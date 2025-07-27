#!/bin/bash

# ============================================================================
# ENHANCED ORGANIZE MODULE WITH AI-POWERED CONTENT ANALYSIS
# ============================================================================
# Advanced document organization with duplicate detection, content consolidation,
# and extensible category system

set -euo pipefail

# Get script directory and parent
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load configuration with validation
CONFIG_FILE="$PROJECT_DIR/../config/config.env"
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "❌ Configuration file not found: $CONFIG_FILE"
    echo "💡 Run system validation: node $PROJECT_DIR/startup_validator.js"
    exit 1
fi

source "$CONFIG_FILE"

# Validate critical configuration variables
validate_config() {
    local missing_vars=()
    
    if [[ -z "${SYNC_HUB:-}" ]]; then
        missing_vars+=("SYNC_HUB")
    fi
    
    if [[ -z "${LOG_LEVEL:-}" ]]; then
        LOG_LEVEL="INFO"
    fi
    
    if [[ -z "${LOG_TO_CONSOLE:-}" ]]; then
        LOG_TO_CONSOLE="true"
    fi
    
    if [[ -z "${LOG_TO_FILE:-}" ]]; then
        LOG_TO_FILE="true"
    fi
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        echo "❌ Missing required configuration variables: ${missing_vars[*]}"
        echo "💡 Run system validation: node $PROJECT_DIR/startup_validator.js"
        exit 1
    fi
}

# Run configuration validation
validate_config

# Advanced features configuration
ENABLE_DUPLICATE_DETECTION="${ENABLE_DUPLICATE_DETECTION:-true}"
ENABLE_CONTENT_CONSOLIDATION="${ENABLE_CONTENT_CONSOLIDATION:-true}"
ENABLE_AI_ENHANCEMENT="${ENABLE_AI_ENHANCEMENT:-false}"
ENABLE_CATEGORY_SUGGESTIONS="${ENABLE_CATEGORY_SUGGESTIONS:-true}"
SIMILARITY_THRESHOLD="${SIMILARITY_THRESHOLD:-0.8}"
MIN_CONSOLIDATION_FILES="${MIN_CONSOLIDATION_FILES:-2}"

# Enhanced logging function with error context
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local hostname=$(hostname)
    local pid=$$
    
    # Create structured log entry
    local log_entry="[$timestamp] [$level] [organize_module] [PID:$pid] [HOST:$hostname] $message"
    
    # Console logging with color coding
    if [[ "$LOG_TO_CONSOLE" == "true" ]]; then
        case "$level" in
            "ERROR"|"FATAL")
                echo -e "\033[31m$log_entry\033[0m" >&2  # Red for errors
                ;;
            "WARN")
                echo -e "\033[33m$log_entry\033[0m" >&2  # Yellow for warnings
                ;;
            "INFO")
                echo -e "\033[32m$log_entry\033[0m"      # Green for info
                ;;
            "DEBUG")
                if [[ "${DEBUG:-false}" == "true" ]]; then
                    echo -e "\033[36m$log_entry\033[0m"  # Cyan for debug
                fi
                ;;
            *)
                echo "$log_entry"
                ;;
        esac
    fi
    
    # File logging with JSON structure for better parsing
    if [[ "$LOG_TO_FILE" == "true" ]]; then
        mkdir -p "$PROJECT_DIR/logs"
        local json_log="{\"timestamp\":\"$timestamp\",\"level\":\"$level\",\"component\":\"organize_module\",\"pid\":$pid,\"hostname\":\"$hostname\",\"message\":\"$message\"}"
        echo "$json_log" >> "$PROJECT_DIR/logs/organize.log"
    fi
}

# Error handling function
handle_error() {
    local error_code="$1"
    local error_message="$2"
    local context="$3"
    local operation="${4:-unknown}"
    
    log "ERROR" "Operation failed: $operation | Error: $error_message | Context: $context | Exit Code: $error_code"
    
    # Determine recovery strategy based on error type
    case "$error_code" in
        1)
            log "INFO" "General error - attempting to continue with fallback behavior"
            return 0  # Continue execution
            ;;
        2)
            log "WARN" "File not found error - skipping operation"
            return 0  # Continue execution
            ;;
        126|127)
            log "FATAL" "Command not found or not executable - cannot continue"
            return 1  # Stop execution
            ;;
        130)
            log "INFO" "Operation interrupted by user - stopping gracefully"
            return 1  # Stop execution
            ;;
        *)
            log "WARN" "Unknown error code - attempting to continue"
            return 0  # Continue execution
            ;;
    esac
}

# Async operation wrapper with timeout and retry
run_with_retry() {
    local max_attempts="${1:-3}"
    local delay="${2:-2}"
    local timeout="${3:-30}"
    shift 3
    local command="$*"
    
    local attempt=1
    while [[ $attempt -le $max_attempts ]]; do
        log "DEBUG" "Attempt $attempt/$max_attempts: $command"
        
        if timeout "$timeout" bash -c "$command"; then
            log "DEBUG" "Command succeeded on attempt $attempt"
            return 0
        else
            local exit_code=$?
            log "WARN" "Command failed on attempt $attempt with exit code $exit_code"
            
            if [[ $attempt -eq $max_attempts ]]; then
                handle_error "$exit_code" "Command failed after $max_attempts attempts" "$command" "run_with_retry"
                return $exit_code
            fi
            
            log "INFO" "Retrying in ${delay}s..."
            sleep "$delay"
            ((attempt++))
            delay=$((delay * 2))  # Exponential backoff
        fi
    done
}

# Validate and ensure config file exists with comprehensive error handling
validate_config_file() {
    local config_path="$PROJECT_DIR/../config/organize_config.conf"
    local config_dir="$PROJECT_DIR/../config"
    
    log "DEBUG" "Validating configuration file setup" "config_path=$config_path"
    
    # Ensure config directory exists
    if [[ ! -d "$config_dir" ]]; then
        log "INFO" "Creating config directory: $config_dir"
        if ! mkdir -p "$config_dir" 2>/dev/null; then
            handle_error $? "Failed to create config directory" "$config_dir" "validate_config_file"
            return 1
        fi
    fi
    
    # Check if config directory is accessible and writable
    if [[ ! -r "$config_dir" ]]; then
        handle_error 2 "Config directory is not readable" "$config_dir" "validate_config_file"
        return 1
    fi
    
    if [[ ! -w "$config_dir" ]]; then
        handle_error 2 "Config directory is not writable" "$config_dir" "validate_config_file"
        return 1
    fi
    
    # Create default config file if it doesn't exist
    if [[ ! -f "$config_path" ]]; then
        log "INFO" "Creating default organize_config.conf at: $config_path"
        if ! create_default_config "$config_path"; then
            handle_error $? "Failed to create default config file" "$config_path" "validate_config_file"
            return 1
        fi
    else
        log "INFO" "Using existing config file: $config_path"
        
        # Validate config file is readable
        if [[ ! -r "$config_path" ]]; then
            handle_error 2 "Config file is not readable" "$config_path" "validate_config_file"
            return 1
        fi
    fi
    
    log "DEBUG" "Configuration file validation completed successfully"
    return 0
}

# Create default configuration file
create_default_config() {
    local config_path="$1"
    
    cat > "$config_path" << 'EOF'
# Enhanced Document Organization Configuration
# This file contains settings for the document organization system

# General Settings
[general]
similarity_threshold = 0.8
min_consolidation_files = 2
enable_duplicate_detection = true
enable_content_consolidation = true
enable_ai_enhancement = false
enable_category_suggestions = true

# Default Categories
# These are built-in categories that cannot be modified
# Custom categories can be added in the "Custom Categories" section below

# Custom Categories
# Add your custom categories here using the format:
# [category.your_category_id]
# name = "Your Category Name"
# icon = "📂"
# description = "Description of your category"
# keywords = ["keyword1", "keyword2", "keyword3"]
# file_patterns = ["*pattern*", "*.ext"]
# priority = 5
# auto_detect = true
# created_by = "user"
# created_at = "2024-01-01T00:00:00.000Z"

EOF
    
    log "INFO" "Default configuration file created successfully"
}

