#!/bin/bash

# MCP Server Management Script
# Manages the Enhanced Document Organization MCP Server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_DIR="$SCRIPT_DIR/mcp-server"
SERVER_SCRIPT="$MCP_DIR/server.js"
PID_FILE="$MCP_DIR/.server.pid"
LOG_FILE="$MCP_DIR/server.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

usage() {
    echo "Enhanced Document Organization MCP Server Manager"
    echo ""
    echo "Usage: $0 {status|test|test-interactive|install|config|logs}"
    echo ""
    echo "Commands:"
    echo "  status          - Show server status and readiness"
    echo "  test            - Test server functionality and access"
    echo "  test-interactive - Start server in interactive mode for testing"
    echo "  install         - Install/update dependencies"
    echo "  config          - Show configuration for MCP clients"
    echo "  logs            - Show any available logs"
    echo ""
    echo "Note: MCP servers run on-demand through MCP clients, not as services"
    echo ""
}

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

check_dependencies() {
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 18 ]; then
        error "Node.js version 18+ is required. Current version: $(node --version)"
        exit 1
    fi
}

install_dependencies() {
    log "Installing MCP server dependencies..."
    
    cd "$MCP_DIR"
    
    if [ ! -f "package.json" ]; then
        error "package.json not found in $MCP_DIR"
        exit 1
    fi
    
    npm install
    success "Dependencies installed successfully"
}

start_server() {
    log "MCP servers run on-demand through MCP clients (like Claude Desktop)"
    log "They don't run as persistent background services."
    echo ""
    success "Server is ready to be used by MCP clients"
    echo ""
    echo "To use this server:"
    echo "1. Configure your MCP client (see 'config' command)"
    echo "2. The server will start automatically when the client connects"
    echo ""
    echo "For testing, use: $0 test-interactive"
}

stop_server() {
    log "MCP servers don't run as persistent services"
    success "Nothing to stop - servers start on-demand"
}

restart_server() {
    log "Restarting MCP server..."
    stop_server
    sleep 1
    start_server
}

is_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 $pid 2>/dev/null; then
            return 0
        else
            rm -f "$PID_FILE"
        fi
    fi
    return 1
}

show_status() {
    echo "Enhanced Document Organization MCP Server Status"
    echo "==============================================="
    
    log "MCP servers run on-demand, not as persistent services"
    success "Server is ready and available for MCP clients"
    
    echo ""
    echo "Configuration:"
    echo "  Server Script: $SERVER_SCRIPT"
    echo "  Working Directory: $MCP_DIR"
    
    echo ""
    echo "Dependencies:"
    if command -v node &> /dev/null; then
        success "Node.js: $(node --version)"
    else
        error "Node.js: Not installed"
    fi
    
    if command -v npm &> /dev/null; then
        success "npm: $(npm --version)"
    else
        error "npm: Not installed"
    fi
    
    echo ""
    echo "File System Check:"
    if [ -f "$SERVER_SCRIPT" ]; then
        success "Server script exists"
    else
        error "Server script not found"
    fi
    
    if [ -f "$MCP_DIR/package.json" ]; then
        success "Package configuration exists"
    else
        error "Package configuration not found"
    fi
    
    if [ -d "$MCP_DIR/node_modules" ]; then
        success "Dependencies installed"
    else
        warning "Dependencies not installed - run: $0 install"
    fi
}

test_server() {
    log "Testing MCP server functionality..."
    
    # Test Node.js availability
    if ! command -v node &> /dev/null; then
        error "Node.js not found"
        exit 1
    fi
    
    # Test server script syntax
    log "Checking server script syntax..."
    if cd "$MCP_DIR" && node --check "$SERVER_SCRIPT"; then
        success "Server script syntax is valid"
    else
        error "Server script has syntax errors"
        exit 1
    fi
    
    # Test dependencies
    log "Checking dependencies..."
    if [ -d "$MCP_DIR/node_modules" ]; then
        success "Dependencies are installed"
    else
        error "Dependencies not found. Run: $0 install"
        exit 1
    fi
    
    # Test configuration access
    log "Testing sync directory access..."
    local accessible_dirs=0
    local total_dirs=0
    
    # Test primary sync directory access
    if [ -d "/Users/moatasimfarooque/Downloads/Data_Science/Sync_iCloud" ]; then
        success "iCloud sync directory accessible"
        ((accessible_dirs++))
    else
        warning "iCloud sync directory not accessible"
    fi
    ((total_dirs++))
    
    if [ -d "/Users/moatasimfarooque/Downloads/Data_Science/Sync_GoogleDrive" ]; then
        success "Google Drive sync directory accessible"
        ((accessible_dirs++))
    else
        warning "Google Drive sync directory not accessible"
    fi
    ((total_dirs++))
    
    echo ""
    log "Accessibility: $accessible_dirs/$total_dirs sync directories"
    
    if [ $accessible_dirs -gt 0 ]; then
        success "Server is ready for MCP client connections"
        echo ""
        echo "To connect with Claude Desktop:"
        echo "1. Add the configuration from: $0 config"
        echo "2. Restart Claude Desktop"
        echo "3. The server will start automatically when you use MCP tools"
    else
        warning "No sync directories accessible - server may have limited functionality"
    fi
}

test_interactive() {
    log "Starting interactive MCP server test..."
    echo ""
    echo "This will start the server in interactive mode."
    echo "You can send MCP protocol messages to test functionality."
    echo "Press Ctrl+C to exit."
    echo ""
    
    cd "$MCP_DIR"
    node "$SERVER_SCRIPT"
}

show_logs() {
    if [ ! -f "$LOG_FILE" ]; then
        warning "Log file not found: $LOG_FILE"
        return 1
    fi
    
    echo "MCP Server Logs (last 50 lines):"
    echo "================================="
    tail -n 50 "$LOG_FILE"
}

show_config() {
    echo "MCP Client Configuration"
    echo "========================"
    echo ""
    echo "For Claude Desktop, add this to your configuration file:"
    echo "File: ~/Library/Application Support/Claude/claude_desktop_config.json"
    echo ""
    echo "{"
    echo "  \"mcpServers\": {"
    echo "    \"enhanced-document-organization\": {"
    echo "      \"command\": \"node\","
    echo "      \"args\": [\"$SERVER_SCRIPT\"],"
    echo "      \"env\": {}"
    echo "    }"
    echo "  }"
    echo "}"
    echo ""
    echo "For other MCP clients:"
    echo "  Command: node"
    echo "  Args: [\"$SERVER_SCRIPT\"]"
    echo "  Protocol: stdio"
    echo ""
    echo "Available Tools:"
    echo "  - search_documents: Search through organized documents"
    echo "  - get_document_content: Get full document content"
    echo "  - organize_documents: Run organization system"
    echo "  - sync_documents: Synchronize across platforms"
    echo "  - get_organization_stats: Get system statistics"
    echo "  - list_categories: List document categories"
    echo "  - create_document: Create new documents"
}

main() {
    case "${1:-}" in
        status)
            show_status
            ;;
        test)
            check_dependencies
            test_server
            ;;
        test-interactive)
            check_dependencies
            test_interactive
            ;;
        install)
            check_dependencies
            install_dependencies
            ;;
        config)
            show_config
            ;;
        logs)
            show_logs
            ;;
        # Legacy commands for backward compatibility
        start)
            log "Note: MCP servers don't run as persistent services"
            start_server
            ;;
        stop)
            stop_server
            ;;
        restart)
            log "Note: MCP servers don't run as persistent services"
            start_server
            ;;
        *)
            usage
            exit 1
            ;;
    esac
}

main "$@"
