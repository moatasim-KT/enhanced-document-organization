#!/bin/bash

# Archive and Cleanup Management System
# Provides safe archiving, validation, and rollback capabilities for file cleanup operations
# Part of the testing-documentation-cleanup feature

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCHIVE_BASE_DIR="${SCRIPT_DIR}/archive_old_files"
CLEANUP_LOG_DIR="${SCRIPT_DIR}/.reports"
BACKUP_DIR="${SCRIPT_DIR}/.cleanup_backups"
VALIDATION_LOG="${CLEANUP_LOG_DIR}/validation_$(date +%Y%m%d_%H%M%S).log"
CLEANUP_AUDIT_LOG="${CLEANUP_LOG_DIR}/cleanup_audit_$(date +%Y%m%d_%H%M%S).log"

# Ensure required directories exist
mkdir -p "$ARCHIVE_BASE_DIR" "$CLEANUP_LOG_DIR" "$BACKUP_DIR"

# Logging functions
log_info() {
    local message="$1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $message" | tee -a "$CLEANUP_AUDIT_LOG"
}

log_warning() {
    local message="$1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $message" | tee -a "$CLEANUP_AUDIT_LOG"
}

log_error() {
    local message="$1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $message" | tee -a "$CLEANUP_AUDIT_LOG" >&2
}

# Archive system functions
create_archive_structure() {
    local archive_name="$1"
    local archive_dir="${ARCHIVE_BASE_DIR}/${archive_name}_$(date +%Y%m%d_%H%M%S)"
    
    mkdir -p "$archive_dir"
    echo "$archive_dir"
}

archive_file() {
    local source_file="$1"
    local archive_dir="$2"
    local preserve_structure="${3:-true}"
    
    if [[ ! -f "$source_file" ]]; then
        log_error "Source file does not exist: $source_file"
        return 1
    fi
    
    local dest_file
    if [[ "$preserve_structure" == "true" ]]; then
        # Preserve directory structure
        local relative_path="${source_file#./}"
        dest_file="${archive_dir}/${relative_path}"
        mkdir -p "$(dirname "$dest_file")"
    else
        # Flat structure
        dest_file="${archive_dir}/$(basename "$source_file")"
    fi
    
    # Copy file with metadata preservation
    if cp -p "$source_file" "$dest_file"; then
        log_info "Archived: $source_file -> $dest_file"
        
        # Create metadata file
        cat > "${dest_file}.metadata" << EOF
original_path: $source_file
archive_date: $(date -Iseconds)
file_size: $(stat -f%z "$source_file" 2>/dev/null || stat -c%s "$source_file" 2>/dev/null || echo "unknown")
file_hash: $(shasum -a 256 "$source_file" | cut -d' ' -f1)
archived_by: $(whoami)
EOF
        return 0
    else
        log_error "Failed to archive: $source_file"
        return 1
    fi
}

# Validation system functions
validate_functionality_preserved() {
    local validation_type="$1"
    local test_scope="${2:-all}"
    
    log_info "Starting functionality validation: $validation_type (scope: $test_scope)"
    
    case "$validation_type" in
        "organize")
            validate_organize_functionality "$test_scope"
            ;;
        "sync")
            validate_sync_functionality "$test_scope"
            ;;
        "full")
            validate_organize_functionality "$test_scope" && validate_sync_functionality "$test_scope"
            ;;
        *)
            log_error "Unknown validation type: $validation_type"
            return 1
            ;;
    esac
}

