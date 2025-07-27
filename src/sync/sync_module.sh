#!/bin/bash

# ============================================================================
# SIMPLIFIED SYNC MODULE
# ============================================================================
# Clean and simple sync functionality using Unison
# Handles synchronization between local hub and cloud services

set -euo pipefail

export PATH="/opt/homebrew/opt/util-linux/bin:$PATH"

# Get script directory and parent
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"


# Load configuration with defaults
CONFIG_FILE="$PROJECT_DIR/../config/config.env"
if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE"
else
    echo "[ERROR] Config file not found: $CONFIG_FILE" >&2
    exit 1
fi

# Set config defaults if not set
: "${LOG_TO_CONSOLE:=true}"
: "${LOG_TO_FILE:=true}"
: "${SYNC_ENABLED:=true}"
: "${SYNC_HUB:?SYNC_HUB not set in config.env}"
: "${ICLOUD_PATH:?ICLOUD_PATH not set in config.env}"
: "${GOOGLE_DRIVE_PATH:?GOOGLE_DRIVE_PATH not set in config.env}"

# Log rotation (keep last 5 logs, 1MB max)
rotate_log() {
    local logfile="$1"
    if [[ -f "$logfile" && $(wc -c < "$logfile" | awk '{print $1}') -ge 1048576 ]]; then
        for i in 5 4 3 2 1; do
            [[ -f "$logfile.$i" ]] && mv "$logfile.$i" "$logfile.$((i+1))"
        done
        mv "$logfile" "$logfile.1"
        touch "$logfile"
    fi
}

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    if [[ "$LOG_TO_CONSOLE" == "true" ]]; then
        echo "[$timestamp] [$level] $message"
    fi
    
    if [[ "$LOG_TO_FILE" == "true" ]]; then
        mkdir -p "$PROJECT_DIR/logs"
        local logfile="$PROJECT_DIR/logs/sync.log"
        rotate_log "$logfile"
        echo "[$timestamp] [$level] $message" >> "$logfile"
    fi
}

# Check if directory exists and create if needed
ensure_directory() {
    local dir="$1"
    if [[ ! -d "$dir" ]]; then
        log "INFO" "Creating directory: $dir"
        mkdir -p "$dir"
    fi
}

# Check if Unison is available
check_unison() {
    if ! command -v unison >/dev/null 2>&1; then
        log "ERROR" "Unison is not installed. Please install it with: brew install unison"
        return 1
    fi
    return 0
}

# Sync using Unison profile (with dry-run and safe temp file)
sync_with_unison() {
    local profile="$1"
    local dry_run_flag="${2:-false}"
    local profile_path="$PROJECT_DIR/../config/$profile.prf"
    if [[ ! -f "$profile_path" ]]; then
        log "ERROR" "Profile not found: $profile_path"
        return 1
    fi
    log "INFO" "Starting sync with profile: $profile${dry_run_flag:+ (dry-run)}"
    local unison_dir="$HOME/.unison"
    ensure_directory "$unison_dir"
    # Only copy if source is newer
    local dest_profile="$unison_dir/${profile#unison_}.prf"
    if [[ ! -f "$dest_profile" || "$profile_path" -nt "$dest_profile" ]]; then
        cp "$profile_path" "$dest_profile"
    fi
    # Use unique temp file
    local tmpfile="/tmp/unison_output_$$.log"
    local profile_name="${profile#unison_}"
    local unison_args=("$profile_name" -batch -auto)
    [[ "$dry_run_flag" == "true" ]] && unison_args+=( -testserver )
    if unison "${unison_args[@]}" &> "$tmpfile"; then
        log "INFO" "Sync completed successfully: $profile"
        rm -f "$tmpfile"
        return 0
    else
        local unison_error=$(cat "$tmpfile")
        log "ERROR" "Sync failed: $profile. Error: $unison_error"
        rm -f "$tmpfile"
        return 1
    fi
}

