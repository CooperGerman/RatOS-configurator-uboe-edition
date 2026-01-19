#!/usr/bin/env bash
PNPM_WORKDIR=""

_ratos_configuration_dir=$(git rev-parse --show-toplevel 2>/dev/null)
# if in _ratos_configuration_dir,then ensure the repository is RatOS-configurator
if [[ -z "$_ratos_configuration_dir" ]] || [[ ! "$_ratos_configuration_dir" == *"RatOS-configurator" ]]; then
 echo "Error: not a RatOS-configurator git repo" >&2
 exit 1
fi

# sanitize branch name for use in directory names
_sanitize_branch_name(){
    local branch_name="$1"
    # Replace slashes with hyphens
    echo "${branch_name//\//-}"
}

# This will create a git worktree for the branch being worked
# on in the same parent folder as the repo
make_or_use_worktree(){
    local _worktree_artifacts_dir # Base dir to hold deployment worktrees for branches
    local _worktree_add_path # Full path to add the worktree
    local _current_branch # Current git branch name

    _worktree_artifacts_dir="$(dirname "$_ratos_configuration_dir")/configurator-deployment-worktrees"

    _current_branch=$(git branch --show-current)
    _worktree_add_path="${_worktree_artifacts_dir}/$(_sanitize_branch_name "${_current_branch}")-deployment"

    git worktree add "$_worktree_add_path" 2>/dev/null || {
        echo "Using existing worktree at: $_worktree_add_path"
    }

}

_is_cmd() {
    local cmd="$1"
    if ! command -v "$cmd" &> /dev/null; then
        echo "Error: The required command: $cmd is required but not available. Please install"
        exit 1
    fi
}

_pnpm_install() {
    _is_cmd pnpm
    sleep 2
    echo "Running pnpm install..."
}

build_app(){
    echo "Building RatOS-configurator app..."
    # Placeholder for actual build commands
    _pnpm_install
    echo "Build complete."
}


make_or_use_worktree
build_app
echo "Deployment branch created!"