validate_organize_functionality() {
    local test_scope="$1"
    local validation_passed=true
    
    log_info "Validating organize module functionality"
    
    # Check if organize module exists and is executable
    if [[ ! -x "organize/organize_module.sh" ]]; then
        log_error "Organize module not found or not executable"
        echo "FAIL: organize_module_exists" >> "$VALIDATION_LOG"
        validation_passed=false
    else
        echo "PASS: organize_module_exists" >> "$VALIDATION_LOG"
    fi
    
    # Test basic organize functions
    if [[ -x "organize/organize_module.sh" ]]; then
        # Source the module to test functions
        if source "organize/organize_module.sh" 2>/dev/null; then
            echo "PASS: organize_module_loadable" >> "$VALIDATION_LOG"
            
            # Test key functions exist
            local required_functions=("categorize_file" "create_folder_structure" "calculate_file_hash")
            for func in "${required_functions[@]}"; do
                if declare -f "$func" > /dev/null; then
                    echo "PASS: function_${func}_exists" >> "$VALIDATION_LOG"
                else
                    echo "FAIL: function_${func}_exists" >> "$VALIDATION_LOG"
                    validation_passed=false
                fi
            done
        else
            echo "FAIL: organize_module_loadable" >> "$VALIDATION_LOG"
            validation_passed=false
        fi
    fi
    
    # Run organize tests if available
    if [[ -x "tests/unit/test_organize_functions.sh" && "$test_scope" != "basic" ]]; then
        log_info "Running organize unit tests"
        if bash "tests/unit/test_organize_functions.sh" >> "$VALIDATION_LOG" 2>&1; then
            echo "PASS: organize_unit_tests" >> "$VALIDATION_LOG"
        else
            echo "FAIL: organize_unit_tests" >> "$VALIDATION_LOG"
            validation_passed=false
        fi
    fi
    
    if [[ "$validation_passed" == "true" ]]; then
        log_info "Organize functionality validation passed"
        return 0
    else
        log_error "Organize functionality validation failed"
        return 1
    fi
}

validate_sync_functionality() {
    local test_scope="$1"
    local validation_passed=true
    
    log_info "Validating sync module functionality"
    
    # Check if sync module exists and is executable
    if [[ ! -x "sync/sync_module.sh" ]]; then
        log_error "Sync module not found or not executable"
        echo "FAIL: sync_module_exists" >> "$VALIDATION_LOG"
        validation_passed=false
    else
        echo "PASS: sync_module_exists" >> "$VALIDATION_LOG"
    fi
    
    # Test basic sync functions
    if [[ -x "sync/sync_module.sh" ]]; then
        # Source the module to test functions
        if source "sync/sync_module.sh" 2>/dev/null; then
            echo "PASS: sync_module_loadable" >> "$VALIDATION_LOG"
            
            # Test key functions exist
            local required_functions=("check_circuit_breaker" "sync_with_retry" "update_sync_metrics")
            for func in "${required_functions[@]}"; do
                if declare -f "$func" > /dev/null; then
                    echo "PASS: function_${func}_exists" >> "$VALIDATION_LOG"
                else
                    echo "FAIL: function_${func}_exists" >> "$VALIDATION_LOG"
                    validation_passed=false
                fi
            done
        else
            echo "FAIL: sync_module_loadable" >> "$VALIDATION_LOG"
            validation_passed=false
        fi
    fi
    
    # Run sync tests if available
    if [[ -x "tests/unit/test_sync_functions.sh" && "$test_scope" != "basic" ]]; then
        log_info "Running sync unit tests"
        if bash "tests/unit/test_sync_functions.sh" >> "$VALIDATION_LOG" 2>&1; then
            echo "PASS: sync_unit_tests" >> "$VALIDATION_LOG"
        else
            echo "FAIL: sync_unit_tests" >> "$VALIDATION_LOG"
            validation_passed=false
        fi
    fi
    
    if [[ "$validation_passed" == "true" ]]; then
        log_info "Sync functionality validation passed"
        return 0
    else
        log_error "Sync functionality validation failed"
        return 1
    fi
}

# Rollback system functions
create_rollback_point() {
    local rollback_name="$1"
    local rollback_dir="${BACKUP_DIR}/rollback_${rollback_name}_$(date +%Y%m%d_%H%M%S)"
    
    mkdir -p "$rollback_dir"
    
    # Create rollback manifest
    cat > "${rollback_dir}/rollback_manifest.json" << EOF
{
    "rollback_name": "$rollback_name",
    "created_date": "$(date -Iseconds)",
    "created_by": "$(whoami)",
    "files": []
}
EOF
    
    echo "$rollback_dir"
}

