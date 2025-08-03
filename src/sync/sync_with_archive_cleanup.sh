#!/bin/bash

# ============================================================================
# SYNC WITH ARCHIVE CLEANUP
# ============================================================================
# Enhanced sync functionality that includes archive cleanup before syncing
# This demonstrates integration of the archive manager with the sync system

set -euo pipefail

# Get script directory and navigate to main project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Source the main sync module
source "$SCRIPT_DIR/sync_module.sh"

# Enhanced logging function for archive cleanup
log_archive() {
    local level="$1"
    shift
    local message="$*"
    log "$level" "[ARCHIVE_CLEANUP] $message"
}

# Function to run archive cleanup before sync
cleanup_archives_before_sync() {
    local profile="$1"
    local dry_run="${2:-false}"
    
    log_archive "INFO" "Running archive cleanup for profile: $profile"
    
    # Run the archive manager
    local archive_manager="$SCRIPT_DIR/archive_manager.js"
    
    if [[ ! -f "$archive_manager" ]]; then
        log_archive "ERROR" "Archive manager not found: $archive_manager"
        return 1
    fi
    
    # First, get a summary of the current state
    log_archive "INFO" "Getting archive cleanup summary..."
    local summary_output
    if ! summary_output=$(node "$archive_manager" summary 2>&1); then
        log_archive "ERROR" "Failed to get archive summary: $summary_output"
        return 1
    fi
    
    # Parse the summary to check if cleanup is needed
    local corrupted_count
    corrupted_count=$(echo "$summary_output" | grep -o '"corruptedCount": [0-9]*' | grep -o '[0-9]*' || echo "0")
    
    if [[ "$corrupted_count" -eq 0 ]]; then
        log_archive "INFO" "No corrupted archives found, proceeding with sync"
        return 0
    fi
    
    log_archive "WARN" "Found $corrupted_count corrupted archives"
    
    # Run cleanup (dry run first if requested)
    if [[ "$dry_run" == "true" ]]; then
        log_archive "INFO" "Running dry-run archive cleanup..."
        local cleanup_output
        if ! cleanup_output=$(node "$archive_manager" cleanup "$profile" --dry-run 2>&1); then
            log_archive "ERROR" "Dry-run archive cleanup failed: $cleanup_output"
            return 1
        fi
        log_archive "INFO" "Dry-run cleanup completed successfully"
        return 0
    else
        log_archive "INFO" "Running actual archive cleanup..."
        local cleanup_output
        if ! cleanup_output=$(node "$archive_manager" cleanup "$profile" 2>&1); then
            log_archive "ERROR" "Archive cleanup failed: $cleanup_output"
            return 1
        fi
        log_archive "INFO" "Archive cleanup completed successfully"
    fi
    
    return 0
}

