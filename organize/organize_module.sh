#!/bin/bash

# ============================================================================
# CONSOLIDATED ORGANIZATION MODULE
# ============================================================================
# 
# @file          organize_module.sh
# @description   A comprehensive document organization system that automatically
#                categorizes, deduplicates, and manages files across multiple
#                storage locations.
# @version       2.0.0
# @author        Document Organization System Team
# 
# This module combines functionality from:
# - organize_documents_enhanced.sh
# - organize_manager.sh
# - simplified_categorization.sh
#
# USAGE:
#   ./organize_module.sh run                     # Run organization process
#   ./organize_module.sh dry-run                 # Test without making changes
#   ./organize_module.sh status                  # Check system status
#   ./organize_module.sh create-category NAME EMOJI KEYWORDS  # Create custom category
#   ./organize_module.sh process-inbox           # Process inbox folders only
#
# CONFIGURATION:
#   All settings are loaded from config.env in the parent directory.
#   Key settings include:
#   - SOURCE_DIR: Main directory to organize
#   - INBOX_LOCATIONS: Array of inbox folders to monitor
#   - ENABLE_CONTENT_ANALYSIS: Enable/disable content-based categorization
#   - ENABLE_SIMPLIFIED_CATEGORIZATION: Use simplified 5-category structure
#
# ============================================================================

set -euo pipefail

# Directory and path configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PARENT_DIR/organize_module.log"

# Load configuration from environment file
source "$PARENT_DIR/config.env"

# Cache directory and databases
CACHE_DIR="$PARENT_DIR/.cache"
PROCESSED_FILES_DB="$CACHE_DIR/processed_files.db"
CONTENT_HASH_DB="$CACHE_DIR/content_hashes.db"
CUSTOM_CATEGORIES_FILE="$PARENT_DIR/custom_categories.txt"

# ============================================================================
# CONFIGURATION SETTINGS
# ============================================================================

# Content analysis settings
# Controls whether files are analyzed for content-based categorization
ENABLE_CONTENT_ANALYSIS=true

# Integrity checking
# Validates files for corruption, encoding issues, and minimum size requirements
ENABLE_INTEGRITY_CHECK=true

# Smart categorization
# Uses content analysis and pattern matching to determine file categories
ENABLE_SMART_CATEGORIZATION=true

# Cross-sync validation
# Checks for consistency across sync locations before organizing
ENABLE_CROSS_SYNC_VALIDATION=false

# Incremental processing
# Only processes files that have changed since last run
ENABLE_INCREMENTAL_PROCESSING=true

# Metadata preservation
# Preserves file metadata (creation date, tags) during organization
ENABLE_METADATA_PRESERVATION=true

# Advanced deduplication
# Uses content hashing to identify duplicate files even with different names
ENABLE_ADVANCED_DEDUPLICATION=true

# Progress tracking
# Shows visual progress indicators during processing
ENABLE_PROGRESS_TRACKING=true

# Simplified categorization
# Uses a simplified 5-category structure instead of detailed hierarchy
ENABLE_SIMPLIFIED_CATEGORIZATION=true

# ============================================================================
# THRESHOLD SETTINGS
# ============================================================================

# Minimum file size in bytes to be considered valid
# Files smaller than this will be flagged for review
MIN_FILE_SIZE=10

# Maximum filename length allowed
# Longer filenames will be truncated during organization
MAX_FILENAME_LENGTH=80

# Time threshold in seconds for incremental processing
# Files modified within this threshold will be reprocessed
INCREMENTAL_THRESHOLD=3600  # 1 hour

# Number of lines to analyze for content-based categorization
# Higher values are more accurate but slower
CONTENT_ANALYSIS_DEPTH=50

# ============================================================================
# PROGRESS TRACKING VARIABLES
# ============================================================================

TOTAL_FILES=0
PROCESSED_FILES=0
MOVED_FILES=0
DEDUPLICATED_FILES=0
ERROR_FILES=0
CATEGORIZED_FILES=0

# ============================================================================
# OUTPUT FORMATTING
# ============================================================================

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

/**
 * Logs a message to both console and log file
 *
 * @param {string} message - The message to log
 * @return {void}
 *
 * @example
 * log "Processing file: document.md"
 * log "${RED}Error: File not found${NC}"
 */
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

/**
 * Initializes cache directory and databases
 * Creates necessary directories and database files if they don't exist
 *
 * @return {void}
 *
 * @example
 * initialize_cache
 */
