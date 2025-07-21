#!/bin/bash

# Script to check the status of the Enhanced Document Organization automation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/automation.log"
ERROR_LOG="$SCRIPT_DIR/automation_error.log"
LAUNCHD_OUT="$SCRIPT_DIR/launchd_out.log"
LAUNCHD_ERR="$SCRIPT_DIR/launchd_err.log"

echo "=== Enhanced Document Organization Automation Status ==="

# Check LaunchAgent status
echo "LaunchAgent Status:"
if launchctl list | grep -q "com.moatasim.enhanced-document-organization"; then
    echo "✅ LaunchAgent is loaded and active"
else
    echo "❌ LaunchAgent is not loaded"
fi

# Check last run time
if [[ -f "$LOG_FILE" ]]; then
    last_run=$(grep "Sync-organize-sync workflow completed" "$LOG_FILE" | tail -1)
    if [[ -n "$last_run" ]]; then
        echo "Last successful run: $last_run"
    else
        echo "No successful runs found in log"
    fi
    
    echo ""
    echo "Recent activity (last 5 log entries):"
    tail -5 "$LOG_FILE"
else
    echo "No automation log found"
fi

# Check for errors
echo ""
echo "Recent errors:"
if [[ -f "$ERROR_LOG" ]]; then
    tail -5 "$ERROR_LOG" || echo "No recent errors"
else
    echo "No error log found"
fi

# Check sync directories
echo ""
echo "Sync Directory Status:"
source "$SCRIPT_DIR/config.env" 2>/dev/null || true

if [[ -d "$SYNC_HUB" ]]; then
    file_count=$(find "$SYNC_HUB" -type f -name "*.md" 2>/dev/null | wc -l)
    echo "Local Hub: $file_count Markdown files"
else
    echo "Local Hub directory not found"
fi

if [[ -d "$ICLOUD_PATH" ]]; then
    file_count=$(find "$ICLOUD_PATH" -type f -name "*.md" 2>/dev/null | wc -l)
    echo "iCloud: $file_count Markdown files"
else
    echo "iCloud directory not found"
fi

if [[ -d "$GDRIVE_PATH" ]]; then
    file_count=$(find "$GDRIVE_PATH" -type f -name "*.md" 2>/dev/null | wc -l)
    echo "Google Drive: $file_count Markdown files"
else
    echo "Google Drive directory not found"
fi

echo ""
echo "To manually run the automation: ./run_automation.sh"
echo "To test the automation setup: ./test_automation.sh"