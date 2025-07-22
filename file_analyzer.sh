#!/bin/bash

# ============================================================================
# FILE SCANNING AND ANALYSIS TOOLS
# ============================================================================
# 
# @file          file_analyzer.sh
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
#   ./file_analyzer.sh scan                     # Scan for redundant files
#   ./file_analyzer.sh analyze-deps FILE        # Analyze dependencies for a file
#   ./file_analyzer.sh find-unused              # Find unused config files and scripts
#   ./file_analyzer.sh report                   # Generate cleanup report
#   ./file_analyzer.sh full-analysis            # Run all analysis tools
#
# ============================================================================

set -euo pipefail

# Directory and path configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/file_analyzer.log"
REPORT_DIR="$SCRIPT_DIR/.reports"
CONSOLIDATED_MODULES=(
    "organize/organize_module.sh"
    "sync/sync_module.sh"
)
REPORT_FILE="$REPORT_DIR/cleanup_candidates_$(date +%Y%m%d_%H%M%S).md"
DEPENDENCY_GRAPH_FILE="$REPORT_DIR/dependency_graph.dot"

# ANSI color codes for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

# Logs a message to both console and log file
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Initialize report directory
initialize_report_dir() {
    mkdir -p "$REPORT_DIR"
    log "${BLUE}📊 Initialized report directory: $REPORT_DIR${NC}"
}

# Display usage information
show_usage() {
    cat << EOF
Usage: $(basename "$0") [command] [options]

Commands:
  scan                Scan for redundant files by comparing with consolidated modules
  analyze-deps FILE   Analyze dependencies for a specific file
  find-unused         Find unused configuration files and scripts
  report              Generate cleanup report
  full-analysis       Run all analysis tools

Options:
  --verbose           Show detailed output
  --output FILE       Specify output file for reports
  --include-tests     Include test files in analysis
  --exclude DIR       Exclude directory from analysis

Examples:
  $(basename "$0") scan
  $(basename "$0") analyze-deps sync_manager.sh
  $(basename "$0") find-unused --exclude tests
  $(basename "$0") report --output cleanup_report.md
  $(basename "$0") full-analysis --verbose
EOF
}

# ============================================================================
# CORE ANALYSIS FUNCTIONS
# ============================================================================

