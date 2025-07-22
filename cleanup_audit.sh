#!/bin/bash

# Cleanup Audit and Logging System
# Provides comprehensive audit trail and logging for cleanup operations
# Part of the archive and cleanup management system

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUDIT_DIR="${SCRIPT_DIR}/.reports/audit"
LOGS_DIR="${SCRIPT_DIR}/.reports/logs"

# Ensure audit directories exist
mkdir -p "$AUDIT_DIR" "$LOGS_DIR"

# Audit configuration
AUDIT_LOG="${AUDIT_DIR}/cleanup_audit_$(date +%Y%m%d).log"
OPERATION_LOG="${LOGS_DIR}/operations_$(date +%Y%m%d).log"
METRICS_LOG="${LOGS_DIR}/metrics_$(date +%Y%m%d).json"

# Initialize audit session
init_audit_session() {
    local session_id="$1"
    local operation_type="$2"
    local user="${3:-$(whoami)}"
    
    cat >> "$AUDIT_LOG" << EOF

=== AUDIT SESSION START ===
Session ID: $session_id
Operation Type: $operation_type
User: $user
Start Time: $(date -Iseconds)
Host: $(hostname)
Working Directory: $(pwd)
Script: ${BASH_SOURCE[1]:-unknown}
PID: $$

EOF
    
    # Initialize metrics for this session
    cat > "${AUDIT_DIR}/session_${session_id}_metrics.json" << EOF
{
    "session_id": "$session_id",
    "operation_type": "$operation_type",
    "user": "$user",
    "start_time": "$(date -Iseconds)",
    "host": "$(hostname)",
    "files_processed": 0,
    "files_archived": 0,
    "files_deleted": 0,
    "files_failed": 0,
    "bytes_processed": 0,
    "operations": []
}
EOF
    
    echo "$session_id"
}

# Log individual operations
log_operation() {
    local session_id="$1"
    local operation="$2"
    local file_path="$3"
    local status="$4"
    local details="${5:-}"
    
    local timestamp
    timestamp=$(date -Iseconds)
    
    # Log to main audit log
    cat >> "$AUDIT_LOG" << EOF
[$timestamp] SESSION:$session_id OP:$operation FILE:$file_path STATUS:$status DETAILS:$details
EOF
    
    # Log to operation log
    cat >> "$OPERATION_LOG" << EOF
$timestamp|$session_id|$operation|$file_path|$status|$details
EOF
    
    # Update session metrics
    local metrics_file="${AUDIT_DIR}/session_${session_id}_metrics.json"
    if [[ -f "$metrics_file" ]]; then
        update_session_metrics "$session_id" "$operation" "$file_path" "$status"
    fi
}

# Update session metrics
update_session_metrics() {
    local session_id="$1"
    local operation="$2"
    local file_path="$3"
    local status="$4"
    
    local metrics_file="${AUDIT_DIR}/session_${session_id}_metrics.json"
    local temp_file="${metrics_file}.tmp"
    
    # Get file size if file exists
    local file_size=0
    if [[ -f "$file_path" ]]; then
        file_size=$(stat -f%z "$file_path" 2>/dev/null || stat -c%s "$file_path" 2>/dev/null || echo 0)
    fi
    
    # Update counters based on operation and status
    local processed_increment=1
    local archived_increment=0
    local deleted_increment=0
    local failed_increment=0
    
    case "$operation:$status" in
        "archive:success")
            archived_increment=1
            ;;
        "delete:success")
            deleted_increment=1
            ;;
        "*:failed"|"*:error")
            failed_increment=1
            ;;
    esac
    
    # Simple JSON update (using sed for basic manipulation)
    sed -e "s/\"files_processed\": [0-9]*/\"files_processed\": $(($(grep -o '"files_processed": [0-9]*' "$metrics_file" | cut -d: -f2 | tr -d ' ') + processed_increment))/" \
        -e "s/\"files_archived\": [0-9]*/\"files_archived\": $(($(grep -o '"files_archived": [0-9]*' "$metrics_file" | cut -d: -f2 | tr -d ' ') + archived_increment))/" \
        -e "s/\"files_deleted\": [0-9]*/\"files_deleted\": $(($(grep -o '"files_deleted": [0-9]*' "$metrics_file" | cut -d: -f2 | tr -d ' ') + deleted_increment))/" \
        -e "s/\"files_failed\": [0-9]*/\"files_failed\": $(($(grep -o '"files_failed": [0-9]*' "$metrics_file" | cut -d: -f2 | tr -d ' ') + failed_increment))/" \
        -e "s/\"bytes_processed\": [0-9]*/\"bytes_processed\": $(($(grep -o '"bytes_processed": [0-9]*' "$metrics_file" | cut -d: -f2 | tr -d ' ') + file_size))/" \
        "$metrics_file" > "$temp_file"
    
    mv "$temp_file" "$metrics_file"
    
    # Add operation to operations array (simplified)
    local operation_entry="{\"timestamp\":\"$(date -Iseconds)\",\"operation\":\"$operation\",\"file\":\"$file_path\",\"status\":\"$status\",\"size\":$file_size}"
    sed -i.bak 's/"operations": \[\]/"operations": ['"$operation_entry"']/' "$metrics_file"
    rm -f "${metrics_file}.bak"
}

