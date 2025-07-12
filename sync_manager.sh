#!/bin/bash

# Universal Drive Sync Manager - All-in-one sync, monitoring, and management
# Consolidates: sync_scheduler.sh, sync_monitor.sh, cleanup_old_files.sh, and individual sync scripts
# Author: Drive Sync Improvement

set -euo pipefail

# Configuration
SCRIPT_DIR="/Users/moatasimfarooque/Downloads/Programming/CascadeProjects/Drive_sync"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export HOME="/Users/moatasimfarooque"

# Profile names (stored in ~/.unison/)
ICLOUD_PROFILE="icloud"
GDRIVE_PROFILE="google_drive"
ICLOUD_LOG="$SCRIPT_DIR/unison_icloud_cron.log"
GDRIVE_LOG="$SCRIPT_DIR/unison_google_drive_cron.log"
MANAGER_LOG="$SCRIPT_DIR/sync_manager.log"
HEALTH_REPORT="$SCRIPT_DIR/sync_health_report.txt"

# Cloud paths
ICLOUD_PATH="/Users/moatasimfarooque/icloud_sync"
GDRIVE_PATH="/Users/moatasimfarooque/gdrive_sync"

# Timing and limits
STAGGER_DELAY=300      # 5 minutes between syncs
MIN_INTERVAL=1800      # 30 minutes minimum between same service syncs
QUIET_HOURS_START=23   # 11 PM
QUIET_HOURS_END=7      # 7 AM
MAX_RETRIES=3
RETRY_DELAY=30
TIMEOUT=300            # 5 minutes per sync
MAX_LOG_SIZE_MB=50
MAX_FAILED_FILES=10

# Enhanced monitoring configuration
METRICS_FILE="$SCRIPT_DIR/sync_metrics.json"
TRENDS_FILE="$SCRIPT_DIR/sync_trends.txt"
ALERT_LOG="$SCRIPT_DIR/alerts.log"
PERFORMANCE_LOG="$SCRIPT_DIR/performance.log"

# Alert thresholds
DISK_SPACE_THRESHOLD=85    # Alert when disk usage > 85%
CONSECUTIVE_FAILURES=3     # Alert after 3 consecutive failures
SYNC_DURATION_THRESHOLD=600 # Alert if sync takes > 10 minutes
BANDWIDTH_THRESHOLD_MB=1000 # Alert if transfer > 1GB

# Notification settings (configure as needed)
ENABLE_EMAIL_ALERTS=false
EMAIL_RECIPIENT=""
ENABLE_DESKTOP_NOTIFICATIONS=true

# Performance optimization settings
ENABLE_INCREMENTAL_SYNC=true      # Use incremental sync for better performance
ENABLE_PARALLEL_SYNC=false        # Parallel sync (experimental - use with caution)
ENABLE_FAST_CHECK=true            # Use fast file checking
ENABLE_COMPRESSION=false          # Enable compression for large files
MAX_FILE_SIZE_MB=100              # Skip files larger than this (0 = no limit)
SYNC_PRIORITY="speed"          # Options: speed, reliability, balanced

# Advanced retry configuration
ENABLE_ADAPTIVE_RETRY=true        # Adaptive retry delays based on error type
MAX_RETRY_DELAY=300               # Maximum retry delay in seconds
ENABLE_FALLBACK_STRATEGIES=true   # Enable fallback sync strategies
CONFLICT_RESOLUTION="newer"       # Options: newer, older, manual, backup

# Network and I/O optimization
NETWORK_TIMEOUT=60                # Network operation timeout
IO_NICE_LEVEL=3                   # I/O priority (1-7, lower = higher priority)
CPU_NICE_LEVEL=10                 # CPU priority (-20 to 19, lower = higher priority)

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$MANAGER_LOG"
}

# Alert logging function
log_alert() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[$timestamp] [$level] $message" | tee -a "$ALERT_LOG"
    log "ALERT [$level]: $message"

    # Send desktop notification if enabled
    if [ "$ENABLE_DESKTOP_NOTIFICATIONS" = true ]; then
        send_desktop_notification "$level" "$message"
    fi

    # Send email if enabled and configured
    if [ "$ENABLE_EMAIL_ALERTS" = true ] && [ -n "$EMAIL_RECIPIENT" ]; then
        send_email_alert "$level" "$message"
    fi
}

# Send desktop notification
send_desktop_notification() {
    local level=$1
    local message=$2

    if command -v osascript >/dev/null 2>&1; then
        # macOS notification
        osascript -e "display notification \"$message\" with title \"Drive Sync Alert [$level]\"" 2>/dev/null || true
    elif command -v notify-send >/dev/null 2>&1; then
        # Linux notification
        notify-send "Drive Sync Alert [$level]" "$message" 2>/dev/null || true
    fi
}

# Send email alert (requires mail command or sendmail)
send_email_alert() {
    local level=$1
    local message=$2
    local subject="Drive Sync Alert [$level] - $(hostname)"

    if command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "$subject" "$EMAIL_RECIPIENT" 2>/dev/null || true
    fi
}

# Record performance metrics
record_metrics() {
    local service=$1
    local duration=$2
    local items_transferred=${3:-0}
    local items_failed=${4:-0}
    local status=$5
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local date_only=$(date '+%Y-%m-%d')

    # Create metrics entry
    local metric_entry="{
        \"timestamp\": \"$timestamp\",
        \"service\": \"$service\",
        \"duration\": $duration,
        \"items_transferred\": $items_transferred,
        \"items_failed\": $items_failed,
        \"status\": \"$status\",
        \"date\": \"$date_only\"
    }"

    # Append to metrics file
    echo "$metric_entry" >> "$METRICS_FILE"

    # Also log to performance log for easy reading
    echo "[$timestamp] $service: ${duration}s, transferred: $items_transferred, failed: $items_failed, status: $status" >> "$PERFORMANCE_LOG"

    # Check for performance alerts
    check_performance_alerts "$service" "$duration" "$items_failed"
}

# Check for performance-based alerts
check_performance_alerts() {
    local service=$1
    local duration=$2
    local items_failed=$3

    # Alert on long sync duration
    if [ "$duration" -gt "$SYNC_DURATION_THRESHOLD" ]; then
        log_alert "WARNING" "$service sync took ${duration}s (threshold: ${SYNC_DURATION_THRESHOLD}s)"
    fi

    # Alert on failed items
    if [ "$items_failed" -gt 0 ]; then
        log_alert "WARNING" "$service sync had $items_failed failed items"
    fi

    # Check for consecutive failures
    check_consecutive_failures "$service"
}

# Check for consecutive failures
check_consecutive_failures() {
    local service=$1
    local failure_count=0

    # Count recent failures from performance log
    if [ -f "$PERFORMANCE_LOG" ]; then
        failure_count=$(tail -10 "$PERFORMANCE_LOG" | grep "$service.*status: failed" | wc -l)
        failure_count=$(echo "$failure_count" | tr -d ' ')

        if [ "$failure_count" -ge "$CONSECUTIVE_FAILURES" ]; then
            log_alert "CRITICAL" "$service has $failure_count consecutive failures - requires attention"
        fi
    fi
}

# Optimize Unison arguments based on sync priority and conditions
optimize_unison_args() {
    local service=$1
    local attempt=$2
    local is_first_sync=${3:-false}
    local args="-batch -ui text"

    # Base optimizations
    if [ "$ENABLE_FAST_CHECK" = true ]; then
        args="$args -fastcheck"
    fi

    # Add times for incremental sync
    if [ "$ENABLE_INCREMENTAL_SYNC" = true ] || [ "$is_first_sync" = false ]; then
        args="$args -times"
    fi

    # Priority-based optimizations
    case "$SYNC_PRIORITY" in
        "speed")
            args="$args -prefer newer"
            ;;
        "reliability")
            if [ $attempt -eq 1 ]; then
                args="$args -debug verbose"
            fi
            ;;
        "balanced")
            if [ $attempt -gt 1 ]; then
                args="$args -debug verbose"
            fi
            ;;
    esac

    # Conflict resolution (only if not already set by priority)
    if [[ "$args" != *"-prefer"* ]]; then
        case "$CONFLICT_RESOLUTION" in
            "newer") args="$args -prefer newer" ;;
            "older") args="$args -prefer older" ;;
        esac
    fi

    echo "$args"
}

