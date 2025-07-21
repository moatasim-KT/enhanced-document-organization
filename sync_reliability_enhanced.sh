#!/bin/bash

# Enhanced Sync Reliability Script
# This script helps ensure reliable synchronization with cloud services

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/sync_reliability.log"

# Load configuration
source "$SCRIPT_DIR/config.env"

# Load circuit breaker implementation
source "$SCRIPT_DIR/circuit_breaker.sh"

# Function for logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if Google Drive is accessible
check_gdrive() {
    log "Checking Google Drive accessibility..."
    
    if [[ ! -d "$GDRIVE_PATH" ]]; then
        log "Google Drive path not found: $GDRIVE_PATH"
        return 1
    fi
    
    # Try to list files in Google Drive
    if timeout 10 ls -la "$GDRIVE_PATH" > /dev/null 2>&1; then
        log "Google Drive is accessible"
        return 0
    else
        log "Google Drive is not responding"
        return 1
    fi
}

# Check if iCloud is accessible
check_icloud() {
    log "Checking iCloud accessibility..."
    
    if [[ ! -d "$ICLOUD_PATH" ]]; then
        log "iCloud path not found: $ICLOUD_PATH"
        return 1
    fi
    
    # Try to list files in iCloud
    if timeout 10 ls -la "$ICLOUD_PATH" > /dev/null 2>&1; then
        log "iCloud is accessible"
        return 0
    else
        log "iCloud is not responding"
        return 1
    fi
}

# Ensure local sync hub exists
ensure_sync_hub() {
    log "Ensuring local sync hub exists..."
    
    if [[ ! -d "$SYNC_HUB" ]]; then
        log "Creating local sync hub: $SYNC_HUB"
        mkdir -p "$SYNC_HUB"
    fi
    
    # Create basic folder structure if it doesn't exist
    for dir in "📚 Research Papers" "🤖 AI & ML" "💻 Development" "🌐 Web Content" "📝 Notes & Drafts"; do
        if [[ ! -d "$SYNC_HUB/$dir" ]]; then
            log "Creating directory: $dir"
            mkdir -p "$SYNC_HUB/$dir"
        fi
    done
    
    log "Local sync hub is ready"
}

# Force download iCloud files
force_icloud_download() {
    log "Forcing download of iCloud files..."
    
    if [[ ! -d "$ICLOUD_PATH" ]]; then
        log "iCloud path not found: $ICLOUD_PATH"
        return 1
    fi
    
    # Use brctl to force download if available
    if command -v brctl &> /dev/null; then
        log "Using brctl to force download..."
        brctl download "$ICLOUD_PATH" &> /dev/null || true
        
        # Find and download .icloud files
        find "$ICLOUD_PATH" -name "*.icloud" -exec brctl download {} \; &> /dev/null || true
    else
        log "brctl not available, trying alternative method..."
        
        # Alternative method: touch files to force download
        find "$ICLOUD_PATH" -type f -name "*.icloud" -exec touch {} \; &> /dev/null || true
    fi
    
    log "iCloud download attempt completed"
}

# Wait for Google Drive to be ready
wait_for_gdrive() {
    log "Waiting for Google Drive to be ready..."
    
    local max_attempts=10
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        log "Attempt $attempt of $max_attempts"
        
        if check_gdrive; then
            log "Google Drive is ready"
            return 0
        fi
        
        log "Waiting 5 seconds before next attempt..."
        sleep 5
        ((attempt++))
    done
    
    log "Google Drive not ready after $max_attempts attempts"
    return 1
}

# Wait for iCloud to be ready
wait_for_icloud() {
    log "Waiting for iCloud to be ready..."
    
    local max_attempts=10
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        log "Attempt $attempt of $max_attempts"
        
        if check_icloud; then
            log "iCloud is ready"
            return 0
        fi
        
        log "Waiting 5 seconds before next attempt..."
        sleep 5
        ((attempt++))
    done
    
    log "iCloud not ready after $max_attempts attempts"
    return 1
}

