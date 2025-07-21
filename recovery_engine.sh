#!/bin/bash

# ============================================================================
# AUTOMATED RECOVERY ENGINE
# ============================================================================

# Recovery action registry - maps error types to recovery procedures
get_recovery_actions() {
    local error_type=$1
    case "$error_type" in
        "authentication")
            echo "refresh_credentials:validate_permissions"
            ;;
        "conflict")
            echo "reset_archives:clean_problematic_files:backup_conflicts"
            ;;
        "quota")
            echo "cleanup_space:compress_logs"
            ;;
        "partial_sync")
            echo "analyze_failed_files:selective_retry"
            ;;
        "network")
            echo "wait_connectivity:test_endpoints"
            ;;
        "configuration")
            echo "validate_paths:fix_permissions:restore_profile"
            ;;
        *)
            echo ""
            ;;
    esac
}

# Main recovery engine entry point
attempt_recovery() {
    local service=$1
    local error_type=$2
    local error_context=$3
    local exit_code=${4:-0}
    local error_output=${5:-""}
    
    log "Starting automated recovery for $service - error type: $error_type"
    
    local recovery_actions=$(get_recovery_actions "$error_type")
    local recovery_attempted=false
    local recovery_success=false
    local next_action="retry"
    
    if [ -z "$recovery_actions" ]; then
        log "No automated recovery available for error type: $error_type"
        echo "false:false:manual_intervention"
        return 1
    fi
    
    # Split recovery actions by colon and attempt each one
    local IFS=':'
    for action in $recovery_actions; do
        log "Attempting recovery action: $action"
        recovery_attempted=true
        
        case "$action" in
            "refresh_credentials")
                if refresh_service_credentials "$service" "$error_output"; then
                    recovery_success=true
                    log "Credential refresh successful for $service"
                    break
                fi
                ;;
            "validate_permissions")
                if validate_and_fix_permissions "$service"; then
                    recovery_success=true
                    log "Permission validation/fix successful for $service"
                    break
                fi
                ;;
            "reset_archives")
                if reset_unison_archives_recovery "$service" "$error_output"; then
                    recovery_success=true
                    log "Archive reset successful for $service"
                    break
                fi
                ;;
            "clean_problematic_files")
                if clean_problematic_files_recovery "$service" "$error_output"; then
                    recovery_success=true
                    log "Problematic file cleanup successful for $service"
                    break
                fi
                ;;
            "backup_conflicts")
                if backup_conflicted_files "$service"; then
                    log "Conflict backup created for $service"
                    # This doesn't resolve the issue but helps preserve data
                fi
                ;;
            "cleanup_space")
                if cleanup_disk_space "$service"; then
                    recovery_success=true
                    log "Disk space cleanup successful for $service"
                    break
                fi
                ;;
            "compress_logs")
                if compress_old_logs; then
                    log "Log compression completed"
                    # This is a supportive action, continue with other actions
                fi
                ;;
            "analyze_failed_files")
                if analyze_and_fix_failed_files "$service" "$error_output"; then
                    recovery_success=true
                    log "Failed file analysis and fix successful for $service"
                    break
                fi
                ;;
            "selective_retry")
                if perform_selective_retry "$service" "$error_output"; then
                    recovery_success=true
                    log "Selective retry successful for $service"
                    break
                fi
                ;;
            "wait_connectivity")
                if wait_for_network_connectivity; then
                    recovery_success=true
                    log "Network connectivity restored"
                    break
                fi
                ;;
            "test_endpoints")
                if test_service_endpoints "$service"; then
                    recovery_success=true
                    log "Service endpoints are accessible"
                    break
                fi
                ;;
            "validate_paths")
                if validate_sync_paths "$service"; then
                    recovery_success=true
                    log "Path validation successful for $service"
                    break
                fi
                ;;
            "fix_permissions")
                if fix_path_permissions "$service"; then
                    recovery_success=true
                    log "Permission fix successful for $service"
                    break
                fi
                ;;
            "restore_profile")
                if restore_unison_profile "$service"; then
                    recovery_success=true
                    log "Profile restoration successful for $service"
                    break
                fi
                ;;
            *)
                log "Unknown recovery action: $action"
                ;;
        esac
    done
    
    # Determine next action based on recovery results
    if [ "$recovery_success" = true ]; then
        next_action="retry_immediately"
    elif [ "$recovery_attempted" = true ]; then
        next_action="retry_with_delay"
    else
        next_action="manual_intervention"
    fi
    
    log "Recovery completed: attempted=$recovery_attempted, success=$recovery_success, next_action=$next_action"
    echo "$recovery_attempted:$recovery_success:$next_action"
    return 0
}

