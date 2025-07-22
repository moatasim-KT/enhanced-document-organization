#!/bin/bash

# ============================================================================
# CLEANUP MODULE
# ============================================================================
# This script handles cleanup operations for the Drive Sync system.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRIVE_SYNC_ROOT="$(dirname "$SCRIPT_DIR")"

# Source the config file
source "$DRIVE_SYNC_ROOT/config.env"

# Function to log messages
log() {
    local message="$1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] CLEANUP: $message" >> "$DRIVE_SYNC_ROOT/logs/cleanup.log"
}

# Show usage information
show_usage() {
    cat << EOF
Cleanup Module

Usage: $(basename "$0") [command] [options]

Commands:
  run                Execute cleanup tasks.
  help               Show this help message.

EOF
}

# Function to run cleanup
run_cleanup() {
    log "Starting cleanup operations..."

    # Example cleanup: Remove old log files (older than 7 days)
    find "$DRIVE_SYNC_ROOT/logs" -type f -name "*.log" -mtime +7 -delete
    log "Removed log files older than 7 days."

    # Example cleanup: Clear cache (use with caution)
    # rm -rf "$DRIVE_SYNC_ROOT/.cache/*"
    # log "Cleared cache directory."

    log "Cleanup operations finished."
}

# Main execution logic
case "${1:-}" in
    run)
        run_cleanup
        ;;
    help)
        show_usage
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
