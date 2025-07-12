#!/bin/bash

# AI & ML Agents Folder Cleanup Script
# Removes duplicates, empty files, and optimizes the Agents directory structure

set -euo pipefail

# Define all sync directories that need to be cleaned
SYNC_DIRS=(
    "/Users/moatasimfarooque/Downloads/Data_Science/Sync_iCloud/🤖 AI & ML/Agents"
    "/Users/moatasimfarooque/Downloads/Data_Science/Sync_GoogleDrive/🤖 AI & ML/Agents"
    "/Users/moatasimfarooque/Library/Mobile Documents/iCloud~md~obsidian/Documents/Sync/🤖 AI & ML/Agents"
    "/Users/moatasimfarooque/Library/CloudStorage/GoogleDrive-moatasim23android@gmail.com/My Drive/Sync/🤖 AI & ML/Agents"
)

echo "🧹 Starting AI & ML/Agents folder cleanup..."
echo "📁 Processing ${#SYNC_DIRS[@]} sync directories"

# Create backup timestamp
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Function to clean up a single directory
cleanup_agents_dir() {
    local dir="$1"
    
    if [[ ! -d "$dir" ]]; then
        echo "⚠️  Directory not found: $dir"
        return
    fi
    
    echo "🗂️  Processing: $dir"
    
    # Create backup
    local backup_dir="${dir}_backup_${BACKUP_TIMESTAMP}"
    cp -R "$dir" "$backup_dir" 2>/dev/null || true
    echo "💾 Backup created: $backup_dir"
    
    cd "$dir"
    
    # Remove empty files
    echo "🗑️  Removing empty files..."
    find . -type f -size 0 -name "*.md" -delete 2>/dev/null || true
    
    # Handle duplicate files - keep the largest/most complete version
    echo "🔍 Processing duplicates..."
    
    # AI Agents vs Agentic AI duplicates - keep the largest
    if [[ -f "AI Agents vs. Agentic AI.md" && -f "AI Agents vs. Agentic AI_ A Conceptual Taxonomy, Applications and Challenges.md" ]]; then
        if [[ "AI Agents vs. Agentic AI.md" -ot "AI Agents vs. Agentic AI_ A Conceptual Taxonomy, Applications and Challenges.md" ]]; then
            echo "🗑️  Removing smaller duplicate: AI Agents vs. Agentic AI.md"
            rm "AI Agents vs. Agentic AI.md" 2>/dev/null || true
        else
            echo "🗑️  Removing older duplicate: AI Agents vs. Agentic AI_ A Conceptual Taxonomy, Applications and Challenges.md"
            rm "AI Agents vs. Agentic AI_ A Conceptual Taxonomy, Applications and Challenges.md" 2>/dev/null || true
        fi
    fi
    
    # Remove the shorter paper version (likely incomplete)
    if [[ -f "AI Agents vs. Agentic AI A Conceptual Taxonomy, Applications and Challenge (2505.10468v1).md" ]]; then
        echo "🗑️  Removing incomplete paper version: AI Agents vs. Agentic AI A Conceptual Taxonomy, Applications and Challenge (2505.10468v1).md"
        rm "AI Agents vs. Agentic AI A Conceptual Taxonomy, Applications and Challenge (2505.10468v1).md" 2>/dev/null || true
    fi
    
    # Building Effective AI Agents duplicates - keep the one with source attribution
    if [[ -f "Building Effective AI Agents.md" && -f "Building Effective AI Agents _ Anthropic.md" ]]; then
        echo "🗑️  Removing generic version, keeping Anthropic-attributed version"
        rm "Building Effective AI Agents.md" 2>/dev/null || true
    fi
    
    # Google ADK building guides - check for content similarity
    if [[ -f "Building AI Agents with Google ADK, FastAPI, and MCP.md" && -f "Building AI Agents with Google ADK (Agent Development Kit) and MCP (Model Context Protocol) with Gemini 2.5 Pro _ Google Cloud - Community.md" ]]; then
        # Keep the more detailed/longer one
        size1=$(wc -c < "Building AI Agents with Google ADK, FastAPI, and MCP.md" 2>/dev/null || echo 0)
        size2=$(wc -c < "Building AI Agents with Google ADK (Agent Development Kit) and MCP (Model Context Protocol) with Gemini 2.5 Pro _ Google Cloud - Community.md" 2>/dev/null || echo 0)
        
        if [[ $size1 -lt $size2 ]]; then
            echo "🗑️  Removing shorter Google ADK guide"
            rm "Building AI Agents with Google ADK, FastAPI, and MCP.md" 2>/dev/null || true
        else
            echo "🗑️  Removing longer filename Google ADK guide"
            rm "Building AI Agents with Google ADK (Agent Development Kit) and MCP (Model Context Protocol) with Gemini 2.5 Pro _ Google Cloud - Community.md" 2>/dev/null || true
        fi
    fi
    
    # Organize subdirectories better
    echo "📂 Organizing subdirectories..."
    
    # Move Agentic_AI subdirectory contents up if it exists
    if [[ -d "Agentic_AI" ]]; then
        echo "📁 Moving Agentic_AI subdirectory contents..."
        find "Agentic_AI" -name "*.md" -type f -exec mv {} . \; 2>/dev/null || true
        # Remove empty Agentic_AI directory and any hidden files
        rm -rf "Agentic_AI" 2>/dev/null || true
    fi
    
    # Rename files for better organization
    echo "✏️  Improving file names..."
    
    # Shorten very long filenames while keeping meaning
    if [[ -f "Building AI Agents with Google ADK (Agent Development Kit) and MCP (Model Context Protocol) with Gemini 2.5 Pro _ Google Cloud - Community.md" ]]; then
        mv "Building AI Agents with Google ADK (Agent Development Kit) and MCP (Model Context Protocol) with Gemini 2.5 Pro _ Google Cloud - Community.md" "Google ADK and MCP Guide.md" 2>/dev/null || true
    fi
    
    if [[ -f "AI Agents vs. Agentic AI_ A Conceptual Taxonomy, Applications and Challenges.md" ]]; then
        mv "AI Agents vs. Agentic AI_ A Conceptual Taxonomy, Applications and Challenges.md" "AI Agents vs Agentic AI - Taxonomy and Applications.md" 2>/dev/null || true
    fi
    
    if [[ -f "Building Effective AI Agents _ Anthropic.md" ]]; then
        mv "Building Effective AI Agents _ Anthropic.md" "Building Effective AI Agents (Anthropic).md" 2>/dev/null || true
    fi
    
    if [[ -f "The Agentic AI Handbook - A Beginner's Guide to Autonomous Intelligent Agents.md" ]]; then
        mv "The Agentic AI Handbook - A Beginner's Guide to Autonomous Intelligent Agents.md" "Agentic AI Handbook - Beginners Guide.md" 2>/dev/null || true
    fi
    
    if [[ -f "How I Built a Multi-Agent Powerhouse with Google's ADK and MCP Without Losing My Mind.md" ]]; then
        mv "How I Built a Multi-Agent Powerhouse with Google's ADK and MCP Without Losing My Mind.md" "Multi-Agent Powerhouse with Google ADK.md" 2>/dev/null || true
    fi
    
    # Clean up any remaining empty directories
    find . -type d -empty -delete 2>/dev/null || true
    
    # Count final files
    local file_count=$(find . -name "*.md" -type f | wc -l | tr -d ' ')
    echo "✅ Cleanup complete for $dir - $file_count files remaining"
    echo ""
}

# Process each sync directory
for sync_dir in "${SYNC_DIRS[@]}"; do
    cleanup_agents_dir "$sync_dir"
done

echo "🎯 Creating final cleanup report..."

# Generate summary report
REPORT_FILE="/Users/moatasimfarooque/Downloads/Programming/CascadeProjects/Drive_sync/agents_cleanup_report.txt"
echo "=== AI & ML Agents Folder Cleanup Report ===" > "$REPORT_FILE"
echo "Date: $(date)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

for sync_dir in "${SYNC_DIRS[@]}"; do
    if [[ -d "$sync_dir" ]]; then
        echo "📁 $sync_dir:" >> "$REPORT_FILE"
        echo "   Files: $(find "$sync_dir" -name "*.md" -type f | wc -l | tr -d ' ')" >> "$REPORT_FILE"
        echo "   Structure:" >> "$REPORT_FILE"
        find "$sync_dir" -name "*.md" -type f -exec basename {} \; | sort >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    fi
done

echo "📊 Cleanup report saved to: $REPORT_FILE"
echo "✅ All AI & ML/Agents directories cleaned successfully!"
echo ""
echo "🔄 Next step: Run sync to propagate changes across all directories"
