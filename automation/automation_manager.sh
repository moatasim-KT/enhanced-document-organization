#!/bin/bash

# ============================================================================
# AUTOMATION MANAGER
# ============================================================================
# This script handles advanced automation features like intelligent scheduling,
# conditional operations, event-driven processing, and smart resource management.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRIVE_SYNC_ROOT="$(dirname "$SCRIPT_DIR")"

# Source the config file
source "$DRIVE_SYNC_ROOT/config.env"

# Function to log messages
log() {
    local message="$1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] AUTOMATION: $message" >> "$DRIVE_SYNC_ROOT/logs/automation.log"
}

# Show usage information
show_usage() {
    cat << EOF
Automation Manager

Usage: $(basename "$0") [command] [options]

Commands:
  run                Execute automated tasks based on configured rules.
  status             Show status of automated tasks and resource usage.
  help               Show this help message.

EOF
}

# Function to implement intelligent scheduling and conditional operations
run_automation() {
log "Starting automated tasks..."

# Get system metrics from MCP server
local metrics_json
metrics_json=$(node "$DRIVE_SYNC_ROOT/mcp/mcp_client.js" get_system_metrics '{}')
local metrics_status=$(echo "$metrics_json" | jq -r '.content[0].text')
log "Retrieved system metrics: $metrics_status"

# Parse metrics (example: disk usage, error count)
local disk_usage=$(echo "$metrics_status" | jq -r '.performance_metrics.disk_io' | sed 's/%//')
local errors_24h=$(echo "$metrics_status" | jq -r '.error_tracking.errors')

# Intelligent scheduling based on time and usage patterns
CURRENT_HOUR=$(date +%H)
if [[ "$CURRENT_HOUR" -ge 22 || "$CURRENT_HOUR" -le 5 ]]; then
    log "Running full workflow during off-peak hours."
    "$DRIVE_SYNC_ROOT/drive_sync.sh" all
elif [[ "$errors_24h" -gt 5 ]]; then
    log "High error rate detected ($errors_24h errors in 24h). Running quick sync only to avoid further issues."
    "$DRIVE_SYNC_ROOT/drive_sync.sh" sync sync
else
    log "Running quick sync only during peak hours or normal operation."
        "$DRIVE_SYNC_ROOT/drive_sync.sh" sync sync
fi

    # Conditional operation based on disk space (smart resource management)
    if [[ "$disk_usage" -gt 80 ]]; then
        log "Disk usage is high ($disk_usage%). Triggering cleanup."
        "$DRIVE_SYNC_ROOT/organize/cleanup_module.sh" run
    else
        log "Disk usage is normal ($disk_usage%). No cleanup needed."
    fi

    # Event-driven processing: This system currently relies on scheduled tasks.
    # For true event-driven processing (e.g., reacting instantly to new files),
    # external tools like `fswatch` or macOS LaunchDaemons configured for filesystem events
    # would be required to trigger `automation_manager.sh`.

    log "Automated tasks finished."
}

# Function to show automation status
show_automation_status() {
    echo "Automation Status:"
    echo "------------------"
    echo "Last run: $(tail -n 1 "$DRIVE_SYNC_ROOT/logs/automation.log" | cut -d']' -f1 | sed 's/^\[//')"
    echo "Log file: $DRIVE_SYNC_ROOT/logs/automation.log"
    echo ""
    echo "Recent Automation Log Entries:"
    tail -n 10 "$DRIVE_SYNC_ROOT/logs/automation.log" || echo "No recent log entries."
}

# Main execution logic
case "${1:-}" in
    run)
        run_automation
        ;;
    status)
        show_automation_status
        ;;
    help)
        show_usage
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