# Finalize audit session
finalize_audit_session() {
    local session_id="$1"
    local final_status="${2:-completed}"
    
    local end_time
    end_time=$(date -Iseconds)
    
    cat >> "$AUDIT_LOG" << EOF

=== AUDIT SESSION END ===
Session ID: $session_id
Final Status: $final_status
End Time: $end_time

EOF
    
    # Update session metrics with end time
    local metrics_file="${AUDIT_DIR}/session_${session_id}_metrics.json"
    if [[ -f "$metrics_file" ]]; then
        sed -i.bak 's/}$/,"end_time":"'"$end_time"'","final_status":"'"$final_status"'"}/' "$metrics_file"
        rm -f "${metrics_file}.bak"
        
        # Add to daily metrics summary
        update_daily_metrics "$metrics_file"
    fi
}

# Update daily metrics summary
update_daily_metrics() {
    local session_metrics_file="$1"
    local daily_metrics="${AUDIT_DIR}/daily_metrics_$(date +%Y%m%d).json"
    
    # Initialize daily metrics if it doesn't exist
    if [[ ! -f "$daily_metrics" ]]; then
        cat > "$daily_metrics" << EOF
{
    "date": "$(date +%Y-%m-%d)",
    "total_sessions": 0,
    "total_files_processed": 0,
    "total_files_archived": 0,
    "total_files_deleted": 0,
    "total_files_failed": 0,
    "total_bytes_processed": 0,
    "sessions": []
}
EOF
    fi
    
    # Extract metrics from session file
    local session_processed
    local session_archived
    local session_deleted
    local session_failed
    local session_bytes
    
    session_processed=$(grep -o '"files_processed": [0-9]*' "$session_metrics_file" | cut -d: -f2 | tr -d ' ')
    session_archived=$(grep -o '"files_archived": [0-9]*' "$session_metrics_file" | cut -d: -f2 | tr -d ' ')
    session_deleted=$(grep -o '"files_deleted": [0-9]*' "$session_metrics_file" | cut -d: -f2 | tr -d ' ')
    session_failed=$(grep -o '"files_failed": [0-9]*' "$session_metrics_file" | cut -d: -f2 | tr -d ' ')
    session_bytes=$(grep -o '"bytes_processed": [0-9]*' "$session_metrics_file" | cut -d: -f2 | tr -d ' ')
    
    # Update daily totals
    local temp_file="${daily_metrics}.tmp"
    sed -e "s/\"total_sessions\": [0-9]*/\"total_sessions\": $(($(grep -o '"total_sessions": [0-9]*' "$daily_metrics" | cut -d: -f2 | tr -d ' ') + 1))/" \
        -e "s/\"total_files_processed\": [0-9]*/\"total_files_processed\": $(($(grep -o '"total_files_processed": [0-9]*' "$daily_metrics" | cut -d: -f2 | tr -d ' ') + session_processed))/" \
        -e "s/\"total_files_archived\": [0-9]*/\"total_files_archived\": $(($(grep -o '"total_files_archived": [0-9]*' "$daily_metrics" | cut -d: -f2 | tr -d ' ') + session_archived))/" \
        -e "s/\"total_files_deleted\": [0-9]*/\"total_files_deleted\": $(($(grep -o '"total_files_deleted": [0-9]*' "$daily_metrics" | cut -d: -f2 | tr -d ' ') + session_deleted))/" \
        -e "s/\"total_files_failed\": [0-9]*/\"total_files_failed\": $(($(grep -o '"total_files_failed": [0-9]*' "$daily_metrics" | cut -d: -f2 | tr -d ' ') + session_failed))/" \
        -e "s/\"total_bytes_processed\": [0-9]*/\"total_bytes_processed\": $(($(grep -o '"total_bytes_processed": [0-9]*' "$daily_metrics" | cut -d: -f2 | tr -d ' ') + session_bytes))/" \
        "$daily_metrics" > "$temp_file"
    
    mv "$temp_file" "$daily_metrics"
}

