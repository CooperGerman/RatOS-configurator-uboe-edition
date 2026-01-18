#!/usr/bin/env bash
COMPRESS_BUILD=false
CREATE_DEPLOYMENT_BRANCH=false

# Validate that the script is run from the RatOS-configurator git repo
current_git_repo=$(git rev-parse --show-toplevel 2>/dev/null)
current_dir=$(pwd)
RATOS_CONFIGURATOR_DIR="$(current_dir)"

if [ "$current_dir" != "$current_git_repo" ] && [[ "$current_dir" != *"RatOS-configurator" ]]; then
    echo "Error: this command must be run from the root of the RatOS-configurator git repo"
    exit 1
fi

# Parse command line arguments
while getopts ":zg" opt; do
    case $opt in
        z)
            COMPRESS_BUILD=true
            ;;
        g)
            CREATE_DEPLOYMENT_BRANCH=true
            ;;
        *)
            echo "Usage: $0 [-z] [-g]"
            echo "  -z  Create a gzipped tar archive of the current build"
            echo "  -g  Create deployment branch from the current build"
            exit 1
            ;;
    esac
done

# Array of files and directories to ignore when running rsync
declare -a RSYNC_IGNORE=(
	"__tests__"
	"app"
	"pages"
	"components"
	"coverage"
	"data"
	"helpers"
	"hooks"
	"moonraker"
	"env"
	"recoil"
	"server"
	"utils"
	"zods"
	"test-setup.ts"
	"test-setup-global.ts"
	"vitest.config.mts"
	"tsconfig.vitest.json"
	"copy-files-from-to.json"
	"components.json"
	"postcss.config.js"
	"prettier.config.mjs"
	"tailwind.config.ts"
)

get_configurator_build_id(){
	BUILD_ID_FILE="${RATOS_CONFIGURATOR_DIR}/src/build/BUILD_ID"
	
	if [ -f "$BUILD_ID_FILE" ]; then
		cat "$BUILD_ID_FILE"
	else
		echo "No current build exists on RatOS-configurator/src"
		exit 0
	fi
}

get_artifact_build_directory(){
    local BUILD_ID
    BUILD_ID=$(get_configurator_build_id)
    echo "./artifacts/${BUILD_ID}"
}

create_artifact_build_directory(){
    local BUILD_DIR
    BUILD_DIR=$(get_artifact_build_directory)
    mkdir -p "$BUILD_DIR"
    echo "Created build directory at: $BUILD_DIR"
}

check_required_command() {
    local cmd="$1"
    if ! command -v "$cmd" &> /dev/null; then
        echo "Error: The required command: $cmd is required but not available. Please install"
        exit 1
    fi
}

bundle_app(){
    check_required_command rsync
    local BUNDLE_ARTIFACT_BUILD_DIR="$(get_artifact_build_directory)"
    echo "Bundling RatOS-configurator into: ${BUNDLE_ARTIFACT_BUILD_DIR}"
    mkdir -p "${BUNDLE_ARTIFACT_BUILD_DIR}"
    
    # Build exclude args with src/ prefix since we're syncing from root of repo dir
    local exclude_args=()
    for item in "${RSYNC_IGNORE[@]}"; do
        exclude_args+=("--exclude=src/$item")
    done
    
    # Read .gitignore entries and add them to exclude args
    local gitignore_file="${RATOS_CONFIGURATOR_DIR}/src/.gitignore"
    if [ -f "$gitignore_file" ]; then
        while IFS= read -r line; do
            # Skip empty lines and comments
            [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
            # Remove leading/trailing whitespace
            line=$(echo "$line" | xargs)
            exclude_args+=("--exclude=src/$line")
        done < "$gitignore_file"
    fi

    # exclude the .git directory
    exclude_args+=("--exclude=.git") 

    # Read root .gitignore entries and add them to exclude args
    # Read .gitignore entries and add them to exclude args
    local root_gitignore_file="${RATOS_CONFIGURATOR_DIR}.gitignore"
    if [ -f "$root_gitignore_file" ]; then
        while IFS= read -r line; do
            # Skip empty lines and comments
            [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
            # Remove leading/trailing whitespace
            line=$(echo "$line" | xargs)
            exclude_args+=("--exclude=src/$line")
        done < "$root_gitignore_file"
    fi

    rsync -a --delete "${exclude_args[@]}" "${RATOS_CONFIGURATOR_DIR}/" "${BUNDLE_ARTIFACT_BUILD_DIR}/"
    echo "Bundle completed successfully."
}

compress_build(){
    check_required_command tar
    local BUILD_ID
    BUILD_ID=$(get_configurator_build_id)
    local archive_name="./artifacts/${BUILD_ID}.tar.gz"
    
    echo "Compressing build into: ${archive_name}"
    tar -czvf "${archive_name}" -C "./artifacts" "${BUILD_ID}"
    echo "Build compressed successfully at: ${archive_name}"
}

rename_src_to_app(){
    local BUILD_DIR
    BUILD_DIR=$(get_artifact_build_directory)
    mv "${BUILD_DIR}/src" "${BUILD_DIR}/app"
    echo "Renamed src/ to app/ in build directory."
}

create_deployment_branch(){
    echo "Creating deployment branch..."
}

create_artifact_build_directory
bundle_app
rename_src_to_app

if [ "$COMPRESS_BUILD" = true ]; then
    compress_build
fi

if [ "$CREATE_DEPLOYMENT_BRANCH" = true ]; then
    create_deployment_branch
fi