#!/bin/bash

# ============================================================================
# SIMPLIFIED SYNC MODULE
# ============================================================================
# Clean and simple sync functionality using Unison
# Handles synchronization between local hub and cloud services

set -euo pipefail

# Get script directory and parent
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load configuration
source "$(dirname "$PROJECT_DIR")/config/config.env"

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
        echo "[$timestamp] [$level] $message" >> "$PROJECT_DIR/logs/sync.log"
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

# Sync using Unison profile
sync_with_unison() {
    local profile="$1"
    local profile_path="$(dirname "$PROJECT_DIR")/config/$profile.prf"
    
    if [[ ! -f "$profile_path" ]]; then
        log "ERROR" "Profile not found: $profile_path"
        return 1
    fi
    
    log "INFO" "Starting sync with profile: $profile"
    
    # Copy profile to Unison directory
    local unison_dir="$HOME/.unison"
    ensure_directory "$unison_dir"
    cp "$profile_path" "$unison_dir/${profile#unison_}.prf"
    
    # Run Unison sync
    local profile_name="${profile#unison_}"
    if unison "$profile_name" -batch -auto -silent 2>/dev/null; then
        log "INFO" "Sync completed successfully: $profile"
        return 0
    else
        log "ERROR" "Sync failed: $profile"
        return 1
    fi
}

# Sync iCloud
sync_icloud() {
    log "INFO" "Starting iCloud sync"
    
    # Ensure directories exist
    ensure_directory "$SYNC_HUB"
    ensure_directory "$(dirname "$ICLOUD_PATH")"
    
    if sync_with_unison "unison_icloud"; then
        log "INFO" "iCloud sync completed successfully"
        return 0
    else
        log "ERROR" "iCloud sync failed"
        return 1
    fi
}

# Sync Google Drive
sync_google_drive() {
    log "INFO" "Starting Google Drive sync"
    
    # Ensure directories exist
    ensure_directory "$SYNC_HUB"
    ensure_directory "$(dirname "$GOOGLE_DRIVE_PATH")"
    
    if sync_with_unison "unison_google_drive"; then
        log "INFO" "Google Drive sync completed successfully"
        return 0
    else
        log "ERROR" "Google Drive sync failed"
        return 1
    fi
}

# Run all syncs
sync_all() {
    log "INFO" "Starting full sync process"
    
    if [[ "$SYNC_ENABLED" != "true" ]]; then
        log "WARN" "Sync is disabled in configuration"
        return 0
    fi
    
    local success=true
    
    # Check Unison availability
    if ! check_unison; then
        return 1
    fi
    
    # Sync iCloud
    if ! sync_icloud; then
        success=false
    fi
    
    # Sync Google Drive  
    if ! sync_google_drive; then
        success=false
    fi
    
    if [[ "$success" == "true" ]]; then
        log "INFO" "All syncs completed successfully"
        return 0
    else
        log "ERROR" "Some syncs failed"
        return 1
    fi
}

# Check sync status
sync_status() {
    log "INFO" "Checking sync status"
    
    echo "=== Sync Configuration ==="
    echo "Sync Hub: $SYNC_HUB"
    echo "iCloud Path: $ICLOUD_PATH"
    echo "Google Drive Path: $GOOGLE_DRIVE_PATH"
    echo "Sync Enabled: $SYNC_ENABLED"
    echo ""
    
    echo "=== Directory Status ==="
    echo "Sync Hub exists: $(if [[ -d "$SYNC_HUB" ]]; then echo "Yes"; else echo "No"; fi)"
    echo "iCloud path exists: $(if [[ -d "$ICLOUD_PATH" ]]; then echo "Yes"; else echo "No"; fi)"
    echo "Google Drive path exists: $(if [[ -d "$GOOGLE_DRIVE_PATH" ]]; then echo "Yes"; else echo "No"; fi)"
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
                sync_icloud
            fi
            ;;
        "gdrive"|"google-drive")
            if check_unison; then
                sync_google_drive
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

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
