#!/bin/bash

# ============================================================================
# SETUP SCRIPT FOR ENHANCED DOCUMENT ORGANIZATION SYSTEM
# ============================================================================
# Simple setup script to configure the system

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Enhanced Document Organization System Setup"
echo "=============================================="
echo ""

# Check dependencies
echo "📋 Checking dependencies..."

# Check Unison
if command -v unison >/dev/null 2>&1; then
    echo "✅ Unison is installed ($(unison -version | head -1))"
else
    echo "❌ Unison is not installed"
    echo "   Install with: brew install unison"
    exit 1
fi

# Check flock
if command -v flock >/dev/null 2>&1; then
    echo "✅ flock is installed"
else
    echo "❌ flock is not installed"
    echo "   Install with: brew install util-linux (on macOS)"
    exit 1
fi

# Check Node.js
if command -v node >/dev/null 2>&1; then
    echo "✅ Node.js is installed ($(node --version))"
else
    echo "❌ Node.js is not installed"
    echo "   Install with: brew install node"
    exit 1
fi

echo ""

# Setup directories
echo "📁 Setting up directories..."

source "$SCRIPT_DIR/config/config.env"

# Create sync hub
if [[ ! -d "$SYNC_HUB" ]]; then
    echo "   Creating sync hub: $SYNC_HUB"
    mkdir -p "$SYNC_HUB"
else
    echo "   Sync hub already exists: $SYNC_HUB"
fi

# Create logs directory
mkdir -p "$SCRIPT_DIR/logs"
echo "   Created logs directory"

echo ""

# Setup Unison profiles
echo "🔧 Setting up Unison profiles..."

UNISON_DIR="$HOME/.unison"
mkdir -p "$UNISON_DIR"

# Copy and expand profiles
sed "s|\$SYNC_HUB|$SYNC_HUB|g" "$SCRIPT_DIR/config/unison_icloud.prf" > "$UNISON_DIR/icloud.prf"
sed "s|\$SYNC_HUB|$SYNC_HUB|g" "$SCRIPT_DIR/config/unison_google_drive.prf" > "$UNISON_DIR/google_drive.prf"

echo "   Copied Unison profiles to ~/.unison/"

echo ""

# Setup MCP server
echo "🤖 Setting up MCP server..."

cd "$SCRIPT_DIR/src/mcp"
if [[ ! -d "node_modules" ]]; then
    echo "   Installing MCP server dependencies..."
    npm install
else
    echo "   MCP server dependencies already installed"
fi

echo ""

# Test configuration
echo "🧪 Testing configuration..."

echo "   Testing sync module..."
if "$SCRIPT_DIR/sync/sync_module.sh" status >/dev/null 2>&1; then
    echo "   ✅ Sync module OK"
else
    echo "   ❌ Sync module has issues"
fi

echo "   Testing organize module..."
if "$SCRIPT_DIR/organize/organize_module.sh" status >/dev/null 2>&1; then
    echo "   ✅ Organize module OK"
else
    echo "   ❌ Organize module has issues"
fi

echo ""

# LaunchAgent setup
echo "🔄 LaunchAgent setup (optional)..."
echo ""
echo "To enable automatic sync and organization, copy the LaunchAgent:"
echo "   cp '$SCRIPT_DIR/com.moatasim.enhanced-document-organization.plist' ~/Library/LaunchAgents/"
echo "   launchctl load ~/Library/LaunchAgents/com.moatasim.enhanced-document-organization.plist"
echo ""

# Configuration reminder
echo "⚙️  Configuration Notes:"
echo ""
echo "1. Edit config.env to adjust paths and settings:"
echo "   - SYNC_HUB: Your central document location"
echo "   - ICLOUD_PATH: Path to your iCloud documents"
echo "   - GOOGLE_DRIVE_PATH: Path to your Google Drive documents"
echo ""
echo "2. The system uses these cloud paths by default:"
echo "   - iCloud: ~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Sync"
echo "   - Google Drive: ~/Library/CloudStorage/GoogleDrive-*/My Drive/Sync"
echo ""
echo "3. Make sure these directories exist or update the paths in config.env"
echo ""

# Usage examples
echo "🎯 Usage Examples:"
echo ""
echo "   ./drive_sync.sh status           # Check system status"
echo "   ./drive_sync.sh sync             # Sync files only"
echo "   ./drive_sync.sh organize         # Organize files only"
echo "   ./drive_sync.sh organize dry-run # Preview organization"
echo "   ./drive_sync.sh all              # Full workflow"
echo "   ./drive_sync.sh mcp start        # Start AI integration"
echo ""

echo "✅ Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Check/edit config.env for your specific paths"
echo "2. Run: ./drive_sync.sh status"
echo "3. Test with: ./drive_sync.sh organize dry-run"
echo "4. When ready: ./drive_sync.sh all"
echo ""