add_to_rollback() {
    local rollback_dir="$1"
    local file_path="$2"
    local operation="$3"  # "archive", "delete", "modify"
    
    if [[ ! -d "$rollback_dir" ]]; then
        log_error "Rollback directory does not exist: $rollback_dir"
        return 1
    fi
    
    local rollback_file="${rollback_dir}/$(basename "$file_path")_$(date +%s)"
    
    case "$operation" in
        "archive"|"delete")
            if [[ -f "$file_path" ]]; then
                cp -p "$file_path" "$rollback_file"
                log_info "Added to rollback: $file_path"
            fi
            ;;
        "modify")
            if [[ -f "$file_path" ]]; then
                cp -p "$file_path" "$rollback_file"
                log_info "Added to rollback (pre-modification): $file_path"
            fi
            ;;
    esac
    
    # Update rollback manifest
    local manifest="${rollback_dir}/rollback_manifest.json"
    local temp_manifest="${manifest}.tmp"
    
    # Add file entry to manifest (simplified JSON manipulation)
    sed '$d' "$manifest" > "$temp_manifest"
    cat >> "$temp_manifest" << EOF
        {
            "original_path": "$file_path",
            "rollback_file": "$rollback_file",
            "operation": "$operation",
            "timestamp": "$(date -Iseconds)"
        }
    ]
}
EOF
    mv "$temp_manifest" "$manifest"
}

