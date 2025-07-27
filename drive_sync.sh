#!/bin/bash

# ============================================================================
# DRIVE SYNC - MAIN ENTRY POINT
# ============================================================================
# Simplified main script for document sync and organization


set -euo pipefail


SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Debug: Log HOME and SYNC_HUB at script start
echo "[DEBUG] HOME is: $HOME" | tee -a "$SCRIPT_DIR/logs/launchagent_env.log"
if [[ -f "$SCRIPT_DIR/config/config.env" ]]; then
    source "$SCRIPT_DIR/config/config.env"
    echo "[DEBUG] SYNC_HUB after sourcing config: $SYNC_HUB" | tee -a "$SCRIPT_DIR/logs/launchagent_env.log"
else
    echo "❌ Configuration file not found: $SCRIPT_DIR/config/config.env" | tee -a "$SCRIPT_DIR/logs/launchagent_env.log"
    echo "💡 Run startup validation: node src/organize/startup_validator.js" | tee -a "$SCRIPT_DIR/logs/launchagent_env.log"
    echo "💡 Or run setup: ./setup.sh" | tee -a "$SCRIPT_DIR/logs/launchagent_env.log"
    exit 1
fi

# Load configuration
if [[ ! -f "$SCRIPT_DIR/config/config.env" ]]; then
    echo "❌ Configuration file not found: $SCRIPT_DIR/config/config.env"
    echo "💡 Run startup validation: node src/organize/startup_validator.js"
    echo "💡 Or run setup: ./setup.sh"
    exit 1
fi

source "$SCRIPT_DIR/config/config.env"

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
        if pgrep -f "src/mcp/server.js" >/dev/null; then
            echo "MCP Server: ✅ Running"
        else
            echo "MCP Server: ❌ Not running"
        fi
    else
        echo "MCP Server: ⚪ Disabled"
    fi
    
    echo ""
    echo "💡 For detailed system validation, run: node src/organize/startup_validator.js"
}

# Run sync workflow
run_sync() {
    log "INFO" "Starting sync workflow"
    
    if [[ ! -x "$SCRIPT_DIR/src/sync/sync_module.sh" ]]; then
        log "ERROR" "Sync module not found or not executable"
        return 1
    fi
    
    "$SCRIPT_DIR/src/sync/sync_module.sh" all
}

# Run organization workflow
run_organize() {
    log "INFO" "Starting enhanced organization workflow"
    
    if [[ ! -x "$SCRIPT_DIR/src/organize/organize_module.sh" ]]; then
        log "ERROR" "Organization module not found or not executable"
        return 1
    fi
    
    # Ensure SYNC_HUB is properly set
    if [[ -z "$SYNC_HUB" ]]; then
        log "ERROR" "SYNC_HUB environment variable is not set"
        return 1
    fi
    
    # Resolve SYNC_HUB to actual path to prevent literal $SYNC_HUB usage
    local sync_hub_path="$SYNC_HUB"
    
    # Double-check that we have an actual path, not a literal variable
    if [[ "$sync_hub_path" == "\$SYNC_HUB" ]] || [[ "$sync_hub_path" == '$SYNC_HUB' ]]; then
        log "ERROR" "SYNC_HUB is not properly expanded: $sync_hub_path"
        # Fallback to config value
        sync_hub_path="/Users/moatasimfarooque/Sync_Hub_New"
        log "WARN" "Using fallback SYNC_HUB path: $sync_hub_path"
    fi
    
    local dry_run="${1:-false}"
    log "DEBUG" "Calling organize_module.sh with resolved path: $sync_hub_path"
    "$SCRIPT_DIR/src/organize/organize_module.sh" "$sync_hub_path" "$dry_run"
}

