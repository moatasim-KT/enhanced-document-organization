#!/bin/bash

# ============================================================================
# CONSOLIDATED SYNC MODULE
# ============================================================================
# This module combines sync_manager.sh, sync_reliability_enhanced.sh, and circuit_breaker.sh
# into a single, comprehensive sync management system

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PARENT_DIR/sync_module.log"
CIRCUIT_BREAKER_FILE="$PARENT_DIR/circuit_breaker_state.json"
CIRCUIT_BREAKER_LOG="$PARENT_DIR/circuit_breaker.log"

# Load configuration
source "$PARENT_DIR/config.env"

# ============================================================================
# CIRCUIT BREAKER IMPLEMENTATION
# ============================================================================

# Default thresholds
DEFAULT_FAILURE_THRESHOLD=5
DEFAULT_RESET_TIMEOUT=1800  # 30 minutes
DEFAULT_HALF_OPEN_TIMEOUT=300  # 5 minutes

# Error type specific thresholds - use compatible array declaration
# Check if bash version supports associative arrays
if [[ "${BASH_VERSINFO[0]}" -ge 4 ]]; then
    declare -A FAILURE_THRESHOLDS
    declare -A RESET_TIMEOUTS
else
    # Fallback for older bash versions
    FAILURE_THRESHOLDS=()
    RESET_TIMEOUTS=()
fi

# Function for logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Circuit breaker specific logging
log_circuit_breaker() {
    local level=$1
    local message=$2
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message" | tee -a "$CIRCUIT_BREAKER_LOG"
    log "[$level] [CircuitBreaker] $message"
}

# Initialize circuit breaker configuration
initialize_circuit_breaker_config() {
    if [[ "${BASH_VERSINFO[0]}" -ge 4 ]]; then
        # Set error-specific thresholds using associative arrays
        FAILURE_THRESHOLDS["authentication"]=3
        FAILURE_THRESHOLDS["conflict"]=4
        FAILURE_THRESHOLDS["quota"]=2
        FAILURE_THRESHOLDS["network"]=6
        FAILURE_THRESHOLDS["configuration"]=3
        FAILURE_THRESHOLDS["transient"]=8
        FAILURE_THRESHOLDS["permanent"]=1
        FAILURE_THRESHOLDS["partial_sync"]=5
        
        # Set error-specific reset timeouts (in seconds)
        RESET_TIMEOUTS["authentication"]=3600   # 1 hour
        RESET_TIMEOUTS["conflict"]=1800         # 30 minutes
        RESET_TIMEOUTS["quota"]=7200            # 2 hours
        RESET_TIMEOUTS["network"]=900           # 15 minutes
        RESET_TIMEOUTS["configuration"]=3600    # 1 hour
        RESET_TIMEOUTS["transient"]=600         # 10 minutes
        RESET_TIMEOUTS["permanent"]=86400       # 24 hours
        RESET_TIMEOUTS["partial_sync"]=1200     # 20 minutes
    else
        # Fallback for older bash versions - use functions instead of associative arrays
        log_circuit_breaker "INFO" "Using compatibility mode for older Bash versions"
    fi
}

# Initialize circuit breaker state file
initialize_circuit_breaker() {
    if [ ! -f "$CIRCUIT_BREAKER_FILE" ]; then
        log_circuit_breaker "INFO" "Creating circuit breaker state file"
        cat > "$CIRCUIT_BREAKER_FILE" << 'EOF'
{
  "services": {}
}
EOF
    fi
}

# Get circuit breaker state for a service
get_circuit_breaker_state() {
    local service=$1
    
    initialize_circuit_breaker
    
    if command -v jq >/dev/null 2>&1; then
        local state=$(jq -r ".services[\"$service\"].state // \"closed\"" "$CIRCUIT_BREAKER_FILE" 2>/dev/null)
        if [ -z "$state" ] || [ "$state" = "null" ]; then
            echo "closed"
        else
            echo "$state"
        fi
    else
        # Fallback if jq is not available
        if grep -q "\"$service\"" "$CIRCUIT_BREAKER_FILE" 2>/dev/null; then
            if grep -q "\"state\":\"open\"" "$CIRCUIT_BREAKER_FILE" 2>/dev/null; then
                echo "open"
            elif grep -q "\"state\":\"half-open\"" "$CIRCUIT_BREAKER_FILE" 2>/dev/null; then
                echo "half-open"
            else
                echo "closed"
            fi
        else
            echo "closed"
        fi
    fi
}

# Get failure count for a service
get_failure_count() {
    local service=$1
    
    initialize_circuit_breaker
    
    if command -v jq >/dev/null 2>&1; then
        local count=$(jq -r ".services[\"$service\"].failure_count // 0" "$CIRCUIT_BREAKER_FILE" 2>/dev/null)
        if [ -z "$count" ] || [ "$count" = "null" ]; then
            echo "0"
        else
            echo "$count"
        fi
    else
        # Fallback if jq is not available
        echo "0"
    fi
}

