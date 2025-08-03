#!/bin/bash

# ============================================================================
# SIMPLIFIED SYNC MODULE
# ============================================================================
# Clean and simple sync functionality using Unison
# Handles synchronization between local hub and cloud services

set -euo pipefail

export PATH="/opt/homebrew/opt/util-linux/bin:$PATH"

# Get script directory and navigate to main project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Navigate up two levels: src/sync -> src -> project_root
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"


# Load configuration with defaults
CONFIG_FILE="$PROJECT_DIR/config/config.env"
if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE"
else
    echo "[ERROR] Config file not found: $CONFIG_FILE" >&2
    exit 1
fi

# Set config defaults if not set
: "${LOG_TO_CONSOLE:=true}"
: "${LOG_TO_FILE:=true}"
: "${SYNC_ENABLED:=true}"
: "${SYNC_HUB:?SYNC_HUB not set in config.env}"
: "${ICLOUD_PATH:?ICLOUD_PATH not set in config.env}"
: "${GOOGLE_DRIVE_PATH:?GOOGLE_DRIVE_PATH not set in config.env}"

# Log rotation (keep last 5 logs, 1MB max)
rotate_log() {
    local logfile="$1"
    if [[ -f "$logfile" && $(wc -c < "$logfile" | awk '{print $1}') -ge 1048576 ]]; then
        for i in 5 4 3 2 1; do
            [[ -f "$logfile.$i" ]] && mv "$logfile.$i" "$logfile.$((i+1))"
        done
        mv "$logfile" "$logfile.1"
        touch "$logfile"
    fi
}

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    if [[ "$LOG_TO_CONSOLE" == "true" ]]; then
        echo "[$timestamp] [$level] $message"
    fi
    
    if [[ "$LOG_TO_FILE" == "true" ]]; then
        mkdir -p "$PROJECT_DIR/logs"
        local logfile="$PROJECT_DIR/logs/sync.log"
        rotate_log "$logfile"
        echo "[$timestamp] [$level] $message" >> "$logfile"
    fi
}

# Check if directory exists and create if needed
ensure_directory() {
    local dir="$1"
    if [[ ! -d "$dir" ]]; then
        log "INFO" "Creating directory: $dir"
        mkdir -p "$dir"
    fi
}

# Check if Unison is available
check_unison() {
    if ! command -v unison >/dev/null 2>&1; then
        log "ERROR" "Unison is not installed. Please install it with: brew install unison"
        return 1
    fi
    return 0
}

# Validate profile integrity before sync
validate_profile_integrity() {
    local profile="$1"
    local profile_path="$HOME/.unison/${profile}.prf"
    
    log "INFO" "Validating profile integrity: $profile"
    
    # Check if profile exists
    if [[ ! -f "$profile_path" ]]; then
        log "ERROR" "Profile file not found: $profile_path"
        return 1
    fi
    
    # Use the profile validator to check for corruption
    local validator_script="$SCRIPT_DIR/profile_validator.js"
    if [[ ! -f "$validator_script" ]]; then
        log "ERROR" "Profile validator not found: $validator_script"
        return 1
    fi
    
    log "INFO" "Running profile validation for: $profile"
    local validation_output
    if ! validation_output=$(node "$validator_script" validate "$profile" 2>/dev/null); then
        log "ERROR" "Profile validation failed for: $profile"
        return 1
    fi
    
    # Parse validation result - extract isCorrupted from JSON output
    local is_corrupted="false"
    
    # Try to extract JSON and parse isCorrupted
    if command -v jq >/dev/null 2>&1; then
        # Use jq if available for robust JSON parsing
        local json_part
        json_part=$(echo "$validation_output" | grep -A 50 '^{' | jq -r '.isCorrupted // false' 2>/dev/null || echo "false")
        is_corrupted="$json_part"
    else
        # Fallback to grep/sed parsing
        local json_part
        json_part=$(echo "$validation_output" | sed -n '/^{/,/^}/p')
        if [[ -n "$json_part" ]]; then
            is_corrupted=$(echo "$json_part" | grep -o '"isCorrupted":[[:space:]]*true' | grep -o 'true' || echo "false")
        fi
    fi
    
    if [[ "$is_corrupted" == "true" ]]; then
        log "ERROR" "Profile corruption detected: $profile"
        log "INFO" "Consider running profile cleanup: node $validator_script cleanup"
        return 1
    fi
    
    log "INFO" "Profile integrity validation passed: $profile"
    return 0
}

