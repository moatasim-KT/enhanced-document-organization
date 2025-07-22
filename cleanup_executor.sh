#!/bin/bash

# Cleanup Execution Script
# Orchestrates the cleanup process with validation and safety checks
# Part of the archive and cleanup management system

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCHIVE_MANAGER="${SCRIPT_DIR}/archive_manager.sh"
REPORTS_DIR="${SCRIPT_DIR}/.reports"
CLEANUP_PLANS_DIR="${REPORTS_DIR}/cleanup_plans"

# Ensure required directories exist
mkdir -p "$CLEANUP_PLANS_DIR"

# Source the archive manager functions
if [[ -f "$ARCHIVE_MANAGER" ]]; then
    source "$ARCHIVE_MANAGER"
else
    echo "ERROR: Archive manager not found at $ARCHIVE_MANAGER"
    exit 1
fi

# Enhanced logging for cleanup execution
CLEANUP_SESSION_LOG="${REPORTS_DIR}/cleanup_session_$(date +%Y%m%d_%H%M%S).log"

exec 1> >(tee -a "$CLEANUP_SESSION_LOG")
exec 2> >(tee -a "$CLEANUP_SESSION_LOG" >&2)

log_session() {
    local level="$1"
    local message="$2"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message"
}

# Pre-cleanup validation
pre_cleanup_validation() {
    log_session "INFO" "Starting pre-cleanup validation"
    
    local validation_passed=true
    
    # Check that consolidated modules exist and are functional
    if ! validate_functionality_preserved "full" "basic"; then
        log_session "ERROR" "Pre-cleanup validation failed - consolidated modules not functional"
        validation_passed=false
    fi
    
    # Check that test infrastructure is in place
    if [[ ! -d "tests" ]]; then
        log_session "WARNING" "Test directory not found - limited validation available"
    fi
    
    # Check for required tools
    local required_tools=("shasum" "stat" "find")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            log_session "ERROR" "Required tool not found: $tool"
            validation_passed=false
        fi
    done
    
    if [[ "$validation_passed" == "true" ]]; then
        log_session "INFO" "Pre-cleanup validation passed"
        return 0
    else
        log_session "ERROR" "Pre-cleanup validation failed"
        return 1
    fi
}

# Generate cleanup plan based on analysis
generate_cleanup_plan() {
    local plan_name="$1"
    local plan_file="${CLEANUP_PLANS_DIR}/${plan_name}_$(date +%Y%m%d_%H%M%S).txt"
    
    log_session "INFO" "Generating cleanup plan: $plan_file"
    
    cat > "$plan_file" << 'EOF'
# Cleanup Plan
# Format: operation:file_path:reason
# Operations: archive, delete
# This is a template - customize based on actual analysis

# Example entries (commented out):
# archive:old_script.sh:Replaced by consolidated module
# delete:temp_file.tmp:Temporary file no longer needed
# archive:legacy_config.conf:Configuration superseded by new format

EOF
    
    # Add detected redundant files if analysis exists
    if [[ -f "${REPORTS_DIR}/redundant_files_temp.txt" ]]; then
        log_session "INFO" "Adding files from redundancy analysis"
        while IFS= read -r file; do
            [[ -z "$file" ]] && continue
            echo "archive:${file}:Identified as redundant by analysis" >> "$plan_file"
        done < "${REPORTS_DIR}/redundant_files_temp.txt"
    fi
    
    # Add files from cleanup reports
    local cleanup_reports
    cleanup_reports=$(find "$REPORTS_DIR" -name "cleanup_report_*.md" -type f | head -1)
    if [[ -n "$cleanup_reports" && -f "$cleanup_reports" ]]; then
        log_session "INFO" "Processing cleanup report: $cleanup_reports"
        # Extract file paths from markdown tables (simplified parsing)
        grep -E "^\|.*\.sh\|" "$cleanup_reports" | cut -d'|' -f2 | tr -d ' ' | while read -r file; do
            [[ -n "$file" && "$file" != "File" ]] && echo "archive:${file}:From cleanup report analysis" >> "$plan_file"
        done
    fi
    
    log_session "INFO" "Cleanup plan generated: $plan_file"
    echo "$plan_file"
}