# Main organization function with advanced features
organize_documents() {
    local source_dir="$1"
    local dry_run="${2:-false}"
    
    log "INFO" "Starting enhanced organization process"
    log "INFO" "Source directory: $source_dir"
    log "INFO" "Dry run mode: $dry_run"
    log "INFO" "Duplicate detection: $ENABLE_DUPLICATE_DETECTION"
    log "INFO" "Content consolidation: $ENABLE_CONTENT_CONSOLIDATION"
    log "INFO" "AI enhancement: $ENABLE_AI_ENHANCEMENT"
    
    # Validate config file exists and is accessible
    if ! validate_config_file; then
        log "ERROR" "Failed to validate configuration file"
        return 1
    fi
    
    # Ensure category directories exist
    setup_category_structure "$source_dir"
    
    # Get list of files to process
    local files_to_process=()
    while IFS= read -r -d '' file; do
        if [[ -f "$file" && ! "$file" =~ /\. && ! "$file" =~ _category_info\.md$ ]]; then
            files_to_process+=("$file")
        fi
    done < <(find "$source_dir" -maxdepth 3 -type f -print0)
    
    if [[ ${#files_to_process[@]} -eq 0 ]]; then
        log "INFO" "No files to process"
        return 0
    fi
    
    log "INFO" "Found ${#files_to_process[@]} files to process"
    
    # Step 1: Analyze content for duplicates and consolidation opportunities
    local analysis_results="/tmp/content_analysis_results.json"
    local duplicates_found="/tmp/duplicates_found.json"
    local consolidation_candidates="/tmp/consolidation_candidates.json"
    
    if [[ "$ENABLE_DUPLICATE_DETECTION" == "true" || "$ENABLE_CONTENT_CONSOLIDATION" == "true" ]]; then
        log "INFO" "Running content analysis..."
        run_content_analysis "${files_to_process[@]}" "$analysis_results" "$duplicates_found" "$consolidation_candidates"
    fi
    
    # Step 2: Handle duplicates
    if [[ "$ENABLE_DUPLICATE_DETECTION" == "true" && -f "$duplicates_found" ]]; then
        log "INFO" "Processing duplicates..."
        process_duplicates "$duplicates_found" "$dry_run"
    fi
    
    # Step 3: Handle content consolidation
    if [[ "$ENABLE_CONTENT_CONSOLIDATION" == "true" && -f "$consolidation_candidates" ]]; then
        log "INFO" "Processing consolidation candidates..."
        process_consolidation_candidates "$consolidation_candidates" "$dry_run"
    fi
    
    # Step 4: Organize remaining files
    log "INFO" "Organizing remaining files..."
    organize_remaining_files "$source_dir" "$dry_run"
    
    # Step 5: Check for category suggestions
    if [[ "$ENABLE_CATEGORY_SUGGESTIONS" == "true" ]]; then
        log "INFO" "Checking for category suggestions..."
        check_category_suggestions "$source_dir"
    fi
    
    # Cleanup temporary files
    rm -f "$analysis_results" "$duplicates_found" "$consolidation_candidates"
    
    log "INFO" "Enhanced organization process completed"
}

# Setup category structure with extensible system
setup_category_structure() {
    local base_dir="$1"
    
    # Create category directories using environment variables with defaults
    local categories=(
        "${CATEGORY_AI_ML:-AI & ML}"
        "${CATEGORY_RESEARCH:-Research Papers}"
        "${CATEGORY_WEB:-Web Content}"
        "${CATEGORY_NOTES:-Notes & Drafts}"
        "${CATEGORY_DEV:-Development}"
    )
    
    for category in "${categories[@]}"; do
        local category_dir="$base_dir/$category"
        if [[ ! -d "$category_dir" ]]; then
            mkdir -p "$category_dir"
            log "INFO" "Created category folder: $category"
            
            # Create category info file
            cat > "$category_dir/_category_info.md" << EOF
# $category

This folder contains documents related to $category.

## Category Guidelines
- Files in this category should be relevant to: $category
- Content is automatically organized based on content analysis
- Manual organization is also supported

Last updated: $(date)
EOF
        fi
    done
    
    log "INFO" "Category structure setup complete"
}

# Run content analysis using Node.js modules with comprehensive error handling
run_content_analysis() {
    # Get the last 3 arguments which are the output file paths
    local analysis_results="${!#}"           # Last argument
    local consolidation_candidates="${@: -2:1}"  # Second to last
    local duplicates_found="${@: -3:1}"      # Third to last
    
    # Get all arguments except the last 3 as the file list
    local total_args=$#
    local file_count=$((total_args - 3))
    local file_list=("${@:1:$file_count}")
    
    log "INFO" "Starting content analysis for ${#file_list[@]} files"
    
    # Validate input parameters
    if [[ ${#file_list[@]} -eq 0 ]]; then
        handle_error 1 "No files provided for analysis" "file_count=0" "run_content_analysis"
        return 1
    fi
    
    # Create file list for Node.js with proper escaping and validation
    local file_list_json="["
    local valid_files=0
    
    for file in "${file_list[@]}"; do
        # Validate file exists and is readable
        if [[ ! -f "$file" ]]; then
            log "WARN" "Skipping non-existent file: $file"
            continue
        fi
        
        if [[ ! -r "$file" ]]; then
            log "WARN" "Skipping unreadable file: $file"
            continue
        fi
        
        # Properly escape file paths for JSON
        local escaped_file=$(printf '%s' "$file" | sed 's/\\/\\\\/g; s/"/\\"/g')
        file_list_json+='"'$escaped_file'",'
        ((valid_files++))
    done
    
    file_list_json="${file_list_json%,}]"
    
    if [[ $valid_files -eq 0 ]]; then
        log "WARN" "No valid files found for analysis, creating empty results"
        echo "[]" > "$duplicates_found"
        echo "[]" > "$consolidation_candidates"
        return 0
    fi
    
    log "DEBUG" "Processing $valid_files valid files for analysis"
    
    # Run duplicate analysis with retry and timeout
    log "INFO" "Running duplicate detection analysis..."
    if ! run_with_retry 2 3 60 "
        PROJECT_ROOT='$PROJECT_DIR/..' \
        SIMILARITY_THRESHOLD='$SIMILARITY_THRESHOLD' \
        FILE_LIST_JSON='$file_list_json' \
        DUPLICATES_FOUND='$duplicates_found' \
        node '$PROJECT_DIR/organize/batch_processor.js' duplicates
    "; then
        log "ERROR" "Duplicate analysis failed after retries, using empty results"
        echo "[]" > "$duplicates_found"
    else
        log "INFO" "Duplicate analysis completed successfully"
    fi
    
    # Run consolidation analysis with retry and timeout
    log "INFO" "Running consolidation analysis..."
    if ! run_with_retry 2 3 60 "
        PROJECT_ROOT='$PROJECT_DIR/..' \
        SIMILARITY_THRESHOLD='$SIMILARITY_THRESHOLD' \
        FILE_LIST_JSON='$file_list_json' \
        CONSOLIDATION_CANDIDATES='$consolidation_candidates' \
        node '$PROJECT_DIR/organize/batch_processor.js' consolidation
    "; then
        log "ERROR" "Consolidation analysis failed after retries, using empty results"
        echo "[]" > "$consolidation_candidates"
    else
        log "INFO" "Consolidation analysis completed successfully"
    fi
    
    # Validate output files were created
    for output_file in "$duplicates_found" "$consolidation_candidates"; do
        if [[ ! -f "$output_file" ]]; then
            log "WARN" "Output file not created, creating empty file: $output_file"
            echo "[]" > "$output_file"
        elif [[ ! -s "$output_file" ]]; then
            log "DEBUG" "Output file is empty: $output_file"
        fi
    done
    
    log "INFO" "Content analysis completed"
    return 0
}

# Process duplicate files
process_duplicates() {
    local duplicates_file="$1"
    local dry_run="$2"
    
    if [[ ! -f "$duplicates_file" ]]; then
        log "INFO" "No duplicates file found: $duplicates_file"
        return 0
    fi

    log "INFO" "Processing duplicates from $duplicates_file (dry_run: $dry_run)"

    local processed_count=0
    local deleted_count=0

    # Read duplicates from the JSON file
    local duplicates_json=$(cat "$duplicates_file")
    local duplicate_groups=$(echo "$duplicates_json" | jq -c '.[]')

    for group in $duplicate_groups; do
        local files_in_group=$(echo "$group" | jq -r '.files[]')
        local recommended_action=$(echo "$group" | jq -r '.recommended_action')
        local group_type=$(echo "$group" | jq -r '.type')

        log "INFO" "Duplicate group ($group_type): $files_in_group"
        log "INFO" "Recommended action: $recommended_action"

        if [[ "$recommended_action" == "delete_duplicates" ]]; then
            # Keep the first file, delete the rest
            local keep_file=$(echo "$files_in_group" | head -n 1)
            local files_to_delete=$(echo "$files_in_group" | tail -n +2)

            for file_to_delete in $files_to_delete; do
                if [[ "$dry_run" == "true" ]]; then
                    log "INFO" "DRY RUN: Would delete duplicate file: $file_to_delete (keeping $keep_file)"
                else
                    if [[ -f "$file_to_delete" ]]; then
                        log "INFO" "Deleting duplicate file: $file_to_delete (keeping $keep_file)"
                        rm "$file_to_delete"
                        ((deleted_count++))
                    else
                        log "WARN" "Duplicate file not found, skipping: $file_to_delete"
                    fi
                fi
                ((processed_count++))
            done
        else
            log "INFO" "No action taken for this duplicate group (action: $recommended_action)"
        fi
    done

    log "INFO" "Processed $processed_count duplicate files, deleted $deleted_count files"
}

# Process content consolidation candidates with improved error handling
process_consolidation_candidates() {
    local candidates_file="$1"
    local dry_run="$2"
    
    if [[ ! -f "$candidates_file" ]]; then
        log "INFO" "No consolidation candidates file found: $candidates_file"
        return 0
    fi
    
    # Check if file is valid JSON and has content
    local candidate_count=0
    if command -v jq >/dev/null 2>&1; then
        candidate_count=$(jq 'length' "$candidates_file" 2>/dev/null || echo "0")
    else
        # Fallback method without jq
        candidate_count=$(node -e "
            try {
                const fs = require('fs');
                const candidates = JSON.parse(fs.readFileSync('$candidates_file', 'utf-8'));
                console.log(Array.isArray(candidates) ? candidates.length : Object.keys(candidates).length);
            } catch (error) {
                console.log('0');
            }
        " 2>/dev/null || echo "0")
    fi
    
    if [[ "$candidate_count" -gt 0 ]]; then
        log "INFO" "Processing $candidate_count consolidation candidates"
        
        if [[ "$dry_run" == "true" ]]; then
            log "INFO" "DRY RUN: Would consolidate the following content groups:"
            node -e "
                try {
                    const fs = require('fs');
                    const candidates = JSON.parse(fs.readFileSync('$candidates_file', 'utf-8'));
                    
                    // Handle both array and object formats
                    const candidateEntries = Array.isArray(candidates) ? candidates : Object.entries(candidates);
                    
                    for (const [topic, candidate] of candidateEntries) {
                        if (candidate && candidate.files) {
                            console.log(\`Topic: \${topic} (\${candidate.files.length} files, similarity: \${(candidate.avgSimilarity || 0).toFixed(2)})\`);
                            console.log(\`  Title: \${candidate.recommendedTitle || 'N/A'}\`);
                            console.log(\`  Strategy: \${candidate.consolidationStrategy || 'simple_merge'}\`);
                            console.log(\`  Files: \${candidate.files.map(f => f.filePath || f).join(', ')}\`);
                            console.log('');
                        }
                    }
                } catch (error) {
                    console.error('Failed to process consolidation candidates:', error.message);
                }
            " 2>/dev/null || log "WARN" "Failed to display consolidation preview"
        else
            # Actually perform consolidation using batch processor
            log "INFO" "Performing content consolidation..."
            
            node -e "
                import BatchProcessor from '$PROJECT_DIR/organize/batch_processor.js';
                import { promises as fs } from 'fs';
                
                async function consolidateContent() {
                    try {
                        const processor = new BatchProcessor({
                            projectRoot: '$PROJECT_DIR/..'
                        });
                        
                        const candidates = JSON.parse(await fs.readFile('$candidates_file', 'utf8'));
                        const candidateEntries = Array.isArray(candidates) ? candidates : Object.entries(candidates);
                        
                        for (const [topic, candidate] of candidateEntries) {
                            if (candidate && candidate.files && candidate.files.length >= $MIN_CONSOLIDATION_FILES) {
                                console.log(\`Consolidating topic: \${topic}\`);
                                try {
                                    const result = await processor.consolidateContent(candidate, {
                                        syncHubPath: '$SYNC_HUB',
                                        aiService: '$ENABLE_AI_ENHANCEMENT' === 'true' ? 'local' : 'none',
                                        enhanceContent: '$ENABLE_AI_ENHANCEMENT' === 'true'
                                    });
                                    console.log(\`Created: \${result.consolidatedDocument}\`);
                                } catch (error) {
                                    console.error(\`Failed to consolidate \${topic}: \${error.message}\`);
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Consolidation process failed:', error.message);
                    }
                }
                
                consolidateContent().catch(console.error);
            " 2>/dev/null || log "WARN" "Content consolidation failed, continuing with organization"
        fi
    else
        log "INFO" "No consolidation candidates found"
    fi
}

# Organize remaining files using traditional + enhanced categorization
organize_remaining_files() {
    local source_dir_param="$1"
    local dry_run="$2"

    local source_dir="$source_dir_param"
    
    local processed_count=0
    local moved_count=0
    
    # Process files in Inbox and root directory
    while IFS= read -r -d '' file; do
        # Skip already processed files (in category folders)
        if [[ "$file" =~ /"${CATEGORY_AI_ML:-AI & ML}"|/"${CATEGORY_RESEARCH:-Research Papers}"|/"${CATEGORY_WEB:-Web Content}"|/"${CATEGORY_NOTES:-Notes & Drafts}"|/"${CATEGORY_DEV:-Development}" ]]; then
            continue
        fi
        
        # Skip hidden files and category info files
        if [[ "$(basename "$file")" =~ ^\. ]] || [[ "$(basename "$file")" =~ _category_info\.md$ ]]; then
            continue
        fi
        
        local category=$(get_file_category_enhanced "$file")
    local category_dir="$source_dir/$category"
        
        ensure_directory "$category_dir"
        
        local filename=$(basename "$file")
        local target_path="$category_dir/$filename"
        
        # Handle filename conflicts
        if [[ -e "$target_path" && "$target_path" != "$file" ]]; then
            local base_name="${filename%.*}"
            local extension="${filename##*.}"
            local counter=1
            
            while [[ -e "$category_dir/${base_name}_${counter}.${extension}" ]]; do
                ((counter++))
            done
            
            target_path="$category_dir/${base_name}_${counter}.${extension}"
            filename="${base_name}_${counter}.${extension}"
        fi
        
        if [[ "$target_path" != "$file" ]]; then
            if [[ "$dry_run" == "true" ]]; then
                log "INFO" "DRY RUN: Would move $file -> $target_path"
            else
                log "INFO" "Moved: $file -> $target_path"
                mv "$file" "$target_path"
                ((moved_count++))
            fi
        fi
        
        ((processed_count++))
        
    done < <(find "$source_dir" -maxdepth 2 -type f \( -path "*/Inbox/*" -o -path "$source_dir/*" \) -print0)
    
    log "INFO" "Processed $processed_count files, moved $moved_count files"
}

# Enhanced category detection using the batch processor
get_file_category_enhanced() {
    local file="$1"
    
    # Use batch processor for enhanced categorization with error handling
    local category=$(node "$PROJECT_DIR/organize/batch_processor.js" categorize 2>/dev/null \
        PROJECT_ROOT="$PROJECT_DIR/.." \
        CONFIG_PATH="$PROJECT_DIR/../config/organize_config.conf" \
        FILE_LIST_JSON='["'$(printf '%s' "$file" | sed 's/\\/\\\\/g; s/"/\\"/g')'"]' | \
        jq -r '.[0].category' 2>/dev/null || echo "")
    
    # Fallback to simple categorization if batch processing fails
    if [[ -z "$category" || "$category" == "null" ]]; then
        category=$(get_file_category_simple "$file")
    fi
    
    echo "${category:-${CATEGORY_NOTES:-Notes & Drafts}}"
}

# Check for category suggestions based on unmatched content with improved error handling
check_category_suggestions() {
    local source_dir_param="$1"
    local source_dir="$source_dir_param"
    log "DEBUG" "check_category_suggestions: source_dir is $source_dir"
    
    log "INFO" "Analyzing content for potential new categories..."
    
    # Use a more robust approach with the batch processor
    node -e "
        import BatchProcessor from '$PROJECT_DIR/organize/batch_processor.js';
        import { promises as fs } from 'fs';
        import path from 'path';
        
        async function checkSuggestions() {
            try {
                const processor = new BatchProcessor({
                    projectRoot: '$PROJECT_DIR/..'
                });
                
                await processor.initialize();
                
                // Find all files in categories
                const allFiles = [];
                const categories = ['AI & ML', 'Research Papers', 'Web Content', 'Notes & Drafts', 'Development'];
                
                const sourceDir = '$source_dir';
                if (!sourceDir) {
                    console.log('No source directory provided for category suggestions');
                    return;
                }
                
                for (const category of categories) {
                    const categoryPath = path.join(sourceDir, category);
                    try {
                        const files = await fs.readdir(categoryPath);
                        for (const file of files) {
                            const filePath = path.join(categoryPath, file);
                            try {
                                const stat = await fs.stat(filePath);
                                if (stat.isFile() && !file.startsWith('.') && !file.includes('_category_info')) {
                                    allFiles.push(filePath);
                                }
                            } catch (e) {
                                // Skip files that can't be accessed
                            }
                        }
                    } catch (e) {
                        // Skip categories that don't exist
                    }
                }
                
                if (allFiles.length === 0) {
                    console.log('No files found for category analysis');
                    return;
                }
                
                // Categorize files to find poorly matched ones
                const results = await processor.categorizeFiles(allFiles, {
                    configPath: '$PROJECT_DIR/../config/organize_config.conf'
                });
                
                const poorlyMatched = results.filter(r => r.confidence < 0.5);
                
                if (poorlyMatched.length >= 3) {
                    console.log(\`Found \${poorlyMatched.length} files that might benefit from a new category\`);
                    console.log('Files with low categorization confidence:');
                    poorlyMatched.slice(0, 5).forEach(file => {
                        console.log(\`  - \${path.basename(file.filePath)} (confidence: \${(file.confidence * 100).toFixed(1)}%)\`);
                    });
                    console.log('');
                    console.log('Consider creating a new category for these files or reviewing the existing category definitions.');
                } else {
                    console.log('No new category suggestions at this time');
                }
                
            } catch (error) {
                console.error('Error in category suggestions:', error.message);
                console.log('No category suggestions available due to error');
            }
        }
        
        checkSuggestions().catch(error => {
            console.error('Failed to check category suggestions:', error.message);
        });
    " 2>/dev/null || log "WARN" "Category suggestions analysis failed"
}

# Utility functions
ensure_directory() {
    local dir="$1"
    if [[ ! -d "$dir" ]]; then
        log "INFO" "Creating directory: $dir"
        mkdir -p "$dir"
    fi
}

# Legacy simple categorization (fallback)
get_file_category_simple() {
    local file="$1"
    local filename=$(basename "$file")
    local content=""
    
    # Read file content for analysis (first few lines)
    if [[ -f "$file" && -r "$file" ]]; then
        content=$(head -n 20 "$file" 2>/dev/null || echo "")
    fi
    
    local combined_text="${filename,,} ${content,,}"
    
    # AI & ML category
    if [[ $combined_text =~ (machine.learning|artificial.intelligence|neural.network|deep.learning|tensorflow|pytorch|model|algorithm|ai|ml|data.science|jupyter) ]]; then
        echo "${CATEGORY_AI_ML:-AI & ML}"
        return
    fi
    
    # Research Papers category
    if [[ $combined_text =~ (research|paper|study|journal|arxiv|academic|publication|thesis|abstract|methodology|conclusion) ]] || [[ $filename =~ \.pdf$ ]]; then
        echo "${CATEGORY_RESEARCH:-Research Papers}"
        return
    fi
    
    # Web Content category
    if [[ $combined_text =~ (article|tutorial|guide|blog|how.to|walkthrough|tips|web|html) ]] || [[ $filename =~ \.(html|htm)$ ]]; then
        echo "${CATEGORY_WEB:-Web Content}"
        return
    fi
    
    # Development category
    if [[ $combined_text =~ (code|api|programming|development|software|technical|documentation|function|class|method) ]] || [[ $filename =~ \.(js|py|java|cpp|c|php|rb|go|rs|ts|json|yml|yaml|xml)$ ]]; then
        echo "${CATEGORY_DEV:-Development}"
        return
    fi
    
    # Default to Notes & Drafts
    echo "${CATEGORY_NOTES_DRAFTS:-Notes & Drafts}"
}

# Show usage information
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS] [SOURCE_DIR]

Enhanced Document Organization System

OPTIONS:
    -h, --help          Show this help message
    -d, --dry-run       Preview changes without executing them
    -v, --verbose       Enable verbose logging

ARGUMENTS:
    SOURCE_DIR          Directory to organize (default: \$SYNC_HUB)

EXAMPLES:
    $0                          # Organize default sync hub directory
    $0 --dry-run                # Preview organization of default directory
    $0 /path/to/docs            # Organize specific directory
    $0 --dry-run /path/to/docs  # Preview organization of specific directory
    $0 /path/to/docs --dry-run  # Alternative dry-run syntax

INTEGRATION USAGE:
    When called from drive_sync.sh or other scripts:
    $0 [SOURCE_DIR] [dry-run|true|false]

EOF
}

# Parse command line arguments
parse_arguments() {
    local source_dir=""
    local dry_run="false"
    local verbose="false"
    local show_help="false"
    
    # Handle case with no arguments
    if [[ $# -eq 0 ]]; then
        source_dir="$SYNC_HUB"
        echo "$source_dir|$dry_run|$verbose"
        return 0
    fi
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)
                show_help="true"
                shift
                ;;
            -d|--dry-run)
                dry_run="true"
                shift
                ;;
            -v|--verbose)
                verbose="true"
                shift
                ;;
            dry-run|true)
                # Legacy integration support - second argument as dry-run flag
                if [[ -n "$source_dir" ]]; then
                    dry_run="true"
                else
                    # First argument is "dry-run" - use default source dir
                    source_dir="$SYNC_HUB"
                    dry_run="true"
                fi
                shift
                ;;
            false)
                # Legacy integration support - explicit false for dry-run
                if [[ -n "$source_dir" ]]; then
                    dry_run="false"
                else
                    echo "ERROR: Invalid argument: $1" >&2
                    echo "INVALID"
                    return 1
                fi
                shift
                ;;
            -*)
                echo "ERROR: Unknown option: $1" >&2
                echo "INVALID"
                return 1
                ;;
            *)
                # Positional argument - should be source directory
                if [[ -z "$source_dir" ]]; then
                    source_dir="$1"
                else
                    echo "ERROR: Multiple source directories specified: '$source_dir' and '$1'" >&2
                    echo "INVALID"
                    return 1
                fi
                shift
                ;;
        esac
    done
    
    # Show help if requested
    if [[ "$show_help" == "true" ]]; then
        echo "HELP"
        return 0
    fi
    
    # Use default source directory if none specified
    if [[ -z "$source_dir" ]]; then
        source_dir="$SYNC_HUB"
    fi
    
    # Validate source directory
    if [[ ! -d "$source_dir" ]]; then
        echo "ERROR: Source directory does not exist: $source_dir" >&2
        echo "INVALID"
        return 1
    fi
    
    # Apply verbose setting to logging
    if [[ "$verbose" == "true" ]]; then
        export LOG_TO_CONSOLE="true"
    fi
    
    echo "$source_dir|$dry_run|$verbose"
    return 0
}

# Main execution
main() {
    # Parse arguments
    local parse_result
    parse_result=$(parse_arguments "$@")
    local parse_exit_code=$?
    
    # Handle special cases
    if [[ "$parse_result" == "HELP" ]]; then
        show_usage
        exit 0
    elif [[ "$parse_result" == "INVALID" ]] || [[ $parse_exit_code -ne 0 ]]; then
        echo ""
        echo "Error: Invalid arguments provided."
        echo ""
        show_usage
        exit 1
    fi
    
    # Extract parsed values
    IFS='|' read -r source_dir dry_run verbose <<< "$parse_result"
    
    log "INFO" "Starting organization process"
    log "INFO" "Source directory: $source_dir"
    log "INFO" "Dry run mode: $dry_run"
    log "INFO" "Verbose mode: $verbose"
    
    # Ensure dry-run mode is properly indicated in logs
    if [[ "$dry_run" == "true" ]]; then
        log "INFO" "=== DRY RUN MODE ACTIVE - NO FILES WILL BE MODIFIED ==="
    fi
    
    organize_documents "$source_dir" "$dry_run"
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