# Validate sync root paths before starting sync
validate_sync_roots() {
    local profile="$1"
    local expected_source="$SYNC_HUB"
    local expected_destination=""
    
    log "INFO" "Validating sync root paths for profile: $profile"
    
    # Determine expected destination based on profile
    case "$profile" in
        "icloud")
            expected_destination="$ICLOUD_PATH"
            ;;
        "google_drive")
            expected_destination="$GOOGLE_DRIVE_PATH"
            ;;
        *)
            log "ERROR" "Unknown profile for root validation: $profile"
            return 1
            ;;
    esac
    
    # Use the sync root validator to check paths
    local root_validator_script="$SCRIPT_DIR/sync_root_validator.js"
    if [[ ! -f "$root_validator_script" ]]; then
        log "ERROR" "Sync root validator not found: $root_validator_script"
        return 1
    fi
    
    log "INFO" "Validating sync configuration:"
    log "INFO" "  Source: $expected_source"
    log "INFO" "  Destination: $expected_destination"
    log "INFO" "  Cloud Service: $profile"
    
    local validation_output
    if ! validation_output=$(node "$root_validator_script" validate-config "$expected_source" "$expected_destination" "$profile" 2>/dev/null); then
        log "ERROR" "Sync root validation failed for: $profile"
        return 1
    fi
    
    # Parse validation result - extract isValid from JSON output
    local is_valid="false"
    
    # Try to extract JSON and parse isValid
    if command -v jq >/dev/null 2>&1; then
        # Use jq if available for robust JSON parsing
        local json_part
        json_part=$(echo "$validation_output" | grep -A 50 '^{' | jq -r '.isValid // false' 2>/dev/null || echo "false")
        is_valid="$json_part"
    else
        # Fallback to grep/sed parsing
        local json_part
        json_part=$(echo "$validation_output" | sed -n '/^{/,/^}/p')
        if [[ -n "$json_part" ]]; then
            is_valid=$(echo "$json_part" | grep -o '"isValid":[[:space:]]*true' | grep -o 'true' || echo "false")
        fi
    fi
    
    if [[ "$is_valid" != "true" ]]; then
        log "ERROR" "Sync root validation failed for profile: $profile"
        log "ERROR" "Parsed isValid value: '$is_valid'"
        return 1
    fi
    
    log "INFO" "Sync root validation passed for profile: $profile"
    return 0
}

# Log confirmed sync paths for user verification
log_sync_path_confirmation() {
    local profile="$1"
    local source_path="$SYNC_HUB"
    local destination_path=""
    
    # Determine destination path based on profile
    case "$profile" in
        "icloud")
            destination_path="$ICLOUD_PATH"
            ;;
        "google_drive")
            destination_path="$GOOGLE_DRIVE_PATH"
            ;;
        *)
            destination_path="Unknown"
            ;;
    esac
    
    log "INFO" "=== SYNC PATH CONFIRMATION ==="
    log "INFO" "Profile: $profile"
    log "INFO" "Source Path: $source_path"
    log "INFO" "Destination Path: $destination_path"
    log "INFO" "Profile File: $HOME/.unison/${profile}.prf"
    
    # Check if paths exist and log their status
    if [[ -d "$source_path" ]]; then
        local source_size
        source_size=$(du -sh "$source_path" 2>/dev/null | cut -f1 || echo "Unknown")
        log "INFO" "Source Directory Status: EXISTS (Size: $source_size)"
    else
        log "WARN" "Source Directory Status: DOES NOT EXIST"
    fi
    
    if [[ -d "$destination_path" ]]; then
        local dest_size
        dest_size=$(du -sh "$destination_path" 2>/dev/null | cut -f1 || echo "Unknown")
        log "INFO" "Destination Directory Status: EXISTS (Size: $dest_size)"
    else
        log "WARN" "Destination Directory Status: DOES NOT EXIST (will be created)"
    fi
    
    log "INFO" "=== END SYNC PATH CONFIRMATION ==="
}

