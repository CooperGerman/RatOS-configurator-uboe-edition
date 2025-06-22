#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR=$( cd -- "$( dirname -- "$(realpath -- "${BASH_SOURCE[0]}")" )" &> /dev/null && pwd )

# Source logging library first
# shellcheck source=configuration/scripts/ratos-logging.sh
if [ ! -f "$SCRIPT_DIR/ratos-logging.sh" ]; then
  echo "ERROR: ratos-logging.sh not found in $SCRIPT_DIR"
  exit 1
fi
# shellcheck disable=SC1091
source "$SCRIPT_DIR"/ratos-logging.sh

# Set up error trapping and logging
setup_error_trap "klipper-fork-migration"
START_TIME=$(get_timestamp)

# Log script start
log_script_start "klipper-fork-migration.sh" "1.0.0"

# Check if running as root (after logging is available)
if [ "$EUID" -ne 0 ]; then
  log_fatal "Please run as root" "script_init" "PERMISSION_DENIED"
  exit 1
fi

# shellcheck source=configuration/scripts/ratos-common.sh
if [ ! -f "$SCRIPT_DIR/ratos-common.sh" ]; then
  log_fatal "ratos-common.sh not found in $SCRIPT_DIR" "script_init" "FILE_NOT_FOUND"
  exit 1
fi
# shellcheck disable=SC1091
source "$SCRIPT_DIR"/ratos-common.sh

# Required environment variables (sourced from ratos-common.sh -> environment.sh):
# - KLIPPER_DIR: Path to the Klipper installation directory
# - RATOS_USERNAME: RatOS system user for file ownership
# - RATOS_USERGROUP: RatOS system group for file ownership
# These variables are loaded from ~/.ratos.env.system or ~/.ratos.env

# Validate required environment variables
if [ -z "${KLIPPER_DIR:-}" ]; then
    log_fatal "KLIPPER_DIR environment variable is not set. This should be defined in ~/.ratos.env.system" "script_init" "ENV_VAR_MISSING"
    exit 1
fi

if [ -z "${RATOS_USERNAME:-}" ]; then
    log_fatal "RATOS_USERNAME environment variable is not set. This should be defined in ~/.ratos.env.system" "script_init" "ENV_VAR_MISSING"
    exit 1
fi

if [ -z "${RATOS_USERGROUP:-}" ]; then
    log_fatal "RATOS_USERGROUP environment variable is not set. This should be defined in ~/.ratos.env.system" "script_init" "ENV_VAR_MISSING"
    exit 1
fi

# Additional validation for KLIPPER_DIR path existence and accessibility
if [ ! -d "$KLIPPER_DIR" ]; then
    log_fatal "KLIPPER_DIR path does not exist: $KLIPPER_DIR" "script_init" "KLIPPER_DIR_NOT_FOUND"
    exit 1
fi

if [ ! -r "$KLIPPER_DIR" ] || [ ! -x "$KLIPPER_DIR" ]; then
    log_fatal "KLIPPER_DIR path is not accessible: $KLIPPER_DIR" "script_init" "KLIPPER_DIR_ACCESS_FAILED"
    exit 1
fi

# Validate that RATOS_USERNAME exists on the system
if ! id "$RATOS_USERNAME" >/dev/null 2>&1; then
    log_fatal "RATOS_USERNAME user does not exist on system: $RATOS_USERNAME" "script_init" "USER_NOT_FOUND"
    exit 1
fi

# Validate that RATOS_USERGROUP exists on the system
if ! getent group "$RATOS_USERGROUP" >/dev/null 2>&1; then
    log_fatal "RATOS_USERGROUP group does not exist on system: $RATOS_USERGROUP" "script_init" "GROUP_NOT_FOUND"
    exit 1
fi

# Migration constants (readonly to prevent accidental modification)
readonly OFFICIAL_KLIPPER_URL="https://github.com/Klipper3d/klipper.git"
readonly RATOS_FORK_URL="https://github.com/Rat-OS/klipper.git"
readonly RATOS_FORK_REMOTE="ratos-fork"
readonly TARGET_BRANCH="topic/first-layer-experimental"
readonly TARGET_COMMIT="1c96f096fdeea8e2e79237b679ed6fa944fbae5e"

