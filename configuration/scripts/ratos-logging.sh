#!/bin/bash

# RatOS Structured Logging Library
# Provides JSON-formatted logging compatible with pino for bash scripts

# Load environment
SCRIPT_DIR=$( cd -- "$( dirname -- "$(realpath -- "${BASH_SOURCE[0]}")" )" &> /dev/null && pwd )
source "$SCRIPT_DIR/environment.sh"

# Default log configuration
RATOS_LOG_LEVEL=${RATOS_LOG_LEVEL:-"info"}
RATOS_LOG_FILE=${RATOS_LOG_FILE:-"${RATOS_PRINTER_DATA_DIR}/logs/ratos-update.log"}
RATOS_LOG_MAX_SIZE=${RATOS_LOG_MAX_SIZE:-10485760}  # 10MB
RATOS_LOG_BACKUP_COUNT=${RATOS_LOG_BACKUP_COUNT:-5}

# Ensure log directory exists
mkdir -p "$(dirname "$RATOS_LOG_FILE")"

# Log levels (matching pino levels)
declare -A LOG_LEVELS=(
    ["trace"]=10
    ["debug"]=20
    ["info"]=30
    ["warn"]=40
    ["error"]=50
    ["fatal"]=60
)

# Current log level numeric value
CURRENT_LOG_LEVEL=${LOG_LEVELS[$RATOS_LOG_LEVEL]}

# Get current timestamp in ISO format
get_timestamp() {
    date -u +"%Y-%m-%dT%H:%M:%S.%3NZ"
}

# Get process info
get_process_info() {
    echo "{\"pid\":$$,\"hostname\":\"$(hostname)\"}"
}

# Rotate log file if it exceeds max size
rotate_log_if_needed() {
    if [[ -f "$RATOS_LOG_FILE" ]] && [[ $(stat -f%z "$RATOS_LOG_FILE" 2>/dev/null || stat -c%s "$RATOS_LOG_FILE" 2>/dev/null || echo 0) -gt $RATOS_LOG_MAX_SIZE ]]; then
        # Rotate existing backups
        for ((i=RATOS_LOG_BACKUP_COUNT; i>=1; i--)); do
            if [[ -f "${RATOS_LOG_FILE}.$i" ]]; then
                if [[ $i -eq $RATOS_LOG_BACKUP_COUNT ]]; then
                    rm -f "${RATOS_LOG_FILE}.$i"
                else
                    mv "${RATOS_LOG_FILE}.$i" "${RATOS_LOG_FILE}.$((i+1))"
                fi
            fi
        done

        # Move current log to .1
        mv "$RATOS_LOG_FILE" "${RATOS_LOG_FILE}.1"

        # Create new log file
        touch "$RATOS_LOG_FILE"
        chmod 664 "$RATOS_LOG_FILE"
    fi
}

# Core logging function
log_message() {
    local level="$1"
    local message="$2"
    local context="$3"
    local error_code="$4"
    
    # Check if we should log this level
    local level_value=${LOG_LEVELS[$level]}
    if [[ $level_value -lt $CURRENT_LOG_LEVEL ]]; then
        return 0
    fi
    
    # Rotate log if needed
    rotate_log_if_needed
    
    # Build JSON log entry
    local timestamp
    local process_info
    local escaped_message

    timestamp=$(get_timestamp)
    process_info=$(get_process_info)

    # Escape message for JSON
    escaped_message=$(echo "$message" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | tr '\n' ' ')
    
    # Build context JSON
    local context_json=""
    if [[ -n "$context" ]]; then
        context_json=",\"context\":\"$context\""
    fi
    
    # Build error code JSON
    local error_code_json=""
    if [[ -n "$error_code" ]]; then
        error_code_json=",\"errorCode\":\"$error_code\""
    fi
    
    # Create log entry
    local log_entry
    log_entry="{\"level\":$level_value,\"time\":\"$timestamp\",\"msg\":\"$escaped_message\",\"source\":\"ratos-update\"$context_json$error_code_json,$(echo "$process_info" | sed 's/^{//;s/}$//')}"
    
    # Write to log file
    echo "$log_entry" >> "$RATOS_LOG_FILE"
    
    # Also output to console for immediate feedback
    case $level in
        "error"|"fatal")
            echo -e "\033[31m[$(date '+%H:%M:%S')] ERROR: $message\033[0m" >&2
            ;;
        "warn")
            echo -e "\033[33m[$(date '+%H:%M:%S')] WARN: $message\033[0m" >&2
            ;;
        "info")
            echo -e "\033[32m[$(date '+%H:%M:%S')] INFO: $message\033[0m"
            ;;
        "debug")
            if [[ $RATOS_LOG_LEVEL == "debug" ]]; then
                echo -e "\033[36m[$(date '+%H:%M:%S')] DEBUG: $message\033[0m"
            fi
            ;;
    esac
}