# Get last failure time for a service
get_last_failure_time() {
    local service=$1
    
    initialize_circuit_breaker
    
    if command -v jq >/dev/null 2>&1; then
        local time=$(jq -r ".services[\"$service\"].last_failure_time // \"\"" "$CIRCUIT_BREAKER_FILE" 2>/dev/null)
        if [ -z "$time" ] || [ "$time" = "null" ]; then
            echo ""
        else
            echo "$time"
        fi
    else
        # Fallback if jq is not available
        echo ""
    fi
}

# Get error type for a service
get_circuit_breaker_error_type() {
    local service=$1
    
    initialize_circuit_breaker
    
    if command -v jq >/dev/null 2>&1; then
        local error_type=$(jq -r ".services[\"$service\"].error_type // \"\"" "$CIRCUIT_BREAKER_FILE" 2>/dev/null)
        if [ -z "$error_type" ] || [ "$error_type" = "null" ]; then
            echo ""
        else
            echo "$error_type"
        fi
    else
        # Fallback if jq is not available
        echo ""
    fi
}

# Update circuit breaker state
update_circuit_breaker_state() {
    local service=$1
    local new_state=$2
    local failure_count=${3:-0}
    local error_type=${4:-"unknown"}
    
    initialize_circuit_breaker
    
    local timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
    
    if command -v jq >/dev/null 2>&1; then
        local temp_file=$(mktemp)
        jq --arg service "$service" \
           --arg state "$new_state" \
           --arg timestamp "$timestamp" \
           --argjson failure_count "$failure_count" \
           --arg error_type "$error_type" \
           '
           .services[$service] = {
               "state": $state,
               "failure_count": $failure_count,
               "last_failure_time": $timestamp,
               "last_updated": $timestamp,
               "error_type": $error_type
           }
           ' "$CIRCUIT_BREAKER_FILE" > "$temp_file" && mv "$temp_file" "$CIRCUIT_BREAKER_FILE"
    else
        # Fallback if jq is not available - create a simple JSON structure
        local json_content=$(cat "$CIRCUIT_BREAKER_FILE" 2>/dev/null || echo '{"services":{}}')
        # This is a very basic approach and not robust for complex JSON
        # In production, jq should be required
        echo "$json_content" | sed "s/\"services\":{/\"services\":{\"$service\":{\"state\":\"$new_state\",\"failure_count\":$failure_count,\"last_failure_time\":\"$timestamp\",\"last_updated\":\"$timestamp\",\"error_type\":\"$error_type\"},/" > "$CIRCUIT_BREAKER_FILE"
    fi
    
    log_circuit_breaker "INFO" "Circuit breaker for $service updated to state: $new_state (failures: $failure_count, error: $error_type)"
}

# Check if circuit breaker allows operation
circuit_breaker_allows_operation() {
    local service=$1
    
    local state=$(get_circuit_breaker_state "$service")
    local last_failure_time=$(get_last_failure_time "$service")
    local error_type=$(get_circuit_breaker_error_type "$service")
    
    # Get reset timeout based on error type
    local reset_timeout=$(get_reset_timeout "$error_type")
    local half_open_timeout=$DEFAULT_HALF_OPEN_TIMEOUT
    
    case "$state" in
        "closed")
            return 0  # Allow operation
            ;;
        "open")
            # Check if it's time to transition to half-open
            if [ -n "$last_failure_time" ]; then
                local current_time=$(date -u +%s)
                local failure_time
                
                # Handle different date formats for macOS and Linux
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    # macOS
                    failure_time=$(date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$last_failure_time" "+%s" 2>/dev/null)
                else
                    # Linux and others
                    failure_time=$(date -d "$last_failure_time" +%s 2>/dev/null)
                fi
                
                if [ -n "$failure_time" ] && [ $((current_time - failure_time)) -ge $reset_timeout ]; then
                    # Transition to half-open state
                    update_circuit_breaker_state "$service" "half-open" "$(get_failure_count "$service")" "$error_type"
                    log_circuit_breaker "INFO" "Circuit breaker for $service transitioned to half-open state after timeout"
                    return 0  # Allow one test operation
                fi
            fi
            
            log_circuit_breaker "WARN" "Circuit breaker for $service is open - operation blocked"
            return 1  # Block operation
            ;;
        "half-open")
            log_circuit_breaker "INFO" "Circuit breaker for $service is half-open - allowing test operation"
            return 0  # Allow one test operation
            ;;
        *)
            return 0  # Default to allow
            ;;
    esac
}