check_klipper_repository()
{
    log_info "Checking Klipper repository configuration..." "check_repository"

    if [ ! -d "$KLIPPER_DIR" ]; then
        log_error "Klipper directory not found at $KLIPPER_DIR" "check_repository" "KLIPPER_DIR_NOT_FOUND"
        return 2  # Fatal error
    fi

    if [ ! -d "$KLIPPER_DIR/.git" ]; then
        log_error "Klipper directory is not a git repository" "check_repository" "KLIPPER_NOT_GIT_REPO"
        return 2  # Fatal error
    fi

    cd "$KLIPPER_DIR" || {
        log_error "Cannot change to Klipper directory" "check_repository" "KLIPPER_DIR_ACCESS_FAILED"
        return 2  # Fatal error
    }

    # Check if current origin is the official Klipper repository
    local current_origin
    if ! current_origin=$(git remote get-url origin 2>/dev/null); then
        log_error "Cannot get origin URL from Klipper repository" "check_repository" "GIT_REMOTE_URL_FAILED"
        return 2  # Fatal error
    fi

    # Support both HTTPS and SSH formats
    if [[ "$current_origin" != "$OFFICIAL_KLIPPER_URL" ]] && [[ "$current_origin" != "git@github.com:Klipper3d/klipper.git" ]]; then
        log_info "Klipper repository is not using the official source ($current_origin)" "check_repository"
        log_info "Migration not needed." "check_repository"
        return 1  # Skip migration
    fi

    log_info "Klipper repository is using official source, migration needed." "check_repository"
    return 0
}

check_uncommitted_changes()
{
    log_info "Checking for uncommitted changes..." "check_changes"

    cd "$KLIPPER_DIR" || {
        log_error "Cannot change to Klipper directory" "check_changes" "KLIPPER_DIR_ACCESS_FAILED"
        return 1
    }

    # Check for staged changes (index vs HEAD) using Git plumbing commands
    if ! git diff-index --cached --quiet HEAD --; then
        log_error "There are staged changes in the Klipper repository." "check_changes" "KLIPPER_STAGED_CHANGES"
        log_error "Please commit or stash these changes before running migration." "check_changes" "KLIPPER_STAGED_CHANGES"

        # Get list of staged files for error reporting
        local staged_files
        staged_files=$(git diff-index --cached --name-only HEAD -- | tr '\n' ' ')
        log_error "Staged files: $staged_files" "check_changes" "KLIPPER_STAGED_CHANGES"
        return 1
    fi

    # Check for unstaged changes (working directory vs index) using Git plumbing commands
    if ! git diff-index --quiet HEAD --; then
        log_error "There are uncommitted changes in the Klipper repository." "check_changes" "KLIPPER_UNCOMMITTED_CHANGES"
        log_error "Please commit or stash these changes before running migration." "check_changes" "KLIPPER_UNCOMMITTED_CHANGES"

        # Get list of modified files for error reporting
        local modified_files
        modified_files=$(git diff-index --name-only HEAD -- | tr '\n' ' ')
        log_error "Modified files: $modified_files" "check_changes" "KLIPPER_UNCOMMITTED_CHANGES"
        return 1
    fi

    log_info "No uncommitted changes found." "check_changes"
    return 0
}