# Convenience logging functions
log_trace() { log_message "trace" "$1" "$2" "$3"; }
log_debug() { log_message "debug" "$1" "$2" "$3"; }
log_info() { log_message "info" "$1" "$2" "$3"; }
log_warn() { log_message "warn" "$1" "$2" "$3"; }
log_error() { log_message "error" "$1" "$2" "$3"; }
log_fatal() { log_message "fatal" "$1" "$2" "$3"; }

# Function to log command execution with error handling
execute_with_logging() {
    local cmd="$1"
    local context="$2"
    local error_code="$3"
    
    log_debug "Executing command: $cmd" "$context"
    
    # Execute command and capture output and exit code
    local output
    local exit_code
    
    output=$(eval "$cmd" 2>&1)
    exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        log_info "Command completed successfully: $cmd" "$context"
        if [[ -n "$output" ]]; then
            log_debug "Command output: $output" "$context"
        fi
    else
        log_error "Command failed with exit code $exit_code: $cmd" "$context" "${error_code:-CMD_FAILED}"
        if [[ -n "$output" ]]; then
            log_error "Command error output: $output" "$context" "${error_code:-CMD_FAILED}"
        fi
    fi
    
    return $exit_code
}

# Function to set up error trapping
setup_error_trap() {
    local context="$1"

    # Enable error trapping but be more selective about exit behavior
    set -E  # Inherit ERR trap to functions and subshells

    trap 'handle_error $? $LINENO "$context"' ERR
}

# Error trap handler
handle_error() {
    local exit_code="$1"
    local line_number="$2"
    local context="$3"
    
    log_fatal "Script failed at line $line_number with exit code $exit_code" "$context" "SCRIPT_ERROR"
    
    # Log stack trace if available
    if declare -f caller > /dev/null; then
        local frame=0
        log_error "Stack trace:" "$context" "SCRIPT_ERROR"
        while caller $frame; do
            ((frame++))
        done 2>&1 | while read -r line; do
            log_error "  $line" "$context" "SCRIPT_ERROR"
        done
    fi

    exit "$exit_code"
}

# Function to log script start
log_script_start() {
    local script_name="$1"
    local version="$2"
    
    log_info "Starting $script_name" "script_lifecycle" "SCRIPT_START"
    if [[ -n "$version" ]]; then
        log_info "Script version: $version" "script_lifecycle"
    fi
    log_info "Log file: $RATOS_LOG_FILE" "script_lifecycle"
    log_info "Log level: $RATOS_LOG_LEVEL" "script_lifecycle"
}

# Function to log script completion
log_script_complete() {
    local script_name="$1"
    local exit_code="${2:-0}"
    
    if [[ $exit_code -eq 0 ]]; then
        log_info "$script_name completed successfully" "script_lifecycle" "SCRIPT_SUCCESS"
    else
        log_error "$script_name completed with errors (exit code: $exit_code)" "script_lifecycle" "SCRIPT_ERROR"
    fi
}

# Function to create a summary of the current log session
create_log_summary() {
    local script_name="$1"
    local start_time="$2"
    local end_time="${3:-$(get_timestamp)}"
    
    # Count log entries by level for this session
    local error_count
    local warn_count
    local info_count

    error_count=$(grep -c '"level":50' "$RATOS_LOG_FILE" 2>/dev/null || echo 0)
    warn_count=$(grep -c '"level":40' "$RATOS_LOG_FILE" 2>/dev/null || echo 0)
    info_count=$(grep -c '"level":30' "$RATOS_LOG_FILE" 2>/dev/null || echo 0)
    
    log_info "Log summary for $script_name:" "script_lifecycle" "SCRIPT_SUMMARY"
    log_info "  Errors: $error_count, Warnings: $warn_count, Info: $info_count" "script_lifecycle" "SCRIPT_SUMMARY"
    log_info "  Duration: $start_time to $end_time" "script_lifecycle" "SCRIPT_SUMMARY"
}

# Export functions for use in other scripts
export -f log_trace log_debug log_info log_warn log_error log_fatal
export -f execute_with_logging setup_error_trap handle_error
export -f log_script_start log_script_complete create_log_summary
