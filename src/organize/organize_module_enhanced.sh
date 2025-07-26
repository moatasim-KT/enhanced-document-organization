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

# Load configuration
source "$PROJECT_DIR/config/config.env"

# Advanced features configuration
ENABLE_DUPLICATE_DETECTION="${ENABLE_DUPLICATE_DETECTION:-true}"
ENABLE_CONTENT_CONSOLIDATION="${ENABLE_CONTENT_CONSOLIDATION:-true}"
ENABLE_AI_ENHANCEMENT="${ENABLE_AI_ENHANCEMENT:-false}"
ENABLE_CATEGORY_SUGGESTIONS="${ENABLE_CATEGORY_SUGGESTIONS:-true}"
SIMILARITY_THRESHOLD="${SIMILARITY_THRESHOLD:-0.8}"
MIN_CONSOLIDATION_FILES="${MIN_CONSOLIDATION_FILES:-2}"

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
    
    # Ensure category directories exist
    setup_category_structure "$source_dir"
    
    # Get list of files to process
    local files_to_process=()
    while IFS= read -r -d '' file; do
        if [[ -f "$file" && ! "$file" =~ /\. && ! "$file" =~ _category_info\.md$ ]]; then
            files_to_process+=("$file")
        fi
    done < <(find "$source_dir" -maxdepth 1 -type f -print0)
    
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

# Run content analysis using Node.js modules
run_content_analysis() {
    # Get the last 3 arguments which are the output file paths
    local analysis_results="${!#}"           # Last argument
    local consolidation_candidates="${@: -2:1}"  # Second to last
    local duplicates_found="${@: -3:1}"      # Third to last
    
    # Get all arguments except the last 3 as the file list
    local total_args=$#
    local file_count=$((total_args - 3))
    local file_list=("${@:1:$file_count}")
    
    # Create file list for Node.js
    local file_list_json="["
    for file in "${file_list[@]}"; do
        file_list_json+='"'$(printf '%s' "$file" | sed 's/"/\\"/g')'",'
    done
    file_list_json="${file_list_json%,}]"
    
    # Run analysis
    node -e "
        import ContentAnalyzer from '$PROJECT_DIR/organize/content_analyzer.js';
        import { promises as fs } from 'fs';
        
        async function runAnalysis() {
            const analyzer = new ContentAnalyzer({
                similarityThreshold: $SIMILARITY_THRESHOLD,
                minContentLength: 50
            });
            
            const fileList = $file_list_json;
            console.log('Analyzing', fileList.length, 'files...');
            
            // Find duplicates
            const duplicates = await analyzer.findDuplicates(fileList);
            await fs.writeFile('$duplicates_found', JSON.stringify([...duplicates.entries()], null, 2));
            
            // Find consolidation candidates
            const candidates = await analyzer.findConsolidationCandidates(fileList);
            await fs.writeFile('$consolidation_candidates', JSON.stringify([...candidates.entries()], null, 2));
            
            console.log('Found', duplicates.size, 'duplicate groups');
            console.log('Found', candidates.size, 'consolidation opportunities');
        }
        
        runAnalysis().catch(console.error);
    "
}