# Generate audit report
generate_audit_report() {
    local report_type="${1:-daily}"
    local date_filter="${2:-$(date +%Y%m%d)}"
    local output_file="${AUDIT_DIR}/audit_report_${report_type}_${date_filter}.md"
    
    case "$report_type" in
        "daily")
            generate_daily_audit_report "$date_filter" "$output_file"
            ;;
        "session")
            generate_session_audit_report "$date_filter" "$output_file"
            ;;
        "summary")
            generate_summary_audit_report "$output_file"
            ;;
        *)
            echo "Unknown report type: $report_type"
            return 1
            ;;
    esac
    
    echo "Audit report generated: $output_file"
}

# Generate daily audit report
generate_daily_audit_report() {
    local date_filter="$1"
    local output_file="$2"
    local daily_metrics="${AUDIT_DIR}/daily_metrics_${date_filter}.json"
    
    cat > "$output_file" << EOF
# Daily Cleanup Audit Report

**Date:** $(date -d "${date_filter:0:4}-${date_filter:4:2}-${date_filter:6:2}" +"%B %d, %Y" 2>/dev/null || echo "${date_filter}")
**Generated:** $(date -Iseconds)

## Summary

EOF
    
    if [[ -f "$daily_metrics" ]]; then
        local total_sessions
        local total_processed
        local total_archived
        local total_deleted
        local total_failed
        local total_bytes
        
        total_sessions=$(grep -o '"total_sessions": [0-9]*' "$daily_metrics" | cut -d: -f2 | tr -d ' ')
        total_processed=$(grep -o '"total_files_processed": [0-9]*' "$daily_metrics" | cut -d: -f2 | tr -d ' ')
        total_archived=$(grep -o '"total_files_archived": [0-9]*' "$daily_metrics" | cut -d: -f2 | tr -d ' ')
        total_deleted=$(grep -o '"total_files_deleted": [0-9]*' "$daily_metrics" | cut -d: -f2 | tr -d ' ')
        total_failed=$(grep -o '"total_files_failed": [0-9]*' "$daily_metrics" | cut -d: -f2 | tr -d ' ')
        total_bytes=$(grep -o '"total_bytes_processed": [0-9]*' "$daily_metrics" | cut -d: -f2 | tr -d ' ')
        
        cat >> "$output_file" << EOF
- **Total Sessions:** $total_sessions
- **Files Processed:** $total_processed
- **Files Archived:** $total_archived
- **Files Deleted:** $total_deleted
- **Files Failed:** $total_failed
- **Bytes Processed:** $(numfmt --to=iec "$total_bytes" 2>/dev/null || echo "$total_bytes bytes")

## Session Details

EOF
        
        # List individual sessions
        find "$AUDIT_DIR" -name "session_*_${date_filter}_*.json" -type f | sort | while read -r session_file; do
            local session_id
            session_id=$(basename "$session_file" .json | sed 's/session_//')
            
            local operation_type
            local start_time
            local files_processed
            
            operation_type=$(grep -o '"operation_type": "[^"]*"' "$session_file" | cut -d'"' -f4)
            start_time=$(grep -o '"start_time": "[^"]*"' "$session_file" | cut -d'"' -f4)
            files_processed=$(grep -o '"files_processed": [0-9]*' "$session_file" | cut -d: -f2 | tr -d ' ')
            
            cat >> "$output_file" << EOF
### Session: $session_id

- **Operation Type:** $operation_type
- **Start Time:** $start_time
- **Files Processed:** $files_processed

EOF
        done
    else
        cat >> "$output_file" << EOF
No cleanup activities recorded for this date.
EOF
    fi
    
    # Add recent audit log entries
    cat >> "$output_file" << EOF

## Detailed Audit Log

EOF
    
    if [[ -f "$AUDIT_LOG" ]]; then
        grep "$date_filter" "$AUDIT_LOG" | tail -50 >> "$output_file"
    fi
}