execute_rollback() {
    local rollback_dir="$1"
    local manifest="${rollback_dir}/rollback_manifest.json"
    
    if [[ ! -f "$manifest" ]]; then
        log_error "Rollback manifest not found: $manifest"
        return 1
    fi
    
    log_info "Executing rollback from: $rollback_dir"
    
    # Parse manifest and restore files (simplified approach)
    while IFS= read -r line; do
        if [[ "$line" =~ \"original_path\":\ \"([^\"]+)\" ]]; then
            local original_path="${BASH_REMATCH[1]}"
            local rollback_file=$(echo "$line" | sed -n 's/.*"rollback_file": "\([^"]*\)".*/\1/p')
            
            if [[ -f "$rollback_file" ]]; then
                mkdir -p "$(dirname "$original_path")"
                if cp -p "$rollback_file" "$original_path"; then
                    log_info "Restored: $original_path"
                else
                    log_error "Failed to restore: $original_path"
                fi
            fi
        fi
    done < "$manifest"
    
    log_info "Rollback completed"
}

# Main cleanup execution functions
execute_cleanup() {
    local cleanup_plan="$1"
    local dry_run="${2:-false}"
    
    if [[ ! -f "$cleanup_plan" ]]; then
        log_error "Cleanup plan file not found: $cleanup_plan"
        return 1
    fi
    
    log_info "Starting cleanup execution (dry_run: $dry_run)"
    
    # Create rollback point
    local rollback_dir
    rollback_dir=$(create_rollback_point "cleanup_$(basename "$cleanup_plan" .txt)")
    
    # Create archive for this cleanup session
    local archive_dir
    archive_dir=$(create_archive_structure "cleanup_$(date +%Y%m%d_%H%M%S)")
    
    local files_processed=0
    local files_archived=0
    local files_failed=0
    
    # Process cleanup plan
    while IFS= read -r line; do
        # Skip comments and empty lines
        [[ "$line" =~ ^#.*$ ]] || [[ -z "$line" ]] && continue
        
        # Parse line format: operation:file_path:reason
        IFS=':' read -r operation file_path reason <<< "$line"
        
        case "$operation" in
            "archive")
                files_processed=$((files_processed + 1))
                
                if [[ "$dry_run" == "true" ]]; then
                    log_info "[DRY RUN] Would archive: $file_path ($reason)"
                else
                    # Add to rollback before archiving
                    add_to_rollback "$rollback_dir" "$file_path" "archive"
                    
                    if archive_file "$file_path" "$archive_dir"; then
                        rm -f "$file_path"
                        files_archived=$((files_archived + 1))
                        log_info "Archived and removed: $file_path"
                    else
                        files_failed=$((files_failed + 1))
                        log_error "Failed to archive: $file_path"
                    fi
                fi
                ;;
            "delete")
                files_processed=$((files_processed + 1))
                
                if [[ "$dry_run" == "true" ]]; then
                    log_info "[DRY RUN] Would delete: $file_path ($reason)"
                else
                    # Add to rollback before deleting
                    add_to_rollback "$rollback_dir" "$file_path" "delete"
                    
                    if rm -f "$file_path"; then
                        files_archived=$((files_archived + 1))
                        log_info "Deleted: $file_path"
                    else
                        files_failed=$((files_failed + 1))
                        log_error "Failed to delete: $file_path"
                    fi
                fi
                ;;
            *)
                log_warning "Unknown operation: $operation for file: $file_path"
                ;;
        esac
    done < "$cleanup_plan"
    
    # Generate cleanup summary
    cat >> "$CLEANUP_AUDIT_LOG" << EOF

=== CLEANUP SUMMARY ===
Files processed: $files_processed
Files archived/deleted: $files_archived
Files failed: $files_failed
Archive directory: $archive_dir
Rollback directory: $rollback_dir
Dry run: $dry_run
Completed: $(date -Iseconds)

EOF
    
    log_info "Cleanup execution completed. Processed: $files_processed, Success: $files_archived, Failed: $files_failed"
    
    if [[ "$dry_run" == "false" && "$files_failed" -eq 0 ]]; then
        return 0
    elif [[ "$files_failed" -gt 0 ]]; then
        return 1
    else
        return 0
    fi
}

# Utility functions
list_archives() {
    log_info "Available archives:"
    find "$ARCHIVE_BASE_DIR" -maxdepth 1 -type d -name "*_[0-9]*" | sort
}

list_rollback_points() {
    log_info "Available rollback points:"
    find "$BACKUP_DIR" -maxdepth 1 -type d -name "rollback_*" | sort
}

show_help() {
    cat << EOF
Archive and Cleanup Management System

Usage: $0 <command> [options]

Commands:
    archive <source_file> <archive_name>     Archive a single file
    validate <type> [scope]                  Validate functionality (organize|sync|full)
    cleanup <plan_file> [--dry-run]          Execute cleanup plan
    rollback <rollback_dir>                  Execute rollback
    list-archives                            List available archives
    list-rollbacks                          List available rollback points
    help                                    Show this help

Examples:
    $0 archive old_script.sh manual_cleanup
    $0 validate full basic
    $0 cleanup cleanup_plan.txt --dry-run
    $0 rollback .cleanup_backups/rollback_cleanup_20250722_123456

EOF
}

# Main execution
main() {
    local command="${1:-help}"
    
    case "$command" in
        "archive")
            if [[ $# -lt 3 ]]; then
                echo "Usage: $0 archive <source_file> <archive_name>"
                exit 1
            fi
            archive_dir=$(create_archive_structure "$3")
            archive_file "$2" "$archive_dir"
            ;;
        "validate")
            if [[ $# -lt 2 ]]; then
                echo "Usage: $0 validate <type> [scope]"
                exit 1
            fi
            validate_functionality_preserved "$2" "${3:-all}"
            ;;
        "cleanup")
            if [[ $# -lt 2 ]]; then
                echo "Usage: $0 cleanup <plan_file> [--dry-run]"
                exit 1
            fi
            dry_run="false"
            [[ "${3:-}" == "--dry-run" ]] && dry_run="true"
            execute_cleanup "$2" "$dry_run"
            ;;
        "rollback")
            if [[ $# -lt 2 ]]; then
                echo "Usage: $0 rollback <rollback_dir>"
                exit 1
            fi
            execute_rollback "$2"
            ;;
        "list-archives")
            list_archives
            ;;
        "list-rollbacks")
            list_rollback_points
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# Only run main if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi