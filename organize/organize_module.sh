#!/bin/bash

# ============================================================================
# SIMPLIFIED ORGANIZE MODULE
# ============================================================================
# Clean and simple document organization using the 5-category system

set -euo pipefail

# Get script directory and parent
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load configuration
source "$PROJECT_DIR/config.env"

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
        echo "[$timestamp] [$level] $message" >> "$PROJECT_DIR/logs/organize.log"
    fi
}

# Ensure directory exists
ensure_directory() {
    local dir="$1"
    if [[ ! -d "$dir" ]]; then
        log "INFO" "Creating directory: $dir"
        mkdir -p "$dir"
    fi
}

# Get category for file based on content and filename
get_file_category() {
    local file="$1"
    local filename=$(basename "$file")
    local content=""
    
    # Read file content for analysis (first few lines)
    if [[ -f "$file" && -r "$file" ]]; then
        content=$(head -n "$CONTENT_ANALYSIS_DEPTH" "$file" 2>/dev/null || echo "")
    fi
    
    # Combine filename and content for analysis
    local text="$filename $content"
    local text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')
    
    # AI & ML category
    if echo "$text_lower" | grep -qE "(machine learning|neural network|deep learning|artificial intelligence|pytorch|tensorflow|scikit|pandas|numpy|jupyter|notebook|algorithm|model|training|dataset|ai|ml|llm|gpt|transformer|bert)" 2>/dev/null; then
        echo "$CATEGORY_AI_ML"
        return
    fi
    
    # Research Papers category
    if echo "$text_lower" | grep -qE "(abstract|introduction|methodology|literature review|bibliography|citation|doi:|arxiv|paper|journal|research|study|analysis|findings|conclusion)" 2>/dev/null; then
        echo "$CATEGORY_RESEARCH"
        return
    fi
    
    # Development category
    if echo "$text_lower" | grep -qE "(function|class|import|export|api|github|git|code|programming|software|development|javascript|python|bash|shell|dockerfile|kubernetes|docker)" 2>/dev/null; then
        echo "$CATEGORY_DEV"
        return
    fi
    
    # Web Content category
    if echo "$text_lower" | grep -qE "(article|tutorial|guide|blog|news|web|http|https|www\.|link|url|bookmark)" 2>/dev/null; then
        echo "$CATEGORY_WEB"
        return
    fi
    
    # Default to Notes & Drafts
    echo "$CATEGORY_NOTES"
}

# Move file to category directory
move_to_category() {
    local file="$1"
    local category="$2"
    local source_dir="$3"
    
    # Create category directory
    local category_dir="$source_dir/$category"
    ensure_directory "$category_dir"
    
    # Get filename
    local filename=$(basename "$file")
    local target_file="$category_dir/$filename"
    
    # Handle name conflicts
    local counter=1
    while [[ -f "$target_file" ]]; do
        local name="${filename%.*}"
        local ext="${filename##*.}"
        if [[ "$name" == "$ext" ]]; then
            # No extension
            target_file="$category_dir/${filename}_${counter}"
        else
            target_file="$category_dir/${name}_${counter}.${ext}"
        fi
        counter=$((counter + 1))
    done
    
    # Move file
    if [[ "$DRY_RUN_MODE" == "true" ]]; then
        log "INFO" "DRY RUN: Would move $file -> $target_file"
    else
        if mv "$file" "$target_file"; then
            log "INFO" "Moved: $file -> $target_file"
        else
            log "ERROR" "Failed to move: $file -> $target_file"
            return 1
        fi
    fi
    
    return 0
}

# Organize files in a directory
organize_directory() {
    local dir="$1"
    
    if [[ ! -d "$dir" ]]; then
        log "WARN" "Directory does not exist: $dir"
        return 0
    fi
    
    log "INFO" "Organizing directory: $dir"
    
    local files_processed=0
    local files_moved=0
    
    # Find files to organize (exclude directories and hidden files)
    while IFS= read -r -d '' file; do
        # Skip if it's a directory
        if [[ -d "$file" ]]; then
            continue
        fi
        
        # Skip hidden files
        local filename=$(basename "$file")
        if [[ "$filename" =~ ^\. ]]; then
            continue
        fi
        
        # Skip files that are too small
        local file_size=$(stat -f%z "$file" 2>/dev/null || echo 0)
        if [[ "$file_size" -lt "$MIN_FILE_SIZE" ]]; then
            continue
        fi
        
        # Skip if file is already in a category directory
        local parent_dir=$(basename "$(dirname "$file")")
        if [[ "$parent_dir" == "$CATEGORY_AI_ML" || "$parent_dir" == "$CATEGORY_RESEARCH" || 
              "$parent_dir" == "$CATEGORY_WEB" || "$parent_dir" == "$CATEGORY_NOTES" || 
              "$parent_dir" == "$CATEGORY_DEV" ]]; then
            continue
        fi
        
        files_processed=$((files_processed + 1))
        
        # Get category for file
        local category=$(get_file_category "$file")
        
        # Move file to category
        if move_to_category "$file" "$category" "$dir"; then
            files_moved=$((files_moved + 1))
        fi
        
    done < <(find "$dir" -maxdepth 1 -type f -print0)
    
    log "INFO" "Processed $files_processed files, moved $files_moved files"
}