# Generate session audit report
generate_session_audit_report() {
    local session_id="$1"
    local output_file="$2"
    local session_metrics="${AUDIT_DIR}/session_${session_id}_metrics.json"
    
    cat > "$output_file" << EOF
# Session Cleanup Audit Report

**Session ID:** $session_id
**Generated:** $(date -Iseconds)

EOF
    
    if [[ -f "$session_metrics" ]]; then
        # Extract session details
        local operation_type
        local user
        local start_time
        local end_time
        local final_status
        
        operation_type=$(grep -o '"operation_type": "[^"]*"' "$session_metrics" | cut -d'"' -f4)
        user=$(grep -o '"user": "[^"]*"' "$session_metrics" | cut -d'"' -f4)
        start_time=$(grep -o '"start_time": "[^"]*"' "$session_metrics" | cut -d'"' -f4)
        end_time=$(grep -o '"end_time": "[^"]*"' "$session_metrics" | cut -d'"' -f4 || echo "In Progress")
        final_status=$(grep -o '"final_status": "[^"]*"' "$session_metrics" | cut -d'"' -f4 || echo "In Progress")
        
        cat >> "$output_file" << EOF
## Session Details

- **Operation Type:** $operation_type
- **User:** $user
- **Start Time:** $start_time
- **End Time:** $end_time
- **Final Status:** $final_status

## Metrics

EOF
        
        # Add metrics
        local files_processed
        local files_archived
        local files_deleted
        local files_failed
        local bytes_processed
        
        files_processed=$(grep -o '"files_processed": [0-9]*' "$session_metrics" | cut -d: -f2 | tr -d ' ')
        files_archived=$(grep -o '"files_archived": [0-9]*' "$session_metrics" | cut -d: -f2 | tr -d ' ')
        files_deleted=$(grep -o '"files_deleted": [0-9]*' "$session_metrics" | cut -d: -f2 | tr -d ' ')
        files_failed=$(grep -o '"files_failed": [0-9]*' "$session_metrics" | cut -d: -f2 | tr -d ' ')
        bytes_processed=$(grep -o '"bytes_processed": [0-9]*' "$session_metrics" | cut -d: -f2 | tr -d ' ')
        
        cat >> "$output_file" << EOF
- **Files Processed:** $files_processed
- **Files Archived:** $files_archived
- **Files Deleted:** $files_deleted
- **Files Failed:** $files_failed
- **Bytes Processed:** $(numfmt --to=iec "$bytes_processed" 2>/dev/null || echo "$bytes_processed bytes")

EOF
    else
        cat >> "$output_file" << EOF
Session metrics file not found: $session_metrics
EOF
    fi
    
    # Add audit log entries for this session
    cat >> "$output_file" << EOF

## Detailed Operations

EOF
    
    if [[ -f "$AUDIT_LOG" ]]; then
        grep "SESSION:$session_id" "$AUDIT_LOG" >> "$output_file"
    fi
}