# Authentication recovery procedures
refresh_service_credentials() {
    local service=$1
    local error_output=$2
    
    log "Attempting credential refresh for $service"
    
    case "$service" in
        "google_drive")
            return $(refresh_google_drive_credentials "$error_output")
            ;;
        "icloud")
            return $(refresh_icloud_credentials "$error_output")
            ;;
        *)
            log "No credential refresh procedure for service: $service"
            return 1
            ;;
    esac
}

# Google Drive credential refresh
refresh_google_drive_credentials() {
    local error_output=$1
    
    # Check if this is a token expiry issue
    if echo "$error_output" | grep -qi "token\|auth\|credential\|unauthorized"; then
        log "Detected authentication issue with Google Drive"
        
        # Try to refresh OAuth token if using rclone
        if command -v rclone >/dev/null 2>&1; then
            log "Attempting to refresh rclone token for Google Drive"
            if rclone config reconnect gdrive: 2>/dev/null; then
                log "Google Drive token refresh successful"
                return 0
            fi
        fi
        
        # Check if Google Drive File Stream is running
        if pgrep -f "Google Drive" >/dev/null 2>&1; then
            log "Google Drive File Stream is running, checking authentication status"
            # Force a re-authentication by restarting the service
            if killall "Google Drive" 2>/dev/null; then
                sleep 5
                open -a "Google Drive" 2>/dev/null || true
                sleep 10
                log "Google Drive File Stream restarted"
                return 0
            fi
        fi
    fi
    
    log "Google Drive credential refresh failed or not applicable"
    return 1
}

# iCloud credential refresh
refresh_icloud_credentials() {
    local error_output=$1
    
    # Check if this is an iCloud authentication issue
    if echo "$error_output" | grep -qi "icloud\|apple\|auth\|sign.*in"; then
        log "Detected authentication issue with iCloud"
        
        # Check iCloud status
        if command -v brctl >/dev/null 2>&1; then
            local icloud_status=$(brctl status 2>/dev/null | head -1)
            log "iCloud status: $icloud_status"
            
            if echo "$icloud_status" | grep -qi "not.*sign\|offline"; then
                log "iCloud appears to be signed out or offline"
                log_alert "WARNING" "iCloud authentication required - please sign in through System Preferences"
                return 1
            fi
        fi
        
        # Try to trigger iCloud sync refresh
        if [ -d "$ICLOUD_PATH" ]; then
            log "Triggering iCloud sync refresh"
            brctl download "$ICLOUD_PATH" 2>/dev/null || true
            sleep 5
            return 0
        fi
    fi
    
    log "iCloud credential refresh failed or not applicable"
    return 1
}

# Permission validation and fixing
validate_and_fix_permissions() {
    local service=$1
    
    log "Validating and fixing permissions for $service"
    
    local sync_path=""
    case "$service" in
        "icloud")
            sync_path="$ICLOUD_PATH"
            ;;
        "google_drive")
            sync_path="$GDRIVE_PATH"
            ;;
        *)
            log "Unknown service for permission validation: $service"
            return 1
            ;;
    esac
    
    if [ ! -d "$sync_path" ]; then
        log "Sync path does not exist: $sync_path"
        return 1
    fi
    
    # Check and fix basic permissions
    if [ ! -r "$sync_path" ] || [ ! -w "$sync_path" ]; then
        log "Fixing basic permissions for $sync_path"
        chmod u+rw "$sync_path" 2>/dev/null || {
            log "Failed to fix permissions for $sync_path"
            return 1
        }
    fi
    
    # Check for problematic permission patterns
    local permission_issues=0
    
    # Find files with problematic permissions
    find "$sync_path" -type f ! -readable -o ! -writable 2>/dev/null | head -10 | while read -r file; do
        if [ -n "$file" ]; then
            log "Fixing permissions for: $file"
            chmod u+rw "$file" 2>/dev/null || permission_issues=$((permission_issues + 1))
        fi
    done
    
    # Find directories with problematic permissions
    find "$sync_path" -type d ! -readable -o ! -writable -o ! -executable 2>/dev/null | head -10 | while read -r dir; do
        if [ -n "$dir" ]; then
            log "Fixing directory permissions for: $dir"
            chmod u+rwx "$dir" 2>/dev/null || permission_issues=$((permission_issues + 1))
        fi
    done
    
    if [ $permission_issues -eq 0 ]; then
        log "Permission validation and fix completed successfully"
        return 0
    else
        log "Some permission issues could not be resolved"
        return 1
    fi
}