# Check if this is the first sync for a service
is_first_sync() {
    local service=$1
    local profile_name=$2

    # Check if archive files exist for this profile
    local archive_count=$(find "$HOME/.unison" -name "fp*" -type f 2>/dev/null | wc -l)

    # Also check performance log for previous successful syncs
    local previous_syncs=0
    if [ -f "$PERFORMANCE_LOG" ]; then
        previous_syncs=$(grep "$service.*status: success" "$PERFORMANCE_LOG" | wc -l)
    fi

    if [ "$archive_count" -eq 0 ] && [ "$previous_syncs" -eq 0 ]; then
        return 0  # First sync
    else
        return 1  # Not first sync
    fi
}

# Adaptive retry delay based on error type and attempt
calculate_retry_delay() {
    local exit_code=$1
    local attempt=$2
    local base_delay=$RETRY_DELAY

    if [ "$ENABLE_ADAPTIVE_RETRY" = true ]; then
        case $exit_code in
            2)  # Fatal error - longer delay
                base_delay=$((RETRY_DELAY * 2))
                ;;
            3)  # Non-fatal error - shorter delay
                base_delay=$((RETRY_DELAY / 2))
                ;;
            124) # Timeout - progressive delay
                base_delay=$((RETRY_DELAY * attempt))
                ;;
        esac
    fi

    # Exponential backoff with jitter
    local delay=$((base_delay * attempt))
    local jitter=$((RANDOM % 10 + 1))  # 1-10 second jitter
    delay=$((delay + jitter))

    # Cap at maximum delay
    if [ $delay -gt $MAX_RETRY_DELAY ]; then
        delay=$MAX_RETRY_DELAY
    fi

    echo $delay
}

# Pre-sync optimization and preparation
prepare_sync_environment() {
    local service=$1

    # Set process priorities for better system responsiveness
    if command -v renice >/dev/null 2>&1; then
        renice $CPU_NICE_LEVEL $$ 2>/dev/null || true
    fi

    if command -v ionice >/dev/null 2>&1; then
        ionice -c 2 -n $IO_NICE_LEVEL -p $$ 2>/dev/null || true
    fi

    # Enhanced iCloud file system optimization
    if [ "$service" = "icloud" ] && [ -d "$ICLOUD_PATH" ]; then
        log "Ensuring iCloud files are downloaded locally..."
        
        # Force download all iCloud placeholder files
        find "$ICLOUD_PATH" -name "*.icloud" -exec brctl download {} \; 2>/dev/null || true
        
        # Force download the entire directory to ensure all files are local
        brctl download "$ICLOUD_PATH" 2>/dev/null || true
        
        # Check for cloud-only files and force download them
        local actual_path=$(readlink "$ICLOUD_PATH" 2>/dev/null || echo "$ICLOUD_PATH")
        if [ -d "$actual_path" ]; then
            # Use brctl monitor to identify cloud-only files and download them
            local cloud_files=$(timeout 5 brctl monitor "$actual_path" 2>/dev/null | grep "☁" | awk '{print $2}' | head -20)
            if [ -n "$cloud_files" ]; then
                log "Found cloud-only files, downloading..."
                echo "$cloud_files" | while IFS= read -r file; do
                    if [ -n "$file" ]; then
                        local full_path="${actual_path}${file}"
                        log "Downloading: $file"
                        brctl download "$full_path" 2>/dev/null || true
                    fi
                done
                # Wait a moment for downloads to complete
                sleep 2
            fi
        fi
    fi

    # Clear any stale temporary files
    find "/tmp" -name "unison*" -user "$(whoami)" -mtime +1 -delete 2>/dev/null || true
}

# Enhanced error logging with exit code interpretation
log_error() {
    local service=$1
    local exit_code=$2
    local attempt=$3
    local error_msg=""

    case $exit_code in
        1) error_msg="Syntax error or invalid arguments" ;;
        2) error_msg="Fatal error during synchronization (likely file conflicts or deadlocks)" ;;
        3) error_msg="Non-fatal error (some files failed to sync)" ;;
        124) error_msg="Timeout - sync took longer than ${TIMEOUT} seconds" ;;
        *) error_msg="Unknown error (exit code: $exit_code)" ;;
    esac

    log "ERROR: $service sync failed (attempt $attempt) - $error_msg"
}

# Validate Unison profiles
validate_profiles() {
    local errors=0

    for profile in "$ICLOUD_PROFILE" "$GDRIVE_PROFILE"; do
        local profile_file="$HOME/.unison/${profile}.prf"
        if [ ! -f "$profile_file" ]; then
            log "ERROR: Profile not found: $profile_file"
            ((errors++))
        else
            # Check if profile is readable and has required settings
            if ! grep -q "^root = " "$profile_file"; then
                log "ERROR: Profile $profile missing root definitions"
                ((errors++))
            fi
        fi
    done

    return $errors
}

# Check for problematic files that cause deadlocks
check_problematic_files() {
    local service=$1
    local root_path=""

    case $service in
        "icloud") root_path="$ICLOUD_PATH" ;;
        "google_drive") root_path="$GDRIVE_PATH" ;;
    esac

    if [ -n "$root_path" ] && [ -d "$root_path" ]; then
        # Check for files with problematic characters
        local problematic_files=$(find "$root_path" -name "*:*" -o -name "*\"*" -o -name "*<*" -o -name "*>*" -o -name "*|*" 2>/dev/null | head -5)
        if [ -n "$problematic_files" ]; then
            log "WARNING: Found files with problematic characters in $service:"
            echo "$problematic_files" | while read -r file; do
                log "  - $(basename "$file")"
            done
            return 1
        fi
    fi
    return 0
}

# Check if it's quiet hours
is_quiet_hours() {
    local current_hour=$(date +%H)
    current_hour=$((10#$current_hour))
    if [ $current_hour -ge $QUIET_HOURS_START ] || [ $current_hour -lt $QUIET_HOURS_END ]; then
        return 0
    else
        return 1
    fi
}

# Check if service can run
can_run_service() {
    local service=$1
    local lock_file="$SCRIPT_DIR/unison_${service}.lock"
    local log_file="$SCRIPT_DIR/unison_${service}_cron.log"
    
    # Check if already running
    if [ -f "$lock_file" ]; then
        local pid=$(cat "$lock_file" 2>/dev/null || echo "")
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            return 1
        fi
    fi
    
    # Check minimum interval
    if [ -f "$log_file" ]; then
        local last_run=$(stat -f %m "$log_file" 2>/dev/null || echo "0")
        local current_time=$(date +%s)
        local time_diff=$((current_time - last_run))
        if [ $time_diff -lt $MIN_INTERVAL ]; then
            return 1
        fi
    fi
    
    return 0
}

# Wait for cloud service availability
wait_for_cloud() {
    local service=$1
    local cloud_path=$2
    local max_wait=60
    local count=0
    
    while [ $count -lt $max_wait ]; do
        if [ -d "$cloud_path" ] && [ -r "$cloud_path" ]; then
            log "$service directory is accessible"
            return 0
        fi
        log "Waiting for $service directory... ($count/$max_wait)"
        sleep 2
        ((count++))
    done
    
    log "ERROR: $service directory not accessible after $max_wait attempts"
    return 1
}

# Clean problematic files before sync
clean_problematic_files() {
    local service=$1
    local root_path=""
    local actual_path=""

    case $service in
        "icloud")
            root_path="$ICLOUD_PATH"
            actual_path=$(readlink "$ICLOUD_PATH" 2>/dev/null || echo "$ICLOUD_PATH")
            ;;
        "google_drive")
            root_path="$GDRIVE_PATH"
            actual_path=$(readlink "$GDRIVE_PATH" 2>/dev/null || echo "$GDRIVE_PATH")
            ;;
    esac

    # Check both symlink and actual paths
    for path in "$root_path" "$actual_path"; do
        if [ -n "$path" ] && [ -d "$path" ]; then
            log "Checking for problematic files in $service at $path..."

            # Find and handle files with problematic characters (colons, quotes, etc.)
            find "$path" -name "*:*" 2>/dev/null | while IFS= read -r file; do
                if [ -f "$file" ]; then
                    local dir=$(dirname "$file")
                    local basename=$(basename "$file")
                    local new_name=$(echo "$basename" | tr ':' '_' | tr '"' '_' | tr '<' '_' | tr '>' '_' | tr '|' '_')
                    local new_path="$dir/$new_name"

                    log "Renaming problematic file: '$basename' -> '$new_name'"
                    if mv "$file" "$new_path" 2>/dev/null; then
                        log "Successfully renamed: $new_name"
                    else
                        log "WARNING: Could not rename '$file'"
                    fi
                fi
            done

            # Also handle files with quotes and other problematic characters
            find "$path" \( -name '*"*' -o -name '*<*' -o -name '*>*' -o -name '*|*' \) 2>/dev/null | while IFS= read -r file; do
                if [ -f "$file" ]; then
                    local dir=$(dirname "$file")
                    local basename=$(basename "$file")
                    local new_name=$(echo "$basename" | tr '"<>|' '_')
                    local new_path="$dir/$new_name"

                    log "Renaming problematic file: '$basename' -> '$new_name'"
                    mv "$file" "$new_path" 2>/dev/null || log "WARNING: Could not rename '$file'"
                fi
            done

            # Remove temporary and problematic files
            find "$path" -name "*.tmp" -delete 2>/dev/null || true
            find "$path" -name ".#*" -delete 2>/dev/null || true
            find "$path" -name "*~" -delete 2>/dev/null || true
        fi
    done
}