# Enhanced pre-sync validation
pre_sync_validation() {
    local profile="$1"
    local skip_safety="$2"
    
    log "INFO" "Starting pre-sync validation for profile: $profile"
    
    # Step 1: Validate profile integrity
    if ! validate_profile_integrity "$profile"; then
        log "ERROR" "Pre-sync validation failed: Profile integrity check failed"
        return 1
    fi
    
    # Step 2: Validate sync root paths
    if ! validate_sync_roots "$profile"; then
        log "ERROR" "Pre-sync validation failed: Sync root validation failed"
        return 1
    fi
    
    # Step 3: Log sync path confirmation
    log_sync_path_confirmation "$profile"
    
    # Step 4: Perform dotfile safety check (unless explicitly skipped)
    if [[ "$skip_safety" != "true" ]]; then
        log "INFO" "Running dotfile safety check for profile: $profile"
        
        local safety_check_script="$SCRIPT_DIR/dotfile_safety_check.cjs"
        if [[ ! -f "$safety_check_script" ]]; then
            log "ERROR" "Dotfile safety check script not found: $safety_check_script"
            return 1
        fi
        
        # Backup the profile before sync (integrated into safety check)
        if ! node "$safety_check_script" "$profile"; then
            log "ERROR" "Dotfile safety check failed! Sync operation aborted to prevent unwanted files from being synced."
            log "WARNING" "If you need to override this safety check, use the --force option"
            return 1
        fi
        
        log "INFO" "Dotfile safety check passed successfully"
    else
        log "WARNING" "Dotfile safety check skipped due to force option"
    fi
    
    log "INFO" "Pre-sync validation completed successfully for profile: $profile"
    return 0
}

# Enhanced sync using Unison profile with validation checks
sync_with_unison() {
    local profile="$1"
    local dry_run_flag="${2:-false}"
    
    # Check if profile exists in ~/.unison/
    local unison_profile="$HOME/.unison/${profile}.prf"
    
    if [[ ! -f "$unison_profile" ]]; then
        log "ERROR" "Unison profile not found: $unison_profile"
        log "INFO" "Please ensure profiles are properly generated in ~/.unison/"
        return 1
    fi
    
    # Run pre-sync validation
    log "INFO" "Running pre-sync validation for profile: $profile"
    local force_flag="${3:-false}"
    
    if ! pre_sync_validation "$profile" "$force_flag"; then
        log "ERROR" "Pre-sync validation failed, aborting sync: $profile"
        return 1
    fi
    
    log "INFO" "Starting sync with profile: $profile${dry_run_flag:+ (dry-run)}"
    log "INFO" "Using Unison profile: $unison_profile"
    
    # Run Unison with progress output and timeout
    local unison_args=("$profile" -batch -auto)
    [[ "$dry_run_flag" == "true" ]] && unison_args+=( -testserver )
    
    log "INFO" "Executing: unison ${unison_args[*]}"
    
    # Use timeout to prevent hanging (5 minutes max)
    if timeout 300 unison "${unison_args[@]}"; then
        log "INFO" "Sync completed successfully: $profile"
        log "INFO" "Post-sync confirmation for profile: $profile"
        log_sync_path_confirmation "$profile"
        return 0
    else
        local exit_code=$?
        if [[ $exit_code -eq 124 ]]; then
            log "ERROR" "Sync timed out after 5 minutes: $profile"
        else
            log "ERROR" "Sync failed with exit code $exit_code: $profile"
        fi
        return 1
    fi
}