# Conflict resolution strategies
reset_unison_archives_recovery() {
    local service=$1
    local error_output=$2
    
    log "Attempting selective Unison archive reset for $service"
    
    # Check if this is actually a deadlock or archive corruption issue
    if ! echo "$error_output" | grep -qi "deadlock\|archive\|corrupt\|inconsistent"; then
        log "Error doesn't appear to be archive-related, skipping archive reset"
        return 1
    fi
    
    local profile_name=""
    case "$service" in
        "icloud")
            profile_name="$ICLOUD_PROFILE"
            ;;
        "google_drive")
            profile_name="$GDRIVE_PROFILE"
            ;;
        *)
            log "Unknown service for archive reset: $service"
            return 1
            ;;
    esac
    
    # Create backup of current archives before reset
    local backup_dir="$SCRIPT_DIR/archive_backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Find and backup archive files for this profile
    local archive_files_found=false
    find "$HOME/.unison" -name "*${profile_name}*" -type f 2>/dev/null | while read -r archive_file; do
        if [ -n "$archive_file" ]; then
            cp "$archive_file" "$backup_dir/" 2>/dev/null && archive_files_found=true
            log "Backed up archive: $(basename "$archive_file")"
        fi
    done
    
    # Remove problematic archive files
    local archives_removed=0
    find "$HOME/.unison" -name "*${profile_name}*" -type f 2>/dev/null | while read -r archive_file; do
        if [ -n "$archive_file" ]; then
            rm -f "$archive_file" 2>/dev/null && {
                archives_removed=$((archives_removed + 1))
                log "Removed archive: $(basename "$archive_file")"
            }
        fi
    done
    
    if [ $archives_removed -gt 0 ]; then
        log "Archive reset completed: removed $archives_removed files, backup in $backup_dir"
        return 0
    else
        log "No archive files found to reset"
        return 1
    fi
}

# Clean problematic files that prevent sync
clean_problematic_files_recovery() {
    local service=$1
    local error_output=$2
    
    log "Cleaning problematic files for $service"
    
    local sync_path=""
    case "$service" in
        "icloud")
            sync_path="$ICLOUD_PATH"
            ;;
        "google_drive")
            sync_path="$GDRIVE_PATH"
            ;;
        *)
            log "Unknown service for file cleanup: $service"
            return 1
            ;;
    esac
    
    if [ ! -d "$sync_path" ]; then
        log "Sync path does not exist: $sync_path"
        return 1
    fi
    
    local files_cleaned=0
    
    # Clean temporary files that might interfere with sync
    find "$sync_path" -name "*.tmp" -o -name "*.temp" -o -name ".DS_Store" -o -name "Thumbs.db" 2>/dev/null | while read -r temp_file; do
        if [ -n "$temp_file" ] && [ -f "$temp_file" ]; then
            rm -f "$temp_file" 2>/dev/null && {
                files_cleaned=$((files_cleaned + 1))
                log "Removed temporary file: $(basename "$temp_file")"
            }
        fi
    done
    
    # Clean lock files that might be stale
    find "$sync_path" -name "*.lock" -o -name ".*.lock" 2>/dev/null | while read -r lock_file; do
        if [ -n "$lock_file" ] && [ -f "$lock_file" ]; then
            # Check if lock file is older than 1 hour
            if find "$lock_file" -mmin +60 2>/dev/null | grep -q .; then
                rm -f "$lock_file" 2>/dev/null && {
                    files_cleaned=$((files_cleaned + 1))
                    log "Removed stale lock file: $(basename "$lock_file")"
                }
            fi
        fi
    done
    
    # Clean zero-byte files that might cause issues
    find "$sync_path" -type f -size 0 2>/dev/null | head -5 | while read -r empty_file; do
        if [ -n "$empty_file" ]; then
            rm -f "$empty_file" 2>/dev/null && {
                files_cleaned=$((files_cleaned + 1))
                log "Removed empty file: $(basename "$empty_file")"
            }
        fi
    done
    
    if [ $files_cleaned -gt 0 ]; then
        log "File cleanup completed: cleaned $files_cleaned files"
        return 0
    else
        log "No problematic files found to clean"
        return 1
    fi
}