# Enhanced sync function with archive cleanup
sync_with_cleanup() {
    local service="$1"
    local path_var="$2"
    local profile="$3"
    local dry_run_flag="${4:-false}"
    
    log "INFO" "Starting enhanced sync with archive cleanup for $service"
    
    # Run archive cleanup first
    if ! cleanup_archives_before_sync "$profile" "$dry_run_flag"; then
        log "ERROR" "Archive cleanup failed for $service, aborting sync"
        return 1
    fi
    
    # If this is a dry run, don't proceed with actual sync
    if [[ "$dry_run_flag" == "true" ]]; then
        log "INFO" "Dry run completed for $service (archive cleanup only)"
        return 0
    fi
    
    # Proceed with normal sync
    local path_value="${!path_var}"
    log "INFO" "Starting $service sync after archive cleanup"
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

# Enhanced sync all function with archive cleanup
sync_all_with_cleanup() {
    local dry_run_flag="${1:-false}"
    
    log "INFO" "Starting full sync process with archive cleanup"
    
    if [[ "$SYNC_ENABLED" != "true" ]]; then
        log "WARN" "Sync is disabled in configuration"
        return 0
    fi
    
    # Check Unison availability
    if ! check_unison; then
        return 1
    fi
    
    local services=(
        "iCloud:ICLOUD_PATH:icloud"
        "GoogleDrive:GOOGLE_DRIVE_PATH:google_drive"
    )
    
    local failed=()
    
    for entry in "${services[@]}"; do
        IFS=":" read -r name pathvar profile <<< "$entry"
        if ! sync_with_cleanup "$name" "$pathvar" "$profile" "$dry_run_flag"; then
            failed+=("$name")
        fi
    done
    
    if [[ ${#failed[@]} -eq 0 ]]; then
        log "INFO" "All syncs with cleanup completed successfully"
        return 0
    else
        log "ERROR" "Some syncs failed: ${failed[*]}"
        return 1
    fi
}

# Archive management commands
archive_status() {
    log "INFO" "Checking archive status"
    
    local archive_manager="$SCRIPT_DIR/archive_manager.js"
    
    if [[ ! -f "$archive_manager" ]]; then
        log "ERROR" "Archive manager not found: $archive_manager"
        return 1
    fi
    
    echo "=== Archive Status ==="
    node "$archive_manager" summary
}

archive_cleanup() {
    local profile="${1:-}"
    local dry_run_flag="${2:-false}"
    
    log "INFO" "Running archive cleanup${profile:+ for profile: $profile}"
    
    local archive_manager="$SCRIPT_DIR/archive_manager.js"
    
    if [[ ! -f "$archive_manager" ]]; then
        log "ERROR" "Archive manager not found: $archive_manager"
        return 1
    fi
    
    local args=("cleanup")
    [[ -n "$profile" ]] && args+=("$profile")
    [[ "$dry_run_flag" == "true" ]] && args+=("--dry-run")
    
    node "$archive_manager" "${args[@]}"
}

# Enhanced help function
show_enhanced_help() {
    cat << EOF
Enhanced Sync Module with Archive Cleanup

Usage: $0 <command> [options]

Sync Commands:
    all-clean       - Sync all services with archive cleanup
    icloud-clean    - Sync iCloud with archive cleanup
    gdrive-clean    - Sync Google Drive with archive cleanup
    
Archive Commands:
    archive-status  - Show archive cleanup status
    archive-cleanup [profile] [--dry-run] - Clean up corrupted archives
    
Standard Commands:
    all             - Sync all configured services (without cleanup)
    icloud          - Sync iCloud only (without cleanup)
    gdrive          - Sync Google Drive only (without cleanup)
    status          - Show sync configuration and status
    help            - Show this help message

Options:
    --dry-run       - Show what would be done without making changes

Examples:
    $0 all-clean                    # Sync everything with archive cleanup
    $0 icloud-clean                 # Sync iCloud with archive cleanup
    $0 archive-status               # Check archive status
    $0 archive-cleanup --dry-run    # Preview archive cleanup
    $0 archive-cleanup icloud       # Clean up iCloud archives

Configuration:
    Edit config.env to modify sync settings and paths.

EOF
}

# Enhanced main execution
enhanced_main() {
    case "${1:-help}" in
        "all-clean")
            sync_all_with_cleanup
            ;;
        "icloud-clean")
            if check_unison; then
                sync_with_cleanup "iCloud" "ICLOUD_PATH" "icloud"
            fi
            ;;
        "gdrive-clean"|"google-drive-clean")
            if check_unison; then
                sync_with_cleanup "GoogleDrive" "GOOGLE_DRIVE_PATH" "google_drive"
            fi
            ;;
        "archive-status")
            archive_status
            ;;
        "archive-cleanup")
            local profile=""
            local dry_run="false"
            
            # Parse arguments
            for arg in "${@:2}"; do
                case "$arg" in
                    "--dry-run")
                        dry_run="true"
                        ;;
                    *)
                        if [[ -z "$profile" ]]; then
                            profile="$arg"
                        fi
                        ;;
                esac
            done
            
            archive_cleanup "$profile" "$dry_run"
            ;;
        "all"|"sync")
            sync_all
            ;;
        "icloud")
            if check_unison; then
                sync_service "iCloud" "ICLOUD_PATH" "icloud"
            fi
            ;;
        "gdrive"|"google-drive")
            if check_unison; then
                sync_service "GoogleDrive" "GOOGLE_DRIVE_PATH" "google_drive"
            fi
            ;;
        "status")
            sync_status
            ;;
        "help"|"--help"|"-h")
            show_enhanced_help
            ;;
        *)
            echo "Unknown command: $1"
            show_enhanced_help
            exit 1
            ;;
    esac
}

# Run enhanced main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    acquire_lock
    trap release_lock EXIT
    enhanced_main "$@"
fi