# Generate comprehensive dry-run preview using the dry-run preview module
dry_run_preview() {
    local profile="$1"
    
    log "INFO" "Generating dry-run preview for profile: $profile"
    
    # Check if dry-run preview script exists
    local dry_run_script="$SCRIPT_DIR/dry_run_preview.cjs"
    if [[ ! -f "$dry_run_script" ]]; then
        log "ERROR" "Dry-run preview script not found: $dry_run_script"
        return 1
    fi
    
    # Check if Node.js is available
    if ! command -v node >/dev/null 2>&1; then
        log "ERROR" "Node.js is required for dry-run preview but not found"
        return 1
    fi
    
    # Run pre-sync validation first
    log "INFO" "Running pre-sync validation for dry-run preview: $profile"
    if ! pre_sync_validation "$profile"; then
        log "ERROR" "Pre-sync validation failed, aborting dry-run preview: $profile"
        return 1
    fi
    
    # Generate the preview
    log "INFO" "Executing dry-run preview: node $dry_run_script preview $profile"
    
    if node "$dry_run_script" preview "$profile"; then
        log "INFO" "Dry-run preview completed successfully: $profile"
        return 0
    else
        log "ERROR" "Dry-run preview failed: $profile"
        return 1
    fi
}

# Interactive function to add ignore patterns
add_ignore_patterns() {
    local profile="$1"
    
    log "INFO" "Starting interactive ignore pattern addition for profile: $profile"
    
    # Check if dry-run preview script exists
    local dry_run_script="$SCRIPT_DIR/dry_run_preview.cjs"
    if [[ ! -f "$dry_run_script" ]]; then
        log "ERROR" "Dry-run preview script not found: $dry_run_script"
        return 1
    fi
    
    # Check if Node.js is available
    if ! command -v node >/dev/null 2>&1; then
        log "ERROR" "Node.js is required for adding ignore patterns but not found"
        return 1
    fi
    
    # Run the interactive ignore pattern addition
    log "INFO" "Executing interactive ignore pattern addition: node $dry_run_script add-ignore $profile"
    
    if node "$dry_run_script" add-ignore "$profile"; then
        log "INFO" "Ignore pattern addition completed successfully: $profile"
        return 0
    else
        log "ERROR" "Ignore pattern addition failed: $profile"
        return 1
    fi
}

# Generic sync service (dynamic, extensible)
sync_service() {
    local service="$1"
    local path_var="$2"
    local profile="$3"
    local dry_run_flag="${4:-false}"
    local force_flag="${5:-false}"
    local path_value="${!path_var}"
    log "INFO" "Starting $service sync${dry_run_flag:+ (dry-run)}${force_flag:+ (with force option)}"
    ensure_directory "$SYNC_HUB"
    ensure_directory "$path_value"
    if sync_with_unison "$profile" "$dry_run_flag" "$force_flag"; then
        log "INFO" "$service sync completed successfully"
        return 0
    else
        log "ERROR" "$service sync failed"
        return 1
    fi
}