# Identify redundant files by comparing with consolidated modules
# This function scans the codebase to find files that have been replaced
# by functionality in the consolidated modules
#
# Parameters:
#   $1 - (Optional) Directory to scan, defaults to script directory
#   $2 - (Optional) Verbose flag (true/false), defaults to false
#
# Returns:
#   0 on success, non-zero on failure
#
# Example:
#   scan_redundant_files
#   scan_redundant_files "/path/to/dir" true
scan_redundant_files() {
    local scan_dir="${1:-$SCRIPT_DIR}"
    local verbose="${2:-false}"
    local temp_file="$REPORT_DIR/redundant_files_temp.txt"
    
    log "${BLUE}🔍 Scanning for redundant files in: $scan_dir${NC}"
    
    # Create temporary file for results
    > "$temp_file"
    
    # Extract function names from consolidated modules for comparison
    log "${CYAN}Extracting function signatures from consolidated modules...${NC}"
    local consolidated_functions=""
    
    for module in "${CONSOLIDATED_MODULES[@]}"; do
        if [[ -f "$SCRIPT_DIR/$module" ]]; then
            # Extract function names using grep
            local functions=$(grep -o "^[[:space:]]*[a-zA-Z0-9_]\+()[[:space:]]*{" "$SCRIPT_DIR/$module" 2>/dev/null | sed 's/()[[:space:]]*{//g' | tr -d ' ')
            if [[ "$verbose" == "true" ]]; then
                log "${PURPLE}Found functions in $module:${NC}"
                echo "$functions" | while read -r func; do
                    [[ -n "$func" ]] && log "  - $func"
                done
            fi
            # Add to consolidated functions string
            while read -r func; do
                if [[ -n "$func" ]]; then
                    if [[ -z "$consolidated_functions" ]]; then
                        consolidated_functions="$func"
                    else
                        consolidated_functions="$consolidated_functions|$func"
                    fi
                fi
            done <<< "$functions"
        else
            log "${RED}⚠️  Module not found: $module${NC}"
        fi
    done
    
    # Count functions by counting pipe separators and adding 1
    local function_count=$(echo "$consolidated_functions" | grep -o "|" | wc -l)
    ((function_count++))
    log "${GREEN}✅ Found $function_count functions in consolidated modules${NC}"
    
    # Find shell script files to analyze
    log "${CYAN}Finding shell script files to analyze...${NC}"
    local script_files=$(find "$scan_dir" -type f -name "*.sh" | grep -v "$(basename "$0")" | grep -v "$(basename "$SCRIPT_DIR/organize/organize_module.sh")" | grep -v "$(basename "$SCRIPT_DIR/sync/sync_module.sh")")
    
    # Analyze each script file for redundancy
    log "${CYAN}Analyzing script files for redundancy...${NC}"
    local redundant_count=0
    
    echo "$script_files" | while read -r script_file; do
        local redundancy_score=0
        local total_functions=0
        local redundant_functions=""
        
        # Extract function names from the script
        local script_functions=$(grep -o "^[[:space:]]*[a-zA-Z0-9_]\+()[[:space:]]*{" "$script_file" 2>/dev/null | sed 's/()[[:space:]]*{//g' | tr -d ' ')
        
        # Count total functions in script
        total_functions=$(echo "$script_functions" | grep -v "^$" | wc -l)
        
        # Check each function against consolidated modules
        echo "$script_functions" | while read -r func; do
            if [[ -z "$func" ]]; then
                continue
            fi
            
            # Check if function matches any consolidated function
            if echo "$func" | grep -q -E "^($consolidated_functions)$"; then
                if [[ -z "$redundant_functions" ]]; then
                    redundant_functions="$func"
                else
                    redundant_functions="$redundant_functions,$func"
                fi
                ((redundancy_score++))
            fi
        done
        
        # Calculate redundancy percentage
        local redundancy_percentage=0
        if [[ $total_functions -gt 0 ]]; then
            redundancy_percentage=$((redundancy_score * 100 / total_functions))
        fi
        
        # If redundancy score is above threshold, mark as redundant
        if [[ $redundancy_percentage -gt 50 ]]; then
            echo "$script_file|$redundancy_percentage|$redundancy_score|$total_functions" >> "$temp_file"
            ((redundant_count++))
            
            if [[ "$verbose" == "true" ]]; then
                log "${YELLOW}Found redundant file: $script_file (${redundancy_percentage}% redundant)${NC}"
                log "  - Redundant functions: ${redundant_functions}"
            fi
        fi
    done
    
    # Sort results by redundancy percentage
    if [[ -f "$temp_file" ]]; then
        sort -t'|' -k2 -nr "$temp_file" > "$REPORT_DIR/redundant_files.txt"
        rm "$temp_file"
    fi
    
    log "${GREEN}✅ Found $redundant_count potentially redundant files${NC}"
    return 0
}

