# Integration Examples

This document provides examples of how the sync and organize modules work together in various scenarios.

## Basic Integration Workflow

The following example demonstrates a complete workflow that integrates both modules:

```bash
#!/bin/bash

# Set up error handling
set -euo pipefail

# Log file for the integration workflow
LOG_FILE="integration_workflow.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Step 1: Check health of sync services
log "Checking sync health..."
./sync/sync_module.sh health

# Step 2: Sync files from cloud services
log "Syncing files from cloud services..."
if ./sync/sync_module.sh sync; then
    log "Sync completed successfully"
else
    log "Sync failed, checking circuit breaker status..."
    ./sync/sync_module.sh status
    
    # Try to reset circuit breakers if sync failed
    log "Resetting circuit breakers..."
    ./sync/sync_module.sh reset-circuit-breakers
    
    # Try sync again
    log "Retrying sync..."
    if ./sync/sync_module.sh sync; then
        log "Sync completed successfully on retry"
    else
        log "Sync failed again, aborting workflow"
        exit 1
    fi
fi

# Step 3: Organize the synced files
log "Organizing files..."
if ./organize/organize_module.sh run; then
    log "Organization completed successfully"
else
    log "Organization failed, checking status..."
    ./organize/organize_module.sh status
    exit 1
fi

# Step 4: Final health check
log "Performing final health check..."
./sync/sync_module.sh health

log "Integration workflow completed successfully"
```

## Automated Daily Workflow

This example shows how to set up a daily workflow that syncs and organizes files:

```bash
#!/bin/bash

# Set up error handling
set -euo pipefail

# Log file with date stamp
LOG_FILE="daily_workflow_$(date '+%Y-%m-%d').log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Step 1: Process inbox folders only (faster daily operation)
log "Processing inbox folders..."
./organize/organize_module.sh process-inbox

# Step 2: Sync with cloud services
log "Syncing with cloud services..."
./sync/sync_module.sh sync

# Step 3: Process inbox folders again (to categorize newly synced files)
log "Processing newly synced files..."
./organize/organize_module.sh process-inbox

log "Daily workflow completed"
```

## Error Recovery Integration

This example demonstrates how to handle errors across modules:

```bash
#!/bin/bash

# Set up error handling
set -euo pipefail

# Log file for error recovery
LOG_FILE="error_recovery.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to check and handle circuit breaker status
check_circuit_breakers() {
    log "Checking circuit breaker status..."
    
    # Get circuit breaker status
    status_output=$(./sync/sync_module.sh status)
    
    # Check if any circuit breakers are open
    if echo "$status_output" | grep -q "open"; then
        log "Found open circuit breakers, attempting reset..."
        ./sync/sync_module.sh reset-circuit-breakers
        return 1
    fi
    
    return 0
}

# Function to validate folder structure
validate_folders() {
    log "Validating folder structure..."
    
    # Run organize module in status mode to check folder structure
    if ./organize/organize_module.sh status | grep -q "missing"; then
        log "Folder structure issues detected, running repair..."
        ./organize/organize_module.sh run --repair-structure
        return 1
    fi
    
    return 0
}

# Main recovery workflow
log "Starting error recovery workflow..."

# Step 1: Check and reset circuit breakers if needed
check_circuit_breakers
circuit_breaker_status=$?

# Step 2: Validate and repair folder structure if needed
validate_folders
folder_structure_status=$?

# Step 3: If any issues were fixed, run the full workflow again
if [[ $circuit_breaker_status -eq 1 || $folder_structure_status -eq 1 ]]; then
    log "Issues were fixed, running full workflow..."
    
    # Sync files
    log "Syncing files..."
    ./sync/sync_module.sh sync
    
    # Organize files
    log "Organizing files..."
    ./organize/organize_module.sh run
    
    log "Recovery workflow completed successfully"
else
    log "No issues detected, system is healthy"
fi
```

## Cross-Module Configuration Sharing

This example demonstrates how to share configuration between modules:

