#!/bin/bash
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Please run as root"
  exit 1
fi

SCRIPT_DIR=$( cd -- "$( dirname -- "$(realpath -- "${BASH_SOURCE[0]}")" )" &> /dev/null && pwd )
# shellcheck source=configuration/scripts/ratos-common.sh
if [ ! -f "$SCRIPT_DIR/ratos-common.sh" ]; then
  echo "ERROR: ratos-common.sh not found in $SCRIPT_DIR"
  exit 1
fi
source "$SCRIPT_DIR"/ratos-common.sh

# Constants
OFFICIAL_KLIPPER_URL="https://github.com/Klipper3d/klipper.git"
RATOS_FORK_URL="https://github.com/Rat-OS/klipper.git"
RATOS_FORK_REMOTE="ratos-fork"
TARGET_BRANCH="topic/first-layer-experimental"
TARGET_COMMIT="1c96f096fdeea8e2e79237b679ed6fa944fbae5e"

check_klipper_repository()
{
    report_status "Checking Klipper repository configuration..."

    if [ ! -d "$KLIPPER_DIR" ]; then
        echo "ERROR: Klipper directory not found at $KLIPPER_DIR"
        return 2  # Fatal error
    fi

    if [ ! -d "$KLIPPER_DIR/.git" ]; then
        echo "ERROR: Klipper directory is not a git repository"
        return 2  # Fatal error
    fi

    cd "$KLIPPER_DIR" || {
        echo "ERROR: Cannot change to Klipper directory"
        return 2  # Fatal error
    }

    # Check if current origin is the official Klipper repository
    local current_origin
    if ! current_origin=$(git remote get-url origin 2>/dev/null); then
        echo "ERROR: Cannot get origin URL from Klipper repository"
        return 2  # Fatal error
    fi

    # Support both HTTPS and SSH formats
    if [[ "$current_origin" != "$OFFICIAL_KLIPPER_URL" ]] && [[ "$current_origin" != "git@github.com:Klipper3d/klipper.git" ]]; then
        echo "Klipper repository is not using the official source ($current_origin)"
        echo "Migration not needed."
        return 1  # Skip migration
    fi

    echo "Klipper repository is using official source, migration needed."
    return 0
}

check_uncommitted_changes()
{
    report_status "Checking for uncommitted changes..."
    
    cd "$KLIPPER_DIR" || return 1
    
    # Check for staged changes
    if ! git diff --cached --quiet; then
        echo "ERROR: There are staged changes in the Klipper repository."
        echo "Please commit or stash these changes before running migration."
        git diff --cached --name-only
        return 1
    fi
    
    # Check for unstaged changes (ignoring untracked files)
    if ! git diff --quiet; then
        echo "ERROR: There are uncommitted changes in the Klipper repository."
        echo "Please commit or stash these changes before running migration."
        git diff --name-only
        return 1
    fi
    
    echo "No uncommitted changes found."
    return 0
}

handle_existing_remote()
{
    report_status "Checking for existing RatOS fork remote..."
    
    cd "$KLIPPER_DIR" || return 1
    
    # Check if ratos-fork remote already exists
    if git remote get-url "$RATOS_FORK_REMOTE" >/dev/null 2>&1; then
        local existing_url
        existing_url=$(git remote get-url "$RATOS_FORK_REMOTE")
        
        if [ "$existing_url" != "$RATOS_FORK_URL" ]; then
            echo "WARNING: Remote '$RATOS_FORK_REMOTE' exists but points to different URL:"
            echo "  Current: $existing_url"
            echo "  Expected: $RATOS_FORK_URL"
            echo "Updating remote URL..."
            
            if ! git remote set-url "$RATOS_FORK_REMOTE" "$RATOS_FORK_URL"; then
                echo "ERROR: Failed to update remote URL"
                return 1
            fi
            echo "Remote URL updated successfully."
        else
            echo "Remote '$RATOS_FORK_REMOTE' already exists with correct URL."
        fi
    else
        echo "Adding RatOS fork remote..."
        if ! git remote add "$RATOS_FORK_REMOTE" "$RATOS_FORK_URL"; then
            echo "ERROR: Failed to add RatOS fork remote"
            return 1
        fi
        echo "RatOS fork remote added successfully."
    fi
    
    return 0
}

fetch_ratos_fork()
{
    report_status "Fetching from RatOS fork..."
    
    cd "$KLIPPER_DIR" || return 1
    
    # Attempt to fetch with retries
    local max_retries=3
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        if git fetch "$RATOS_FORK_REMOTE"; then
            echo "Successfully fetched from RatOS fork."
            return 0
        else
            retry_count=$((retry_count + 1))
            echo "Fetch attempt $retry_count failed."
            if [ $retry_count -lt $max_retries ]; then
                echo "Retrying in 5 seconds..."
                sleep 5
            fi
        fi
    done
    
    echo "ERROR: Failed to fetch from RatOS fork after $max_retries attempts"
    echo "Please check your network connection and try again."
    return 1
}