# Analyze dependencies for a specific file
# This function examines a file to determine what other files it depends on
# and what files depend on it
#
# Parameters:
#   $1 - File to analyze
#   $2 - (Optional) Directory to search for dependencies, defaults to script directory
#   $3 - (Optional) Verbose flag (true/false), defaults to false
#
# Returns:
#   0 on success, non-zero on failure
#
# Example:
#   analyze_dependencies "sync_manager.sh"
#   analyze_dependencies "sync_manager.sh" "/path/to/dir" true
analyze_dependencies() {
    local target_file="$1"
    local search_dir="${2:-$SCRIPT_DIR}"
    local verbose="${3:-false}"
    local dependencies_file="$REPORT_DIR/dependencies_$(basename "$target_file").txt"
    local dependents_file="$REPORT_DIR/dependents_$(basename "$target_file").txt"
    
    # Ensure target file exists
    if [[ ! -f "$target_file" && ! -f "$search_dir/$target_file" ]]; then
        log "${RED}⚠️  Target file not found: $target_file${NC}"
        return 1
    fi
    
    # Use absolute path for target file
    if [[ ! -f "$target_file" ]]; then
        target_file="$search_dir/$target_file"
    fi
    
    log "${BLUE}🔍 Analyzing dependencies for: $(basename "$target_file")${NC}"
    
    # Create output files
    > "$dependencies_file"
    > "$dependents_file"
    
    # Find files that the target file depends on (source, include, etc.)
    log "${CYAN}Finding dependencies...${NC}"
    
    # Look for source statements
    local source_deps=$(grep -o "source [\"']\?[^\"']*[\"']\?" "$target_file" 2>/dev/null | sed 's/source [\"'"'"']\(.*\)[\"'"'"']/\1/g')
    
    # Look for direct executable calls
    local exec_deps=$(grep -o "\./[^ ]*\.sh" "$target_file" 2>/dev/null)
    
    # Look for . (dot) sourcing
    local dot_deps=$(grep -o "\. [\"']\?[^\"']*[\"']\?" "$target_file" 2>/dev/null | sed 's/\. [\"'"'"']\(.*\)[\"'"'"']/\1/g')
    
    # Combine all dependencies
    local all_deps=("$source_deps" "$exec_deps" "$dot_deps")
    
    # Write dependencies to file
    for dep in "${all_deps[@]}"; do
        if [[ -n "$dep" ]]; then
            echo "$dep" >> "$dependencies_file"
            if [[ "$verbose" == "true" ]]; then
                log "${PURPLE}Dependency: $dep${NC}"
            fi
        fi
    done
    
    # Find files that depend on the target file
    log "${CYAN}Finding dependents...${NC}"
    local target_basename=$(basename "$target_file")
    
    # Search for files that source or execute the target file
    find "$search_dir" -type f -name "*.sh" | while read -r file; do
        if [[ "$file" != "$target_file" ]]; then
            if grep -q "source [\"']\?[^\"']*$target_basename[\"']\?" "$file" 2>/dev/null || \
               grep -q "\./[^\"']*$target_basename" "$file" 2>/dev/null || \
               grep -q "\. [\"']\?[^\"']*$target_basename[\"']\?" "$file" 2>/dev/null; then
                echo "$file" >> "$dependents_file"
                if [[ "$verbose" == "true" ]]; then
                    log "${YELLOW}Dependent: $file${NC}"
                fi
            fi
        fi
    done
    
    # Count dependencies and dependents
    local dep_count=$(wc -l < "$dependencies_file")
    local dependent_count=$(wc -l < "$dependents_file")
    
    log "${GREEN}✅ Found $dep_count dependencies and $dependent_count dependents for $(basename "$target_file")${NC}"
    
    # Generate DOT file for visualization
    log "${CYAN}Generating dependency graph...${NC}"
    {
        echo "digraph dependencies {"
        echo "  \"$(basename "$target_file")\" [shape=box, style=filled, fillcolor=lightblue];"
        
        # Add dependencies
        while read -r dep; do
            if [[ -n "$dep" ]]; then
                echo "  \"$(basename "$target_file")\" -> \"$(basename "$dep")\" [color=blue];"
            fi
        done < "$dependencies_file"
        
        # Add dependents
        while read -r dependent; do
            if [[ -n "$dependent" ]]; then
                echo "  \"$(basename "$dependent")\" -> \"$(basename "$target_file")\" [color=red];"
            fi
        done < "$dependents_file"
        
        echo "}"
    } > "$DEPENDENCY_GRAPH_FILE"
    
    log "${GREEN}✅ Dependency graph saved to: $DEPENDENCY_GRAPH_FILE${NC}"
    log "${BLUE}📊 To visualize: dot -Tpng $DEPENDENCY_GRAPH_FILE -o dependency_graph.png${NC}"
    
    return 0
}

# Find unused configuration files and scripts
# This function identifies configuration files and scripts that are not
# referenced by any other files in the codebase
#
# Parameters:
#   $1 - (Optional) Directory to scan, defaults to script directory
#   $2 - (Optional) Exclude pattern, defaults to none
#   $3 - (Optional) Verbose flag (true/false), defaults to false
#
# Returns:
#   0 on success, non-zero on failure
#
# Example:
#   find_unused_files
#   find_unused_files "/path/to/dir" "tests/" true
find_unused_files() {
    local scan_dir="${1:-$SCRIPT_DIR}"
    local exclude_pattern="${2:-}"
    local verbose="${3:-false}"
    local unused_file="$REPORT_DIR/unused_files.txt"
    
    log "${BLUE}🔍 Scanning for unused configuration files and scripts in: $scan_dir${NC}"
    
    # Create output file
    > "$unused_file"
    
    # Find all configuration and script files
    log "${CYAN}Finding configuration and script files...${NC}"
    local find_cmd="find \"$scan_dir\" -type f \\( -name \"*.conf\" -o -name \"*.cfg\" -o -name \"*.env\" -o -name \"*.sh\" -o -name \"*.json\" -o -name \"*.yml\" -o -name \"*.yaml\" -o -name \"*.prf\" \\)"
    
    if [[ -n "$exclude_pattern" ]]; then
        find_cmd="$find_cmd | grep -v \"$exclude_pattern\""
    fi
    
    local all_files=$(eval "$find_cmd")
    local total_files=$(echo "$all_files" | wc -l)
    
    log "${CYAN}Found $total_files configuration and script files${NC}"
    
    # Check each file to see if it's referenced anywhere
    local unused_count=0
    
    echo "$all_files" | while read -r file; do
        local file_basename=$(basename "$file")
        local is_referenced=false
        
        # Skip this analyzer script
        if [[ "$file" == "$SCRIPT_DIR/$(basename "$0")" ]]; then
            continue
        fi
        
        # Check if file is referenced in any other file
        find "$scan_dir" -type f | grep -v "$file" | while read -r potential_referencer; do
            if grep -q "$file_basename" "$potential_referencer" 2>/dev/null; then
                is_referenced=true
                break
            fi
        done
        
        # If not referenced, add to unused files list
        if [[ "$is_referenced" == "false" ]]; then
            echo "$file" >> "$unused_file"
            ((unused_count++))
            
            if [[ "$verbose" == "true" ]]; then
                log "${YELLOW}Found unused file: $file${NC}"
            fi
        fi
    done
    
    log "${GREEN}✅ Found $unused_count potentially unused files${NC}"
    return 0
}

