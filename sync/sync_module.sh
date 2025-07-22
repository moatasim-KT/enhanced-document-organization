update_sync_metrics() {
    local success=$1
    local metrics_file="$PARENT_DIR/.gemini/metrics_data.json"
    if [[ -f "$metrics_file" ]]; then
        local current_metrics=$(cat "$metrics_file")
        local current_sync_ops=$(echo "$current_metrics" | jq -r '.sync_operations_last_24h')
        local new_sync_ops=$((current_sync_ops + 1))
        local new_metrics=$(echo "$current_metrics" | jq \
            --argjson sync_ops "$new_sync_ops" \
            '.sync_operations_last_24h = $sync_ops | .last_updated = "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"'
        )
        echo "$new_metrics" > "$metrics_file"
        log "Updated metrics_data.json with sync operations count."
    fi
}#!/bin/bash

# ============================================================================
# CONSOLIDATED SYNC MODULE
# ============================================================================
# This module combines sync_manager.sh, sync_reliability_enhanced.sh, and circuit_breaker.sh
# into a single, comprehensive sync management system.
#
# The module provides robust synchronization with error handling, circuit breaker
# implementation, and automatic recovery mechanisms.
#
# Key features:
# - Circuit breaker pattern to prevent repeated failures
# - Error-specific handling and recovery strategies
# - Cloud service health checks
# - Comprehensive logging and status reporting
#
# Usage:
#   ./sync_module.sh sync       # Run sync with reliability enhancements
#   ./sync_module.sh health     # Check sync health
#   ./sync_module.sh status     # Show circuit breaker status
#   ./sync_module.sh reset      # Reset all circuit breakers
#
# Options:
#   --force            # Force sync even during quiet hours
#

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
# The circuit breaker is a design pattern that prevents an application from
# repeatedly trying to execute an operation that's likely to fail, allowing
# it to handle the failure gracefully without overwhelming system resources.
# It works in three states:
#
# - CLOSED: Operations are allowed. Failures are counted.
# - OPEN: Operations are blocked, preventing further failures.
# - HALF-OPEN: A test operation is allowed to see if the system has recovered.
#

# Default thresholds
DEFAULT_FAILURE_THRESHOLD=5       # Number of failures to open the circuit
DEFAULT_RESET_TIMEOUT=1800        # 30 minutes to transition to half-open
DEFAULT_HALF_OPEN_TIMEOUT=300     # 5 minutes for half-open test

declare -A FAILURE_THRESHOLDS
declare -A RESET_TIMEOUTS

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_circuit_breaker() {
    local level=$1
    local message=$2
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] [CircuitBreaker] $message" | tee -a "$CIRCUIT_BREAKER_LOG"
}

initialize_circuit_breaker_config() {
    FAILURE_THRESHOLDS["network"]=3
    FAILURE_THRESHOLDS["authentication"]=2
    FAILURE_THRESHOLDS["conflict"]=5
    FAILURE_THRESHOLDS["quota"]=2
    FAILURE_THRESHOLDS["transient"]=8
    FAILURE_THRESHOLDS["permanent"]=1
    FAILURE_THRESHOLDS["partial_sync"]=5

    RESET_TIMEOUTS["network"]=900
    RESET_TIMEOUTS["authentication"]=3600
    RESET_TIMEOUTS["conflict"]=1800
    RESET_TIMEOUTS["quota"]=7200
    RESET_TIMEOUTS["transient"]=300
    RESET_TIMEOUTS["permanent"]=86400
    RESET_TIMEOUTS["partial_sync"]=1200
}

initialize_circuit_breaker_file() {
    if [ ! -f "$CIRCUIT_BREAKER_FILE" ]; then
        log_circuit_breaker "INFO" "Creating circuit breaker state file."
        cat > "$CIRCUIT_BREAKER_FILE" <<EOF
{
  "services": {}
}
EOF
    fi
}

get_circuit_breaker_state() {
    local service=$1
    local state=$(jq -r ".services[\"$service\"].state // \"closed\"" "$CIRCUIT_BREAKER_FILE" 2>/dev/null)
    echo "${state:-closed}"
}

get_failure_count() {
    local service=$1
    local count=$(jq -r ".services[\"$service\"].failure_count // 0" "$CIRCUIT_BREAKER_FILE" 2>/dev/null)
    echo "${count:-0}"
}

get_last_failure_time() {
    local service=$1
    local time=$(jq -r ".services[\"$service\"].last_failure_time // \"\"" "$CIRCUIT_BREAKER_FILE" 2>/dev/null)
    echo "${time}"
}