# Handle circuit breaker result after an operation
handle_circuit_breaker_result() {
    local service=$1
    local success=$2
    local error_type=${3:-"unknown"}
    local consecutive_failures=${4:-0}
    
    local current_state=$(get_circuit_breaker_state "$service")
    local current_count=$(get_failure_count "$service")
    
    # Get failure threshold based on error type
    local failure_threshold=$(get_failure_threshold "$error_type")
    
    if [ "$success" = true ]; then
        # Operation succeeded
        if [ "$current_state" = "half-open" ]; then
            # If in half-open state and operation succeeded, close the circuit
            update_circuit_breaker_state "$service" "closed" 0 "$error_type"
            log_circuit_breaker "INFO" "Circuit breaker for $service closed after successful test operation"
        elif [ "$current_state" = "open" ]; then
            # This shouldn't happen normally, but handle it just in case
            update_circuit_breaker_state "$service" "closed" 0 "$error_type"
            log_circuit_breaker "INFO" "Circuit breaker for $service closed after successful operation while open"
        elif [ $current_count -gt 0 ]; then
            # Reset failure count on success if there were previous failures
            update_circuit_breaker_state "$service" "closed" 0 "$error_type"
            log_circuit_breaker "INFO" "Circuit breaker for $service reset failure count after success"
        fi
    else
        # Operation failed
        if [ "$current_state" = "half-open" ]; then
            # If in half-open state and operation failed, reopen the circuit
            update_circuit_breaker_state "$service" "open" $((current_count + 1)) "$error_type"
            log_circuit_breaker "WARN" "Circuit breaker for $service reopened after failed test operation"
        elif [ "$current_state" = "closed" ]; then
            # Increment failure count
            local new_count=$((current_count + 1))
            
            # If failure count exceeds threshold, open the circuit
            if [ $new_count -ge $failure_threshold ]; then
                update_circuit_breaker_state "$service" "open" $new_count "$error_type"
                log_circuit_breaker "WARN" "Circuit breaker for $service opened after $new_count consecutive failures"
            else
                update_circuit_breaker_state "$service" "closed" $new_count "$error_type"
                log_circuit_breaker "INFO" "Circuit breaker for $service incremented failure count to $new_count"
            fi
        elif [ "$current_state" = "open" ]; then
            # Update failure count while circuit is open
            update_circuit_breaker_state "$service" "open" $((current_count + 1)) "$error_type"
            log_circuit_breaker "WARN" "Circuit breaker for $service recorded additional failure while open"
        fi
    fi
}

# Reset circuit breaker for a service
reset_circuit_breaker() {
    local service=$1
    
    update_circuit_breaker_state "$service" "closed" 0 "reset"
    log_circuit_breaker "INFO" "Circuit breaker for $service manually reset"
}

# Reset all circuit breakers
reset_all_circuit_breakers() {
    log_circuit_breaker "INFO" "Resetting all circuit breakers"
    
    if command -v jq >/dev/null 2>&1; then
        local services=$(jq -r '.services | keys[]' "$CIRCUIT_BREAKER_FILE" 2>/dev/null)
        
        if [ -n "$services" ]; then
            for service in $services; do
                reset_circuit_breaker "$service"
            done
        else
            log_circuit_breaker "INFO" "No circuit breakers to reset"
        fi
    else
        log_circuit_breaker "WARN" "jq is required for resetting all circuit breakers"
    fi
}

# Get circuit breaker status report
get_circuit_breaker_status() {
    initialize_circuit_breaker
    
    log_circuit_breaker "INFO" "Generating circuit breaker status report"
    
    if command -v jq >/dev/null 2>&1; then
        local services=$(jq -r '.services | keys[]' "$CIRCUIT_BREAKER_FILE" 2>/dev/null)
        
        echo "Circuit Breaker Status Report"
        echo "============================"
        echo "Generated at: $(date '+%Y-%m-%d %H:%M:%S')"
        echo ""
        
        if [ -z "$services" ]; then
            echo "No circuit breaker states recorded."
            return 0
        fi
        
        echo "Service | State | Failures | Last Failure | Error Type"
        echo "--------|-------|----------|--------------|------------"
        
        for service in $services; do
            local state=$(jq -r ".services[\"$service\"].state" "$CIRCUIT_BREAKER_FILE")
            local failures=$(jq -r ".services[\"$service\"].failure_count" "$CIRCUIT_BREAKER_FILE")
            local last_failure=$(jq -r ".services[\"$service\"].last_failure_time" "$CIRCUIT_BREAKER_FILE")
            local error_type=$(jq -r ".services[\"$service\"].error_type" "$CIRCUIT_BREAKER_FILE")
            
            echo "$service | $state | $failures | $last_failure | $error_type"
        done
    else
        echo "jq is required for detailed circuit breaker status reporting"
    fi
}