handle_existing_remote()
{
    log_info "Checking for existing RatOS fork remote..." "handle_remote"

    cd "$KLIPPER_DIR" || {
        log_error "Cannot change to Klipper directory" "handle_remote" "KLIPPER_DIR_ACCESS_FAILED"
        return 1
    }

    # Cache the remote URL to avoid multiple git subprocess calls
    local existing_url
    existing_url=$(git remote get-url "$RATOS_FORK_REMOTE" 2>/dev/null)

    # Check if ratos-fork remote already exists
    if [ -n "$existing_url" ]; then
        if [ "$existing_url" != "$RATOS_FORK_URL" ]; then
            log_warn "Remote '$RATOS_FORK_REMOTE' exists but points to different URL:" "handle_remote" "REMOTE_URL_MISMATCH"
            log_warn "  Current: $existing_url" "handle_remote" "REMOTE_URL_MISMATCH"
            log_warn "  Expected: $RATOS_FORK_URL" "handle_remote" "REMOTE_URL_MISMATCH"
            log_info "Updating remote URL..." "handle_remote"

            if ! execute_with_logging git remote set-url "$RATOS_FORK_REMOTE" "$RATOS_FORK_URL" "handle_remote" "GIT_REMOTE_UPDATE_FAILED"; then
                log_error "Failed to update remote URL" "handle_remote" "GIT_REMOTE_UPDATE_FAILED"
                return 1
            fi
            log_info "Remote URL updated successfully." "handle_remote"
        else
            log_info "Remote '$RATOS_FORK_REMOTE' already exists with correct URL." "handle_remote"
        fi
    else
        log_info "Adding RatOS fork remote..." "handle_remote"
        if ! execute_with_logging git remote add "$RATOS_FORK_REMOTE" "$RATOS_FORK_URL" "handle_remote" "GIT_REMOTE_ADD_FAILED"; then
            log_error "Failed to add RatOS fork remote" "handle_remote" "GIT_REMOTE_ADD_FAILED"
            return 1
        fi
        log_info "RatOS fork remote added successfully." "handle_remote"
    fi

    return 0
}

fetch_ratos_fork()
{
    log_info "Fetching from RatOS fork..." "fetch_fork"

    cd "$KLIPPER_DIR" || {
        log_error "Cannot change to Klipper directory" "fetch_fork" "KLIPPER_DIR_ACCESS_FAILED"
        return 1
    }

    # Attempt to fetch with retries
    local max_retries=3
    local retry_count=0

    while [ $retry_count -lt $max_retries ]; do
        if execute_with_logging git fetch "$RATOS_FORK_REMOTE" "fetch_fork" "GIT_FETCH_FAILED"; then
            log_info "Successfully fetched from RatOS fork." "fetch_fork"
            return 0
        else
            retry_count=$((retry_count + 1))
            log_warn "Fetch attempt $retry_count failed." "fetch_fork" "GIT_FETCH_RETRY"
            if [ $retry_count -lt $max_retries ]; then
                log_info "Retrying in 5 seconds..." "fetch_fork"
                sleep 5
            fi
        fi
    done

    log_error "Failed to fetch from RatOS fork after $max_retries attempts" "fetch_fork" "GIT_FETCH_FAILED"
    log_error "Please check your network connection and try again." "fetch_fork" "NETWORK_ERROR"
    return 1
}