# Post-cleanup validation
post_cleanup_validation() {
    log_session "INFO" "Starting post-cleanup validation"
    
    local validation_passed=true
    
    # Run comprehensive functionality validation
    if ! validate_functionality_preserved "full" "all"; then
        log_session "ERROR" "Post-cleanup validation failed - functionality compromised"
        validation_passed=false
    fi
    
    # Check that essential files still exist
    local essential_files=(
        "organize/organize_module.sh"
        "sync/sync_module.sh"
        "config.env"
        "README.md"
    )
    
    for file in "${essential_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_session "ERROR" "Essential file missing after cleanup: $file"
            validation_passed=false
        fi
    done
    
    # Run tests if available
    if [[ -x "tests/test_runner.sh" ]]; then
        log_session "INFO" "Running test suite for post-cleanup validation"
        if bash "tests/test_runner.sh" unit; then
            log_session "INFO" "Test suite passed"
        else
            log_session "WARNING" "Some tests failed - review required"
        fi
    fi
    
    if [[ "$validation_passed" == "true" ]]; then
        log_session "INFO" "Post-cleanup validation passed"
        return 0
    else
        log_session "ERROR" "Post-cleanup validation failed"
        return 1
    fi
}

# Interactive cleanup mode
interactive_cleanup() {
    local plan_file="$1"
    
    log_session "INFO" "Starting interactive cleanup mode"
    
    if [[ ! -f "$plan_file" ]]; then
        log_session "ERROR" "Cleanup plan file not found: $plan_file"
        return 1
    fi
    
    echo "=== Interactive Cleanup Mode ==="
    echo "Plan file: $plan_file"
    echo
    
    # Show plan summary
    local total_files
    total_files=$(grep -v '^#' "$plan_file" | grep -v '^$' | wc -l)
    echo "Total files to process: $total_files"
    echo
    
    # Ask for confirmation
    read -p "Do you want to proceed with cleanup? (y/N): " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_session "INFO" "Cleanup cancelled by user"
        return 0
    fi
    
    # Offer dry run first
    read -p "Do you want to run a dry run first? (Y/n): " -r
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        log_session "INFO" "Running dry run"
        execute_cleanup "$plan_file" "true"
        echo
        read -p "Dry run completed. Proceed with actual cleanup? (y/N): " -r
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_session "INFO" "Cleanup cancelled after dry run"
            return 0
        fi
    fi
    
    # Execute cleanup
    log_session "INFO" "Executing cleanup"
    if execute_cleanup "$plan_file" "false"; then
        log_session "INFO" "Cleanup completed successfully"
        
        # Run post-cleanup validation
        if post_cleanup_validation; then
            log_session "INFO" "All validations passed - cleanup successful"
        else
            log_session "WARNING" "Post-cleanup validation issues detected"
            echo "WARNING: Validation issues detected. Consider running rollback if needed."
        fi
    else
        log_session "ERROR" "Cleanup execution failed"
        return 1
    fi
}

# Automated cleanup mode
automated_cleanup() {
    local plan_file="$1"
    local skip_validation="${2:-false}"
    
    log_session "INFO" "Starting automated cleanup mode"
    
    # Pre-cleanup validation
    if [[ "$skip_validation" != "true" ]]; then
        if ! pre_cleanup_validation; then
            log_session "ERROR" "Pre-cleanup validation failed - aborting"
            return 1
        fi
    fi
    
    # Execute cleanup
    log_session "INFO" "Executing automated cleanup"
    if execute_cleanup "$plan_file" "false"; then
        log_session "INFO" "Cleanup execution completed"
        
        # Post-cleanup validation
        if [[ "$skip_validation" != "true" ]]; then
            if post_cleanup_validation; then
                log_session "INFO" "Automated cleanup completed successfully"
            else
                log_session "ERROR" "Post-cleanup validation failed"
                return 1
            fi
        fi
    else
        log_session "ERROR" "Cleanup execution failed"
        return 1
    fi
}