# Get failure threshold for an error type
get_failure_threshold() {
    local error_type=$1
    
    if [[ "${BASH_VERSINFO[0]}" -ge 4 ]]; then
        echo "${FAILURE_THRESHOLDS[$error_type]:-$DEFAULT_FAILURE_THRESHOLD}"
    else
        # Fallback for older bash versions
        case "$error_type" in
            "authentication") echo "3" ;;
            "conflict") echo "4" ;;
            "quota") echo "2" ;;
            "network") echo "6" ;;
            "configuration") echo "3" ;;
            "transient") echo "8" ;;
            "permanent") echo "1" ;;
            "partial_sync") echo "5" ;;
            *) echo "$DEFAULT_FAILURE_THRESHOLD" ;;
        esac
    fi
}

# Get reset timeout for an error type
get_reset_timeout() {
    local error_type=$1
    
    if [[ "${BASH_VERSINFO[0]}" -ge 4 ]]; then
        echo "${RESET_TIMEOUTS[$error_type]:-$DEFAULT_RESET_TIMEOUT}"
    else
        # Fallback for older bash versions
        case "$error_type" in
            "authentication") echo "3600" ;;  # 1 hour
            "conflict") echo "1800" ;;        # 30 minutes
            "quota") echo "7200" ;;           # 2 hours
            "network") echo "900" ;;          # 15 minutes
            "configuration") echo "3600" ;;   # 1 hour
            "transient") echo "600" ;;        # 10 minutes
            "permanent") echo "86400" ;;      # 24 hours
            "partial_sync") echo "1200" ;;    # 20 minutes
            *) echo "$DEFAULT_RESET_TIMEOUT" ;;
        esac
    fi
}

# ============================================================================
# SYNC RELIABILITY FUNCTIONS
# ============================================================================

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

# ============================================================================
# MAIN FUNCTIONS
# ============================================================================

# Run sync with reliability enhancements
run_sync() {
    log "Starting enhanced sync process..."
    
    # Initialize circuit breaker
    initialize_circuit_breaker_config
    initialize_circuit_breaker
    
    # Check if reset is requested
    if [[ "$#" -gt 0 ]] && reset_circuit_breakers "$1"; then
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
    
    log "Enhanced sync process completed"
}

# Check health of sync services
check_health() {
    log "Checking sync health..."
    
    # Initialize circuit breaker
    initialize_circuit_breaker_config
    initialize_circuit_breaker
    
    # Display circuit breaker status
    display_circuit_breaker_status
    
    # Check cloud services
    check_icloud
    check_gdrive
    
    # Check for problematic files
    log "Checking for problematic files..."
    
    # Check iCloud
    if [[ -d "$ICLOUD_PATH" ]]; then
        local problematic_files=$(find "$ICLOUD_PATH" -name "*:*" -o -name "*\"*" -o -name "*<*" -o -name "*>*" -o -name "*|*" 2>/dev/null | head -5)
        if [[ -n "$problematic_files" ]]; then
            log "WARNING: Found files with problematic characters in iCloud:"
            echo "$problematic_files" | while read -r file; do
                log "  - $(basename "$file")"
            done
        else
            log "No problematic files found in iCloud"
        fi
    fi
    
    # Check Google Drive
    if [[ -d "$GDRIVE_PATH" ]]; then
        local problematic_files=$(find "$GDRIVE_PATH" -name "*:*" -o -name "*\"*" -o -name "*<*" -o -name "*>*" -o -name "*|*" 2>/dev/null | head -5)
        if [[ -n "$problematic_files" ]]; then
            log "WARNING: Found files with problematic characters in Google Drive:"
            echo "$problematic_files" | while read -r file; do
                log "  - $(basename "$file")"
            done
        else
            log "No problematic files found in Google Drive"
        fi
    fi
    
    # Check disk space
    log "Checking disk space..."
    df -h | grep -E "Filesystem|/$"
    
    log "Health check completed"
}

# Show usage information
show_usage() {
    cat << EOF
Usage: $(basename "$0") [command] [options]

Commands:
  sync                Run sync process with reliability enhancements
  health              Check sync health
  reset-circuit       Reset circuit breakers
  status              Show sync and circuit breaker status

Options:
  --reset-circuit-breakers  Reset all circuit breakers
  --force                   Force sync even during quiet hours

Examples:
  $(basename "$0") sync
  $(basename "$0") health
  $(basename "$0") reset-circuit
  $(basename "$0") status
EOF
}

# ============================================================================
# MAIN SCRIPT
# ============================================================================

# Initialize the circuit breaker configuration
initialize_circuit_breaker_config

# Main function
main() {
    if [[ "$#" -eq 0 ]]; then
        show_usage
        exit 1
    fi
    
    local command="$1"
    shift
    
    case "$command" in
        sync)
            run_sync "$@"
            ;;
        health)
            check_health
            ;;
        reset-circuit)
            reset_all_circuit_breakers
            display_circuit_breaker_status
            ;;
        status)
            display_circuit_breaker_status
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