# Generate summary audit report
generate_summary_audit_report() {
    local output_file="$1"
    
    cat > "$output_file" << EOF
# Cleanup System Audit Summary

**Generated:** $(date -Iseconds)

## Overview

This report provides a comprehensive summary of all cleanup activities.

## Recent Activity

EOF
    
    # Show recent daily metrics
    find "$AUDIT_DIR" -name "daily_metrics_*.json" -type f | sort | tail -7 | while read -r daily_file; do
        local date_str
        date_str=$(basename "$daily_file" .json | sed 's/daily_metrics_//')
        
        local total_sessions
        local total_processed
        
        total_sessions=$(grep -o '"total_sessions": [0-9]*' "$daily_file" | cut -d: -f2 | tr -d ' ')
        total_processed=$(grep -o '"total_files_processed": [0-9]*' "$daily_file" | cut -d: -f2 | tr -d ' ')
        
        echo "- **$date_str:** $total_sessions sessions, $total_processed files processed" >> "$output_file"
    done
    
    cat >> "$output_file" << EOF

## System Health

EOF
    
    # Check for failed operations
    local recent_failures
    recent_failures=$(grep -c "STATUS:failed\|STATUS:error" "$AUDIT_LOG" 2>/dev/null || echo 0)
    
    cat >> "$output_file" << EOF
- **Recent Failures:** $recent_failures
- **Archive Directories:** $(find "${ARCHIVE_BASE_DIR:-./archive_old_files}" -maxdepth 1 -type d -name "*_[0-9]*" | wc -l)
- **Rollback Points:** $(find "${BACKUP_DIR:-./cleanup_backups}" -maxdepth 1 -type d -name "rollback_*" | wc -l)

EOF
}

# Utility functions
list_audit_files() {
    echo "=== Audit Files ==="
    echo
    echo "Audit Logs:"
    find "$AUDIT_DIR" -name "cleanup_audit_*.log" -type f | sort
    echo
    echo "Session Metrics:"
    find "$AUDIT_DIR" -name "session_*.json" -type f | sort | tail -10
    echo
    echo "Daily Metrics:"
    find "$AUDIT_DIR" -name "daily_metrics_*.json" -type f | sort
}

# Help function
show_help() {
    cat << EOF
Cleanup Audit and Logging System

Usage: $0 <command> [options]

Commands:
    init-session <session_id> <operation_type> [user]    Initialize audit session
    log-operation <session_id> <operation> <file> <status> [details]  Log operation
    finalize-session <session_id> [status]              Finalize audit session
    generate-report <type> [date/session_id]            Generate audit report
    list-files                                          List audit files
    help                                                Show this help

Report Types:
    daily       Daily summary report
    session     Individual session report
    summary     Overall system summary

Examples:
    $0 init-session cleanup_001 automated
    $0 log-operation cleanup_001 archive old_file.sh success
    $0 finalize-session cleanup_001 completed
    $0 generate-report daily 20250722
    $0 generate-report session cleanup_001_20250722_123456

EOF
}

# Main execution
main() {
    local command="${1:-help}"
    
    case "$command" in
        "init-session")
            if [[ $# -lt 3 ]]; then
                echo "Usage: $0 init-session <session_id> <operation_type> [user]"
                exit 1
            fi
            init_audit_session "$2" "$3" "${4:-$(whoami)}"
            ;;
        "log-operation")
            if [[ $# -lt 5 ]]; then
                echo "Usage: $0 log-operation <session_id> <operation> <file> <status> [details]"
                exit 1
            fi
            log_operation "$2" "$3" "$4" "$5" "${6:-}"
            ;;
        "finalize-session")
            if [[ $# -lt 2 ]]; then
                echo "Usage: $0 finalize-session <session_id> [status]"
                exit 1
            fi
            finalize_audit_session "$2" "${3:-completed}"
            ;;
        "generate-report")
            if [[ $# -lt 2 ]]; then
                echo "Usage: $0 generate-report <type> [date/session_id]"
                exit 1
            fi
            generate_audit_report "$2" "${3:-$(date +%Y%m%d)}"
            ;;
        "list-files")
            list_audit_files
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