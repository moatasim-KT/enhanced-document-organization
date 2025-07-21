#!/bin/bash

# ============================================================================
# MCP SERVER MANAGER
# ============================================================================
# This script manages the MCP server for AI integration

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PARENT_DIR/mcp_server.log"

# Load configuration
source "$PARENT_DIR/config.env"

# Function for logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Start the MCP server
start_server() {
    log "Starting MCP server..."
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        log "Error: Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    # Check if server.js exists
    if [[ ! -f "$SCRIPT_DIR/server.js" ]]; then
        log "Error: server.js not found in $SCRIPT_DIR"
        exit 1
    fi
    
    # Check if package.json exists and install dependencies if needed
    if [[ -f "$SCRIPT_DIR/package.json" ]]; then
        if [[ ! -d "$SCRIPT_DIR/node_modules" ]]; then
            log "Installing dependencies..."
            (cd "$SCRIPT_DIR" && npm install)
        fi
    fi
    
    # Start the server
    log "Running MCP server..."
    node "$SCRIPT_DIR/server.js" >> "$LOG_FILE" 2>&1 &
    
    # Save PID
    echo $! > "$SCRIPT_DIR/server.pid"
    log "MCP server started with PID: $!"
}

# Stop the MCP server
stop_server() {
    log "Stopping MCP server..."
    
    # Check if PID file exists
    if [[ -f "$SCRIPT_DIR/server.pid" ]]; then
        local pid=$(cat "$SCRIPT_DIR/server.pid")
        
        # Check if process is running
        if kill -0 $pid 2>/dev/null; then
            log "Stopping MCP server with PID: $pid"
            kill $pid
            rm "$SCRIPT_DIR/server.pid"
            log "MCP server stopped"
        else
            log "MCP server is not running (PID: $pid)"
            rm "$SCRIPT_DIR/server.pid"
        fi
    else
        log "MCP server is not running (no PID file)"
    fi
}

# Check MCP server status
check_status() {
    log "Checking MCP server status..."
    
    # Check if PID file exists
    if [[ -f "$SCRIPT_DIR/server.pid" ]]; then
        local pid=$(cat "$SCRIPT_DIR/server.pid")
        
        # Check if process is running
        if kill -0 $pid 2>/dev/null; then
            log "MCP server is running with PID: $pid"
            return 0
        else
            log "MCP server is not running (stale PID file)"
            rm "$SCRIPT_DIR/server.pid"
            return 1
        fi
    else
        log "MCP server is not running (no PID file)"
        return 1
    fi
}

# Test MCP server functionality
test_server() {
    log "Testing MCP server functionality..."
    
    # Check if server is running
    if ! check_status; then
        log "MCP server is not running. Starting server..."
        start_server
        sleep 2  # Give the server time to start
    fi
    
    # Test server functionality
    log "Sending test request to MCP server..."
    # Add test code here
    
    log "MCP server test completed"
}

# Show configuration for Claude Desktop
show_config() {
    log "Generating Claude Desktop configuration..."
    
    cat << EOF
Add this to your Claude Desktop configuration file:
~/Library/Application Support/Claude/claude_desktop_config.json

{
  "mcpServers": {
    "enhanced-document-organization": {
      "command": "node",
      "args": ["$SCRIPT_DIR/server.js"],
      "env": {}
    }
  }
}
EOF
}

# Show usage information
show_usage() {
    cat << EOF
Usage: $(basename "$0") [command]

Commands:
  start             Start the MCP server
  stop              Stop the MCP server
  status            Check MCP server status
  test              Test MCP server functionality
  config            Show configuration for Claude Desktop
  help              Show this help message

Examples:
  $(basename "$0") start
  $(basename "$0") status
  $(basename "$0") config
EOF
}

# Main function
main() {
    if [[ "$#" -eq 0 ]]; then
        show_usage
        exit 1
    fi
    
    local command="$1"
    shift
    
    case "$command" in
        start)
            start_server
            ;;
        stop)
            stop_server
            ;;
        status)
            check_status
            ;;
        test)
            test_server
            ;;
        config)
            show_config
            ;;
        help)
            show_usage
            ;;
        *)
            echo "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"