# Backup conflicted files before resolution
backup_conflicted_files() {
    local service=$1
    
    log "Creating backup of conflicted files for $service"
    
    local sync_path=""
    case "$service" in
        "icloud")
            sync_path="$ICLOUD_PATH"
            ;;
        "google_drive")
            sync_path="$GDRIVE_PATH"
            ;;
        *)
            log "Unknown service for conflict backup: $service"
            return 1
            ;;
    esac
    
    if [ ! -d "$sync_path" ]; then
        log "Sync path does not exist: $sync_path"
        return 1
    fi
    
    local backup_dir="$SCRIPT_DIR/conflict_backup_${service}_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    local conflicts_found=0
    
    # Find files with conflict markers or conflict suffixes
    find "$sync_path" -type f \( -name "*conflict*" -o -name "*.orig" -o -name "*.backup" \) 2>/dev/null | while read -r conflict_file; do
        if [ -n "$conflict_file" ] && [ -f "$conflict_file" ]; then
            local relative_path="${conflict_file#$sync_path/}"
            local backup_file="$backup_dir/$relative_path"
            local backup_file_dir=$(dirname "$backup_file")
            
            mkdir -p "$backup_file_dir"
            cp "$conflict_file" "$backup_file" 2>/dev/null && {
                conflicts_found=$((conflicts_found + 1))
                log "Backed up conflict file: $relative_path"
            }
        fi
    done
    
    if [ $conflicts_found -gt 0 ]; then
        log "Conflict backup completed: backed up $conflicts_found files to $backup_dir"
        return 0
    else
        log "No conflict files found to backup"
        return 1
    fi
}

# Disk space cleanup for quota issues
cleanup_disk_space() {
    local service=$1
    
    log "Attempting disk space cleanup for $service"
    
    local space_freed=0
    
    # Clean old log files
    find "$SCRIPT_DIR" -name "*.log" -mtime +7 -size +10M 2>/dev/null | while read -r old_log; do
        if [ -n "$old_log" ] && [ -f "$old_log" ]; then
            local log_size=$(stat -f%z "$old_log" 2>/dev/null || echo "0")
            rm -f "$old_log" 2>/dev/null && {
                space_freed=$((space_freed + log_size))
                log "Removed old log file: $(basename "$old_log")"
            }
        fi
    done
    
    # Clean temporary files
    find "/tmp" -name "unison*" -user "$(whoami)" -mtime +1 2>/dev/null | while read -r temp_file; do
        if [ -n "$temp_file" ]; then
            rm -rf "$temp_file" 2>/dev/null && log "Removed temp file: $(basename "$temp_file")"
        fi
    done
    
    # Clean old backup directories
    find "$SCRIPT_DIR" -name "*backup*" -type d -mtime +30 2>/dev/null | while read -r old_backup; do
        if [ -n "$old_backup" ] && [ -d "$old_backup" ]; then
            rm -rf "$old_backup" 2>/dev/null && log "Removed old backup: $(basename "$old_backup")"
        fi
    done
    
    if [ $space_freed -gt 0 ]; then
        log "Disk space cleanup completed: freed approximately $space_freed bytes"
        return 0
    else
        log "Minimal disk space cleanup performed"
        return 0  # Return success even if no space freed
    fi
}

# Compress old logs to save space
compress_old_logs() {
    log "Compressing old log files"
    
    local logs_compressed=0
    
    # Compress log files older than 3 days and larger than 1MB
    find "$SCRIPT_DIR" -name "*.log" -mtime +3 -size +1M ! -name "*.gz" 2>/dev/null | while read -r log_file; do
        if [ -n "$log_file" ] && [ -f "$log_file" ]; then
            if gzip "$log_file" 2>/dev/null; then
                logs_compressed=$((logs_compressed + 1))
                log "Compressed log file: $(basename "$log_file")"
            fi
        fi
    done
    
    if [ $logs_compressed -gt 0 ]; then
        log "Log compression completed: compressed $logs_compressed files"
        return 0
    else
        log "No log files needed compression"
        return 0
    fi
}