# Generic sync service (dynamic, extensible)
sync_service() {
    local service="$1"
    local path_var="$2"
    local profile="$3"
    local dry_run_flag="${4:-false}"
    local path_value="${!path_var}"
    log "INFO" "Starting $service sync"
    ensure_directory "$SYNC_HUB"
    ensure_directory "$path_value"
    if sync_with_unison "$profile" "$dry_run_flag"; then
        log "INFO" "$service sync completed successfully"
        return 0
    else
        log "ERROR" "$service sync failed"
        return 1
    fi
}

# Run all syncs (dynamic, extensible, error reporting)
sync_all() {
    log "INFO" "Starting full sync process"
    if [[ "$SYNC_ENABLED" != "true" ]]; then
        log "WARN" "Sync is disabled in configuration"
        return 0
    fi
    # Check Unison availability
    if ! check_unison; then
        return 1
    fi
    local services=(
        "iCloud:ICLOUD_PATH:unison_icloud"
        "GoogleDrive:GOOGLE_DRIVE_PATH:unison_google_drive"
    )
    local failed=()
    for entry in "${services[@]}"; do
        IFS=":" read -r name pathvar profile <<< "$entry"
        if ! sync_service "$name" "$pathvar" "$profile"; then
            failed+=("$name")
        fi
    done
    if [[ ${#failed[@]} -eq 0 ]]; then
        log "INFO" "All syncs completed successfully"
        return 0
    else
        log "ERROR" "Some syncs failed: ${failed[*]}"
        return 1
    fi
}

# Check sync status (dynamic)
sync_status() {
    log "INFO" "Checking sync status"
    echo "=== Sync Configuration ==="
    echo "Sync Hub: $SYNC_HUB"
    echo "iCloud Path: $ICLOUD_PATH"
    echo "Google Drive Path: $GOOGLE_DRIVE_PATH"
    echo "Sync Enabled: $SYNC_ENABLED"
    echo ""
    echo "=== Directory Status ==="
    for entry in "iCloud:$ICLOUD_PATH" "Google Drive:$GOOGLE_DRIVE_PATH"; do
        IFS=":" read -r name path <<< "$entry"
        echo "$name path exists: $(if [[ -d "$path" ]]; then echo "Yes"; else echo "No"; fi)"
    done
    echo ""
    echo "=== Unison Status ==="
    if command -v unison >/dev/null 2>&1; then
        echo "Unison installed: Yes ($(unison -version | head -1))"
    else
        echo "Unison installed: No"
    fi
}

# Show help
show_help() {
    cat << EOF
Simplified Sync Module

Usage: $0 <command> [options]

Commands:
    all         - Sync all configured services
    icloud      - Sync iCloud only
    gdrive      - Sync Google Drive only
    status      - Show sync configuration and status
    help        - Show this help message

Examples:
    $0 all              # Sync everything
    $0 icloud           # Sync iCloud only
    $0 status           # Check status

Configuration:
    Edit config.env to modify sync settings and paths.

EOF
}

# Main execution
main() {
    case "${1:-help}" in
        "all"|"sync")
            sync_all
            ;;
        "icloud")
            if check_unison; then
                sync_service "iCloud" "ICLOUD_PATH" "unison_icloud"
            fi
            ;;
        "gdrive"|"google-drive")
            if check_unison; then
                sync_service "GoogleDrive" "GOOGLE_DRIVE_PATH" "unison_google_drive"
            fi
            ;;
        "status")
            sync_status
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        *)
            echo "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Locking to prevent concurrent runs
LOCKFILE="/tmp/sync_module.lock"
acquire_lock() {
    exec 200>"$LOCKFILE"
    flock -n 200 || { echo "[ERROR] Another sync is already running." >&2; exit 1; }
}
release_lock() {
    flock -u 200
    rm -f "$LOCKFILE"
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    acquire_lock
    trap release_lock EXIT
    main "$@"
fi