get_circuit_breaker_error_type() {
    local service=$1
    local error_type=$(jq -r ".services[\"$service\"].error_type // \"\"" "$CIRCUIT_BREAKER_FILE" 2>/dev/null)
    echo "${error_type}"
}

update_circuit_breaker_state() {
    local service=$1
    local new_state=$2
    local failure_count=${3:-0}
    local error_type=${4:-"unknown"}
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    local temp_file=$(mktemp)
    jq \
       --arg service "$service" \
       --arg state "$new_state" \
       --argjson count "$failure_count" \
       --arg timestamp "$timestamp" \
       --arg error_type "$error_type" \
       '
       .services[$service] = {
           "state": $state,
           "failure_count": $count,
           "last_failure_time": $timestamp,
           "last_updated": $timestamp,
           "error_type": $error_type
       }
       ' "$CIRCUIT_BREAKER_FILE" > "$temp_file" && mv "$temp_file" "$CIRCUIT_BREAKER_FILE"

    log_circuit_breaker "INFO" "Updated $service to $new_state (failures: $failure_count, error: $error_type)"
}

circuit_breaker_allows_operation() {
    local service=$1
    local state=$(get_circuit_breaker_state "$service")
    local last_failure_time=$(get_last_failure_time "$service")
    local error_type=$(get_circuit_breaker_error_type "$service")
    local reset_timeout=$(get_reset_timeout "$error_type")

    case "$state" in
        "closed")
            return 0
            ;;
        "open")
            if [ -n "$last_failure_time" ]; then
                local current_time=$(date +%s)
                local failure_time=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$last_failure_time" +%s)
                local time_diff=$((current_time - failure_time))

                if [ $time_diff -gt $reset_timeout ]; then
                    update_circuit_breaker_state "$service" "half-open"
                    log_circuit_breaker "INFO" "$service transitioning to half-open."
                    return 0
                fi
            fi
            return 1
            ;;
        "half-open")
            return 0
            ;;
        *)
            return 0
            ;;
    esac
}

handle_circuit_breaker_result() {
    local service=$1
    local success=$2
    local error_type=${3:-"unknown"}
    local current_state=$(get_circuit_breaker_state "$service")
    local current_count=$(get_failure_count "$service")
    local failure_threshold=$(get_failure_threshold "$error_type")

    if $success; then
        if [ "$current_state" = "half-open" ] || [ "$current_state" = "closed" ]; then
            update_circuit_breaker_state "$service" "closed" 0
            log_circuit_breaker "INFO" "$service is now closed."
        fi
    else
        local new_count=$((current_count + 1))
        if [ "$current_state" = "half-open" ]; then
            update_circuit_breaker_state "$service" "open" $new_count "$error_type"
            log_circuit_breaker "WARN" "$service failed in half-open state, moving to open."
        elif [ "$current_state" = "closed" ]; then
            if [ $new_count -ge $failure_threshold ]; then
                update_circuit_breaker_state "$service" "open" $new_count "$error_type"
                log_circuit_breaker "WARN" "$service has been opened due to repeated failures."
            else
                update_circuit_breaker_state "$service" "closed" $new_count "$error_type"
            fi
        fi
    fi
}

reset_circuit_breaker() {
    local service=$1
    update_circuit_breaker_state "$service" "closed" 0
    log_circuit_breaker "INFO" "Circuit breaker for $service has been reset."
}

reset_all_circuit_breakers() {
    log_circuit_breaker "INFO" "Resetting all circuit breakers."
    if command -v jq >/dev/null 2>&1; then
        local services=$(jq -r '.services | keys[]' "$CIRCUIT_BREAKER_FILE")
        for service in $services; do
            reset_circuit_breaker "$service"
        done
    else
        log "jq is not installed. Cannot reset all breakers."
    fi
}

display_circuit_breaker_status() {
    initialize_circuit_breaker_file
    log "======================================="
    log "Circuit Breaker Status"
    log "======================================="

    if command -v jq >/dev/null 2>&1; then
        local services=$(jq -r '.services | keys[]' "$CIRCUIT_BREAKER_FILE")
        if [ -z "$services" ]; then
            log "No services configured."
            return 0
        fi

        printf "%-20s %-12s %-10s %-25s %-20s\n" "Service" "State" "Failures" "Last Failure" "Error Type"
        echo "----------------------------------------------------------------------------------------------------"

        for service in $services; do
            local state=$(get_circuit_breaker_state "$service")
            local count=$(get_failure_count "$service")
            local last_failure=$(get_last_failure_time "$service")
            local error_type=$(get_circuit_breaker_error_type "$service")
            printf "%-20s %-12s %-10s %-25s %-20s\n" "$service" "$state" "$count" "$last_failure" "$error_type"
        done
    else
        log "jq is not installed. Cannot display status."
    fi
}

