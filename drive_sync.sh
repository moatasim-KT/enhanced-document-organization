#!/bin/bash

# ============================================================================
# DRIVE SYNC - MAIN ENTRY POINT
# ============================================================================
# Simplified main script for document sync and organization

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load configuration
source "$SCRIPT_DIR/config.env"

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] [$level] $message"
    
    if [[ "$LOG_TO_FILE" == "true" ]]; then
        mkdir -p "$SCRIPT_DIR/logs"
        echo "[$timestamp] [$level] $message" >> "$SCRIPT_DIR/logs/main.log"
    fi
}

# Show system status
show_status() {
    echo "=== Enhanced Document Organization System Status ==="
    echo ""
    
    echo "--- Configuration ---"
    echo "Sync Hub: $SYNC_HUB"
    echo "iCloud Path: $ICLOUD_PATH"
    echo "Google Drive Path: $GOOGLE_DRIVE_PATH"
    echo "Sync Enabled: $SYNC_ENABLED"
    echo "Organization Enabled: $ORGANIZATION_ENABLED"
    echo "MCP Enabled: $MCP_ENABLED"
    echo ""
    
    echo "--- Directory Status ---"
    echo "Sync Hub exists: $(if [[ -d "$SYNC_HUB" ]]; then echo "✅ Yes"; else echo "❌ No"; fi)"
    echo "iCloud path exists: $(if [[ -d "$ICLOUD_PATH" ]]; then echo "✅ Yes"; else echo "❌ No"; fi)"
    echo "Google Drive path exists: $(if [[ -d "$GOOGLE_DRIVE_PATH" ]]; then echo "✅ Yes"; else echo "❌ No"; fi)"
    echo ""
    
    echo "--- Dependencies ---"
    echo "Unison installed: $(if command -v unison >/dev/null 2>&1; then echo "✅ Yes"; else echo "❌ No"; fi)"
    echo "Node.js installed: $(if command -v node >/dev/null 2>&1; then echo "✅ Yes"; else echo "❌ No"; fi)"
    echo ""
    
    echo "--- MCP Server ---"
    if [[ "$MCP_ENABLED" == "true" ]]; then
        if pgrep -f "mcp/server.js" >/dev/null; then
            echo "MCP Server: ✅ Running"
        else
            echo "MCP Server: ❌ Not running"
        fi
    else
        echo "MCP Server: ⚪ Disabled"
    fi
}

# Run sync workflow
run_sync() {
    log "INFO" "Starting sync workflow"
    
    if [[ ! -x "$SCRIPT_DIR/sync/sync_module.sh" ]]; then
        log "ERROR" "Sync module not found or not executable"
        return 1
    fi
    
    "$SCRIPT_DIR/sync/sync_module.sh" all
}

# Run organization workflow
run_organize() {
    log "INFO" "Starting organization workflow"
    
    if [[ ! -x "$SCRIPT_DIR/organize/organize_module.sh" ]]; then
        log "ERROR" "Organization module not found or not executable"
        return 1
    fi
    
    local mode="${1:-run}"
    "$SCRIPT_DIR/organize/organize_module.sh" "$mode"
}

# Start MCP server
start_mcp() {
    log "INFO" "Starting MCP server"
    
    if [[ "$MCP_ENABLED" != "true" ]]; then
        log "WARN" "MCP server is disabled in configuration"
        return 0
    fi
    
    if pgrep -f "mcp/server.js" >/dev/null; then
        log "INFO" "MCP server is already running"
        return 0
    fi
    
    if [[ ! -f "$SCRIPT_DIR/mcp/server.js" ]]; then
        log "ERROR" "MCP server not found"
        return 1
    fi
    
    cd "$SCRIPT_DIR/mcp"
    if [[ "${1:-background}" == "background" ]]; then
        nohup node server.js > /dev/null 2>&1 &
        log "INFO" "MCP server started in background"
    else
        node server.js
    fi
}

# Stop MCP server
stop_mcp() {
    log "INFO" "Stopping MCP server"
    
    if pgrep -f "mcp/server.js" >/dev/null; then
        pkill -f "mcp/server.js"
        log "INFO" "MCP server stopped"
    else
        log "INFO" "MCP server was not running"
    fi
}

# Run complete workflow
run_all() {
    log "INFO" "Starting complete workflow: sync → organize → sync"
    
    local organize_mode="${1:-run}"
    local success=true
    
    # Initial sync
    if ! run_sync; then
        log "ERROR" "Initial sync failed"
        success=false
    fi
    
    # Organization
    if ! run_organize "$organize_mode"; then
        log "ERROR" "Organization failed"
        success=false
    fi
    
    # Final sync
    if ! run_sync; then
        log "ERROR" "Final sync failed"
        success=false
    fi
    
    # Start MCP server if enabled
    if [[ "$MCP_ENABLED" == "true" && "$MCP_AUTO_START" == "true" ]]; then
        start_mcp background
    fi
    
    if [[ "$success" == "true" ]]; then
        log "INFO" "Complete workflow finished successfully"
        return 0
    else
        log "ERROR" "Complete workflow finished with errors"
        return 1
    fi
}

# Show help
show_help() {
    cat << EOF
Enhanced Document Organization System

Usage: $0 <command> [options]

Commands:
    all [dry-run]       - Run complete workflow: sync → organize → sync
    sync                - Run sync only
    organize [dry-run]  - Run organization only  
    mcp start           - Start MCP server
    mcp stop            - Stop MCP server
    mcp status          - Check MCP server status
    status              - Show system status
    help                - Show this help message

Examples:
    $0 all              # Run everything
    $0 all dry-run      # Preview organization changes
    $0 sync             # Sync only
    $0 organize         # Organize files
    $0 organize dry-run # Preview organization
    $0 mcp start        # Start AI integration server
    $0 status           # Check system status

Configuration:
    Edit config.env to modify system settings and paths.

EOF
}

# Main execution
main() {
    case "${1:-help}" in
        "all")
            run_all "${2:-run}"
            ;;
        "sync")
            run_sync
            ;;
        "organize")
            run_organize "${2:-run}"
            ;;
        "mcp")
            case "${2:-status}" in
                "start")
                    start_mcp "${3:-background}"
                    ;;
                "stop")
                    stop_mcp
                    ;;
                "status")
                    if pgrep -f "mcp/server.js" >/dev/null; then
                        echo "MCP Server: ✅ Running (PID: $(pgrep -f 'mcp/server.js'))"
                    else
                        echo "MCP Server: ❌ Not running"
                    fi
                    ;;
                *)
                    echo "MCP commands: start, stop, status"
                    ;;
            esac
            ;;
        "status")
            show_status
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
