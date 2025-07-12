                                                                                                                                                                                                            #!/bin/bash

# Comprehensive AI & ML Directory Cleanup Script
# Cleans up all subcategories in the AI & ML folder

set -euo pipefail

echo "🧹 Starting comprehensive AI & ML folder cleanup..."

# Base directories to clean
BASE_DIRS=(
    "/Users/moatasimfarooque/Downloads/Data_Science/Sync_iCloud/🤖 AI & ML"
    "/Users/moatasimfarooque/Downloads/Data_Science/Sync_GoogleDrive/🤖 AI & ML"
    "/Users/moatasimfarooque/Library/Mob//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////ile Documents/iCloud~md~obsidian/Documents/Sync/🤖 AI & ML"
    "/Users/moatasimfarooque/Library/CloudStorage/GoogleDrive-moatasim23android@gmail.com/My Drive/Sync/🤖 AI & ML"
)

# Function to clean filenames
clean_filename() {
    local original="$1"
    local dir="$2"
    
    # Skip if file doesn't exist
    [[ ! -f "$dir/$original" ]] && return
    
    local cleaned="$original"
    
    # Common cleanup patterns
    cleaned="${cleaned//_ //}"  # Replace underscores with spaces
    cleaned="${cleaned//  / }"  # Replace double spaces with single
    cleaned="${cleaned// _ / }"  # Clean up space-underscore patterns
    
    # Specific long filename fixes
    case "$original" in
        "How I Built a Multi-Agent Powerhouse with Google's ADK and MCP Without Losing My Mind.md")
            cleaned="Multi-Agent Powerhouse with Google ADK.md"
            ;;
        "Building AI Agents with Google ADK (Agent Development Kit) and MCP (Model Context Protocol) with Gemini 2.5 Pro _ Google Cloud - Community.md")
            cleaned="Google ADK and MCP Guide.md"
            ;;
        "AI Agents vs. Agentic AI_ A Conceptual Taxonomy, Applications and Challenges.md")
            cleaned="AI Agents vs Agentic AI - Taxonomy and Applications.md"
            ;;
        "Building Effective AI Agents _ Anthropic.md")
            cleaned="Building Effective AI Agents (Anthropic).md"
            ;;
        "The Agentic AI Handbook - A Beginner's Guide to Autonomous Intelligent Agents.md")
            cleaned="Agentic AI Handbook - Beginners Guide.md"
            ;;
    esac
    
    # Only rename if the name actually changed and target doesn't exist
    if [[ "$original" != "$cleaned" && ! -f "$dir/$cleaned" ]]; then
        echo "✏️  Renaming: $original -> $cleaned"
        mv "$dir/$original" "$dir/$cleaned" 2>/dev/null || true
    fi
}

# Function to clean up a directory
cleanup_directory() {
    local dir="$1"
    local category="$2"
    
    [[ ! -d "$dir" ]] && return
    
    echo "🗂️  Cleaning: $dir"
    cd "$dir"
    
    # Remove empty files
    find . -type f -size 0 -name "*.md" -delete 2>/dev/null || true
    
    # Clean up filenames in this directory
    find . -maxdepth 1 -name "*.md" -type f | while read -r file; do
        filename=$(basename "$file")
        clean_filename "$filename" "."
    done
    
    # Remove empty directories
    find . -type d -empty -delete 2>/dev/null || true
    
    local file_count=$(find . -name "*.md" -type f | wc -l | tr -d ' ')
    echo "   ✅ $file_count files in $category"
}

# Process each base directory
for base_dir in "${BASE_DIRS[@]}"; do
    if [[ -d "$base_dir" ]]; then
        echo "📁 Processing: $base_dir"
        
        # Clean each subcategory
        for subdir in "$base_dir"/*; do
            if [[ -d "$subdir" ]]; then
                category=$(basename "$subdir")
                cleanup_directory "$subdir" "$category"
            fi
        done
        echo ""
    fi
done

# Generate final report
echo "📊 Generating final cleanup summary..."
FINAL_REPORT="/Users/moatasimfarooque/Downloads/Programming/CascadeProjects/Drive_sync/ai_ml_cleanup_final.txt"

echo "=== AI & ML Comprehensive Cleanup Report ===" > "$FINAL_REPORT"
echo "Date: $(date)" >> "$FINAL_REPORT"
echo "" >> "$FINAL_REPORT"

for base_dir in "${BASE_DIRS[@]}"; do
    if [[ -d "$base_dir" ]]; then
        echo "📁 $base_dir:" >> "$FINAL_REPORT"
        for subdir in "$base_dir"/*; do
            if [[ -d "$subdir" ]]; then
                category=$(basename "$subdir")
                file_count=$(find "$subdir" -name "*.md" -type f | wc -l | tr -d ' ')
                echo "   $category: $file_count files" >> "$FINAL_REPORT"
            fi
        done
        echo "" >> "$FINAL_REPORT"
    fi
done

echo "✅ Comprehensive AI & ML cleanup complete!"
echo "📊 Report saved to: $FINAL_REPORT"