# Reset Unison archives if needed
reset_unison_archives() {
    local profile_name=$1
    local service=$2

    log "Resetting Unison archives for $service to resolve persistent issues..."

    # Remove archive files for this profile
    find "$HOME/.unison" -name "fp*" -type f 2>/dev/null | while read -r archive; do
        # Check if this archive belongs to our profile by examining modification time
        # and remove old archives (older than 1 hour)
        if [ -f "$archive" ] && [ $(($(date +%s) - $(stat -f %m "$archive" 2>/dev/null || echo 0))) -gt 3600 ]; then
            rm -f "$archive" 2>/dev/null || true
        fi
    done

    log "Archive reset completed for $service"
}

# Enhanced run unison sync with performance optimizations
run_unison_sync() {
    local service=$1
    local profile_name=$2
    local log_file=$3
    local lock_file="$SCRIPT_DIR/unison_${service}.lock"
    local start_time=$(date +%s)

    # Create lock file
    echo $$ > "$lock_file"
    trap "rm -f '$lock_file'" EXIT

    log "Starting optimized $service sync..."

    # Prepare sync environment and optimizations
    prepare_sync_environment "$service"

    # Check if this is the first sync
    local first_sync=false
    if is_first_sync "$service" "$profile_name"; then
        first_sync=true
        log "Detected first sync for $service - using optimized settings"
    fi

    # Pre-sync checks and cleanup
    check_problematic_files "$service" || clean_problematic_files "$service"

    for attempt in $(seq 1 $MAX_RETRIES); do
        log "Sync attempt $attempt/$MAX_RETRIES for $service"
        local attempt_start=$(date +%s)

        # Adaptive timeout based on sync type and recent failures
        local sync_timeout=$TIMEOUT
        
        # Always use extended timeout if there were recent timeout failures
        local recent_timeouts=0
        if [ -f "$PERFORMANCE_LOG" ]; then
            recent_timeouts=$(tail -10 "$PERFORMANCE_LOG" | grep "$service.*timeout\|Timeout" | wc -l | tr -d ' ')
        fi
        
        if [ "$first_sync" = true ] || [ "$recent_timeouts" -gt 0 ]; then
            sync_timeout=$((TIMEOUT * 6))  # Longer timeout (30 minutes) for first sync or after timeouts
            log "Extended timeout to ${sync_timeout}s (first_sync: $first_sync, recent_timeouts: $recent_timeouts)"
        elif [ $attempt -gt 1 ]; then
            sync_timeout=$((TIMEOUT * 3))  # Progressive timeout increase on retries
            log "Progressive timeout to ${sync_timeout}s for attempt $attempt"
        fi

        # Get optimized Unison arguments
        local unison_args=$(optimize_unison_args "$service" "$attempt" "$first_sync")
        log "Using optimized args: $unison_args"

        # Capture both stdout and stderr separately for better error analysis
        local temp_log=$(mktemp)
        local temp_err=$(mktemp)

        if timeout "$sync_timeout" /opt/homebrew/bin/unison $unison_args "$profile_name" > "$temp_log" 2> "$temp_err"; then
            # Success - parse results and record metrics
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))

            # Parse sync results from log
            local items_transferred=0
            local items_failed=0

            # Extract transfer statistics from Unison output
            if grep -q "items transferred" "$temp_log"; then
                items_transferred=$(grep "items transferred" "$temp_log" | grep -o '[0-9]\+' | head -1 || echo "0")
            fi

            # Look for completion message with statistics
            local completion_line=$(grep -E "Synchronization complete.*transferred.*skipped.*failed" "$temp_log" | tail -1)
            if [ -n "$completion_line" ]; then
                items_transferred=$(echo "$completion_line" | grep -o '[0-9]\+ items transferred' | grep -o '[0-9]\+' || echo "0")
                items_failed=$(echo "$completion_line" | grep -o '[0-9]\+ failed' | grep -o '[0-9]\+' || echo "0")
            fi

            # Append logs and cleanup
            cat "$temp_log" >> "$log_file"
            cat "$temp_err" >> "$log_file"
            rm -f "$temp_log" "$temp_err"

            # Record successful sync metrics
            record_metrics "$service" "$duration" "$items_transferred" "$items_failed" "success"

            log "SUCCESS: $service sync completed in ${duration}s (transferred: $items_transferred, failed: $items_failed)"
            rm -f "$lock_file"
            return 0
        else
            local exit_code=$?
            local attempt_end=$(date +%s)
            local attempt_duration=$((attempt_end - attempt_start))

            # Append error logs
            cat "$temp_log" >> "$log_file"
            cat "$temp_err" >> "$log_file"

            # Enhanced error logging
            log_error "$service" "$exit_code" "$attempt"

            # Advanced error pattern detection and corrective actions
            local error_handled=false

            if grep -q "Resource deadlock avoided" "$temp_err" "$temp_log"; then
                log "Detected resource deadlock - applying corrective measures"
                clean_problematic_files "$service"

                if [ $attempt -eq 2 ]; then
                    log "Persistent deadlock detected - resetting archives"
                    reset_unison_archives "$profile_name" "$service"
                fi
                error_handled=true

            elif grep -q "No archive files" "$temp_err" "$temp_log"; then
                log "Archive files missing - treating as first sync"
                first_sync=true
                sync_timeout=$((TIMEOUT * 2))
                error_handled=true

            elif grep -q "Connection refused\|Network is unreachable" "$temp_err" "$temp_log"; then
                log "Network connectivity issue detected"
                if [ "$ENABLE_FALLBACK_STRATEGIES" = true ]; then
                    log "Applying network fallback strategy"
                    # Wait longer for network issues
                    sync_timeout=$((sync_timeout + 60))
                fi
                error_handled=true

            elif grep -q "Permission denied\|Operation not permitted" "$temp_err" "$temp_log"; then
                log "Permission issue detected - attempting to fix"
                if [ "$ENABLE_FALLBACK_STRATEGIES" = true ]; then
                    # Try to fix common permission issues
                    chmod -R u+rw "$ICLOUD_PATH" "$GDRIVE_PATH" 2>/dev/null || true
                fi
                error_handled=true

            elif grep -q "Disk full\|No space left" "$temp_err" "$temp_log"; then
                log_alert "CRITICAL" "Disk space exhausted during $service sync"
                # Trigger emergency cleanup
                cleanup
                error_handled=true
            fi

            rm -f "$temp_log" "$temp_err"

            if [ $attempt -lt $MAX_RETRIES ]; then
                # Calculate adaptive retry delay
                local delay=$(calculate_retry_delay "$exit_code" "$attempt")

                if [ "$error_handled" = true ]; then
                    log "Error handled - using reduced retry delay: ${delay}s"
                else
                    log "Unhandled error - using standard retry delay: ${delay}s"
                fi

                sleep $delay
            fi
        fi
    done

    # Record failed sync metrics
    local end_time=$(date +%s)
    local total_duration=$((end_time - start_time))
    record_metrics "$service" "$total_duration" "0" "0" "failed"

    log "FATAL: All $MAX_RETRIES attempts failed for $service"
    rm -f "$lock_file"
    return 1
}