```bash
#!/bin/bash

# Set up error handling
set -euo pipefail

# Create a temporary configuration file
TMP_CONFIG="temp_config.env"

# Base configuration
cat > "$TMP_CONFIG" << EOF
# Shared configuration for sync and organize modules
ICLOUD_PATH="/Users/username/Library/Mobile Documents/com~apple~CloudDocs"
GDRIVE_PATH="/Users/username/Google Drive"
SYNC_HUB="/Users/username/Documents/Sync_Hub"
INBOX_LOCATIONS=("/Users/username/Downloads" "/Users/username/Desktop")

# Sync module configuration
ENABLE_CIRCUIT_BREAKER=true
NETWORK_FAILURE_THRESHOLD=5
AUTHENTICATION_FAILURE_THRESHOLD=3

# Organize module configuration
ENABLE_CONTENT_ANALYSIS=true
ENABLE_SMART_CATEGORIZATION=true
ENABLE_SIMPLIFIED_CATEGORIZATION=true
EOF

# Run both modules with the shared configuration
SYNC_CONFIG_PATH="$TMP_CONFIG" ./sync/sync_module.sh sync
ORGANIZE_CONFIG_PATH="$TMP_CONFIG" ./organize/organize_module.sh run

# Clean up
rm "$TMP_CONFIG"
```

## Monitoring Integration

This example shows how to monitor both modules:

```bash
#!/bin/bash

# Set up error handling
set -euo pipefail

# Log file for monitoring
LOG_FILE="monitoring.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to check sync health
check_sync_health() {
    log "Checking sync health..."
    
    # Run sync health check and capture output
    health_output=$(./sync/sync_module.sh health)
    
    # Check for issues
    if echo "$health_output" | grep -q "issue\|error\|problem"; then
        log "Sync health issues detected:"
        log "$health_output"
        return 1
    fi
    
    log "Sync health check passed"
    return 0
}

# Function to check organization status
check_organize_status() {
    log "Checking organization status..."
    
    # Run organize status check and capture output
    status_output=$(./organize/organize_module.sh status)
    
    # Check for issues
    if echo "$status_output" | grep -q "issue\|error\|problem"; then
        log "Organization issues detected:"
        log "$status_output"
        return 1
    fi
    
    log "Organization status check passed"
    return 0
}

# Main monitoring workflow
log "Starting monitoring workflow..."

# Check sync health
check_sync_health
sync_health_status=$?

# Check organization status
check_organize_status
organize_status=$?

# Generate overall health report
log "Generating health report..."

if [[ $sync_health_status -eq 0 && $organize_status -eq 0 ]]; then
    log "OVERALL STATUS: HEALTHY - All systems operational"
else
    log "OVERALL STATUS: ISSUES DETECTED - Check logs for details"
    
    # Send notification (example)
    echo "System issues detected, please check logs" | mail -s "Document System Alert" admin@example.com
fi

log "Monitoring workflow completed"
```

## Scheduled Integration with Cron

This example shows how to set up a cron job for regular sync and organization:

```bash
# Example crontab entries

# Sync every hour during work hours (8 AM to 6 PM, Monday to Friday)
0 8-18 * * 1-5 cd /path/to/project && ./sync/sync_module.sh sync >> /path/to/logs/hourly_sync.log 2>&1

# Process inbox folders every 30 minutes during work hours
30 8-18 * * 1-5 cd /path/to/project && ./organize/organize_module.sh process-inbox >> /path/to/logs/inbox_processing.log 2>&1

# Full organization once a day at 7 PM
0 19 * * * cd /path/to/project && ./organize/organize_module.sh run >> /path/to/logs/daily_organization.log 2>&1

# Health check every morning at 7 AM
0 7 * * * cd /path/to/project && ./sync/sync_module.sh health >> /path/to/logs/health_check.log 2>&1

# Weekly full system check on Sunday at midnight
0 0 * * 0 cd /path/to/project && ./path/to/integration_scripts/weekly_check.sh >> /path/to/logs/weekly_check.log 2>&1
```

The `weekly_check.sh` script could combine both modules for a thorough system check:

```bash
#!/bin/bash

# Set up error handling
set -euo pipefail

echo "Starting weekly system check at $(date)"

# Reset all circuit breakers
./sync/sync_module.sh reset-circuit-breakers

# Check sync health
./sync/sync_module.sh health

# Run full sync
./sync/sync_module.sh sync

# Check folder structure
./organize/organize_module.sh status

# Run full organization
./organize/organize_module.sh run

echo "Weekly system check completed at $(date)"
```