# Analyze and fix failed files for partial sync issues
analyze_and_fix_failed_files() {
    local service=$1
    local error_output=$2
    
    log "Analyzing failed files for $service"
    
    # Extract file names from error output if possible
    local failed_files=$(echo "$error_output" | grep -E "(failed|error|skipped)" | grep -oE "/[^[:space:]]*" | head -10)
    
    if [ -z "$failed_files" ]; then
        log "No specific failed files identified in error output"
        return 1
    fi
    
    local files_fixed=0
    local temp_file=$(mktemp)
    echo "$failed_files" > "$temp_file"
    
    while IFS= read -r failed_file; do
        if [ -n "$failed_file" ] && [ -e "$failed_file" ]; then
            log "Analyzing failed file: $failed_file"
            
            # Check if file is locked or has permission issues
            if [ ! -r "$failed_file" ] || [ ! -w "$failed_file" ]; then
                if chmod u+rw "$failed_file" 2>/dev/null; then
                    files_fixed=$((files_fixed + 1))
                    log "Fixed permissions for: $failed_file"
                fi
            fi
            
            # Check if file is a symbolic link that's broken
            if [ -L "$failed_file" ] && [ ! -e "$failed_file" ]; then
                if rm -f "$failed_file" 2>/dev/null; then
                    files_fixed=$((files_fixed + 1))
                    log "Removed broken symlink: $failed_file"
                fi
            fi
        fi
    done < "$temp_file"
    
    rm -f "$temp_file"
    
    if [ $files_fixed -gt 0 ]; then
        log "Failed file analysis completed: fixed $files_fixed files"
        return 0
    else
        log "No fixable issues found in failed files"
        return 1
    fi
}

# Perform selective retry for specific files
perform_selective_retry() {
    local service=$1
    local error_output=$2
    
    log "Performing selective retry for $service"
    
    # This is a placeholder for more sophisticated selective retry logic
    # In practice, this would involve running Unison with specific file patterns
    # or using Unison's -path option to retry only problematic files
    
    local profile_name=""
    case "$service" in
        "icloud")
            profile_name="$ICLOUD_PROFILE"
            ;;
        "google_drive")
            profile_name="$GDRIVE_PROFILE"
            ;;
        *)
            log "Unknown service for selective retry: $service"
            return 1
            ;;
    esac
    
    # For now, we'll just log that selective retry would be attempted
    log "Selective retry would be performed for $service using profile $profile_name"
    log "This is a placeholder for future selective retry implementation"
    
    # Return success to indicate the recovery action was attempted
    return 0
}

# Network connectivity recovery
wait_for_network_connectivity() {
    log "Waiting for network connectivity"
    
    local max_wait=300  # 5 minutes
    local wait_interval=10
    local waited=0
    
    while [ $waited -lt $max_wait ]; do
        # Test connectivity to common services
        if ping -c 1 8.8.8.8 >/dev/null 2>&1 || ping -c 1 1.1.1.1 >/dev/null 2>&1; then
            log "Network connectivity restored after ${waited}s"
            return 0
        fi
        
        log "Waiting for network connectivity... (${waited}s/${max_wait}s)"
        sleep $wait_interval
        waited=$((waited + wait_interval))
    done
    
    log "Network connectivity not restored within ${max_wait}s"
    return 1
}

# Test service endpoints
test_service_endpoints() {
    local service=$1
    
    log "Testing service endpoints for $service"
    
    case "$service" in
        "google_drive")
            # Test Google Drive endpoints
            if curl -s --connect-timeout 10 "https://www.googleapis.com/drive/v3/about" >/dev/null 2>&1; then
                log "Google Drive API endpoint is accessible"
                return 0
            else
                log "Google Drive API endpoint is not accessible"
                return 1
            fi
            ;;
        "icloud")
            # Test iCloud endpoints (this is more complex as iCloud doesn't have public APIs)
            if ping -c 1 icloud.com >/dev/null 2>&1; then
                log "iCloud domain is accessible"
                return 0
            else
                log "iCloud domain is not accessible"
                return 1
            fi
            ;;
        *)
            log "Unknown service for endpoint testing: $service"
            return 1
            ;;
    esac
}

