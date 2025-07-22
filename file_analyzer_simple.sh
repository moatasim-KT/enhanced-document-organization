#!/bin/bash

# ============================================================================
# FILE SCANNING AND ANALYSIS TOOLS
# ============================================================================
# 
# @file          file_analyzer_simple.sh
# @description   Tools for identifying redundant files, analyzing dependencies,
#                detecting unused configuration files, and generating cleanup reports.
# @version       1.0.0
# @author        Document Organization System Team
# 
# This script provides tools to analyze the codebase for cleanup opportunities:
# - Identifies redundant files by comparing with consolidated modules
# - Analyzes file dependencies to understand relationships
# - Detects unused configuration files and scripts
# - Generates reports of cleanup candidates
#
# USAGE:
#   ./file_analyzer_simple.sh scan                     # Scan for redundant files
#   ./file_analyzer_simple.sh analyze-deps FILE        # Analyze dependencies for a file
#   ./file_analyzer_simple.sh find-unused              # Find unused config files and scripts
#   ./file_analyzer_simple.sh report                   # Generate cleanup report
#   ./file_analyzer_simple.sh full-analysis            # Run all analysis tools
#
# ============================================================================

# Directory and path configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/file_analyzer.log"
REPORT_DIR="$SCRIPT_DIR/.reports"
REPORT_FILE="$REPORT_DIR/redundant_files_temp.txt"

# Initialize report directory
mkdir -p "$REPORT_DIR"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Initialized report directory: $REPORT_DIR" | tee -a "$LOG_FILE"

# Function to scan for redundant files
scan_redundant_files() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Scanning for redundant files..." | tee -a "$LOG_FILE"
    
    # Create temporary file for results
    > "$REPORT_FILE"
    
    # Find all shell scripts except the consolidated modules
    find "$SCRIPT_DIR" -type f -name "*.sh" | grep -v "organize_module.sh" | grep -v "sync_module.sh" | grep -v "file_analyzer" > "$REPORT_DIR/all_scripts.txt"
    
    # Extract function names from consolidated modules
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Extracting functions from consolidated modules..." | tee -a "$LOG_FILE"
    grep -o "^[[:space:]]*[a-zA-Z0-9_]\+()[[:space:]]*{" "$SCRIPT_DIR/organize/organize_module.sh" "$SCRIPT_DIR/sync/sync_module.sh" 2>/dev/null | sed 's/()[[:space:]]*{//g' | tr -d ' ' > "$REPORT_DIR/consolidated_functions.txt"
    
    # Count functions in consolidated modules
    local function_count=$(wc -l < "$REPORT_DIR/consolidated_functions.txt")
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Found $function_count functions in consolidated modules" | tee -a "$LOG_FILE"
    
    # Check each script for redundant functions
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Analyzing scripts for redundancy..." | tee -a "$LOG_FILE"
    local redundant_count=0
    
    while read -r script_file; do
        # Extract functions from this script
        grep -o "^[[:space:]]*[a-zA-Z0-9_]\+()[[:space:]]*{" "$script_file" 2>/dev/null | sed 's/()[[:space:]]*{//g' | tr -d ' ' > "$REPORT_DIR/script_functions.txt"
        
        # Count total functions
        local total_functions=$(wc -l < "$REPORT_DIR/script_functions.txt")
        
        # Find matching functions (redundant)
        grep -f "$REPORT_DIR/consolidated_functions.txt" "$REPORT_DIR/script_functions.txt" > "$REPORT_DIR/matching_functions.txt"
        local redundant_functions=$(wc -l < "$REPORT_DIR/matching_functions.txt")
        
        # Calculate redundancy percentage
        if [ "$total_functions" -gt 0 ]; then
            local redundancy_percentage=$((redundant_functions * 100 / total_functions))
            
            # If redundancy is above threshold, add to report
            if [ "$redundancy_percentage" -gt 30 ]; then
                echo "$script_file|$redundancy_percentage|$redundant_functions|$total_functions" >> "$REPORT_FILE"
                ((redundant_count++))
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] Found redundant file: $script_file ($redundancy_percentage% redundant)" | tee -a "$LOG_FILE"
            fi
        fi
    done < "$REPORT_DIR/all_scripts.txt"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Found $redundant_count potentially redundant files" | tee -a "$LOG_FILE"
    
    # Sort results by redundancy percentage
    if [ -s "$REPORT_FILE" ]; then
        sort -t'|' -k2 -nr "$REPORT_FILE" > "$REPORT_DIR/redundant_files.txt"
    fi
}

