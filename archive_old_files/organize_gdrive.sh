#!/bin/bash

# Document Organization Script
# Organizes documents into sensible categories, removes duplicates and empty files

set -euo pipefail

SOURCE_DIR="/Users/moatasimfarooque/Downloads/Data_Science/Sync_GoogleDrive"
BACKUP_DIR="/Users/moatasimfarooque/Downloads/Data_Science/Sync_GoogleDrive_backup_$(date +%Y%m%d_%H%M%S)"

echo "🗂️  Starting document organization..."
echo "📁 Source: $SOURCE_DIR"
echo "💾 Backup: $BACKUP_DIR"

# Create backup
echo "📋 Creating backup..."
cp -R "$SOURCE_DIR" "$BACKUP_DIR"

cd "$SOURCE_DIR"

# Create organized directory structure
echo "📂 Creating organized directory structure..."

# Main categories
mkdir -p "📚 Research Papers"/{AI_ML,Physics,Neuroscience,Mathematics}
mkdir -p "🤖 AI & ML"/{Agents,Transformers,Neural_Networks,LLMs,Tools_Frameworks}
mkdir -p "💻 Development"/{APIs,Kubernetes,Git,Documentation}
mkdir -p "🌐 Web Content"/{Articles,Tutorials,Guides}
mkdir -p "📝 Notes & Drafts"/{Daily_Notes,Literature_Notes,Untitled}
mkdir -p "🗄️ Archives"/{Duplicates,Legacy}

# Remove empty files
echo "🗑️  Removing empty files..."
find . -type f -size 0 -name "*.md" -delete

# Remove duplicates and organize files
echo "🔍 Processing files and removing duplicates..."

# Function to move file safely
move_file() {
    local src="$1"
    local dest_dir="$2"
    local filename=$(basename "$src")
    
    if [[ -f "$src" ]]; then
        mkdir -p "$dest_dir"
        if [[ -f "$dest_dir/$filename" ]]; then
            echo "⚠️  Duplicate found: $filename (keeping newest)"
            if [[ "$src" -nt "$dest_dir/$filename" ]]; then
                mv "$src" "$dest_dir/"
            else
                rm "$src"
            fi
        else
            mv "$src" "$dest_dir/"
        fi
    fi
}

# Organize AI & ML content
echo "🤖 Organizing AI & ML content..."
find . -name "*gent*" -type f -name "*.md" | while read file; do
    move_file "$file" "🤖 AI & ML/Agents"
done

find . -name "*transform*" -o -name "*attention*" -type f -name "*.md" | while read file; do
    move_file "$file" "🤖 AI & ML/Transformers"
done

find . -name "*neural*" -o -name "*network*" -o -name "*activation*" -type f -name "*.md" | while read file; do
    move_file "$file" "🤖 AI & ML/Neural_Networks"
done

find . -name "*llm*" -o -name "*language*model*" -o -name "*gpt*" -o -name "*claude*" -type f -name "*.md" | while read file; do
    move_file "$file" "🤖 AI & ML/LLMs"
done

find . -name "*quantization*" -o -name "*random*forest*" -type f -name "*.md" | while read file; do
    move_file "$file" "🤖 AI & ML/Tools_Frameworks"
done

# Organize research papers
echo "📚 Organizing research papers..."
find . -name "*physics*" -type f -name "*.md" | while read file; do
    move_file "$file" "📚 Research Papers/Physics"
done

find . -name "*brain*" -o -name "*language*develop*" -type f -name "*.md" | while read file; do
    move_file "$file" "📚 Research Papers/Neuroscience"
done

find . -name "*calculus*" -o -name "*matrix*" -o -name "*linear*algebra*" -type f -name "*.md" | while read file; do
    move_file "$file" "📚 Research Papers/Mathematics"
done

find . -name "*learning*optimal*" -o -name "*meta*learning*" -type f -name "*.md" | while read file; do
    move_file "$file" "📚 Research Papers/AI_ML"
done

# Organize development content
echo "💻 Organizing development content..."
find . -name "*api*" -o -name "*graphql*" -type f -name "*.md" | while read file; do
    move_file "$file" "💻 Development/APIs"
done

find . -name "*kubernetes*" -type f -name "*.md" | while read file; do
    move_file "$file" "💻 Development/Kubernetes"
done

find . -name "*git*" -type f -name "*.md" | while read file; do
    move_file "$file" "💻 Development/Git"
done

find . -name "*cursor*" -o -name "*documentation*" -type f -name "*.md" | while read file; do
    move_file "$file" "💻 Development/Documentation"
done

# Organize notes
echo "📝 Organizing notes..."
find . -name "2025-*.md" -type f | while read file; do
    move_file "$file" "📝 Notes & Drafts/Daily_Notes"
done

find . -name "Untitled*.md" -type f | while read file; do
    move_file "$file" "📝 Notes & Drafts/Untitled"
done

# Move literature notes
if [[ -d "Literature Notes" ]]; then
    mv "Literature Notes"/* "📝 Notes & Drafts/Literature_Notes/" 2>/dev/null || true
    rmdir "Literature Notes" 2>/dev/null || true
fi

# Organize web content
echo "🌐 Organizing web content..."
if [[ -d "Slurped Pages" ]]; then
    mv "Slurped Pages" "🌐 Web Content/Articles"
fi

if [[ -d "Netclips" ]]; then
    mv "Netclips" "🌐 Web Content/Netclips"
fi

# Handle remaining directories and files
echo "🗄️  Moving remaining content..."

# Move remaining research directories
for dir in "PhysicsX - On Machine Learning Methods for Physics" "Meta_Learning_Neural_Mechanisms_rather_than_Bayesian_Priors" "Learning_Optimal_Redistribution_Mechanisms_Neural_Networks" "Emergence_of_ Language_Developing _Brain" "The_little_book_of_deep_learning"; do
    if [[ -d "$dir" ]]; then
        mv "$dir" "📚 Research Papers/AI_ML/" 2>/dev/null || true
    fi
done

# Move AI directories
for dir in "Agentic_AI" "AI Agents vs Agentic AI"; do
    if [[ -d "$dir" ]]; then
        mv "$dir" "🤖 AI & ML/Agents/" 2>/dev/null || true
    fi
done

# Move any remaining loose files to appropriate categories
find . -maxdepth 1 -name "*.md" -type f | while read file; do
    filename=$(basename "$file")
    case "$filename" in
        *mcp*|*protocol*|*tool*)
            move_file "$file" "🤖 AI & ML/Tools_Frameworks"
            ;;
        *nvidia*|*llama*)
            move_file "$file" "🤖 AI & ML/LLMs"
            ;;
        *)
            move_file "$file" "🌐 Web Content/Articles"
            ;;
    esac
done

# Clean up empty directories
echo "🧹 Cleaning up empty directories..."
find . -type d -empty -delete

# Generate organization report
echo "📊 Generating organization report..."
echo "=== Document Organization Report ===" > organization_report.txt
echo "Date: $(date)" >> organization_report.txt
echo "" >> organization_report.txt
echo "📁 Directory Structure:" >> organization_report.txt
find . -type d | sort >> organization_report.txt
echo "" >> organization_report.txt
echo "📄 File Count by Category:" >> organization_report.txt
find . -name "*.md" -type f | cut -d'/' -f2 | sort | uniq -c | sort -nr >> organization_report.txt

echo "✅ Organization complete!"
echo "📊 Report saved to: organization_report.txt"
echo "💾 Backup saved to: $BACKUP_DIR"