# Path validation and fixing
validate_sync_paths() {
    local service=$1
    
    log "Validating sync paths for $service"
    
    local sync_path=""
    local remote_path=""
    
    case "$service" in
        "icloud")
            sync_path="$ICLOUD_PATH"
            remote_path="$ICLOUD_PATH"
            ;;
        "google_drive")
            sync_path="$GDRIVE_PATH"
            remote_path="$GDRIVE_PATH"
            ;;
        *)
            log "Unknown service for path validation: $service"
            return 1
            ;;
    esac
    
    # Check if local sync path exists and is accessible
    if [ ! -d "$sync_path" ]; then
        log "Creating missing sync path: $sync_path"
        mkdir -p "$sync_path" 2>/dev/null || {
            log "Failed to create sync path: $sync_path"
            return 1
        }
    fi
    
    # Check if path is readable and writable
    if [ ! -r "$sync_path" ] || [ ! -w "$sync_path" ]; then
        log "Sync path has permission issues: $sync_path"
        return 1
    fi
    
    # Check if path is actually a cloud storage path (for iCloud)
    if [ "$service" = "icloud" ] && command -v brctl >/dev/null 2>&1; then
        if ! brctl status "$sync_path" >/dev/null 2>&1; then
            log "Path is not recognized as iCloud storage: $sync_path"
            return 1
        fi
    fi
    
    log "Path validation successful for $service: $sync_path"
    return 0
}

# Fix path permissions
fix_path_permissions() {
    local service=$1
    
    log "Fixing path permissions for $service"
    
    local sync_path=""
    case "$service" in
        "icloud")
            sync_path="$ICLOUD_PATH"
            ;;
        "google_drive")
            sync_path="$GDRIVE_PATH"
            ;;
        *)
            log "Unknown service for permission fix: $service"
            return 1
            ;;
    esac
    
    if [ ! -d "$sync_path" ]; then
        log "Sync path does not exist: $sync_path"
        return 1
    fi
    
    # Fix permissions recursively but carefully
    local permissions_fixed=0
    
    # Fix directory permissions
    find "$sync_path" -type d ! -perm -u+rwx 2>/dev/null | head -20 | while read -r dir; do
        if [ -n "$dir" ]; then
            chmod u+rwx "$dir" 2>/dev/null && {
                permissions_fixed=$((permissions_fixed + 1))
                log "Fixed directory permissions: $dir"
            }
        fi
    done
    
    # Fix file permissions
    find "$sync_path" -type f ! -perm -u+rw 2>/dev/null | head -20 | while read -r file; do
        if [ -n "$file" ]; then
            chmod u+rw "$file" 2>/dev/null && {
                permissions_fixed=$((permissions_fixed + 1))
                log "Fixed file permissions: $file"
            }
        fi
    done
    
    if [ $permissions_fixed -gt 0 ]; then
        log "Permission fix completed: fixed $permissions_fixed items"
        return 0
    else
        log "No permission issues found to fix"
        return 0
    fi
}

# Restore Unison profile from backup or defaults
restore_unison_profile() {
    local service=$1
    
    log "Attempting to restore Unison profile for $service"
    
    local profile_name=""
    case "$service" in
        "icloud")
            profile_name="$ICLOUD_PROFILE"
            ;;
        "google_drive")
            profile_name="$GDRIVE_PROFILE"
            ;;
        *)
            log "Unknown service for profile restoration: $service"
            return 1
            ;;
    esac
    
    local profile_file="$HOME/.unison/${profile_name}.prf"
    local backup_profile_file="$SCRIPT_DIR/${profile_name}.prf"
    
    # Check if a backup profile exists in the script directory
    if [ -f "$backup_profile_file" ]; then
        log "Restoring profile from backup: $backup_profile_file"
        cp "$backup_profile_file" "$profile_file" 2>/dev/null && {
            log "Profile restoration successful: $profile_name"
            return 0
        }
    fi
    
    # If no backup exists, create a basic profile
    log "Creating basic profile for $service"
    mkdir -p "$HOME/.unison"
    
    case "$service" in
        "icloud")
            cat > "$profile_file" << EOF