# Process duplicate files
process_duplicates() {
    local duplicates_file="$1"
    local dry_run="$2"
    
    if [[ ! -f "$duplicates_file" ]]; then
        return 0
    fi
    
    local duplicate_count=$(node -e "
        const fs = require('fs');
        const duplicates = JSON.parse(fs.readFileSync('$duplicates_file', 'utf-8'));
        console.log(duplicates.length);
    ")
    
    if [[ "$duplicate_count" -gt 0 ]]; then
        log "INFO" "Processing $duplicate_count duplicate groups"
        
        node -e "
            const fs = require('fs');
            const path = require('path');
            
            const duplicatesEntries = JSON.parse(fs.readFileSync('$duplicates_file', 'utf-8'));
            
            for (const [key, duplicateGroup] of duplicatesEntries) {
                const { type, similarity, files, recommendedAction } = duplicateGroup;
                
                console.log(\`Duplicate group: \${key} (similarity: \${similarity ? similarity.toFixed(2) : 'N/A'})\`);
                console.log(\`Action: \${recommendedAction}\`);
                
                if (type === 'exact' && files.length > 1) {
                    // Keep the first file, mark others for removal
                    const keepFile = files[0].filePath;
                    const removeFiles = files.slice(1).map(f => f.filePath);
                    
                    console.log(\`Keeping: \${keepFile}\`);
                    for (const removeFile of removeFiles) {
                        console.log(\`$dry_run\" === \"true\" ? \"Would remove\" : \"Removing\"}: \${removeFile}\`);
                        if ('$dry_run' !== 'true') {
                            try {
                                fs.unlinkSync(removeFile);
                            } catch (error) {
                                console.warn(\`Failed to remove \${removeFile}: \${error.message}\`);
                            }
                        }
                    }
                }
            }
        "
    fi
}

# Process content consolidation candidates
process_consolidation_candidates() {
    local candidates_file="$1"
    local dry_run="$2"
    
    if [[ ! -f "$candidates_file" ]]; then
        return 0
    fi
    
    local candidate_count=$(node -e "
        const fs = require('fs');
        const candidates = JSON.parse(fs.readFileSync('$candidates_file', 'utf-8'));
        console.log(candidates.length);
    ")
    
    if [[ "$candidate_count" -gt 0 ]]; then
        log "INFO" "Processing $candidate_count consolidation candidates"
        
        if [[ "$dry_run" == "true" ]]; then
            log "INFO" "DRY RUN: Would consolidate the following content groups:"
            node -e "
                const fs = require('fs');
                const candidates = JSON.parse(fs.readFileSync('$candidates_file', 'utf-8'));
                
                for (const [topic, candidate] of candidates) {
                    console.log(\`Topic: \${topic} (\${candidate.files.length} files, similarity: \${candidate.avgSimilarity.toFixed(2)})\`);
                    console.log(\`  Title: \${candidate.recommendedTitle}\`);
                    console.log(\`  Strategy: \${candidate.consolidationStrategy}\`);
                    console.log(\`  Files: \${candidate.files.map(f => f.filePath).join(', ')}\`);
                    console.log('');
                }
            "
        else
            # Actually perform consolidation
            node -e "
                import ContentConsolidator from '$PROJECT_DIR/organize/content_consolidator.js';
                import { promises as fs } from 'fs';
                
                async function consolidateContent() {
                    const consolidator = new ContentConsolidator({
                        projectRoot: '$PROJECT_DIR',
                        aiService: '$ENABLE_AI_ENHANCEMENT' === 'true' ? 'local' : 'none',
                        enhanceContent: '$ENABLE_AI_ENHANCEMENT' === 'true'
                    });
                    
                    const candidates = JSON.parse(await fs.readFile('$candidates_file', 'utf-8'));
                    
                    for (const [topic, candidate] of candidates) {
                        if (candidate.files.length >= $MIN_CONSOLIDATION_FILES) {
                            console.log(\`Consolidating topic: \${topic}\`);
                            try {
                                const result = await consolidator.consolidateDocuments(candidate);
                                console.log(\`Created: \${result.consolidatedDocument}\`);
                                
                                // Mark original files as processed (move to references)
                                // They're already moved by the consolidator
                            } catch (error) {
                                console.error(\`Failed to consolidate \${topic}: \${error.message}\`);
                            }
                        }
                    }
                }
                
                consolidateContent().catch(console.error);
            "
        fi
    fi
}

# Organize remaining files using traditional + enhanced categorization
organize_remaining_files() {
    local source_dir="$1"
    local dry_run="$2"
    
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

# Enhanced category detection using the category manager
get_file_category_enhanced() {
    local file="$1"
    
    # Use Node.js for enhanced categorization
    local category=$(node -e "
        import CategoryManager from '$PROJECT_DIR/organize/category_manager.js';
        import ContentAnalyzer from '$PROJECT_DIR/organize/content_analyzer.js';
        
        async function categorizeFile() {
            const manager = new CategoryManager({
                configPath: '$PROJECT_DIR/organize_config.conf',
                projectRoot: '$PROJECT_DIR'
            });
            await manager.initialize();
            
            const analyzer = new ContentAnalyzer();
            const analysis = await analyzer.analyzeContent('$file');
            
            if (analysis) {
                const match = manager.findBestCategoryMatch(analysis);
                console.log(match.category.name);
            } else {
                console.log('${CATEGORY_NOTES:-Notes & Drafts}');
            }
        }
        
        categorizeFile().catch(() => console.log('${CATEGORY_NOTES:-Notes & Drafts}'));
    ")
    
    echo "${category:-${CATEGORY_NOTES:-Notes & Drafts}}"
}

# Check for category suggestions based on unmatched content
check_category_suggestions() {
    local source_dir="$1"
    
    log "INFO" "Analyzing content for potential new categories..."
    
    node -e "
        import CategoryManager from '$PROJECT_DIR/organize/category_manager.js';
        import ContentAnalyzer from '$PROJECT_DIR/organize/content_analyzer.js';
        import { promises as fs } from 'fs';
        import path from 'path';
        
        async function checkSuggestions() {
            const manager = new CategoryManager({
                configPath: '$PROJECT_DIR/organize_config.conf',
                projectRoot: '$PROJECT_DIR'
            });
            await manager.initialize();
            
            const analyzer = new ContentAnalyzer();
            
            // Find all files and analyze their categorization confidence
            const allFiles = [];
            const categories = ['${CATEGORY_AI_ML:-AI & ML}', '${CATEGORY_RESEARCH:-Research Papers}', '${CATEGORY_WEB:-Web Content}', '${CATEGORY_NOTES:-Notes & Drafts}', '${CATEGORY_DEV:-Development}'];
            
            for (const category of categories) {
                const categoryPath = path.join('${source_dir}', category);
                try {
                    const files = await fs.readdir(categoryPath);
                    for (const file of files) {
                        const filePath = path.join(categoryPath, file);
                        try {
                            const stat = await fs.stat(filePath);
                            if (stat.isFile() && !file.startsWith('.') && !file.includes('_category_info')) {
                                const analysis = await analyzer.analyzeContent(filePath);
                                if (analysis) {
                                    const match = manager.findBestCategoryMatch(analysis);
                                    allFiles.push({ filePath, analysis, match });
                                }
                            }
                        } catch (e) {}
                    }
                } catch (e) {}
            }
            
            // Find poorly categorized files
            const poorlyMatched = allFiles.filter(f => f.match.confidence < 0.5);
            
            if (poorlyMatched.length >= 3) {
                console.log(\`Found \${poorlyMatched.length} files that might benefit from a new category\`);
                
                const suggestion = await manager.suggestCategory(poorlyMatched[0].analysis, poorlyMatched);
                if (suggestion) {
                    console.log('Category suggestion:');
                    console.log(\`  Name: \${suggestion.name}\`);
                    console.log(\`  Icon: \${suggestion.icon}\`);
                    console.log(\`  Description: \${suggestion.description}\`);
                    console.log(\`  Keywords: \${suggestion.keywords.join(', ')}\`);
                    console.log(\`  Confidence: \${(suggestion.confidence * 100).toFixed(1)}%\`);
                    console.log(\`  Affected files: \${suggestion.affectedFiles}\`);
                    console.log('');
                    console.log('To add this category, run:');
                    console.log(\`  ./drive_sync.sh add-category '\${suggestion.name}' '\${suggestion.icon}' '\${suggestion.description}'\`);
                }
            } else {
                console.log('No new category suggestions at this time');
            }
        }
        
        checkSuggestions().catch(console.error);
    "
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

# Main execution
main() {
    local source_dir="${1:-$SYNC_HUB}"
    local dry_run="${2:-false}"
    
    if [[ ! -d "$source_dir" ]]; then
        log "ERROR" "Source directory does not exist: $source_dir"
        exit 1
    fi
    
    log "INFO" "Organizing directory: $source_dir"
    
    organize_documents "$source_dir" "$dry_run"
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