checkout_target_branch()
{
    log_info "Checking out target branch..." "checkout_branch"

    cd "$KLIPPER_DIR" || {
        log_error "Cannot change to Klipper directory" "checkout_branch" "KLIPPER_DIR_ACCESS_FAILED"
        return 1
    }

    # Track if we created a temporary branch for cleanup
    local temp_branch=""
    local created_temp_branch=false

    # Local cleanup function for temporary branches
    # shellcheck disable=SC2317  # Function is called by EXIT trap
    cleanup_temp_branch() {
        local exit_code=$?
        # Only cleanup on error exits (non-zero), not on successful completion
        if [ "$exit_code" -ne 0 ] && [ "$created_temp_branch" = true ] && [ -n "$temp_branch" ]; then
            log_info "Cleaning up temporary migration branch due to error: $temp_branch" "checkout_branch"
            if git branch -D "$temp_branch" >/dev/null 2>&1; then
                log_info "Successfully cleaned up temporary branch: $temp_branch" "checkout_branch" "GIT_TEMP_BRANCH_CLEANUP"
            else
                log_warn "Failed to clean up temporary branch: $temp_branch (this is not critical)" "checkout_branch" "GIT_TEMP_BRANCH_CLEANUP_FAILED"
            fi
        fi
    }

    # Set up local EXIT trap for cleanup
    trap cleanup_temp_branch EXIT

    # Check if we're in detached HEAD state
    if ! git symbolic-ref HEAD >/dev/null 2>&1; then
        log_info "Repository is in detached HEAD state." "checkout_branch"
        log_info "Creating and checking out a temporary branch..." "checkout_branch"
        temp_branch="temp-migration-$(date +%s)-$$"
        if ! execute_with_logging git checkout -b "$temp_branch" "checkout_branch" "GIT_TEMP_BRANCH_FAILED"; then
            log_error "Failed to create temporary branch" "checkout_branch" "GIT_TEMP_BRANCH_FAILED"
            return 1
        fi
        created_temp_branch=true
    fi

    # Check if target branch already exists locally
    if git show-ref --verify --quiet "refs/heads/$TARGET_BRANCH"; then
        log_info "Local branch '$TARGET_BRANCH' already exists, switching to it..." "checkout_branch"
        if ! execute_with_logging git checkout "$TARGET_BRANCH" "checkout_branch" "GIT_CHECKOUT_FAILED"; then
            log_error "Failed to checkout existing branch '$TARGET_BRANCH'" "checkout_branch" "GIT_CHECKOUT_FAILED"
            return 1
        fi
    else
        log_info "Creating and checking out branch '$TARGET_BRANCH' from RatOS fork..." "checkout_branch"
        if ! execute_with_logging git checkout -b "$TARGET_BRANCH" "$RATOS_FORK_REMOTE/$TARGET_BRANCH" "checkout_branch" "GIT_CHECKOUT_REMOTE_FAILED"; then
            log_error "Failed to checkout branch '$TARGET_BRANCH' from RatOS fork" "checkout_branch" "GIT_CHECKOUT_REMOTE_FAILED"
            log_error "Please ensure the branch exists on the remote repository." "checkout_branch" "GIT_CHECKOUT_REMOTE_FAILED"
            return 1
        fi
    fi

    # Clean up temporary branch if we created one (successful completion)
    if [ "$created_temp_branch" = true ] && [ -n "$temp_branch" ]; then
        log_info "Cleaning up temporary migration branch: $temp_branch" "checkout_branch"
        if execute_with_logging git branch -D "$temp_branch" "checkout_branch" "GIT_TEMP_BRANCH_CLEANUP"; then
            log_info "Successfully cleaned up temporary branch: $temp_branch" "checkout_branch"
        else
            log_warn "Failed to clean up temporary branch: $temp_branch (this is not critical)" "checkout_branch" "GIT_TEMP_BRANCH_CLEANUP_FAILED"
        fi
    fi

    # Clear the EXIT trap since we're completing successfully
    trap - EXIT

    log_info "Successfully checked out branch '$TARGET_BRANCH'." "checkout_branch"
    return 0
}

reset_to_target_commit()
{
    log_info "Resetting to target commit..." "reset_commit"

    cd "$KLIPPER_DIR" || {
        log_error "Cannot change to Klipper directory" "reset_commit" "KLIPPER_DIR_ACCESS_FAILED"
        return 1
    }

    # Verify the target commit exists
    if ! git cat-file -e "$TARGET_COMMIT" 2>/dev/null; then
        log_error "Target commit '$TARGET_COMMIT' not found in repository" "reset_commit" "GIT_COMMIT_NOT_FOUND"
        log_error "Please ensure the commit exists and try again." "reset_commit" "GIT_COMMIT_NOT_FOUND"
        return 1
    fi

    # Reset to target commit
    if ! execute_with_logging git reset --hard "$TARGET_COMMIT" "reset_commit" "GIT_RESET_FAILED"; then
        log_error "Failed to reset to target commit '$TARGET_COMMIT'" "reset_commit" "GIT_RESET_FAILED"
        return 1
    fi

    log_info "Successfully reset to commit '$TARGET_COMMIT'." "reset_commit"

    # Set upstream tracking
    if ! execute_with_logging git branch --set-upstream-to="$RATOS_FORK_REMOTE/$TARGET_BRANCH" "$TARGET_BRANCH" "reset_commit" "GIT_UPSTREAM_SET_FAILED"; then
        log_warn "Failed to set upstream tracking, but migration completed successfully." "reset_commit" "GIT_UPSTREAM_SET_FAILED"
    else
        log_info "Upstream tracking set to '$RATOS_FORK_REMOTE/$TARGET_BRANCH'." "reset_commit"
    fi

    return 0
}