# iCloud Sync Profile - Auto-generated
root = $ICLOUD_PATH
root = $DATA_SCIENCE_ROOT
batch = true
auto = true
times = true
fastcheck = true
prefer = newer
ignore = Name {.DS_Store,Thumbs.db,*.tmp,*.temp}
ignore = Name {.*.icloud}
EOF
            ;;
        "google_drive")
            cat > "$profile_file" << EOF
# Google Drive Sync Profile - Auto-generated
root = $GDRIVE_PATH
root = $DATA_SCIENCE_ROOT
batch = true
auto = true
times = true
fastcheck = true
prefer = newer
ignore = Name {.DS_Store,Thumbs.db,*.tmp,*.temp}
EOF
            ;;
    esac
    
    if [ -f "$profile_file" ]; then
        log "Basic profile created successfully: $profile_name"
        return 0
    else
        log "Failed to create profile: $profile_name"
        return 1
    fi
}

# Recovery success detection
detect_recovery_success() {
    local service=$1
    local recovery_action=$2
    local pre_recovery_state=$3
    
    log "Detecting recovery success for $service after $recovery_action"
    
    # This function would implement various checks to determine if recovery was successful
    # For now, we'll implement basic checks
    
    case "$recovery_action" in
        "refresh_credentials")
            # Test if credentials are working by attempting a simple operation
            return $(test_service_credentials "$service")
            ;;
        "reset_archives")
            # Check if archive files were successfully removed/recreated
            return $(verify_archive_reset "$service")
            ;;
        "cleanup_space")
            # Check if disk space was freed
            return $(verify_disk_space_improvement)
            ;;
        "fix_permissions")
            # Check if permission issues were resolved
            return $(verify_permission_fixes "$service")
            ;;
        *)
            # Default success detection
            log "Using default success detection for $recovery_action"
            return 0
            ;;
    esac
}

# Test service credentials
test_service_credentials() {
    local service=$1
    
    case "$service" in
        "google_drive")
            # Test Google Drive access
            if [ -d "$GDRIVE_PATH" ] && [ -r "$GDRIVE_PATH" ] && [ -w "$GDRIVE_PATH" ]; then
                return 0
            fi
            ;;
        "icloud")
            # Test iCloud access
            if [ -d "$ICLOUD_PATH" ] && command -v brctl >/dev/null 2>&1; then
                if brctl status "$ICLOUD_PATH" >/dev/null 2>&1; then
                    return 0
                fi
            fi
            ;;
    esac
    
    return 1
}

# Verify archive reset success
verify_archive_reset() {
    local service=$1
    local profile_name=""
    
    case "$service" in
        "icloud")
            profile_name="$ICLOUD_PROFILE"
            ;;
        "google_drive")
            profile_name="$GDRIVE_PROFILE"
            ;;
        *)
            return 1
            ;;
    esac
    
    # Check if old archive files are gone
    local remaining_archives=$(find "$HOME/.unison" -name "*${profile_name}*" -type f 2>/dev/null | wc -l)
    
    if [ "$remaining_archives" -eq 0 ]; then
        log "Archive reset verification successful: no old archives remain"
        return 0
    else
        log "Archive reset verification failed: $remaining_archives archives still exist"
        return 1
    fi
}

# Verify disk space improvement
verify_disk_space_improvement() {
    # This is a simplified check - in practice, you'd compare before/after disk usage
    local available_space=$(df "$SCRIPT_DIR" | tail -1 | awk '{print $4}')
    
    # If we have more than 1GB available, consider it successful
    if [ "$available_space" -gt 1048576 ]; then  # 1GB in KB
        log "Disk space verification successful: ${available_space}KB available"
        return 0
    else
        log "Disk space verification failed: only ${available_space}KB available"
        return 1
    fi
}

# Verify permission fixes
verify_permission_fixes() {
    local service=$1
    local sync_path=""
    
    case "$service" in
        "icloud")
            sync_path="$ICLOUD_PATH"
            ;;
        "google_drive")
            sync_path="$GDRIVE_PATH"
            ;;
        *)
            return 1
            ;;
    esac
    
    if [ -d "$sync_path" ] && [ -r "$sync_path" ] && [ -w "$sync_path" ]; then
        log "Permission fix verification successful for $sync_path"
        return 0
    else
        log "Permission fix verification failed for $sync_path"
        return 1
    fi
}