initialize_cache() {
    mkdir -p "$CACHE_DIR"
    
    # Create processed files database if it doesn't exist
    if [[ ! -f "$PROCESSED_FILES_DB" ]]; then
        echo "# Processed Files Database" > "$PROCESSED_FILES_DB"
        echo "# Format: filepath|hash|timestamp|category" >> "$PROCESSED_FILES_DB"
    fi
    
    # Create content hash database if it doesn't exist
    if [[ ! -f "$CONTENT_HASH_DB" ]]; then
        echo "# Content Hash Database" > "$CONTENT_HASH_DB"
        echo "# Format: hash|filepath|size|timestamp" >> "$CONTENT_HASH_DB"
    fi
}

/**
 * Updates and displays progress information
 * Shows a visual progress bar if ENABLE_PROGRESS_TRACKING is true
 *
 * @param {number} current - Current progress count
 * @param {number} total - Total items to process
 * @param {string} operation - Description of the current operation
 * @return {void}
 *
 * @example
 * update_progress 45 100 "Categorizing files"
 */
update_progress() {
    local current=$1
    local total=$2
    local operation=$3
    
    if [[ "$ENABLE_PROGRESS_TRACKING" == "true" ]]; then
        local percent=$((current * 100 / total))
        local progress_bar=""
        local filled=$((percent / 2))
        
        # Generate the progress bar visualization
        for ((i=0; i<filled; i++)); do progress_bar+="█"; done
        for ((i=filled; i<50; i++)); do progress_bar+="░"; done
        
        # Print the progress bar with percentage and counts
        printf "\r${CYAN}%s${NC} [%s] %d%% (%d/%d)" "$operation" "$progress_bar" "$percent" "$current" "$total"
    fi
}

/**
 * Calculates a content hash for a file with special handling for different file types
 * For markdown files, normalizes whitespace before hashing to improve deduplication
 *
 * @param {string} file - Path to the file to hash
 * @param {string} [hash_type=sha256] - Hash algorithm to use (sha256, md5, etc.)
 * @return {string} - The calculated hash or "invalid_file" if file doesn't exist
 *
 * @example
 * hash=$(calculate_content_hash "document.md")
 * hash=$(calculate_content_hash "image.jpg" "md5")
 */
calculate_content_hash() {
    local file="$1"
    local hash_type="${2:-sha256}"
    
    if [[ -f "$file" ]]; then
        # Use different hashing based on file type
        if [[ "$file" == *.md ]]; then
            # For markdown files, normalize whitespace and calculate hash
            # This improves deduplication by ignoring insignificant whitespace differences
            sed 's/[[:space:]]*$//' "$file" | sed '/^$/d' | $hash_type"sum" | cut -d' ' -f1
        else
            # For other files, use regular hash
            $hash_type"sum" "$file" | cut -d' ' -f1
        fi
    else
        echo "invalid_file"
    fi
}

/**
 * Checks if a file was recently processed based on the incremental threshold
 * Used to skip unchanged files for faster processing
 *
 * @param {string} file - Path to the file to check
 * @return {boolean} - Returns 0 (true) if recently processed, 1 (false) otherwise
 *
 * @example
 * if is_recently_processed "document.md"; then
 *     echo "Skipping recently processed file"
 * fi
 */
is_recently_processed() {
    local file="$1"
    local file_timestamp=$(stat -f %m "$file" 2>/dev/null || echo 0)
    local current_time=$(date +%s)
    
    if [[ "$ENABLE_INCREMENTAL_PROCESSING" == "true" ]]; then
        # Check if file exists in processed database
        if grep -q "^${file}|" "$PROCESSED_FILES_DB" 2>/dev/null; then
            local db_timestamp=$(grep "^${file}|" "$PROCESSED_FILES_DB" | cut -d'|' -f3)
            local time_diff=$((current_time - db_timestamp))
            
            # If file hasn't changed and was processed recently, skip it
            if [[ $time_diff -lt $INCREMENTAL_THRESHOLD ]]; then
                local db_file_timestamp=$(grep "^${file}|" "$PROCESSED_FILES_DB" | cut -d'|' -f4)
                if [[ "$file_timestamp" == "$db_file_timestamp" ]]; then
                    return 0  # Recently processed
                fi
            fi
        fi
    fi
    
    return 1  # Not recently processed
}

/**
 * Updates the processed files database with information about a processed file
 * Maintains a record of processed files for incremental processing
 *
 * @param {string} file - Path to the processed file
 * @param {string} hash - Content hash of the file
 * @param {string} category - Category assigned to the file
 * @return {void}
 *
 * @example
 * update_processed_db "document.md" "a1b2c3..." "Research Papers"
 */
update_processed_db() {
    local file="$1"
    local hash="$2"
    local category="$3"
    local timestamp=$(date +%s)
    local file_timestamp=$(stat -f %m "$file" 2>/dev/null || echo 0)
    
    # Remove old entry if exists
    if [[ -f "$PROCESSED_FILES_DB" ]]; then
        grep -v "^${file}|" "$PROCESSED_FILES_DB" > "$PROCESSED_FILES_DB.tmp" 2>/dev/null || true
        mv "$PROCESSED_FILES_DB.tmp" "$PROCESSED_FILES_DB"
    fi
    
    # Add new entry with format: filepath|hash|timestamp|category|file_timestamp
    echo "${file}|${hash}|${timestamp}|${category}|${file_timestamp}" >> "$PROCESSED_FILES_DB"
}

/**
 * Validates and creates the required folder structure for document organization
 * Creates missing directories based on the selected categorization scheme
 *
 * @param {string} base_dir - Base directory where the folder structure should exist
 * @return {number} - Returns 0 on success, 1 on failure
 *
 * @example
 * validate_folder_structure "/path/to/documents"
 */
validate_folder_structure() {
    local base_dir="$1"
    log "${BLUE}🔍 Validating folder structure in: $base_dir${NC}"
    
    # Check if base directory exists
    if [[ ! -d "$base_dir" ]]; then
        log "${RED}⚠️  Directory not found: $base_dir${NC}"
        return 1
    }
    
    local required_structure=()
    
    # Use simplified structure if enabled
    if [[ "$ENABLE_SIMPLIFIED_CATEGORIZATION" == "true" ]]; then
        # Simplified 5-category structure
        # This structure provides a balance between organization and simplicity
        required_structure=(
            "🤖 AI & ML"                # Artificial Intelligence and Machine Learning content
            "📚 Research Papers"        # Academic and research papers
            "🌐 Web Content"            # Articles, guides, and web-saved content
            "📝 Notes & Drafts"         # Personal notes and draft documents
            "💻 Development"            # Programming and development resources
            "🗄️ Archives/Duplicates"    # Storage for identified duplicate files
            "🗄️ Archives/Legacy"        # Storage for outdated or replaced files
            "🗄️ Archives/Quarantine"    # Storage for potentially problematic files
        )
        
        # Add Inbox folder to each sync location
        # Inbox folders serve as temporary storage for new files before categorization
        for inbox_path in "${INBOX_LOCATIONS[@]}"; do
            if [[ ! -d "$inbox_path" ]]; then
                log "${YELLOW}📂 Creating Inbox folder: $inbox_path${NC}"
                mkdir -p "$inbox_path"
            fi
        fi
        
        # Add custom categories if they exist
        # Custom categories allow users to extend the organization system
        if [[ -f "$CUSTOM_CATEGORIES_FILE" ]]; then
            while IFS='|' read -r cat_name cat_emoji cat_keywords cat_date; do
                if [[ -n "$cat_name" && -n "$cat_emoji" ]]; then
                    required_structure+=("$cat_emoji $cat_name")
                fi
            done < "$CUSTOM_CATEGORIES_FILE"
        fi
    else
        # Enhanced folder structure with more granular categories (legacy)
        # This structure provides detailed organization for specific use cases
        required_structure=(
            "📚 Research Papers/AI_ML"
            "📚 Research Papers/Physics"
            "📚 Research Papers/Neuroscience"
            "📚 Research Papers/Mathematics"
            "📚 Research Papers/Computer_Science"
            "📚 Research Papers/Biology"
            "🤖 AI & ML/Agents"
            "🤖 AI & ML/Transformers"
            "🤖 AI & ML/Neural_Networks"
            "🤖 AI & ML/LLMs"
            "🤖 AI & ML/Tools_Frameworks"
            "🤖 AI & ML/Reinforcement_Learning"
            "🤖 AI & ML/Computer_Vision"
            "🤖 AI & ML/NLP"
            "🤖 AI & ML/MLOps"
            "💻 Development/APIs"
            "💻 Development/Kubernetes"
            "💻 Development/Git"
            "💻 Development/Documentation"
            "💻 Development/Databases"
            "💻 Development/Frontend"
            "💻 Development/Backend"
            "💻 Development/DevOps"
            "🌐 Web Content/Articles"
            "🌐 Web Content/Tutorials"
            "🌐 Web Content/Guides"
            "🌐 Web Content/News"
            "🌐 Web Content/Netclips"
            "📝 Notes & Drafts/Daily_Notes"
            "📝 Notes & Drafts/Literature_Notes"
            "📝 Notes & Drafts/Untitled"
            "📝 Notes & Drafts/Meeting_Notes"
            "📝 Notes & Drafts/Ideas"
            "🗄️ Archives/Duplicates"
            "🗄️ Archives/Legacy"
            "🗄️ Archives/Quarantine"
            "🔬 Projects/Active"
            "🔬 Projects/Completed"
            "🔬 Projects/Ideas"
            "📊 Data/Datasets"
            "📊 Data/Analysis"
            "📊 Data/Visualizations"
        )
    fi
    
    local missing_dirs=()
    local created_dirs=0
    
    # Check for missing directories and track them
    for dir in "${required_structure[@]}"; do
        if [[ ! -d "$base_dir/$dir" ]]; then
            missing_dirs+=("$dir")
        fi
    done
    
    # Create any missing directories
    if [[ ${#missing_dirs[@]} -gt 0 ]]; then
        log "${YELLOW}📂 Creating missing directories:${NC}"
        for dir in "${missing_dirs[@]}"; do
            log "${GREEN}   + $dir${NC}"
            mkdir -p "$base_dir/$dir"
            ((created_dirs++))
        done
        log "${GREEN}✅ Created $created_dirs directories${NC}"
    else
        log "${GREEN}✅ Folder structure is complete${NC}"
    fi
}

/**
 * Checks file integrity to identify potential issues
 * Validates file existence, readability, size, encoding, and content
 *
 * @param {string} file - Path to the file to check
 * @return {number} - Returns 0 if file passes all checks, 1 if issues found
 *
 * @example
 * if ! check_file_integrity "document.md"; then
 *     log "File integrity check failed"
 * fi
 */
check_file_integrity() {
    local file="$1"
    local issues=()
    
    # Check if file exists and is readable
    if [[ ! -f "$file" ]]; then
        issues+=("File not found")
        return 1
    fi
    
    if [[ ! -r "$file" ]]; then
        issues+=("File not readable")
        return 1
    fi
    
    # Check minimum file size
    # Files that are too small are often corrupted or empty
    local size=$(wc -c < "$file" 2>/dev/null || echo 0)
    if [[ $size -lt $MIN_FILE_SIZE ]]; then
        issues+=("File too small ($size bytes)")
        return 1
    fi
    
    # Check for binary content in text files
    # Text files should not contain binary data
    if [[ "$file" == *.md || "$file" == *.txt ]]; then
        if file "$file" | grep -q "binary"; then
            issues+=("Binary content in text file")
            return 1
        fi
    fi
    
    # Check for corrupted UTF-8 encoding
    # Markdown files should use valid UTF-8 encoding
    if [[ "$file" == *.md ]]; then
        if ! iconv -f utf-8 -t utf-8 "$file" >/dev/null 2>&1; then
            issues+=("Invalid UTF-8 encoding")
            return 1
        fi
    fi
    
    # Check for extremely long lines (potential corruption)
    # Extremely long lines often indicate file corruption or binary content
    if [[ "$file" == *.md ]]; then
        local max_line_length=$(awk 'length > max_length { max_length = length } END { print max_length }' "$file" 2>/dev/null || echo 0)
        if [[ $max_line_length -gt 10000 ]]; then
            issues+=("Extremely long line detected ($max_line_length chars)")
            return 1
        fi
    fi
    
    return 0
}

/**
 * Displays usage information and available commands
 * Provides help text for the module's command-line interface
 *
 * @return {void}
 *
 * @example
 * show_usage
 */
show_usage() {
    cat << EOF
Usage: $(basename "$0") [command] [options]

Commands:
  run                Run document organization
  dry-run            Test organization without making changes
  status             Check system status
  create-category    Create a new custom category
  process-inbox      Process files in Inbox folders

Options:
  --source DIR       Specify source directory (default: $SOURCE_DIR)
  --force            Force organization even if there are sync inconsistencies

Examples:
  $(basename "$0") run
  $(basename "$0") dry-run
  $(basename "$0") status
  $(basename "$0") create-category "Data Science" "📊" "data science,machine learning,statistics"
  $(basename "$0") process-inbox
EOF
}

/**
 * Main function that processes command-line arguments and executes commands
 * Entry point for the module's functionality
 *
 * @param {string[]} args - Command-line arguments
 * @return {number} - Exit code (0 for success, non-zero for errors)
 *
 * @example
 * main "run" "--source" "/path/to/documents"
 */
main() {
    if [[ "$#" -eq 0 ]]; then
        show_usage
        exit 1
    fi
    
    local command="$1"
    shift
    
    case "$command" in
        run)
            log "Running organization..."
            # Call the organization function here
            ;;
        dry-run)
            log "Running organization in dry-run mode..."
            # Call the organization function with dry-run flag
            ;;
        status)
            log "Checking system status..."
            # Call the status function
            ;;
        create-category)
            if [[ "$#" -lt 3 ]]; then
                log "${RED}❌ Missing parameters. Usage: create-category NAME EMOJI KEYWORDS${NC}"
                exit 1
            fi
            log "Creating new category: $1 $2"
            # Call the create category function
            ;;
        process-inbox)
            log "Processing inbox folders..."
            # Call the process inbox function
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