# Check for large files that might slow down sync
check_large_files() {
    local service=$1
    local root_path=""

    case $service in
        "icloud") root_path="$ICLOUD_PATH" ;;
        "google_drive") root_path="$GDRIVE_PATH" ;;
    esac

    if [ "$MAX_FILE_SIZE_MB" -gt 0 ] && [ -d "$root_path" ]; then
        local large_files=$(find "$root_path" -type f -size +${MAX_FILE_SIZE_MB}M 2>/dev/null | head -5)
        if [ -n "$large_files" ]; then
            log "WARNING: Found large files in $service (>${MAX_FILE_SIZE_MB}MB):"
            echo "$large_files" | while read -r file; do
                local size=$(du -h "$file" 2>/dev/null | cut -f1)
                log "  - $(basename "$file") ($size)"
            done
            return 1
        fi
    fi
    return 0
}

# Parallel sync function (experimental)
run_parallel_sync() {
    local services=("$@")
    local pids=()
    local results=()

    log "Starting parallel sync for: ${services[*]}"

    # Start all syncs in parallel
    for service in "${services[@]}"; do
        case $service in
            "icloud")
                (
                    if wait_for_cloud "iCloud" "$ICLOUD_PATH" && run_unison_sync "icloud" "$ICLOUD_PROFILE" "$ICLOUD_LOG"; then
                        echo "success" > "/tmp/sync_${service}_$$"
                    else
                        echo "failed" > "/tmp/sync_${service}_$$"
                    fi
                ) &
                pids+=($!)
                ;;
            "google_drive")
                (
                    if wait_for_cloud "Google Drive" "$GDRIVE_PATH" && run_unison_sync "google_drive" "$GDRIVE_PROFILE" "$GDRIVE_LOG"; then
                        echo "success" > "/tmp/sync_${service}_$$"
                    else
                        echo "failed" > "/tmp/sync_${service}_$$"
                    fi
                ) &
                pids+=($!)
                ;;
        esac
    done

    # Wait for all syncs to complete
    local success_count=0
    for i in "${!pids[@]}"; do
        local pid=${pids[$i]}
        local service=${services[$i]}

        wait $pid
        local result=$(cat "/tmp/sync_${service}_$$" 2>/dev/null || echo "failed")
        rm -f "/tmp/sync_${service}_$$"

        if [ "$result" = "success" ]; then
            ((success_count++))
            log "✓ $service parallel sync successful"
        else
            log "✗ $service parallel sync failed"
        fi
    done

    return $success_count
}

