#!/bin/bash

# Enhanced Document Organization Automation
# Implements sync-organize-sync workflow

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/automation.log"
ERROR_LOG="$SCRIPT_DIR/automation_error.log"

# Function for logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function for error logging
log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a "$ERROR_LOG" >&2
}

# Function to run unison with retry
run_unison() {
    local profile="$1"
    local max_retries=3
    local retry_count=0
    local timeout=120
    
    while [ $retry_count -lt $max_retries ]; do
        log "Running unison with profile: $profile (attempt $((retry_count+1))/$max_retries)"
        
        if timeout $timeout /opt/homebrew/bin/unison -batch "$profile"; then
            log "✅ $profile sync completed successfully"
            return 0
        else
            local exit_code=$?
            log_error "❌ $profile sync failed with exit code $exit_code"
            
            # Increase timeout for next attempt
            timeout=$((timeout + 60))
            retry_count=$((retry_count + 1))
            
            if [ $retry_count -lt $max_retries ]; then
                log "Retrying $profile sync in 10 seconds..."
                sleep 10
            fi
        fi
    done
    
    log_error "❌ $profile sync failed after $max_retries attempts"
    return 1
}

# Load configuration
if [[ -f "$SCRIPT_DIR/config.env" ]]; then
    source "$SCRIPT_DIR/config.env"
    log "Configuration loaded from $SCRIPT_DIR/config.env"
else
    log_error "Configuration file not found: $SCRIPT_DIR/config.env"
    exit 1
fi

# Check if Unison is installed
if ! command -v unison &> /dev/null; then
    log_error "Unison is not installed or not in PATH"
    exit 1
fi

# Check if sync directories exist
if [[ ! -d "$SYNC_HUB" ]]; then
    log_error "Local sync hub directory not found: $SYNC_HUB"
    log "Creating local sync hub directory..."
    mkdir -p "$SYNC_HUB"
fi

if [[ ! -d "$ICLOUD_PATH" ]]; then
    log_error "iCloud directory not found: $ICLOUD_PATH"
    exit 1
fi

if [[ ! -d "$GDRIVE_PATH" ]]; then
    log_error "Google Drive directory not found: $GDRIVE_PATH"
    exit 1
fi

# Create basic folder structure in sync hub to avoid initial sync issues
log "Creating basic folder structure in sync hub..."
mkdir -p "$SYNC_HUB/📚 Research Papers"
mkdir -p "$SYNC_HUB/🤖 AI & ML"
mkdir -p "$SYNC_HUB/💻 Development"
mkdir -p "$SYNC_HUB/🌐 Web Content"
mkdir -p "$SYNC_HUB/📝 Notes & Drafts"

# Step 1: First sync - pull changes from cloud services
log "Step 1: Syncing from cloud services to local hub..."

log "Syncing from iCloud to local hub..."
run_unison "icloud"

log "Syncing from Google Drive to local hub..."
run_unison "google_drive"

# Step 2: Organize documents
log "Step 2: Organizing documents..."

# Modify the organize_documents_enhanced.sh script to use SYNC_HUB as SOURCE_DIR
if [[ -f "$SCRIPT_DIR/organize_documents_enhanced.sh" ]]; then
    log "Running organization script directly with SYNC_HUB as source..."
    
    # Create a temporary modified version of the script
    TEMP_SCRIPT="$SCRIPT_DIR/.temp_organize_script.sh"
    cp "$SCRIPT_DIR/organize_documents_enhanced.sh" "$TEMP_SCRIPT"
    
    # Replace the SOURCE_DIR line with our SYNC_HUB
    sed -i '' "s|SOURCE_DIR=\"[^\"]*\"|SOURCE_DIR=\"$SYNC_HUB\"|" "$TEMP_SCRIPT"
    
    # Run the modified script
    chmod +x "$TEMP_SCRIPT"
    if "$TEMP_SCRIPT"; then
        log "✅ Document organization completed successfully"
    else
        log_error "❌ Document organization failed with exit code $?"
    fi
    
    # Clean up
    rm -f "$TEMP_SCRIPT"
else
    log_error "Organization script not found: $SCRIPT_DIR/organize_documents_enhanced.sh"
fi

# Step 3: Second sync - push organized changes back to cloud services
log "Step 3: Syncing from local hub to cloud services..."

log "Syncing from local hub to iCloud..."
run_unison "icloud"

log "Syncing from local hub to Google Drive..."
run_unison "google_drive"

log "Sync-organize-sync workflow completed"