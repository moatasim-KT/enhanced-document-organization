#!/bin/bash

# ============================================================================
# DRIVE SYNC - MAIN ENTRY POINT
# ============================================================================
# This script serves as the main entry point for the Drive Sync system,
# calling the appropriate modules based on the command

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Show usage information
show_usage() {
    cat << EOF
Drive Sync - Document Organization and Synchronization System

Usage: $(basename "$0") [module] [command] [options]

Modules:
  sync               Sync operations (sync, health, reset-circuit, status)
  organize           Organization operations (run, dry-run, status, create-category)
  mcp                MCP server operations (start, status, test)
  all                Run complete workflow (sync → organize → sync)

Examples:
  $(basename "$0") sync run
  $(basename "$0") organize run
  $(basename "$0") mcp start
  $(basename "$0") all

For module-specific help:
  $(basename "$0") sync help
  $(basename "$0") organize help
  $(basename "$0") mcp help
EOF
}

# Main function
main() {
    if [[ "$#" -eq 0 ]]; then
        show_usage
        exit 1
    fi
    
    local module="$1"
    shift
    
    case "$module" in
        sync)
            "$SCRIPT_DIR/sync/sync_module.sh" "$@"
            ;;
        organize)
            "$SCRIPT_DIR/organize/organize_module.sh" "$@"
            ;;
        mcp)
            "$SCRIPT_DIR/mcp/mcp_manager.sh" "$@"
            ;;
        all)
            echo "Running complete workflow..."
            "$SCRIPT_DIR/sync/sync_module.sh" sync
            "$SCRIPT_DIR/organize/organize_module.sh" run
            "$SCRIPT_DIR/sync/sync_module.sh" sync
            echo "Complete workflow finished successfully!"
            ;;
        help)
            show_usage
            ;;
        *)
            echo "Unknown module: $module"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"