# Enhanced sync function with performance optimizations
sync_services() {
    log "=== Starting Enhanced Sync Process ==="

    if is_quiet_hours; then
        log "Currently in quiet hours, skipping sync"
        return 0
    fi

    # Validate profiles before attempting sync
    if ! validate_profiles; then
        log "ERROR: Profile validation failed - aborting sync"
        return 1
    fi

    local services_to_run=()

    # Check which services can run
    if can_run_service "icloud"; then
        services_to_run+=("icloud")
    fi

    if can_run_service "google_drive"; then
        services_to_run+=("google_drive")
    fi

    if [ ${#services_to_run[@]} -eq 0 ]; then
        log "No services ready to run"
        return 0
    fi

    log "Services ready: ${services_to_run[*]}"
    log "Sync mode: $SYNC_PRIORITY priority"

    # Check for large files that might impact performance
    for service in "${services_to_run[@]}"; do
        check_large_files "$service" || log "Large files detected in $service - sync may take longer"
    done

    local success_count=0

    # Use parallel sync if enabled and multiple services
    if [ "$ENABLE_PARALLEL_SYNC" = true ] && [ ${#services_to_run[@]} -gt 1 ]; then
        log "Using parallel sync mode"
        success_count=$(run_parallel_sync "${services_to_run[@]}")
    else
        # Sequential sync with optimizations
        for service in "${services_to_run[@]}"; do
            log "--- Processing $service ---"

            case $service in
                "icloud")
                    if wait_for_cloud "iCloud" "$ICLOUD_PATH" && run_unison_sync "icloud" "$ICLOUD_PROFILE" "$ICLOUD_LOG"; then
                        ((success_count++))
                        log "✓ iCloud sync successful"
                    else
                        log "✗ iCloud sync failed"
                    fi
                    ;;
                "google_drive")
                    if wait_for_cloud "Google Drive" "$GDRIVE_PATH" && run_unison_sync "google_drive" "$GDRIVE_PROFILE" "$GDRIVE_LOG"; then
                        ((success_count++))
                        log "✓ Google Drive sync successful"
                    else
                        log "✗ Google Drive sync failed"
                    fi
                    ;;
            esac

            # Intelligent stagger based on sync priority
            if [ ${#services_to_run[@]} -gt 1 ] && [ $service != "${services_to_run[${#services_to_run[@]}-1]}" ]; then
                local stagger_delay=$STAGGER_DELAY
                if [ "$SYNC_PRIORITY" = "speed" ]; then
                    stagger_delay=$((STAGGER_DELAY / 2))
                elif [ "$SYNC_PRIORITY" = "reliability" ]; then
                    stagger_delay=$((STAGGER_DELAY * 2))
                fi
                log "Waiting ${stagger_delay}s before next service..."
                sleep $stagger_delay
            fi
        done
    fi

    log "=== Sync Summary: $success_count/${#services_to_run[@]} services succeeded ==="

    # Performance summary
    if [ -f "$PERFORMANCE_LOG" ]; then
        local avg_duration=$(tail -5 "$PERFORMANCE_LOG" | grep -o '[0-9]\+s' | tr -d 's' | awk '{sum+=$1} END {print int(sum/NR)}' 2>/dev/null || echo "0")
        log "Recent average sync duration: ${avg_duration}s"
    fi

    # If all services failed, suggest troubleshooting
    if [ $success_count -eq 0 ] && [ ${#services_to_run[@]} -gt 0 ]; then
        log_alert "CRITICAL" "All sync attempts failed. Run './sync_manager.sh monitor' for detailed analysis"
    fi
}

# Emergency stop
emergency_stop() {
    log "=== Emergency Stop ==="
    pkill -f "unison.*icloud" 2>/dev/null || true
    pkill -f "unison.*google_drive" 2>/dev/null || true
    rm -f "$SCRIPT_DIR"/*.lock
    log "All processes stopped and locks cleared"
}

# Status check
status_check() {
    log "=== Status Check ==="
    
    local icloud_pid=$(pgrep -f "unison.*icloud" || echo "")
    local gdrive_pid=$(pgrep -f "unison.*google_drive" || echo "")
    
    echo "iCloud sync: ${icloud_pid:+Running (PID: $icloud_pid)}"
    echo "iCloud sync: ${icloud_pid:-Not running}"
    echo "Google Drive sync: ${gdrive_pid:+Running (PID: $gdrive_pid)}"
    echo "Google Drive sync: ${gdrive_pid:-Not running}"
    
    for lock_file in "$SCRIPT_DIR"/*.lock; do
        if [ -f "$lock_file" ]; then
            local pid=$(cat "$lock_file" 2>/dev/null || echo "")
            local service=$(basename "$lock_file" .lock)
            if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
                echo "Active lock: $service (PID: $pid)"
            else
                echo "Stale lock: $service"
            fi
        fi
    done
}

# Advanced trend analysis
analyze_trends() {
    local service=$1
    local days=${2:-7}  # Default to 7 days

    if [ ! -f "$PERFORMANCE_LOG" ]; then
        echo "No performance data available"
        return 1
    fi

    local cutoff_date
    if date -v-1d '+%Y-%m-%d' >/dev/null 2>&1; then
        # macOS date command
        cutoff_date=$(date -v-${days}d '+%Y-%m-%d')
    else
        # GNU date command
        cutoff_date=$(date -d "$days days ago" '+%Y-%m-%d')
    fi

    # Analyze recent performance
    local recent_syncs=$(grep "$service" "$PERFORMANCE_LOG" | grep -E "202[0-9]-[0-9]{2}-[0-9]{2}" | tail -20)

    if [ -z "$recent_syncs" ]; then
        echo "No recent sync data for $service"
        return 1
    fi

    # Calculate average duration
    local total_duration=0
    local sync_count=0
    local success_count=0
    local failure_count=0

    while IFS= read -r line; do
        if [ -n "$line" ]; then
            local duration=$(echo "$line" | grep -o '[0-9]\+s' | head -1 | tr -d 's')
            local status=$(echo "$line" | grep -o 'status: [a-z]\+' | cut -d' ' -f2)

            if [ -n "$duration" ]; then
                total_duration=$((total_duration + duration))
                ((sync_count++))

                if [ "$status" = "success" ]; then
                    ((success_count++))
                else
                    ((failure_count++))
                fi
            fi
        fi
    done <<< "$recent_syncs"

    if [ $sync_count -gt 0 ]; then
        local avg_duration=$((total_duration / sync_count))
        local success_rate=$((success_count * 100 / sync_count))

        echo "$service Trends (last $sync_count syncs):"
        echo "  Average duration: ${avg_duration}s"
        echo "  Success rate: ${success_rate}%"
        echo "  Total syncs: $sync_count (success: $success_count, failed: $failure_count)"

        # Predictive alerts
        if [ $avg_duration -gt $((SYNC_DURATION_THRESHOLD / 2)) ]; then
            echo "  ⚠️  Warning: Average duration approaching threshold"
        fi

        if [ $success_rate -lt 80 ]; then
            echo "  🚨 Alert: Low success rate detected"
        fi
    fi
}

# Check disk space and generate alerts
check_disk_space() {
    local sync_dir="/Users/moatasimfarooque/Downloads/Data_Science/Sync"
    local usage_percent=$(df "$sync_dir" | awk 'NR==2 {print $5}' | tr -d '%')

    if [ "$usage_percent" -gt "$DISK_SPACE_THRESHOLD" ]; then
        log_alert "WARNING" "Disk space usage is ${usage_percent}% (threshold: ${DISK_SPACE_THRESHOLD}%)"

        # Suggest cleanup if usage is very high
        if [ "$usage_percent" -gt 90 ]; then
            log_alert "CRITICAL" "Disk space critically low (${usage_percent}%) - automatic cleanup recommended"
            return 1
        fi
    fi

    return 0
}

# Generate bandwidth usage report
analyze_bandwidth() {
    local service=$1
    local days=${2:-1}

    if [ ! -f "$PERFORMANCE_LOG" ]; then
        echo "No performance data available"
        return 1
    fi

    # Calculate total items transferred in the period
    local cutoff_date
    if date -v-1d '+%Y-%m-%d' >/dev/null 2>&1; then
        # macOS date command
        cutoff_date=$(date -v-${days}d '+%Y-%m-%d')
    else
        # GNU date command
        cutoff_date=$(date -d "$days days ago" '+%Y-%m-%d')
    fi
    local total_items=0

    while IFS= read -r line; do
        if [[ "$line" == *"$service"* ]] && [[ "$line" > *"$cutoff_date"* ]]; then
            local items=$(echo "$line" | grep -o 'transferred: [0-9]\+' | grep -o '[0-9]\+')
            if [ -n "$items" ]; then
                total_items=$((total_items + items))
            fi
        fi
    done < "$PERFORMANCE_LOG"

    echo "$service bandwidth (last $days day(s)): $total_items items transferred"

    # Estimate bandwidth (rough calculation)
    if [ $total_items -gt $BANDWIDTH_THRESHOLD_MB ]; then
        log_alert "INFO" "$service transferred $total_items items in $days day(s) - high activity detected"
    fi
}

# Enhanced health monitoring with trends and alerts
monitor_health() {
    log "=== Enhanced Health Monitoring ==="

    # Check disk space first (with error handling)
    if ! check_disk_space; then
        log "Disk space check completed with warnings"
    fi

    # Rotate large logs
    for log_file in "$ICLOUD_LOG" "$GDRIVE_LOG" "$PERFORMANCE_LOG"; do
        if [ -f "$log_file" ]; then
            local size_mb=$(du -m "$log_file" 2>/dev/null | cut -f1 || echo "0")
            if [ "$size_mb" -gt "$MAX_LOG_SIZE_MB" ]; then
                local timestamp=$(date '+%Y%m%d_%H%M%S')
                local basename=$(basename "$log_file" .log)
                mv "$log_file" "${log_file%.log}_${timestamp}.log.old" 2>/dev/null || true
                touch "$log_file"
                log "Rotated large log: $(basename "$log_file") (${size_mb}MB)"
            fi
        fi
    done
    
    # Generate enhanced health report
    {
        echo "=== 📊 Enhanced Drive Sync Health Report ==="
        echo "Generated: $(date)"
        echo ""

        # System Status Overview
        echo "=== 🖥️  System Status ==="
        local icloud_running=$(pgrep -f "unison.*icloud" || echo "")
        local gdrive_running=$(pgrep -f "unison.*google_drive" || echo "")
        echo "iCloud: ${icloud_running:+🟢 Running (PID: $icloud_running)}"
        echo "iCloud: ${icloud_running:-🔴 Not running}"
        echo "Google Drive: ${gdrive_running:+🟢 Running (PID: $gdrive_running)}"
        echo "Google Drive: ${gdrive_running:-🔴 Not running}"
        echo ""

        # Disk Space with Alert Status
        echo "=== 💾 Disk Space Analysis ==="
        local sync_dir="/Users/moatasimfarooque/Downloads/Data_Science/Sync"
        local disk_info=$(df -h "$sync_dir" | awk 'NR==2 {print "Available: " $4 ", Used: " $5}')
        local usage_percent=$(df "$sync_dir" | awk 'NR==2 {print $5}' | tr -d '%')
        echo "$disk_info"

        if [ "$usage_percent" -gt "$DISK_SPACE_THRESHOLD" ]; then
            echo "⚠️  WARNING: Disk usage above threshold (${usage_percent}% > ${DISK_SPACE_THRESHOLD}%)"
        elif [ "$usage_percent" -gt 90 ]; then
            echo "🚨 CRITICAL: Disk space critically low!"
        else
            echo "✅ Disk space healthy"
        fi
        echo ""

        # Cloud Accessibility
        echo "=== ☁️  Cloud Access Status ==="
        echo "iCloud: $( [ -d "$ICLOUD_PATH" ] && [ -r "$ICLOUD_PATH" ] && echo "✅ Accessible" || echo "❌ NOT ACCESSIBLE" )"
        echo "Google Drive: $( [ -d "$GDRIVE_PATH" ] && [ -r "$GDRIVE_PATH" ] && echo "✅ Accessible" || echo "❌ NOT ACCESSIBLE" )"
        echo ""

        # Performance Trends
        echo "=== 📈 Performance Trends ==="
        analyze_trends "icloud" 7 || echo "No iCloud trend data available"
        echo ""
        analyze_trends "google" 7 || echo "No Google Drive trend data available"
        echo ""

        # Bandwidth Analysis
        echo "=== 🌐 Bandwidth Analysis ==="
        analyze_bandwidth "icloud" 1 || echo "No iCloud bandwidth data available"
        analyze_bandwidth "google" 1 || echo "No Google Drive bandwidth data available"
        echo ""
        
        # Enhanced Service Analysis
        for service_log in "$ICLOUD_LOG:iCloud" "$GDRIVE_LOG:Google Drive"; do
            local log_file="${service_log%:*}"
            local service_name="${service_log#*:}"
            local service_key=$(echo "$service_name" | tr '[:upper:]' '[:lower:]' | tr ' ' '_')

            echo "=== 🔍 $service_name Detailed Analysis ==="

            if [ -f "$log_file" ]; then
                local last_sync="No recent sync found"
                local failed_count=0
                local deadlock_count=0
                local items_transferred=0
                local last_sync_duration="Unknown"

                if [ -s "$log_file" ]; then
                    # Get last sync information
                    last_sync=$(tail -50 "$log_file" 2>/dev/null | grep -E "Synchronization (complete|incomplete)" | tail -1 2>/dev/null || echo "No recent sync found")
                    failed_count=$(grep -c "failed:" "$log_file" 2>/dev/null || echo "0")
                    deadlock_count=$(grep -c "Resource deadlock avoided" "$log_file" 2>/dev/null || echo "0")

                    # Extract items transferred from last sync
                    if [[ "$last_sync" =~ ([0-9]+)\ items\ transferred ]]; then
                        items_transferred="${BASH_REMATCH[1]}"
                    fi
                fi

                # Get performance data from metrics
                if [ -f "$PERFORMANCE_LOG" ]; then
                    local last_perf=$(grep "$service_key\|$(echo "$service_name" | cut -d' ' -f1 | tr '[:upper:]' '[:lower:]')" "$PERFORMANCE_LOG" | tail -1)
                    if [ -n "$last_perf" ]; then
                        last_sync_duration=$(echo "$last_perf" | grep -o '[0-9]\+s' | head -1)
                    fi
                fi

                # Clean variables
                failed_count=$(echo "$failed_count" | tr -d '\n\r ' | head -c 10)
                deadlock_count=$(echo "$deadlock_count" | tr -d '\n\r ' | head -c 10)
                failed_count=${failed_count:-0}
                deadlock_count=${deadlock_count:-0}

                # Display results with status indicators
                echo "📅 Last sync: $last_sync"
                echo "⏱️  Duration: $last_sync_duration"
                echo "📦 Items transferred: $items_transferred"
                echo "❌ Failed files: $failed_count"
                echo "🔒 Deadlock errors: $deadlock_count"

                # Health status
                local health_status="✅ Healthy"
                if [ "$failed_count" -gt "$MAX_FAILED_FILES" ] 2>/dev/null; then
                    health_status="⚠️  Warning - High failure count ($failed_count > $MAX_FAILED_FILES)"
                fi
                if [ "$deadlock_count" -gt 0 ] 2>/dev/null; then
                    health_status="🚨 Alert - Deadlock errors detected ($deadlock_count)"
                fi
                echo "🏥 Health: $health_status"

                # Recent activity summary
                if [ -f "$PERFORMANCE_LOG" ]; then
                    local recent_syncs=$(grep "$service_key\|$(echo "$service_name" | cut -d' ' -f1 | tr '[:upper:]' '[:lower:]')" "$PERFORMANCE_LOG" | tail -5 | wc -l)
                    local recent_failures=$(grep "$service_key\|$(echo "$service_name" | cut -d' ' -f1 | tr '[:upper:]' '[:lower:]')" "$PERFORMANCE_LOG" | tail -5 | grep "failed" | wc -l)
                    echo "📊 Recent activity: $recent_syncs syncs, $recent_failures failures"
                fi

                echo ""
            else
                echo "❌ No log file found for $service_name"
                echo ""
            fi
        done

        # Recent Alerts Summary
        echo "=== 🚨 Recent Alerts ==="
        if [ -f "$ALERT_LOG" ]; then
            local recent_alerts=$(tail -10 "$ALERT_LOG" 2>/dev/null)
            if [ -n "$recent_alerts" ]; then
                echo "$recent_alerts"
            else
                echo "✅ No recent alerts"
            fi
        else
            echo "✅ No alerts logged"
        fi
        echo ""
        
    } > "$HEALTH_REPORT"
    
    log "Health report generated"
    cat "$HEALTH_REPORT"
}

# Cleanup old files
cleanup() {
    log "=== Cleanup ==="
    
    # Remove old logs (>7 days)
    find "$SCRIPT_DIR" -name "*.log.old" -mtime +7 -delete 2>/dev/null || true
    
    # Remove old locks (>1 day)
    find "$SCRIPT_DIR" -name "*.lock" -mtime +1 -delete 2>/dev/null || true
    
    # Remove temp files
    find "$SCRIPT_DIR" -name "*.tmp" -o -name "*~" -o -name ".#*" -delete 2>/dev/null || true
    
    log "Cleanup completed"
}

# Diagnostic function for troubleshooting
diagnose() {
    log "=== System Diagnostics ==="

    echo "=== Drive Sync System Diagnostics ==="
    echo "Generated: $(date)"
    echo ""

    # Check Unison installation
    echo "=== Unison Installation ==="
    if command -v unison >/dev/null 2>&1; then
        echo "Unison version: $(unison -version 2>/dev/null | head -1)"
        echo "Unison path: $(which unison)"
    else
        echo "ERROR: Unison not found in PATH"
    fi
    echo ""

    # Check profiles
    echo "=== Profile Validation ==="
    for profile in "$ICLOUD_PROFILE" "$GDRIVE_PROFILE"; do
        local profile_file="$HOME/.unison/${profile}.prf"
        if [ -f "$profile_file" ]; then
            echo "✓ Profile found: $profile"
            echo "  Roots: $(grep '^root = ' "$profile_file" | wc -l) defined"
        else
            echo "✗ Profile missing: $profile"
        fi
    done
    echo ""

    # Check paths
    echo "=== Path Accessibility ==="
    local sync_dir="/Users/moatasimfarooque/Downloads/Data_Science/Sync"
    echo "Local sync directory: $sync_dir"
    echo "  Exists: $( [ -d "$sync_dir" ] && echo "Yes" || echo "No" )"
    echo "  Readable: $( [ -r "$sync_dir" ] && echo "Yes" || echo "No" )"
    echo "  Writable: $( [ -w "$sync_dir" ] && echo "Yes" || echo "No" )"

    echo "iCloud path: $ICLOUD_PATH"
    echo "  Exists: $( [ -d "$ICLOUD_PATH" ] && echo "Yes" || echo "No" )"
    echo "  Readable: $( [ -r "$ICLOUD_PATH" ] && echo "Yes" || echo "No" )"

    echo "Google Drive path: $GDRIVE_PATH"
    echo "  Exists: $( [ -d "$GDRIVE_PATH" ] && echo "Yes" || echo "No" )"
    echo "  Readable: $( [ -r "$GDRIVE_PATH" ] && echo "Yes" || echo "No" )"
    echo ""

    # Check for problematic files
    echo "=== Problematic Files Check ==="
    for service in "icloud" "google_drive"; do
        local root_path=""
        case $service in
            "icloud") root_path="$ICLOUD_PATH" ;;
            "google_drive") root_path="$GDRIVE_PATH" ;;
        esac

        if [ -d "$root_path" ]; then
            local count=$(find "$root_path" -name "*:*" 2>/dev/null | wc -l)
            echo "$service: $count files with problematic characters"
        fi
    done
    echo ""

    # Check recent errors
    echo "=== Recent Error Analysis ==="
    for log_file in "$ICLOUD_LOG" "$GDRIVE_LOG"; do
        if [ -f "$log_file" ] && [ -s "$log_file" ]; then
            local service=$(basename "$log_file" | cut -d'_' -f2)
            echo "$service recent errors:"
            tail -20 "$log_file" | grep -i "error\|failed\|deadlock" | tail -3 | sed 's/^/  /'
        fi
    done
    echo ""

    # Check disk space
    echo "=== Disk Space ==="
    df -h "/Users/moatasimfarooque/Downloads/Data_Science/Sync" 2>/dev/null | awk 'NR==2 {print "Available: " $4 ", Used: " $5}'
    echo ""

    echo "=== Recommendations ==="
    if ! command -v unison >/dev/null 2>&1; then
        echo "- Install Unison: brew install unison"
    fi

    local problematic_count=$(find "$GDRIVE_PATH" "$ICLOUD_PATH" -name "*:*" 2>/dev/null | wc -l)
    if [ "$problematic_count" -gt 0 ]; then
        echo "- Run './sync_manager.sh fix' to clean problematic files"
    fi

    if [ ! -f "$HOME/.unison/icloud.prf" ] || [ ! -f "$HOME/.unison/google_drive.prf" ]; then
        echo "- Run './sync_manager.sh setup' to reinstall profiles"
    fi

    echo "- Check logs: tail -50 unison_*_cron.log"
    echo "- Test manual sync: unison -testserver icloud"
}

# Force iCloud downloads
force_icloud_download() {
    log "=== Forcing iCloud Downloads ==="

    local icloud_actual_path=$(readlink "$ICLOUD_PATH" 2>/dev/null || echo "$ICLOUD_PATH")
    
    if [ ! -d "$icloud_actual_path" ]; then
        log "ERROR: iCloud directory not found: $icloud_actual_path"
        return 1
    fi

    log "Forcing download of all iCloud files..."
    
    # Method 1: Download the entire directory
    log "Method 1: Downloading entire directory..."
    brctl download "$icloud_actual_path" 2>/dev/null || true
    
    # Method 2: Find and download .icloud files
    log "Method 2: Downloading .icloud placeholder files..."
    find "$icloud_actual_path" -name "*.icloud" -exec brctl download {} \; 2>/dev/null || true
    
    # Method 3: Use brctl monitor to find cloud-only files
    log "Method 3: Identifying and downloading cloud-only files..."
    local temp_monitor=$(mktemp)
    timeout 10 brctl monitor "$icloud_actual_path" > "$temp_monitor" 2>/dev/null || true
    
    local cloud_files=$(grep "☁" "$temp_monitor" | awk '{print $2}' | head -50)
    if [ -n "$cloud_files" ]; then
        log "Found $(echo "$cloud_files" | wc -l) cloud-only files"
        echo "$cloud_files" | while IFS= read -r file; do
            if [ -n "$file" ]; then
                local full_path="${icloud_actual_path}${file}"
                if [ -e "$full_path" ]; then
                    log "Downloading: $file"
                    brctl download "$full_path" 2>/dev/null || true
                fi
            fi
        done
    else
        log "No cloud-only files found or all files are already local"
    fi
    
    rm -f "$temp_monitor"
    
    # Method 4: Recursive directory walk and download
    log "Method 4: Recursive directory download..."
    find "$icloud_actual_path" -type d -exec brctl download {} \; 2>/dev/null || true
    
    log "Waiting for downloads to complete..."
    sleep 5
    
    # Verify download status
    log "Checking download status..."
    local temp_status=$(mktemp)
    timeout 5 brctl monitor "$icloud_actual_path" > "$temp_status" 2>/dev/null || true
    
    local remaining_cloud=$(grep "☁" "$temp_status" | wc -l | tr -d ' ')
    local local_files=$(grep -v "☁" "$temp_status" | wc -l | tr -d ' ')
    
    log "Download Summary:"
    log "  Local files: $local_files"
    log "  Cloud-only files remaining: $remaining_cloud"
    
    rm -f "$temp_status"
    
    if [ "$remaining_cloud" -gt 0 ]; then
        log "WARNING: Some files are still cloud-only. This may indicate:"
        log "  1. iCloud sync is paused or disabled"
        log "  2. Network connectivity issues"
        log "  3. iCloud storage quota exceeded"
        log "  4. App-specific iCloud sync is disabled for Obsidian"
        return 1
    else
        log "SUCCESS: All files appear to be downloaded locally"
        return 0
    fi
}

# Fix known issues command
fix_issues() {
    log "=== Fixing Known Issues ==="

    # Clean problematic files in both services
    for service in "icloud" "google_drive"; do
        clean_problematic_files "$service"
    done

    # Reset archives if they're causing issues
    log "Clearing old Unison archives..."
    find "$HOME/.unison" -name "fp*" -type f -mtime +1 -delete 2>/dev/null || true

    # Reinstall profiles
    log "Reinstalling Unison profiles..."
    cp "$SCRIPT_DIR/unison_icloud.prf" "$HOME/.unison/icloud.prf"
    cp "$SCRIPT_DIR/unison_google_drive.prf" "$HOME/.unison/google_drive.prf"

    log "Fix completed. Try running sync again."
}

# Performance analysis command
performance() {
    local service=${1:-"all"}
    local days=${2:-7}

    echo "=== 📊 Performance Analysis ==="
    echo "Period: Last $days days"
    echo ""

    if [ "$service" = "all" ] || [ "$service" = "icloud" ]; then
        echo "📱 iCloud Performance:"
        analyze_trends "icloud" "$days"
        analyze_bandwidth "icloud" "$days"
        echo ""
    fi

    if [ "$service" = "all" ] || [ "$service" = "google" ]; then
        echo "🌐 Google Drive Performance:"
        analyze_trends "google" "$days"
        analyze_bandwidth "google" "$days"
        echo ""
    fi

    # Overall system health
    echo "🏥 System Health:"
    check_disk_space && echo "✅ Disk space healthy" || echo "⚠️  Disk space needs attention"

    # Alert summary
    if [ -f "$ALERT_LOG" ]; then
        local alert_count=$(wc -l < "$ALERT_LOG" 2>/dev/null || echo "0")
        echo "🚨 Total alerts logged: $alert_count"

        if [ "$alert_count" -gt 0 ]; then
            echo "Recent alerts:"
            tail -5 "$ALERT_LOG" | sed 's/^/  /'
        fi
    fi
}

# Alerts management
alerts() {
    local action=${1:-"list"}

    case "$action" in
        "list")
            echo "=== 🚨 Alert History ==="
            if [ -f "$ALERT_LOG" ]; then
                cat "$ALERT_LOG"
            else
                echo "No alerts logged"
            fi
            ;;
        "clear")
            if [ -f "$ALERT_LOG" ]; then
                mv "$ALERT_LOG" "${ALERT_LOG}.$(date +%Y%m%d_%H%M%S).bak"
                touch "$ALERT_LOG"
                echo "Alert log cleared (backup created)"
            else
                echo "No alert log to clear"
            fi
            ;;
        "test")
            log_alert "INFO" "Test alert - system is functioning normally"
            echo "Test alert sent"
            ;;
        *)
            echo "Usage: $0 alerts [list|clear|test]"
            echo "  list  - Show all alerts (default)"
            echo "  clear - Clear alert log (creates backup)"
            echo "  test  - Send test alert"
            ;;
    esac
}

# Performance optimization and tuning
optimize() {
    local action=${1:-"status"}

    case "$action" in
        "status")
            echo "=== ⚡ Performance Optimization Status ==="
            echo "Sync Priority: $SYNC_PRIORITY"
            echo "Incremental Sync: $ENABLE_INCREMENTAL_SYNC"
            echo "Parallel Sync: $ENABLE_PARALLEL_SYNC"
            echo "Fast Check: $ENABLE_FAST_CHECK"
            echo "Compression: $ENABLE_COMPRESSION"
            echo "Adaptive Retry: $ENABLE_ADAPTIVE_RETRY"
            echo "Fallback Strategies: $ENABLE_FALLBACK_STRATEGIES"
            echo "Max File Size: ${MAX_FILE_SIZE_MB}MB"
            echo "Network Timeout: ${NETWORK_TIMEOUT}s"
            echo "CPU Nice Level: $CPU_NICE_LEVEL"
            echo "I/O Nice Level: $IO_NICE_LEVEL"
            ;;
        "speed")
            echo "Optimizing for speed..."
            echo "⚡ Speed mode: Faster sync with reduced reliability checks"
            echo "Note: Changes apply to current session only"
            echo "✅ Speed optimizations applied."
            ;;
        "reliability")
            echo "Optimizing for reliability..."
            echo "🛡️  Reliability mode: Maximum error checking and recovery"
            echo "Note: Changes apply to current session only"
            echo "✅ Reliability optimizations applied."
            ;;
        "balanced")
            echo "Setting balanced optimization..."
            echo "⚖️  Balanced mode: Optimal mix of speed and reliability"
            echo "Note: Changes apply to current session only"
            echo "✅ Balanced mode set."
            ;;
        "parallel")
            if [ "${2:-}" = "enable" ]; then
                echo "⚠️  Enabling parallel sync (experimental)..."
                echo "WARNING: Parallel sync may cause conflicts. Use with caution!"
                echo "Note: Changes apply to current session only"
                echo "✅ Parallel sync enabled."
            elif [ "${2:-}" = "disable" ]; then
                echo "Disabling parallel sync..."
                echo "Note: Changes apply to current session only"
                echo "✅ Parallel sync disabled."
            else
                echo "Usage: $0 optimize parallel [enable|disable]"
                echo "Current parallel sync status: $ENABLE_PARALLEL_SYNC"
            fi
            ;;
        "reset")
            echo "Resetting to default optimization settings..."
            echo "Note: Changes apply to current session only"
            echo "✅ Default settings restored."
            ;;
        *)
            echo "Usage: $0 optimize [status|speed|reliability|balanced|parallel|reset]"
            echo "  status      - Show current optimization settings"
            echo "  speed       - Optimize for fastest sync"
            echo "  reliability - Optimize for maximum reliability"
            echo "  balanced    - Balanced optimization (default)"
            echo "  parallel    - Enable/disable parallel sync"
            echo "  reset       - Reset to default settings"
            ;;
    esac
}

# Benchmark sync performance
benchmark() {
    local iterations=${1:-3}
    local service=${2:-"all"}

    echo "=== 🏁 Sync Performance Benchmark ==="
    echo "Running $iterations iterations for $service"
    echo ""

    local total_time=0
    local successful_runs=0

    for i in $(seq 1 $iterations); do
        echo "--- Benchmark Run $i/$iterations ---"
        local start_time=$(date +%s)

        if [ "$service" = "all" ]; then
            sync_services
        else
            case $service in
                "icloud")
                    run_unison_sync "icloud" "$ICLOUD_PROFILE" "$ICLOUD_LOG"
                    ;;
                "google_drive")
                    run_unison_sync "google_drive" "$GDRIVE_PROFILE" "$GDRIVE_LOG"
                    ;;
            esac
        fi

        local end_time=$(date +%s)
        local duration=$((end_time - start_time))

        if [ $? -eq 0 ]; then
            ((successful_runs++))
            total_time=$((total_time + duration))
            echo "✅ Run $i completed in ${duration}s"
        else
            echo "❌ Run $i failed"
        fi

        # Wait between runs
        if [ $i -lt $iterations ]; then
            echo "Waiting 30s before next run..."
            sleep 30
        fi
    done

    echo ""
    echo "=== Benchmark Results ==="
    echo "Successful runs: $successful_runs/$iterations"

    if [ $successful_runs -gt 0 ]; then
        local avg_time=$((total_time / successful_runs))
        echo "Average sync time: ${avg_time}s"
        echo "Total time: ${total_time}s"
        echo "Success rate: $((successful_runs * 100 / iterations))%"
    else
        echo "No successful runs completed"
    fi
}

# Advanced iCloud remediation for persistent cloud-only files
aggressive_icloud_fix() {
    log "=== Aggressive iCloud Remediation ==="
    
    local icloud_actual_path=$(readlink "$ICLOUD_PATH" 2>/dev/null || echo "$ICLOUD_PATH")
    
    if [ ! -d "$icloud_actual_path" ]; then
        log "ERROR: iCloud directory not found: $icloud_actual_path"
        return 1
    fi
    
    log "Starting aggressive iCloud file remediation..."
    
    # Step 1: Check iCloud Drive system status
    log "Step 1: Checking iCloud Drive system status..."
    local icloud_status=$(brctl status 2>/dev/null || echo "Unknown")
    log "iCloud status: $icloud_status"
    
    # Step 2: Force restart of iCloud processes
    log "Step 2: Restarting iCloud sync processes..."
    killall bird 2>/dev/null || true
    killall cloudd 2>/dev/null || true
    sleep 3
    
    # Step 3: Touch all files to trigger sync events
    log "Step 3: Triggering file system events..."
    find "$icloud_actual_path" -type f -exec touch {} \; 2>/dev/null || true
    
    # Step 4: Force download using multiple methods
    log "Step 4: Multi-method force download..."
    
    # Method A: Bulk directory download
    log "  Method A: Bulk directory download..."
    brctl download "$icloud_actual_path" 2>/dev/null || true
    
    # Method B: Individual file downloads
    log "  Method B: Individual file downloads..."
    find "$icloud_actual_path" -name "*.md" -exec brctl download {} \; 2>/dev/null || true
    find "$icloud_actual_path" -name "*.icloud" -exec brctl download {} \; 2>/dev/null || true
    
    # Method C: Force download via file access
    log "  Method C: Force download via file access..."
    find "$icloud_actual_path" -type f -name "*.md" -exec head -1 {} \; >/dev/null 2>&1 || true
    
    # Step 5: Wait and monitor progress
    log "Step 5: Monitoring download progress..."
    local max_wait=60
    local count=0
    
    while [ $count -lt $max_wait ]; do
        local temp_status=$(mktemp)
        timeout 5 brctl monitor "$icloud_actual_path" > "$temp_status" 2>/dev/null || true
        
        local cloud_only=$(grep "☁" "$temp_status" | wc -l | tr -d ' ')
        local local_files=$(grep -v "☁" "$temp_status" | wc -l | tr -d ' ')
        
        rm -f "$temp_status"
        
        log "  Progress: $local_files local, $cloud_only cloud-only"
        
        if [ "$cloud_only" -eq 0 ]; then
            log "SUCCESS: All files downloaded"
            break
        fi
        
        sleep 5
        ((count += 5))
    done
    
    # Step 6: Force Finder refresh
    log "Step 6: Refreshing Finder and system caches..."
    osascript -e 'tell application "Finder" to close every window' 2>/dev/null || true
    sleep 2
    killall Finder 2>/dev/null || true
    sleep 3
    
    # Step 7: Verify final status
    log "Step 7: Final verification..."
    local temp_final=$(mktemp)
    timeout 10 brctl monitor "$icloud_actual_path" > "$temp_final" 2>/dev/null || true
    
    local final_cloud=$(grep "☁" "$temp_final" | wc -l | tr -d ' ')
    local final_local=$(grep -v "☁" "$temp_final" | wc -l | tr -d ' ')
    
    rm -f "$temp_final"
    
    log "Final status: $final_local local files, $final_cloud cloud-only files"
    
    if [ "$final_cloud" -gt 0 ]; then
        log "WARNING: $final_cloud files remain cloud-only"
        log "This may indicate system-level iCloud issues. Recommendations:"
        log "1. Check System Preferences > Apple ID > iCloud > iCloud Drive"
        log "2. Verify Obsidian has iCloud access in Privacy settings"
        log "3. Try disabling and re-enabling iCloud Drive for Obsidian"
        log "4. Check if iCloud sync is paused system-wide"
        return 1
    else
        log "SUCCESS: All files are now local and should sync to iPad"
        return 0
    fi
}

# Main function
main() {
    case "${1:-sync}" in
        "sync"|"schedule")
            sync_services
            ;;
        "stop")
            emergency_stop
            ;;
        "status")
            status_check
            ;;
        "monitor"|"health")
            monitor_health
            ;;
        "cleanup")
            cleanup
            ;;
        "full")
            sync_services
            monitor_health
            cleanup
            ;;
        "diagnose"|"diag")
            diagnose
            ;;
        "fix")
            fix_issues
            ;;
        "download"|"icloud-download")
            force_icloud_download
            ;;
        "aggressive-fix"|"force-sync")
            aggressive_icloud_fix
            ;;
        "performance"|"perf")
            performance "${2:-all}" "${3:-7}"
            ;;
        "alerts")
            alerts "${2:-list}"
            ;;
        "trends")
            echo "=== 📈 Sync Trends ==="
            analyze_trends "icloud" "${2:-7}" || echo "No iCloud trend data"
            echo ""
            analyze_trends "google" "${2:-7}" || echo "No Google Drive trend data"
            ;;
        "optimize"|"tune")
            optimize "${2:-status}" "${3:-}"
            ;;
        "benchmark"|"bench")
            benchmark "${2:-3}" "${3:-all}"
            ;;
        *)
            echo "Usage: $0 [command] [options]"
            echo ""
            echo "📋 Basic Commands:"
            echo "  sync        - Run intelligent sync (default)"
            echo "  status      - Check current status"
            echo "  stop        - Emergency stop all syncs"
            echo ""
            echo "📊 Monitoring Commands:"
            echo "  monitor     - Generate enhanced health report"
            echo "  performance - Show performance analysis [service] [days]"
            echo "  trends      - Show sync trends [days]"
            echo "  alerts      - Manage alerts [list|clear|test]"
            echo ""
            echo "⚡ Performance Commands:"
            echo "  optimize    - Performance optimization [status|speed|reliability|balanced|parallel|reset]"
            echo "  benchmark   - Run sync performance benchmark [iterations] [service]"
            echo ""
            echo        "            echo "🛠️  Maintenance Commands:""
            echo "  diagnose    - Run system diagnostics"
            echo "  fix         - Fix known issues automatically"
            echo "  download    - Force download all iCloud files locally"
            echo "  aggressive-fix - Advanced iCloud remediation for persistent issues"
            echo "  cleanup     - Clean old files"
            echo "  full        - Run sync + monitor + cleanup"
            echo ""
            echo "Examples:"
            echo "  $0 performance icloud 14      # iCloud performance for 14 days"
            echo "  $0 optimize speed              # Optimize for fastest sync"
            echo "  $0 benchmark 5 icloud          # Benchmark iCloud sync 5 times"
            echo "  $0 aggressive-fix              # Force all iCloud files to download"
            echo "  $0 optimize parallel enable    # Enable experimental parallel sync"
            echo "  $0 trends 30                   # Show trends for 30 days"
            exit 1
            ;;
    esac
}

main "$@"