# Show organization status
show_status() {
    log "INFO" "Organization status check"
    
    echo "=== Organization Configuration ==="
    echo "Organization Enabled: $ORGANIZATION_ENABLED"
    echo "Auto Categorization: $AUTO_CATEGORIZATION"
    echo "Simplified Categories: $SIMPLIFIED_CATEGORIES"
    echo "Dry Run Mode: $DRY_RUN_MODE"
    echo ""
    
    echo "=== Categories ==="
    echo "🤖 AI & ML: $CATEGORY_AI_ML"
    echo "📚 Research Papers: $CATEGORY_RESEARCH"
    echo "🌐 Web Content: $CATEGORY_WEB"
    echo "📝 Notes & Drafts: $CATEGORY_NOTES"
    echo "💻 Development: $CATEGORY_DEV"
    echo ""
    
    if [[ -d "$SYNC_HUB" ]]; then
        echo "=== Sync Hub Directory Analysis ==="
        echo "Location: $SYNC_HUB"
        
        for category in "$CATEGORY_AI_ML" "$CATEGORY_RESEARCH" "$CATEGORY_WEB" "$CATEGORY_NOTES" "$CATEGORY_DEV"; do
            local cat_dir="$SYNC_HUB/$category"
            if [[ -d "$cat_dir" ]]; then
                local file_count=$(find "$cat_dir" -type f | wc -l | tr -d ' ')
                echo "$category: $file_count files"
            else
                echo "$category: Not created yet"
            fi
        done
        
        # Count uncategorized files
        local uncategorized=0
        while IFS= read -r -d '' file; do
            local parent_dir=$(basename "$(dirname "$file")")
            if [[ "$parent_dir" != "$CATEGORY_AI_ML" && "$parent_dir" != "$CATEGORY_RESEARCH" && 
                  "$parent_dir" != "$CATEGORY_WEB" && "$parent_dir" != "$CATEGORY_NOTES" && 
                  "$parent_dir" != "$CATEGORY_DEV" ]]; then
                uncategorized=$((uncategorized + 1))
            fi
        done < <(find "$SYNC_HUB" -maxdepth 1 -type f -print0 2>/dev/null || true)
        
        echo "Uncategorized files: $uncategorized"
    else
        echo "Sync Hub directory does not exist: $SYNC_HUB"
    fi
}

# Run organization process
run_organization() {
    log "INFO" "Starting organization process"
    
    if [[ "$ORGANIZATION_ENABLED" != "true" ]]; then
        log "WARN" "Organization is disabled in configuration"
        return 0
    fi
    
    # Ensure sync hub exists
    ensure_directory "$SYNC_HUB"
    
    # Organize the sync hub
    organize_directory "$SYNC_HUB"
    
    log "INFO" "Organization process completed"
}

# Show help
show_help() {
    cat << EOF
Simplified Organize Module

Usage: $0 <command> [options]

Commands:
    run         - Run the organization process
    dry-run     - Preview what would be organized (no changes)
    status      - Show organization status and statistics
    help        - Show this help message

Examples:
    $0 run              # Organize files
    $0 dry-run          # Preview organization
    $0 status           # Check status

Configuration:
    Edit config.env to modify organization settings.
    Set DRY_RUN_MODE=true in config.env for permanent dry-run mode.

Categories:
    🤖 AI & ML          - Machine learning, AI research, data science
    📚 Research Papers  - Academic papers, studies, research documents  
    🌐 Web Content      - Articles, tutorials, guides, bookmarks
    📝 Notes & Drafts   - Meeting notes, ideas, drafts, personal notes
    💻 Development      - Code, APIs, technical documentation

EOF
}

# Main execution
main() {
    case "${1:-help}" in
        "run")
            run_organization
            ;;
        "dry-run")
            DRY_RUN_MODE="true"
            run_organization
            ;;
        "status")
            show_status
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

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