fix_klipper_ownership()
{
    log_info "Ensuring Klipper directory ownership..." "fix_ownership"

    if [ -n "$(find "$KLIPPER_DIR" \! -user "$RATOS_USERNAME" -o \! -group "$RATOS_USERGROUP" -quit)" ]; then
        if execute_with_logging chown -R "$RATOS_USERNAME:$RATOS_USERGROUP" "$KLIPPER_DIR" "fix_ownership" "OWNERSHIP_CHANGE_FAILED"; then
            log_info "Klipper directory ownership has been set to $RATOS_USERNAME:$RATOS_USERGROUP." "fix_ownership"
        else
            log_error "Failed to set Klipper directory ownership" "fix_ownership" "OWNERSHIP_CHANGE_FAILED"
            return 1
        fi
    else
        log_info "Klipper directory ownership already set correctly." "fix_ownership"
    fi

    return 0
}

migrate_klipper_repository()
{
    log_info "Starting Klipper repository migration to RatOS fork..." "migrate_repository"

    # Check if migration is needed
    local check_result
    check_klipper_repository
    check_result=$?

    if [ $check_result -eq 1 ]; then
        # Migration not needed (safe skip)
        log_info "Migration not needed, skipping." "migrate_repository"
        return 0
    elif [ $check_result -eq 2 ]; then
        # Fatal error occurred
        log_error "Fatal error during repository check" "migrate_repository" "REPOSITORY_CHECK_FAILED"
        return 2
    fi

    # Check for uncommitted changes
    local code
    check_uncommitted_changes
    code=$?
    if [ $code -ne 0 ]; then
        log_error "Uncommitted changes prevent migration (exit code $code)" "migrate_repository" "KLIPPER_UNCOMMITTED_CHANGES"
        return 3
    fi

    # Handle existing remote
    handle_existing_remote
    code=$?
    if [ $code -ne 0 ]; then
        log_error "Failed to handle existing remote (exit code $code)" "migrate_repository" "REMOTE_SETUP_FAILED"
        return 4
    fi

    # Fetch from RatOS fork
    fetch_ratos_fork
    code=$?
    if [ $code -ne 0 ]; then
        log_error "Failed to fetch from RatOS fork (exit code $code)" "migrate_repository" "FETCH_FAILED"
        return 5
    fi

    # Checkout target branch
    checkout_target_branch
    code=$?
    if [ $code -ne 0 ]; then
        log_error "Failed to checkout target branch (exit code $code)" "migrate_repository" "CHECKOUT_FAILED"
        return 6
    fi

    # Reset to target commit
    reset_to_target_commit
    code=$?
    if [ $code -ne 0 ]; then
        log_error "Failed to reset to target commit (exit code $code)" "migrate_repository" "RESET_FAILED"
        return 7
    fi

    # Fix ownership
    fix_klipper_ownership
    code=$?
    if [ $code -ne 0 ]; then
        log_error "Failed to fix ownership (exit code $code)" "migrate_repository" "OWNERSHIP_FAILED"
        return 8
    fi

    log_info "Klipper repository migration completed successfully!" "migrate_repository"
    log_info "Repository is now using RatOS fork at commit $TARGET_COMMIT" "migrate_repository"
    log_info "Branch: $TARGET_BRANCH" "migrate_repository"
    log_info "Remote: $RATOS_FORK_URL" "migrate_repository"

    return 0
}

# Main execution
migrate_klipper_repository
code=$?

# Create log summary and complete
create_log_summary "klipper-fork-migration.sh" "$START_TIME"
log_script_complete "klipper-fork-migration.sh" "$code"

if [ $code -ne 0 ]; then
    log_error "Klipper repository migration failed (exit code $code)!" "main" "KLIPPER_MIGRATION_FAILED"
    exit $code
fi

log_info "Klipper repository migration script completed successfully" "main"
exit 0