# Emergency rollback function
emergency_rollback() {
    log_session "WARNING" "Initiating emergency rollback"
    
    # Find the most recent rollback point
    local latest_rollback
    latest_rollback=$(find "${BACKUP_DIR:-./cleanup_backups}" -maxdepth 1 -type d -name "rollback_*" | sort | tail -1)
    
    if [[ -n "$latest_rollback" && -d "$latest_rollback" ]]; then
        log_session "INFO" "Found rollback point: $latest_rollback"
        read -p "Execute rollback from $latest_rollback? (y/N): " -r
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            execute_rollback "$latest_rollback"
        fi
    else
        log_session "ERROR" "No rollback points found"
        return 1
    fi
}

# Show cleanup status
show_cleanup_status() {
    echo "=== Cleanup System Status ==="
    echo
    
    # Show recent cleanup sessions
    echo "Recent cleanup sessions:"
    find "$REPORTS_DIR" -name "cleanup_session_*.log" -type f | sort | tail -5 | while read -r log_file; do
        echo "  $(basename "$log_file")"
    done
    echo
    
    # Show available cleanup plans
    echo "Available cleanup plans:"
    find "$CLEANUP_PLANS_DIR" -name "*.txt" -type f | sort | while read -r plan_file; do
        echo "  $(basename "$plan_file")"
    done
    echo
    
    # Show archive status
    echo "Archive directories:"
    find "${ARCHIVE_BASE_DIR:-./archive_old_files}" -maxdepth 1 -type d -name "*_[0-9]*" | sort | tail -5 | while read -r archive_dir; do
        local file_count
        file_count=$(find "$archive_dir" -type f | wc -l)
        echo "  $(basename "$archive_dir") ($file_count files)"
    done
    echo
    
    # Show rollback points
    echo "Available rollback points:"
    find "${BACKUP_DIR:-./cleanup_backups}" -maxdepth 1 -type d -name "rollback_*" | sort | tail -5 | while read -r rollback_dir; do
        echo "  $(basename "$rollback_dir")"
    done
}

# Help function
show_help() {
    cat << EOF
Cleanup Execution Script

Usage: $0 <command> [options]

Commands:
    interactive <plan_file>              Run interactive cleanup
    automated <plan_file> [--skip-validation]  Run automated cleanup
    generate-plan <plan_name>            Generate cleanup plan template
    validate-pre                         Run pre-cleanup validation
    validate-post                        Run post-cleanup validation
    rollback                            Emergency rollback to latest point
    status                              Show cleanup system status
    help                                Show this help

Examples:
    $0 generate-plan weekly_cleanup
    $0 interactive cleanup_plans/weekly_cleanup_20250722_123456.txt
    $0 automated cleanup_plans/weekly_cleanup_20250722_123456.txt
    $0 validate-pre
    $0 rollback

EOF
}

# Main execution
main() {
    local command="${1:-help}"
    
    case "$command" in
        "interactive")
            if [[ $# -lt 2 ]]; then
                echo "Usage: $0 interactive <plan_file>"
                exit 1
            fi
            interactive_cleanup "$2"
            ;;
        "automated")
            if [[ $# -lt 2 ]]; then
                echo "Usage: $0 automated <plan_file> [--skip-validation]"
                exit 1
            fi
            skip_validation="false"
            [[ "${3:-}" == "--skip-validation" ]] && skip_validation="true"
            automated_cleanup "$2" "$skip_validation"
            ;;
        "generate-plan")
            if [[ $# -lt 2 ]]; then
                echo "Usage: $0 generate-plan <plan_name>"
                exit 1
            fi
            plan_file=$(generate_cleanup_plan "$2")
            echo "Cleanup plan generated: $plan_file"
            echo "Edit the plan file to customize cleanup operations before execution."
            ;;
        "validate-pre")
            pre_cleanup_validation
            ;;
        "validate-post")
            post_cleanup_validation
            ;;
        "rollback")
            emergency_rollback
            ;;
        "status")
            show_cleanup_status
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