# Function to analyze dependencies for a file
analyze_dependencies() {
    local target_file="$1"
    
    if [ ! -f "$target_file" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] File not found: $target_file" | tee -a "$LOG_FILE"
        return 1
    fi
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Analyzing dependencies for: $target_file" | tee -a "$LOG_FILE"
    
    # Find files that the target depends on
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Finding dependencies..." | tee -a "$LOG_FILE"
    grep -E "source|\.\/.*\.sh|\. " "$target_file" | grep -v "#" > "$REPORT_DIR/dependencies_$(basename "$target_file").txt"
    
    # Find files that depend on the target
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Finding dependents..." | tee -a "$LOG_FILE"
    local target_basename=$(basename "$target_file")
    find "$SCRIPT_DIR" -type f -name "*.sh" | xargs grep -l "$target_basename" | grep -v "$target_file" > "$REPORT_DIR/dependents_$(basename "$target_file").txt"
    
    # Count dependencies and dependents
    local dep_count=$(wc -l < "$REPORT_DIR/dependencies_$(basename "$target_file").txt")
    local dependent_count=$(wc -l < "$REPORT_DIR/dependents_$(basename "$target_file").txt")
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Found $dep_count dependencies and $dependent_count dependents" | tee -a "$LOG_FILE"
    
    # Display dependencies
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Dependencies:" | tee -a "$LOG_FILE"
    cat "$REPORT_DIR/dependencies_$(basename "$target_file").txt" | tee -a "$LOG_FILE"
    
    # Display dependents
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Dependents:" | tee -a "$LOG_FILE"
    cat "$REPORT_DIR/dependents_$(basename "$target_file").txt" | tee -a "$LOG_FILE"
}

# Function to find unused configuration files and scripts
find_unused_files() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Finding unused configuration files and scripts..." | tee -a "$LOG_FILE"
    
    # Find all configuration and script files
    find "$SCRIPT_DIR" -type f \( -name "*.conf" -o -name "*.cfg" -o -name "*.env" -o -name "*.sh" -o -name "*.json" -o -name "*.yml" -o -name "*.yaml" -o -name "*.prf" \) | grep -v "file_analyzer" > "$REPORT_DIR/all_config_files.txt"
    
    # Create output file
    > "$REPORT_DIR/unused_files.txt"
    
    # Check each file to see if it's referenced anywhere
    local unused_count=0
    
    while read -r file; do
        local file_basename=$(basename "$file")
        local references=$(grep -l "$file_basename" $(find "$SCRIPT_DIR" -type f) 2>/dev/null | grep -v "$file" | wc -l)
        
        if [ "$references" -eq 0 ]; then
            echo "$file" >> "$REPORT_DIR/unused_files.txt"
            ((unused_count++))
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Found unused file: $file" | tee -a "$LOG_FILE"
        fi
    done < "$REPORT_DIR/all_config_files.txt"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Found $unused_count potentially unused files" | tee -a "$LOG_FILE"
}

