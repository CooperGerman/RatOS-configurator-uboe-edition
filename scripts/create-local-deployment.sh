#!/usr/bin/env bash
COMPRESS_BUILD=false
CREATE_DEPLOYMENT_BRANCH=false
DEPLOYMENT_BRANCH_SOURCE=""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# RatOS-configurator is the parent directory of the scripts directory
RATOS_CONFIGURATOR_DIR="$(dirname "$SCRIPT_DIR")"
echo "Ratos Configurator Dir: $RATOS_CONFIGURATOR_DIR"

# Validate that the script is run from the RatOS-configurator git repo
current_git_repo=$(git rev-parse --show-toplevel 2>/dev/null)
current_dir=$(pwd)

if [ "$current_dir" != "$current_git_repo" ] && [[ "$current_dir" != *"RatOS-configurator" ]]; then
    echo "Error: this command must be run from the root of the RatOS-configurator git repo"
    exit 1
fi

# Parse command line arguments
while getopts ":zg:" opt; do
    case $opt in
        z)
            COMPRESS_BUILD=true
            ;;
        g)
            CREATE_DEPLOYMENT_BRANCH=true
            DEPLOYMENT_BRANCH_SOURCE="$OPTARG"
            ;;
        *)
            echo "Usage: $0 [-z] [-g branch-name]"
            echo "  -z                 Create a gzipped tar archive of the current build"
            echo "  -g branch-name     Create deployment branch from the specified source branch"
            exit 1
            ;;
    esac
done

# Array of files and directories to ignore from the root when running rsync
declare -a ROOT_RSYNC_IGNORE=(
    ".git"
    "artifacts/"
    "*.log"
    "*.logs"
    "devbox.d/printer_config/"
    "devbox.d/klipper/"
)   
# Array of files and directories to ignore when running rsync
declare -a SRC_RSYNC_IGNORE=(
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
		echo "Error: No current build exists on RatOS-configurator/src" >&2
		return 1
	fi
}

get_artifact_build_directory(){
    local BUILD_ID
    BUILD_ID=$(get_configurator_build_id)
    echo "${RATOS_CONFIGURATOR_DIR}/artifacts/${BUILD_ID}"
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
    for item in "${SRC_RSYNC_IGNORE[@]}"; do
        exclude_args+=("--exclude=src/$item")
    done
    for item in "${ROOT_RSYNC_IGNORE[@]}"; do
        exclude_args+=("--exclude=$item")
    done
    
    # Read src/.gitignore entries and add them to exclude args
    local src_gitignore_file="${RATOS_CONFIGURATOR_DIR}/src/.gitignore"
    if [ -f "$src_gitignore_file" ]; then
        while IFS= read -r line; do
            # Skip empty lines and comments
            [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
            # Remove leading/trailing whitespace
            line=$(echo "$line" | xargs)
            exclude_args+=("--exclude=src/$line")
        done < "$src_gitignore_file"
    fi

    # move all files from RATOS_CONFIGURATOR_DIR to BUNDLE_ARTIFACT_BUILD_DIR
    rsync -a --delete "${exclude_args[@]}" "${RATOS_CONFIGURATOR_DIR}/" "${BUNDLE_ARTIFACT_BUILD_DIR}/"
    echo "Bundle completed successfully."
    echo "Total size of bundle: $(du -sh "${BUNDLE_ARTIFACT_BUILD_DIR}" | cut -f1)"
}

rename_src_to_app(){
    local BUILD_DIR
    BUILD_DIR=$(get_artifact_build_directory)
    mv "${BUILD_DIR}/src" "${BUILD_DIR}/app"
    echo "Renamed src/ to app/ in build directory."
}

compress_build(){
    check_required_command tar
    local BUILD_ID
    BUILD_ID=$(get_configurator_build_id)
    local archive_name="${RATOS_CONFIGURATOR_DIR}/artifacts/${BUILD_ID}.tar.gz"
    
    echo "Compressing build into: ${archive_name}"
    tar -czf "${archive_name}" -C "${RATOS_CONFIGURATOR_DIR}/artifacts" "${BUILD_ID}"
    echo "Build compressed successfully at: ${archive_name}"
}

_is_valid_deployment_branch_source(){
    local branch="$1"
    if [[ "$branch" == *"-deployment" ]]; then
        return 0
    else
        return 1
    fi
}

_strip_remote_reference(){
    local input="$1"
    
    # Check if input contains a forward slash
    if [[ "$input" == */* ]]; then
        # Extract the part before the slash
        local remote="${input%%/*}"
        
        # Get list of remotes from git
        local remotes=$(git remote)
        # Check if remote matches any known remotes
        if echo "$remotes" | grep -q "^${remote}$"; then
            # Return the part after the slash (the branch name)
            echo "${input#*/}"
        else
            # Not a remote reference, return input as is
            echo "$input"
        fi
    else
        echo "$input"
    fi 
}

create_deployment_branch(){
    check_required_command git
    local source_branch="$DEPLOYMENT_BRANCH_SOURCE"
    
    # Validate that source branch ends with -deployment
    if ! _is_valid_deployment_branch_source "$source_branch"; then
        echo "Error: The new deployment branch must be based on an existing deployment branch" >&2
        exit 3
    fi

    local deployment_branch=$(_strip_remote_reference "$source_branch")
    
    # Check if deployment branch already exists
    if git rev-parse --verify "${deployment_branch}" >/dev/null 2>&1; then
        echo "Switching to existing deployment branch: ${deployment_branch}"
        git switch "${deployment_branch}"
    else
        echo "Creating deployment branch: ${deployment_branch} from ${source_branch}"
        git switch -c "${deployment_branch}" "${source_branch}"
    fi

    # unpack the artifacts build directory into the current working directory
    rsync -a --delete "$(get_artifact_build_directory)/" ./
    echo "Deployment branch ${deployment_branch} is ready with the latest build artifacts."
}

# Validate that BUILD_ID file exists before proceeding
get_configurator_build_id > /dev/null || exit 1

create_artifact_build_directory
bundle_app
rename_src_to_app

if [ "$COMPRESS_BUILD" = true ]; then
    compress_build
fi

if [ "$CREATE_DEPLOYMENT_BRANCH" = true ]; then
    create_deployment_branch
fi