get_failure_threshold() {
    local error_type=$1
    echo "${FAILURE_THRESHOLDS[$error_type]:-$DEFAULT_FAILURE_THRESHOLD}"
}

get_reset_timeout() {
    local error_type=$1
    echo "${RESET_TIMEOUTS[$error_type]:-$DEFAULT_RESET_TIMEOUT}"
}

# ============================================================================
# SYNC RELIABILITY FUNCTIONS
# ============================================================================

check_gdrive() {
    log "Checking Google Drive accessibility..."
    if [[ ! -d "$GDRIVE_PATH" ]]; then
        log "Google Drive path not found: $GDRIVE_PATH"
        return 1
    fi
    if timeout 10 ls -la "$GDRIVE_PATH" >/dev/null 2>&1; then
        log "Google Drive is accessible."
        return 0
    else
        log "Google Drive is not responding."
        return 1
    fi
}

check_icloud() {
    log "Checking iCloud accessibility..."
    if [[ ! -d "$ICLOUD_PATH" ]]; then
        log "iCloud path not found: $ICLOUD_PATH"
        return 1
    fi
    if timeout 10 ls -la "$ICLOUD_PATH" >/dev/null 2>&1; then
        log "iCloud is accessible."
        return 0
    else
        log "iCloud is not responding."
        return 1
    fi
}

ensure_sync_hub_exists() {
    log "Ensuring local sync hub exists..."
    if [[ ! -d "$SYNC_HUB" ]]; then
        log "Creating local sync hub: $SYNC_HUB"
        mkdir -p "$SYNC_HUB"
    fi
    log "Local sync hub is ready."
}

run_sync() {
    log "Starting enhanced sync process..."
    initialize_circuit_breaker_config
    initialize_circuit_breaker_file

    sync_gdrive
    sync_icloud

    log "Enhanced sync process completed."
    display_circuit_breaker_status
}

sync_gdrive() {
    log "Performing reliable sync with Google Drive..."
    if ! circuit_breaker_allows_operation "google_drive"; then
        log "Circuit breaker is open for Google Drive. Skipping sync."
        return 1
    fi

    if ! check_gdrive; then
        log "Skipping Google Drive sync due to accessibility issues."
        handle_circuit_breaker_result "google_drive" false "network"
        return 1
    fi

    ensure_sync_hub_exists
    log "Running Unison sync with Google Drive..."
    unison -batch -ui text -times -prefer newer "$SYNC_HUB" "$GDRIVE_PATH"
    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        log "Google Drive sync completed successfully."
        handle_circuit_breaker_result "google_drive" true
        update_sync_metrics true
    else
        log "Google Drive sync failed with exit code $exit_code."
        handle_circuit_breaker_result "google_drive" false "permanent"
        update_sync_metrics false
    fi
}

sync_icloud() {
    log "Performing reliable sync with iCloud..."
    if ! circuit_breaker_allows_operation "icloud"; then
        log "Circuit breaker is open for iCloud. Skipping sync."
        return 1
    fi

    if ! check_icloud; then
        log "Skipping iCloud sync due to accessibility issues."
        handle_circuit_breaker_result "icloud" false "network"
        return 1
    fi

    ensure_sync_hub_exists
    log "Running Unison sync with iCloud..."
    unison -batch -ui text -times -prefer newer "$SYNC_HUB" "$ICLOUD_PATH"
    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        log "iCloud sync completed successfully."
        handle_circuit_breaker_result "icloud" true
        update_sync_metrics true
    else
        log "iCloud sync failed with exit code $exit_code."
        handle_circuit_breaker_result "icloud" false "permanent"
        update_sync_metrics false
    fi
}

check_health() {
    log "Checking sync health..."
    check_gdrive
    check_icloud
    log "Sync health check completed."
}

# ============================================================================
# MAIN SCRIPT
# ============================================================================

show_usage() {
    cat << EOF
Usage: $(basename "$0") [command] [options]

Commands:
  sync               Run enhanced sync process
  health             Check sync health
  status             Display circuit breaker status
  reset              Reset all circuit breakers

Options:
  --force            Force sync even during quiet hours

Examples:
  $(basename "$0") sync
  $(basename "$0") health
  $(basename "$0") status
  $(basename "$0") reset
EOF
}

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
        status)
            display_circuit_breaker_status
            ;;
        reset)
            reset_all_circuit_breakers
            ;;
        *)
            echo "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"