# Function to generate a cleanup report
generate_cleanup_report() {
    local output_file="$REPORT_DIR/cleanup_report_$(date +%Y%m%d_%H%M%S).md"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Generating cleanup report: $output_file" | tee -a "$LOG_FILE"
    
    # Ensure we have data to report
    if [ ! -f "$REPORT_DIR/redundant_files.txt" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] No redundant files data found. Running scan..." | tee -a "$LOG_FILE"
        scan_redundant_files
    fi
    
    if [ ! -f "$REPORT_DIR/unused_files.txt" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] No unused files data found. Running scan..." | tee -a "$LOG_FILE"
        find_unused_files
    fi
    
    # Create the report
    {
        echo "# Cleanup Candidates Report"
        echo ""
        echo "Generated: $(date '+%Y-%m-%d %H:%M:%S')"
        echo ""
        echo "This report identifies files that are candidates for cleanup based on automated analysis."
        echo "Each file should be manually reviewed before removal to ensure no functionality is lost."
        echo ""
        
        # Redundant files section
        echo "## Redundant Files"
        echo ""
        echo "These files contain functionality that appears to be duplicated in the consolidated modules."
        echo ""
        echo "| File | Redundancy % | Redundant Functions | Total Functions |"
        echo "|------|-------------|---------------------|----------------|"
        
        if [ -f "$REPORT_DIR/redundant_files.txt" ]; then
            while IFS='|' read -r file redundancy_pct redundant_funcs total_funcs; do
                echo "| $file | $redundancy_pct% | $redundant_funcs | $total_funcs |"
            done < "$REPORT_DIR/redundant_files.txt"
        else
            echo "| No redundant files found | - | - | - |"
        fi
        
        echo ""
        
        # Unused files section
        echo "## Unused Files"
        echo ""
        echo "These files are not referenced by any other files in the codebase and may be obsolete."
        echo ""
        echo "| File | Type | Last Modified |"
        echo "|------|------|--------------|"
        
        if [ -f "$REPORT_DIR/unused_files.txt" ]; then
            while read -r file; do
                local file_type=$(file -b "$file" 2>/dev/null | cut -d, -f1)
                local last_modified=$(stat -f "%Sm" "$file" 2>/dev/null)
                echo "| $file | $file_type | $last_modified |"
            done < "$REPORT_DIR/unused_files.txt"
        else
            echo "| No unused files found | - | - |"
        fi
        
        echo ""
        
        # Recommendations section
        echo "## Recommendations"
        echo ""
        echo "### Safe to Archive"
        echo ""
        echo "The following files are likely safe to archive based on high redundancy and no dependencies:"
        echo ""
        
        # Find files that are both redundant and unused
        if [ -f "$REPORT_DIR/redundant_files.txt" ] && [ -f "$REPORT_DIR/unused_files.txt" ]; then
            local found_safe=0
            
            while IFS='|' read -r file redundancy_pct redundant_funcs total_funcs; do
                if grep -q "$file" "$REPORT_DIR/unused_files.txt"; then
                    echo "- $file (${redundancy_pct}% redundant, unused)"
                    found_safe=1
                fi
            done < "$REPORT_DIR/redundant_files.txt"
            
            if [ "$found_safe" -eq 0 ]; then
                echo "No files identified as safe to archive."
            fi
        else
            echo "No files identified as safe to archive."
        fi
        
        echo ""
        echo "### Requires Review"
        echo ""
        echo "The following files should be carefully reviewed before archiving:"
        echo ""
        
        # Files that are redundant but have dependents
        if [ -f "$REPORT_DIR/redundant_files.txt" ]; then
            local found_review=0
            
            while IFS='|' read -r file redundancy_pct redundant_funcs total_funcs; do
                if ! grep -q "$file" "$REPORT_DIR/unused_files.txt"; then
                    echo "- $file (${redundancy_pct}% redundant, but may have dependents)"
                    found_review=1
                fi
            done < "$REPORT_DIR/redundant_files.txt"
            
            if [ "$found_review" -eq 0 ]; then
                echo "No files identified that require review."
            fi
        else
            echo "No files identified that require review."
        fi
        
        echo ""
        echo "## Next Steps"
        echo ""
        echo "1. Review the 'Safe to Archive' files and confirm they can be archived"
        echo "2. For 'Requires Review' files, run dependency analysis to understand relationships"
        echo "3. Create a cleanup plan that preserves all required functionality"
        echo "4. Archive files rather than deleting them to allow for recovery if needed"
        echo "5. Run comprehensive tests after each cleanup phase"
        
    } > "$output_file"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleanup report generated: $output_file" | tee -a "$LOG_FILE"
    echo "Report available at: $output_file"
}

# Function to run a full analysis
run_full_analysis() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running full analysis..." | tee -a "$LOG_FILE"
    
    scan_redundant_files
    find_unused_files
    generate_cleanup_report
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Full analysis completed" | tee -a "$LOG_FILE"
}

# Show usage information
show_usage() {
    cat << EOF
Usage: $(basename "$0") [command]

Commands:
  scan                Scan for redundant files by comparing with consolidated modules
  analyze-deps FILE   Analyze dependencies for a specific file
  find-unused         Find unused configuration files and scripts
  report              Generate cleanup report
  full-analysis       Run all analysis tools

Examples:
  $(basename "$0") scan
  $(basename "$0") analyze-deps sync_manager.sh
  $(basename "$0") find-unused
  $(basename "$0") report
  $(basename "$0") full-analysis
EOF
}

# Main function
main() {
    if [ "$#" -eq 0 ]; then
        show_usage
        exit 1
    fi
    
    local command="$1"
    shift
    
    case "$command" in
        scan)
            scan_redundant_files
            ;;
        analyze-deps)
            if [ "$#" -lt 1 ]; then
                echo "Error: Missing file parameter. Usage: analyze-deps FILE"
                exit 1
            fi
            analyze_dependencies "$1"
            ;;
        find-unused)
            find_unused_files
            ;;
        report)
            generate_cleanup_report
            ;;
        full-analysis)
            run_full_analysis
            ;;
        *)
            echo "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all command-line arguments
main "$@"