# Start MCP server
start_mcp() {
    log "INFO" "Starting MCP server"
    
    if [[ "$MCP_ENABLED" != "true" ]]; then
        log "WARN" "MCP server is disabled in configuration"
        return 0
    fi
    
    if pgrep -f "src/mcp/server.js" >/dev/null; then
        log "INFO" "MCP server is already running"
        return 0
    fi
    
    if [[ ! -f "$SCRIPT_DIR/src/mcp/server.js" ]]; then
        log "ERROR" "MCP server not found"
        return 1
    fi
    
    cd "$SCRIPT_DIR/src/mcp"
    export PROJECT_ROOT="$SCRIPT_DIR"
    export SYNC_HUB="$SYNC_HUB"
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
    
    if pgrep -f "src/mcp/server.js" >/dev/null; then
        pkill -f "src/mcp/server.js"
        log "INFO" "MCP server stopped"
    else
        log "INFO" "MCP server was not running"
    fi
}

# Run complete workflow
run_all() {
    log "INFO" "Starting complete workflow: sync → organize → sync"
    
    local organize_mode="${1:-run}"
    local dry_run="false"
    if [[ "$organize_mode" == "dry-run" ]]; then
        dry_run="true"
    fi
    
    local success=true
    
    # Initial sync
    if ! run_sync; then
        log "ERROR" "Initial sync failed"
        success=false
    fi
    
    # Organization
    if ! run_organize "$dry_run"; then
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
    validate [options]  - Run comprehensive system validation
    test [options]      - Run test suite
    help                - Show this help message

Examples:
    $0 all              # Run everything
    $0 all dry-run      # Preview organization changes
    $0 sync             # Sync only
    $0 organize         # Organize files
    $0 organize dry-run # Preview organization
    $0 mcp start        # Start AI integration server
    $0 status           # Check system status
    $0 validate         # Run system validation
    $0 validate --verbose # Detailed validation
    $0 test             # Run test suite

Configuration:
    Edit config.env to modify system settings and paths.

EOF
}

# Parse arguments before main execution
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --sync-hub)
                if [[ -n "$2" && "$2" != --* ]]; then
                    export SYNC_HUB="$2"
                    log "DEBUG" "SYNC_HUB overridden via argument: $SYNC_HUB"
                    shift 2
                else
                    log "ERROR" "--sync-hub requires a path argument"
                    exit 1
                fi
                ;;
            --config)
                if [[ -n "$2" && "$2" != --* ]]; then
                    # Config argument is handled elsewhere, just skip
                    shift 2
                else
                    log "ERROR" "--config requires a path argument"
                    exit 1
                fi
                ;;
            *)
                # Return remaining arguments
                break
                ;;
        esac
    done
    # Return remaining arguments
    echo "$@"
}

# Main execution
main() {
    # Parse arguments first
    remaining_args=$(parse_arguments "$@")
    eval set -- "$remaining_args"
    
    case "${1:-help}" in
        "all")
            run_all "${2:-run}"
            ;;
        "sync")
            run_sync
            ;;
        "organize")
            local mode="${2:-run}"
            local dry_run="false"
            if [[ "$mode" == "dry-run" ]]; then
                dry_run="true"
            fi
            run_organize "$dry_run"
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
                    if pgrep -f "src/mcp/server.js" >/dev/null; then
                        echo "MCP Server: ✅ Running (PID: $(pgrep -f 'src/mcp/server.js'))"
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
        "validate")
            echo "🔍 Running comprehensive system validation..."
            if command -v node >/dev/null 2>&1; then
                node "$SCRIPT_DIR/src/organize/startup_validator.js" "${@:2}"
            else
                echo "❌ Node.js is required for system validation"
                echo "💡 Install Node.js and try again"
                exit 1
            fi
            ;;
        "test")
            echo "🧪 Running test suite..."
            if command -v node >/dev/null 2>&1; then
                node "$SCRIPT_DIR/test/run_tests.js" "${@:2}"
            else
                echo "❌ Node.js is required for running tests"
                echo "💡 Install Node.js and try again"
                exit 1
            fi
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