# Perform reliable sync with Google Drive
sync_gdrive() {
    log "Performing reliable sync with Google Drive..."
    
    # Check circuit breaker before attempting sync
    if ! circuit_breaker_allows_operation "google_drive"; then
        log "Circuit breaker is open for Google Drive - skipping sync"
        return 1
    fi
    
    # Wait for Google Drive to be ready
    if ! wait_for_gdrive; then
        log "Skipping Google Drive sync due to accessibility issues"
        # Record failure in circuit breaker
        handle_circuit_breaker_result "google_drive" false "network" 1
        return 1
    fi
    
    # Ensure local sync hub exists
    ensure_sync_hub
    
    # Try sync with increased timeout
    log "Running Unison sync with Google Drive..."
    if timeout 300 unison -batch -ui text -times -prefer newer google_drive; then
        log "Google Drive sync completed successfully"
        # Record success in circuit breaker
        handle_circuit_breaker_result "google_drive" true
        return 0
    else
        local exit_code=$?
        log "Google Drive sync failed with exit code $exit_code"
        
        # Classify error type
        local error_type="transient"
        if [ $exit_code -eq 124 ] || [ $exit_code -eq 137 ]; then
            error_type="timeout"
        elif [ $exit_code -eq 1 ]; then
            # Check error output for specific patterns
            if grep -q "permission denied\|unauthorized\|auth" "$LOG_FILE"; then
                error_type="authentication"
            elif grep -q "conflict\|locked\|deadlock" "$LOG_FILE"; then
                error_type="conflict"
            elif grep -q "quota\|limit\|space" "$LOG_FILE"; then
                error_type="quota"
            fi
        fi
        
        # Get current failure count
        local failure_count=$(get_failure_count "google_drive")
        failure_count=$((failure_count + 1))
        
        # Try again with more aggressive options
        log "Retrying with fallback options..."
        if timeout 300 unison -batch -ui text -times -prefer newer -retry 5 google_drive; then
            log "Google Drive sync retry completed successfully"
            # Record success in circuit breaker
            handle_circuit_breaker_result "google_drive" true
            return 0
        else
            log "Google Drive sync retry also failed"
            # Record failure in circuit breaker
            handle_circuit_breaker_result "google_drive" false "$error_type" $failure_count
            return 1
        fi
    fi
}

# Perform reliable sync with iCloud
sync_icloud() {
    log "Performing reliable sync with iCloud..."
    
    # Check circuit breaker before attempting sync
    if ! circuit_breaker_allows_operation "icloud"; then
        log "Circuit breaker is open for iCloud - skipping sync"
        return 1
    fi
    
    # Force download iCloud files
    force_icloud_download
    
    # Wait for iCloud to be ready
    if ! wait_for_icloud; then
        log "Skipping iCloud sync due to accessibility issues"
        # Record failure in circuit breaker
        handle_circuit_breaker_result "icloud" false "network" 1
        return 1
    fi
    
    # Ensure local sync hub exists
    ensure_sync_hub
    
    # Try sync with increased timeout
    log "Running Unison sync with iCloud..."
    if timeout 300 unison -batch -ui text -times -prefer newer icloud; then
        log "iCloud sync completed successfully"
        # Record success in circuit breaker
        handle_circuit_breaker_result "icloud" true
        return 0
    else
        local exit_code=$?
        log "iCloud sync failed with exit code $exit_code"
        
        # Classify error type
        local error_type="transient"
        if [ $exit_code -eq 124 ] || [ $exit_code -eq 137 ]; then
            error_type="timeout"
        elif [ $exit_code -eq 1 ]; then
            # Check error output for specific patterns
            if grep -q "permission denied\|unauthorized\|auth" "$LOG_FILE"; then
                error_type="authentication"
            elif grep -q "conflict\|locked\|deadlock" "$LOG_FILE"; then
                error_type="conflict"
            elif grep -q "quota\|limit\|space" "$LOG_FILE"; then
                error_type="quota"
            fi
        fi
        
        # Get current failure count
        local failure_count=$(get_failure_count "icloud")
        failure_count=$((failure_count + 1))
        
        # Try again with more aggressive options
        log "Retrying with fallback options..."
        if timeout 300 unison -batch -ui text -times -prefer newer -retry 5 icloud; then
            log "iCloud sync retry completed successfully"
            # Record success in circuit breaker
            handle_circuit_breaker_result "icloud" true
            return 0
        else
            log "iCloud sync retry also failed"
            # Record failure in circuit breaker
            handle_circuit_breaker_result "icloud" false "$error_type" $failure_count
            return 1
        fi
    fi
}

# Display circuit breaker status
display_circuit_breaker_status() {
    log "Circuit Breaker Status:"
    get_circuit_breaker_status | while read -r line; do
        log "  $line"
    done
}

# Reset circuit breakers if requested
reset_circuit_breakers() {
    if [[ "$1" == "--reset-circuit-breakers" ]]; then
        log "Resetting all circuit breakers..."
        reset_circuit_breaker "icloud"
        reset_circuit_breaker "google_drive"
        log "All circuit breakers have been reset"
        return 0
    fi
    return 1
}

# Main function
main() {
    log "Starting enhanced sync reliability checks..."
    
    # Initialize circuit breaker
    initialize_circuit_breaker
    
    # Check if reset is requested
    if reset_circuit_breakers "$@"; then
        display_circuit_breaker_status
        return 0
    fi
    
    # Display current circuit breaker status
    display_circuit_breaker_status
    
    # Ensure local sync hub exists
    ensure_sync_hub
    
    # Check cloud services
    check_icloud
    check_gdrive
    
    # Force download iCloud files
    force_icloud_download
    
    # Perform syncs
    sync_icloud
    sync_gdrive
    
    # Display final circuit breaker status
    display_circuit_breaker_status
    
    log "Enhanced sync reliability checks completed"
}

# Run main function
main "$@"