checkout_target_branch()
{
    report_status "Checking out target branch..."
    
    cd "$KLIPPER_DIR" || return 1
    
    # Check if we're in detached HEAD state
    if ! git symbolic-ref HEAD >/dev/null 2>&1; then
        echo "Repository is in detached HEAD state."
        echo "Creating and checking out a temporary branch..."
        if ! git checkout -b "temp-migration-$(date +%s)-$$"; then
            echo "ERROR: Failed to create temporary branch"
            return 1
        fi
    fi
    
    # Check if target branch already exists locally
    if git show-ref --verify --quiet "refs/heads/$TARGET_BRANCH"; then
        echo "Local branch '$TARGET_BRANCH' already exists, switching to it..."
        if ! git checkout "$TARGET_BRANCH"; then
            echo "ERROR: Failed to checkout existing branch '$TARGET_BRANCH'"
            return 1
        fi
    else
        echo "Creating and checking out branch '$TARGET_BRANCH' from RatOS fork..."
        if ! git checkout -b "$TARGET_BRANCH" "$RATOS_FORK_REMOTE/$TARGET_BRANCH"; then
            echo "ERROR: Failed to checkout branch '$TARGET_BRANCH' from RatOS fork"
            echo "Please ensure the branch exists on the remote repository."
            return 1
        fi
    fi
    
    echo "Successfully checked out branch '$TARGET_BRANCH'."
    return 0
}

reset_to_target_commit()
{
    report_status "Resetting to target commit..."
    
    cd "$KLIPPER_DIR" || return 1
    
    # Verify the target commit exists
    if ! git cat-file -e "$TARGET_COMMIT" 2>/dev/null; then
        echo "ERROR: Target commit '$TARGET_COMMIT' not found in repository"
        echo "Please ensure the commit exists and try again."
        return 1
    fi
    
    # Reset to target commit
    if ! git reset --hard "$TARGET_COMMIT"; then
        echo "ERROR: Failed to reset to target commit '$TARGET_COMMIT'"
        return 1
    fi
    
    echo "Successfully reset to commit '$TARGET_COMMIT'."
    
    # Set upstream tracking
    if ! git branch --set-upstream-to="$RATOS_FORK_REMOTE/$TARGET_BRANCH" "$TARGET_BRANCH"; then
        echo "WARNING: Failed to set upstream tracking, but migration completed successfully."
    else
        echo "Upstream tracking set to '$RATOS_FORK_REMOTE/$TARGET_BRANCH'."
    fi
    
    return 0
}

fix_klipper_ownership()
{
    report_status "Ensuring Klipper directory ownership..."
    
    if [ -n "$(find "$KLIPPER_DIR" \! -user "$RATOS_USERNAME" -o \! -group "$RATOS_USERGROUP" -quit)" ]; then
        chown -R "$RATOS_USERNAME:$RATOS_USERGROUP" "$KLIPPER_DIR"
        echo "Klipper directory ownership has been set to $RATOS_USERNAME:$RATOS_USERGROUP."
    else
        echo "Klipper directory ownership already set correctly."
    fi
}

migrate_klipper_repository()
{
    report_status "Starting Klipper repository migration to RatOS fork..."

    # Check if migration is needed
    local check_result
    check_klipper_repository
    check_result=$?

    if [ $check_result -eq 1 ]; then
        # Migration not needed (safe skip)
        return 0
    elif [ $check_result -eq 2 ]; then
        # Fatal error occurred
        echo "ERROR: Fatal error during repository check"
        return 2
    fi

    # Check for uncommitted changes
    check_uncommitted_changes
    code=$?
    if [ $code -ne 0 ]; then
        echo "ERROR: Uncommitted changes prevent migration (exit code $code)"
        return 3
    fi

    # Handle existing remote
    handle_existing_remote
    code=$?
    if [ $code -ne 0 ]; then
        echo "ERROR: Failed to handle existing remote (exit code $code)"
        return 4
    fi

    # Fetch from RatOS fork
    fetch_ratos_fork
    code=$?
    if [ $code -ne 0 ]; then
        echo "ERROR: Failed to fetch from RatOS fork (exit code $code)"
        return 5
    fi

    # Checkout target branch
    checkout_target_branch
    code=$?
    if [ $code -ne 0 ]; then
        echo "ERROR: Failed to checkout target branch (exit code $code)"
        return 6
    fi

    # Reset to target commit
    reset_to_target_commit
    code=$?
    if [ $code -ne 0 ]; then
        echo "ERROR: Failed to reset to target commit (exit code $code)"
        return 7
    fi

    # Fix ownership
    fix_klipper_ownership

    report_status "Klipper repository migration completed successfully!"
    echo "Repository is now using RatOS fork at commit $TARGET_COMMIT"
    echo "Branch: $TARGET_BRANCH"
    echo "Remote: $RATOS_FORK_URL"

    return 0
}

# Main execution
migrate_klipper_repository
code=$?
if [ $code -ne 0 ]; then
    echo "ERROR: Klipper repository migration failed (exit code $code)!"
    exit $code
fi
