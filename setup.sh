#!/bin/bash

# Enhanced Document Organization System Setup Script
# This script helps configure the system for your environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}Enhanced Document Organization System Setup${NC}"
echo "============================================="
echo ""

# Check if config already exists
if [ -f "$CONFIG_FILE" ]; then
    echo -e "${YELLOW}Configuration file already exists: $CONFIG_FILE${NC}"
    read -p "Do you want to reconfigure? (y/N): " reconfigure
    if [[ ! $reconfigure =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}Setup cancelled. Using existing configuration.${NC}"
        exit 0
    fi
fi

echo -e "${BLUE}Setting up your configuration...${NC}"
echo ""

# Get user information
USER_HOME="${HOME}"
USERNAME="${USER:-$(whoami)}"

# Get project root
echo -e "${CYAN}Project Configuration:${NC}"
read -p "Project root directory [$SCRIPT_DIR]: " PROJECT_ROOT
PROJECT_ROOT="${PROJECT_ROOT:-$SCRIPT_DIR}"

# Get data science root
echo ""
echo -e "${CYAN}Data Science Configuration:${NC}"
DEFAULT_DATA_ROOT="$USER_HOME/Downloads/Data_Science"
read -p "Data Science root directory [$DEFAULT_DATA_ROOT]: " DATA_SCIENCE_ROOT
DATA_SCIENCE_ROOT="${DATA_SCIENCE_ROOT:-$DEFAULT_DATA_ROOT}"

# Get Google Drive email
echo ""
echo -e "${CYAN}Google Drive Configuration:${NC}"
read -p "Your Google Drive email (for sync paths): " GOOGLE_DRIVE_EMAIL
while [ -z "$GOOGLE_DRIVE_EMAIL" ]; do
    echo -e "${RED}Email is required for Google Drive sync configuration${NC}"
    read -p "Your Google Drive email: " GOOGLE_DRIVE_EMAIL
done

# Create sync directories if they don't exist
echo ""
echo -e "${CYAN}Creating sync directories...${NC}"

SYNC_DIRS=(
    "$DATA_SCIENCE_ROOT/Sync_iCloud"
    "$DATA_SCIENCE_ROOT/Sync_GoogleDrive"
    "$USER_HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/Sync"
    "$USER_HOME/Library/CloudStorage/GoogleDrive-$GOOGLE_DRIVE_EMAIL/My Drive/Sync"
)

for dir in "${SYNC_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        echo -e "${YELLOW}Creating: $dir${NC}"
        mkdir -p "$dir" 2>/dev/null || echo -e "${RED}Warning: Could not create $dir${NC}"
    else
        echo -e "${GREEN}Exists: $dir${NC}"
    fi
done

# Create configuration file
echo ""
echo -e "${CYAN}Writing configuration file...${NC}"

cat > "$CONFIG_FILE" << EOF
# Enhanced Document Organization System Configuration
# Generated on $(date)

# User configuration
USER_HOME="$USER_HOME"
USERNAME="$USERNAME"

# Project paths
PROJECT_ROOT="$PROJECT_ROOT"
DATA_SCIENCE_ROOT="$DATA_SCIENCE_ROOT"

# Sync directory paths
SYNC_ICLOUD="$DATA_SCIENCE_ROOT/Sync_iCloud"
SYNC_GDRIVE="$DATA_SCIENCE_ROOT/Sync_GoogleDrive"
SYNC_OBSIDIAN="$USER_HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/Sync"
SYNC_GDRIVE_CLOUD="$USER_HOME/Library/CloudStorage/GoogleDrive-$GOOGLE_DRIVE_EMAIL/My Drive/Sync"

# Unison paths (for sync operations)
ICLOUD_PATH="$USER_HOME/icloud_sync"
GDRIVE_PATH="$USER_HOME/gdrive_sync"

# Backup configuration
BACKUP_BASE="$DATA_SCIENCE_ROOT"
MANUAL_BACKUP_BASE="$DATA_SCIENCE_ROOT"

# MCP Server configuration
MCP_SERVER_PATH="$PROJECT_ROOT/mcp-server/server.js"
MCP_WORKING_DIR="$PROJECT_ROOT/mcp-server"

# Email for Google Drive
GOOGLE_DRIVE_EMAIL="$GOOGLE_DRIVE_EMAIL"

# Cron job paths
CRON_SCRIPT_PATH="$PROJECT_ROOT"

# Log files
SYNC_LOG="$PROJECT_ROOT/sync_manager.log"
PERFORMANCE_LOG="$PROJECT_ROOT/performance.log"

# Development settings
DEBUG_MODE="false"
VERBOSE_OUTPUT="true"
EOF

echo -e "${GREEN}✅ Configuration saved to: $CONFIG_FILE${NC}"

# Install MCP dependencies
echo ""
echo -e "${CYAN}Installing MCP server dependencies...${NC}"
if [ -d "$PROJECT_ROOT/mcp-server" ]; then
    cd "$PROJECT_ROOT/mcp-server"
    if command -v npm &> /dev/null; then
        npm install
        echo -e "${GREEN}✅ MCP dependencies installed${NC}"
    else
        echo -e "${YELLOW}⚠️  npm not found. Please install Node.js and npm, then run: npm install${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  MCP server directory not found${NC}"
fi

# Generate Claude Desktop configuration
echo ""
echo -e "${CYAN}Generating Claude Desktop configuration...${NC}"

CLAUDE_CONFIG_DIR="$USER_HOME/Library/Application Support/Claude"
CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"

mkdir -p "$CLAUDE_CONFIG_DIR"

# Check if Claude config exists
if [ -f "$CLAUDE_CONFIG_FILE" ]; then
    echo -e "${YELLOW}Claude Desktop configuration already exists${NC}"
    echo "Add this configuration to your existing file:"
    echo ""
else
    echo -e "${GREEN}Creating Claude Desktop configuration...${NC}"
    cat > "$CLAUDE_CONFIG_FILE" << EOF
{
  "mcpServers": {
    "enhanced-document-organization": {
      "command": "node",
      "args": ["$PROJECT_ROOT/mcp-server/server.js"],
      "env": {}
    }
  }
}
EOF
    echo -e "${GREEN}✅ Claude Desktop configuration created${NC}"
fi

echo ""
echo -e "${CYAN}Claude Desktop Configuration:${NC}"
echo "{"
echo "  \"mcpServers\": {"
echo "    \"enhanced-document-organization\": {"
echo "      \"command\": \"node\","
echo "      \"args\": [\"$PROJECT_ROOT/mcp-server/server.js\"],"
echo "      \"env\": {}"
echo "    }"
echo "  }"
echo "}"

echo ""
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo ""
echo -e "${CYAN}Next Steps:${NC}"
echo "1. Test the system: ./mcp_manager.sh test"
echo "2. Test organization: ./organize_manager.sh status"
echo "3. Test sync: ./sync_manager.sh status"
echo "4. Restart Claude Desktop to use the MCP server"
echo ""
echo -e "${CYAN}Quick Start:${NC}"
echo "• Run organization: ./organize_manager.sh run"
echo "• Start sync: ./sync_manager.sh sync"
echo "• MCP server help: ./mcp_manager.sh"
echo ""
echo -e "${BLUE}Configuration file: $CONFIG_FILE${NC}"
echo -e "${BLUE}You can edit this file to customize your setup.${NC}"