# Generate a comprehensive cleanup report
# This function combines the results of all analysis tools to create
# a detailed report of cleanup candidates
#
# Parameters:
#   $1 - (Optional) Output file, defaults to REPORT_FILE
#   $2 - (Optional) Verbose flag (true/false), defaults to false
#
# Returns:
#   0 on success, non-zero on failure
#
# Example:
#   generate_cleanup_report
#   generate_cleanup_report "custom_report.md" true
generate_cleanup_report() {
    local output_file="${1:-$REPORT_FILE}"
    local verbose="${2:-false}"
    
    log "${BLUE}📊 Generating cleanup report: $output_file${NC}"
    
    # Ensure we have data to report
    if [[ ! -f "$REPORT_DIR/redundant_files.txt" ]]; then
        log "${YELLOW}⚠️  No redundant files data found. Running scan...${NC}"
        scan_redundant_files "$SCRIPT_DIR" "$verbose"
    fi
    
    if [[ ! -f "$REPORT_DIR/unused_files.txt" ]]; then
        log "${YELLOW}⚠️  No unused files data found. Running scan...${NC}"
        find_unused_files "$SCRIPT_DIR" "" "$verbose"
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
        
        if [[ -f "$REPORT_DIR/redundant_files.txt" ]]; then
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
        
        if [[ -f "$REPORT_DIR/unused_files.txt" ]]; then
            while read -r file; do
                local file_type=$(file -b "$file" 2>/dev/null | cut -d, -f1)
                # Use stat format appropriate for macOS
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
        if [[ -f "$REPORT_DIR/redundant_files.txt" && -f "$REPORT_DIR/unused_files.txt" ]]; then
            local safe_to_archive=false
            
            while IFS='|' read -r file redundancy_pct redundant_funcs total_funcs; do
                if grep -q "$file" "$REPORT_DIR/unused_files.txt"; then
                    echo "- $file (${redundancy_pct}% redundant, unused)"
                    safe_to_archive=true
                fi
            done < "$REPORT_DIR/redundant_files.txt"
            
            if [[ "$safe_to_archive" == "false" ]]; then
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
        if [[ -f "$REPORT_DIR/redundant_files.txt" ]]; then
            local requires_review=false
            
            while IFS='|' read -r file redundancy_pct redundant_funcs total_funcs; do
                if ! grep -q "$file" "$REPORT_DIR/unused_files.txt"; then
                    echo "- $file (${redundancy_pct}% redundant, but may have dependents)"
                    requires_review=true
                fi
            done < "$REPORT_DIR/redundant_files.txt"
            
            if [[ "$requires_review" == "false" ]]; then
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
    
    log "${GREEN}✅ Cleanup report generated: $output_file${NC}"
    return 0
}

# Run a full analysis of the codebase
# This function runs all analysis tools and generates a comprehensive report
#
# Parameters:
#   $1 - (Optional) Directory to scan, defaults to script directory
#   $2 - (Optional) Output file, defaults to REPORT_FILE
#   $3 - (Optional) Verbose flag (true/false), defaults to false
#
# Returns:
#   0 on success, non-zero on failure
#
# Example:
#   run_full_analysis
#   run_full_analysis "/path/to/dir" "custom_report.md" true
run_full_analysis() {
    local scan_dir="${1:-$SCRIPT_DIR}"
    local output_file="${2:-$REPORT_FILE}"
    local verbose="${3:-false}"
    
    log "${BLUE}🔍 Running full codebase analysis...${NC}"
    
    # Run all analysis tools
    scan_redundant_files "$scan_dir" "$verbose"
    find_unused_files "$scan_dir" "" "$verbose"
    
    # Generate comprehensive report
    generate_cleanup_report "$output_file" "$verbose"
    
    log "${GREEN}✅ Full analysis completed${NC}"
    log "${BLUE}📊 Report available at: $output_file${NC}"
    
    return 0
}

# ============================================================================
# MAIN FUNCTION
# ============================================================================

# Main function that processes command-line arguments and executes commands
main() {
    if [[ "$#" -eq 0 ]]; then
        show_usage
        exit 1
    fi
    
    local command="$1"
    shift
    
    # Initialize report directory
    initialize_report_dir
    
    # Process command
    case "$command" in
        scan)
            log "Scanning for redundant files..."
            scan_redundant_files "$SCRIPT_DIR" "true"
            ;;
        analyze-deps)
            if [[ "$#" -lt 1 ]]; then
                log "${RED}❌ Missing file parameter. Usage: analyze-deps FILE${NC}"
                exit 1
            fi
            log "Analyzing dependencies for $1..."
            analyze_dependencies "$1" "$SCRIPT_DIR" "true"
            ;;
        find-unused)
            log "Finding unused configuration files and scripts..."
            find_unused_files "$SCRIPT_DIR" "" "true"
            ;;
        report)
            log "Generating cleanup report..."
            generate_cleanup_report "$REPORT_FILE" "true"
            ;;
        full-analysis)
            log "Running full analysis..."
            run_full_analysis "$SCRIPT_DIR" "$REPORT_FILE" "true"
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