# Run all syncs (dynamic, extensible, error reporting)
sync_all() {
    local dry_run_flag="${1:-false}"
    local force_flag="${2:-false}"
    log "INFO" "Starting full sync process${dry_run_flag:+ (dry-run)}${force_flag:+ (with force option)}"
    if [[ "$SYNC_ENABLED" != "true" ]]; then
        log "WARN" "Sync is disabled in configuration"
        return 0
    fi
    # Check Unison availability
    if ! check_unison; then
        return 1
    fi
    local services=(
        "iCloud:ICLOUD_PATH:icloud"
        "GoogleDrive:GOOGLE_DRIVE_PATH:google_drive"
    )
    local failed=()
    for entry in "${services[@]}"; do
        IFS=":" read -r name pathvar profile <<< "$entry"
        if ! sync_service "$name" "$pathvar" "$profile" "$dry_run_flag" "$force_flag"; then
            failed+=("$name")
        fi
    done
    if [[ ${#failed[@]} -eq 0 ]]; then
        log "INFO" "All syncs completed successfully"
        return 0
    else
        log "ERROR" "Some syncs failed: ${failed[*]}"
        return 1
    fi
}

# Enhanced sync status with validation checks
sync_status() {
    log "INFO" "Checking enhanced sync status with validation"
    echo "=== Sync Configuration ==="
    echo "Sync Hub: $SYNC_HUB"
    echo "iCloud Path: $ICLOUD_PATH"
    echo "Google Drive Path: $GOOGLE_DRIVE_PATH"
    echo "Sync Enabled: $SYNC_ENABLED"
    echo ""
    echo "=== Directory Status ==="
    for entry in "iCloud:$ICLOUD_PATH" "Google Drive:$GOOGLE_DRIVE_PATH"; do
        IFS=":" read -r name path <<< "$entry"
        if [[ -d "$path" ]]; then
            local size
            size=$(du -sh "$path" 2>/dev/null | cut -f1 || echo "Unknown")
            echo "$name path exists: Yes (Size: $size)"
        else
            echo "$name path exists: No"
        fi
    done
    echo ""
    echo "=== Unison Status ==="
    if command -v unison >/dev/null 2>&1; then
        echo "Unison installed: Yes ($(unison -version | head -1))"
    else
        echo "Unison installed: No"
    fi
    echo ""
    echo "=== Profile Validation Status ==="
    local validator_script="$SCRIPT_DIR/profile_validator.js"
    if [[ -f "$validator_script" ]]; then
        echo "Profile Validator: Available"
        # Check profile integrity for each service
        for profile in "icloud" "google_drive"; do
            local profile_path="$HOME/.unison/${profile}.prf"
            if [[ -f "$profile_path" ]]; then
                echo -n "$profile profile: "
                local validation_output
                if validation_output=$(node "$validator_script" validate "$profile" 2>&1); then
                    local is_corrupted="false"
                    if command -v jq >/dev/null 2>&1; then
                        is_corrupted=$(echo "$validation_output" | grep -A 50 '^{' | jq -r '.isCorrupted // false' 2>/dev/null || echo "false")
                    else
                        local json_part
                        json_part=$(echo "$validation_output" | sed -n '/^{/,/^}/p')
                        if [[ -n "$json_part" ]]; then
                            is_corrupted=$(echo "$json_part" | grep -o '"isCorrupted":[[:space:]]*true' | grep -o 'true' || echo "false")
                        fi
                    fi
                    if [[ "$is_corrupted" == "true" ]]; then
                        echo "CORRUPTED"
                    else
                        echo "Valid"
                    fi
                else
                    echo "Validation Error"
                fi
            else
                echo "$profile profile: Not Found"
            fi
        done
    else
        echo "Profile Validator: Not Available"
    fi
    echo ""
    echo "=== Root Path Validation Status ==="
    local root_validator_script="$SCRIPT_DIR/sync_root_validator.js"
    if [[ -f "$root_validator_script" ]]; then
        echo "Root Path Validator: Available"
        # Check source root
        echo -n "Source Root ($SYNC_HUB): "
        local source_validation
        if source_validation=$(node "$root_validator_script" validate-source "$SYNC_HUB" 2>/dev/null); then
            local is_valid="false"
            if command -v jq >/dev/null 2>&1; then
                is_valid=$(echo "$source_validation" | grep -A 50 '^{' | jq -r '.isValid // false' 2>/dev/null || echo "false")
            else
                local json_part
                json_part=$(echo "$source_validation" | sed -n '/^{/,/^}/p')
                if [[ -n "$json_part" ]]; then
                    is_valid=$(echo "$json_part" | grep -o '"isValid":[[:space:]]*true' | grep -o 'true' || echo "false")
                fi
            fi
            if [[ "$is_valid" == "true" ]]; then
                echo "Valid"
            else
                echo "Invalid"
            fi
        else
            echo "Validation Error"
        fi
        
        # Check destination roots
        for entry in "iCloud:$ICLOUD_PATH:icloud" "Google Drive:$GOOGLE_DRIVE_PATH:google_drive"; do
            IFS=":" read -r name path service <<< "$entry"
            echo -n "$name Destination ($path): "
            local dest_validation
            if dest_validation=$(node "$root_validator_script" validate-destination "$path" "$service" 2>/dev/null); then
                local is_valid="false"
                if command -v jq >/dev/null 2>&1; then
                    is_valid=$(echo "$dest_validation" | grep -A 50 '^{' | jq -r '.isValid // false' 2>/dev/null || echo "false")
                else
                    local json_part
                    json_part=$(echo "$dest_validation" | sed -n '/^{/,/^}/p')
                    if [[ -n "$json_part" ]]; then
                        is_valid=$(echo "$json_part" | grep -o '"isValid":[[:space:]]*true' | grep -o 'true' || echo "false")
                    fi
                fi
                if [[ "$is_valid" == "true" ]]; then
                    echo "Valid"
                else
                    echo "Invalid"
                fi
            else
                echo "Validation Error"
            fi
        done
    else
        echo "Root Path Validator: Not Available"
    fi
}

# Show enhanced help with validation information
show_help() {
    cat << EOF
Enhanced Sync Module with Validation and Dotfile Safety

Usage: $0 <command> [options]

Options:
    --force                - Bypass dotfile safety checks (use with caution)

Sync Commands:
    all                     - Sync all configured services with validation
    icloud                  - Sync iCloud only with validation
    gdrive                  - Sync Google Drive only with validation

Dry-Run Commands:
    dry-run-all             - Dry-run sync for all services (no actual transfer)
    dry-run-icloud          - Dry-run sync for iCloud only
    dry-run-gdrive          - Dry-run sync for Google Drive only

Preview Commands:
    preview-icloud          - Generate comprehensive dry-run preview for iCloud
    preview-gdrive          - Generate comprehensive dry-run preview for Google Drive

Ignore Pattern Commands:
    add-ignore-icloud       - Interactively add ignore patterns to iCloud profile
    add-ignore-gdrive       - Interactively add ignore patterns to Google Drive profile

Status and Validation Commands:
    status                  - Show enhanced sync configuration and validation status
    validate                - Run validation checks without syncing
    help                    - Show this help message

Dry-Run Features:
    - Shows exactly which files would be synchronized
    - Displays ignored files and the patterns that ignore them
    - Provides comprehensive sync summary without file transfer
    - Interactive ignore pattern addition
    - File size and count statistics
    - Save preview results to JSON files

Validation Features:
    - Pre-sync profile integrity checks
    - Root path validation before sync
    - Sync path confirmation logging
    - Enhanced status reporting with validation results

Examples:
    $0 all                  # Sync everything with validation
    $0 dry-run-all          # Preview what would be synced (no transfer)
    $0 preview-icloud       # Detailed preview of iCloud sync
    $0 add-ignore-icloud    # Add custom ignore patterns to iCloud
    $0 status               # Check enhanced status with validation
    $0 validate             # Run validation checks only

Configuration:
    Edit config.env to modify sync settings and paths.

Requirements:
    - profile_validator.js must be present in src/sync/
    - sync_root_validator.js must be present in src/sync/
    - dry_run_preview.cjs must be present in src/sync/
    - Node.js must be available for validation and preview scripts

EOF
}

# Generate comprehensive preview of sync changes
dry_run_preview() {
    local profile="$1"
    local force_flag="false"
    
    log "INFO" "Generating dry-run preview for profile: $profile"
    log "INFO" "Running pre-sync validation for dry-run preview: $profile"
    
    # Run pre-sync validation
    if ! pre_sync_validation "$profile" "$force_flag"; then
        log "ERROR" "Pre-sync validation failed for dry-run preview: $profile"
        return 1
    fi
    
    # Use Unison in dry-run mode with verbose output
    log "INFO" "Running detailed preview for profile: $profile"
    
    # Create directory for preview output
    local preview_dir="$PROJECT_DIR/logs/previews"
    mkdir -p "$preview_dir"
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local preview_file="$preview_dir/${profile}_preview_$timestamp.txt"
    
    # Run Unison with detailed output and save to file
    log "INFO" "Generating comprehensive preview for $profile (saving to $preview_file)"
    unison "$profile" -batch -auto -ui text -terse > "$preview_file" 2>&1
    
    # Display summary of preview
    log "INFO" "Preview generated and saved to: $preview_file"
    echo ""
    echo "Preview Summary (from $preview_file):"
    echo "----------------------------------------"
    grep -E 'will be' "$preview_file" || echo "No changes detected"
    echo "----------------------------------------"
    
    log "INFO" "Preview completed for profile: $profile"
    return 0
}

# Enhanced main execution with validation support
main() {
    # Check for --force option anywhere in arguments
    local force_flag="false"
    for arg in "$@"; do
        if [[ "$arg" == "--force" ]]; then
            force_flag="true"
            log "WARNING" "Force flag detected: Safety checks will be bypassed"
            break
        fi
    done
    
    # Filter out --force from arguments if present
    local filtered_args=()
    for arg in "$@"; do
        if [[ "$arg" != "--force" ]]; then
            filtered_args+=("$arg")
        fi
    done
    
    # If no arguments left after filtering, set default to help
    if [ ${#filtered_args[@]} -eq 0 ]; then
        filtered_args=("help")
    fi
    
    case "${filtered_args[0]:-help}" in
        "all"|"sync")
            sync_all "false" "$force_flag"
            ;;
        "dry-run-all")
            sync_all "true" "$force_flag"
            ;;
        "icloud")
            if check_unison; then
                sync_service "iCloud" "ICLOUD_PATH" "icloud" "false" "$force_flag"
            fi
            ;;
        "dry-run-icloud")
            if check_unison; then
                sync_service "iCloud" "ICLOUD_PATH" "icloud" "true" "$force_flag"
            fi
            ;;
        "gdrive"|"google-drive")
            if check_unison; then
                sync_service "GoogleDrive" "GOOGLE_DRIVE_PATH" "google_drive" "false" "$force_flag"
            fi
            ;;
        "dry-run-gdrive"|"dry-run-google-drive")
            if check_unison; then
                sync_service "GoogleDrive" "GOOGLE_DRIVE_PATH" "google_drive" "true" "$force_flag"
            fi
            ;;
        "preview-icloud")
            dry_run_preview "icloud"
            ;;
        "preview-gdrive"|"preview-google-drive")
            dry_run_preview "google_drive"
            ;;
        "add-ignore-icloud")
            add_ignore_patterns "icloud"
            ;;
        "add-ignore-gdrive"|"add-ignore-google-drive")
            add_ignore_patterns "google_drive"
            ;;
        "status")
            sync_status
            ;;
        "validate")
            validate_all_configurations
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        *)
            echo "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Validate all sync configurations without running sync
validate_all_configurations() {
    log "INFO" "Running validation checks for all sync configurations"
    
    if [[ "$SYNC_ENABLED" != "true" ]]; then
        log "WARN" "Sync is disabled in configuration"
        return 0
    fi
    
    # Check if validation scripts are available
    local validator_script="$SCRIPT_DIR/profile_validator.js"
    local root_validator_script="$SCRIPT_DIR/sync_root_validator.js"
    
    if [[ ! -f "$validator_script" ]]; then
        log "ERROR" "Profile validator not found: $validator_script"
        return 1
    fi
    
    if [[ ! -f "$root_validator_script" ]]; then
        log "ERROR" "Sync root validator not found: $root_validator_script"
        return 1
    fi
    
    local services=(
        "iCloud:ICLOUD_PATH:icloud"
        "GoogleDrive:GOOGLE_DRIVE_PATH:google_drive"
    )
    
    local validation_failed=false
    
    for entry in "${services[@]}"; do
        IFS=":" read -r name pathvar profile <<< "$entry"
        local path_value="${!pathvar}"
        
        log "INFO" "Validating configuration for $name"
        
        # Validate profile integrity
        if ! validate_profile_integrity "$profile"; then
            log "ERROR" "Profile validation failed for $name"
            validation_failed=true
            continue
        fi
        
        # Validate sync roots
        if ! validate_sync_roots "$profile"; then
            log "ERROR" "Root path validation failed for $name"
            validation_failed=true
            continue
        fi
        
        log "INFO" "Validation passed for $name"
    done
    
    if [[ "$validation_failed" == "true" ]]; then
        log "ERROR" "Some validation checks failed"
        return 1
    else
        log "INFO" "All validation checks passed"
        return 0
    fi
}

# Locking to prevent concurrent runs
LOCKFILE="/tmp/sync_module.lock"
acquire_lock() {
    exec 200>"$LOCKFILE"
    flock -n 200 || { echo "[ERROR] Another sync is already running." >&2; exit 1; }
}
release_lock() {
    flock -u 200
    rm -f "$LOCKFILE"
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    acquire_lock
    trap release_lock EXIT
    main "$@"
fi
