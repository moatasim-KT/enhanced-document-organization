#!/bin/bash

# Enhanced Document Organization Script
# Organizes documents into sensible categories, removes duplicates, validates sync integrity,
# and provides advanced folder management across multiple sync locations

set -euo pipefail

SOURCE_DIR="/Users/moatasimfarooque/Downloads/Data_Science/Sync_iCloud"
BACKUP_DIR="/Users/moatasimfarooque/Downloads/Data_Science/Sync_iCloud_backup_$(date +%Y%m%d_%H%M%S)"

# All sync directories for consistency validation
SYNC_LOCATIONS=(
    "/Users/moatasimfarooque/Downloads/Data_Science/Sync_iCloud"
    "/Users/moatasimfarooque/Downloads/Data_Science/Sync_GoogleDrive"
    "/Users/moatasimfarooque/Library/Mobile Documents/iCloud~md~obsidian/Documents/Sync"
    "/Users/moatasimfarooque/Library/CloudStorage/GoogleDrive-moatasim23android@gmail.com/My Drive/Sync"
)

# Enhanced configuration
ENABLE_CONTENT_ANALYSIS=true
ENABLE_INTEGRITY_CHECK=true
ENABLE_SMART_CATEGORIZATION=true
ENABLE_CROSS_SYNC_VALIDATION=true
MIN_FILE_SIZE=10  # bytes
MAX_FILENAME_LENGTH=80

echo "🗂️  Starting enhanced document organization..."
echo "📁 Source: $SOURCE_DIR"
echo "💾 Backup: $BACKUP_DIR"
echo "🔄 Sync locations: ${#SYNC_LOCATIONS[@]} directories"

# Enhanced folder structure validation
validate_folder_structure() {
    local base_dir="$1"
    echo "🔍 Validating folder structure in: $base_dir"
    
    if [[ ! -d "$base_dir" ]]; then
        echo "⚠️  Directory not found: $base_dir"
        return 1
    fi
    
    # Define required structure
    local required_structure=(
        "📚 Research Papers/AI_ML"
        "📚 Research Papers/Physics"
        "📚 Research Papers/Neuroscience"
        "📚 Research Papers/Mathematics"
        "🤖 AI & ML/Agents"
        "🤖 AI & ML/Transformers"
        "🤖 AI & ML/Neural_Networks"
        "🤖 AI & ML/LLMs"
        "🤖 AI & ML/Tools_Frameworks"
        "💻 Development/APIs"
        "💻 Development/Kubernetes"
        "💻 Development/Git"
        "💻 Development/Documentation"
        "🌐 Web Content/Articles"
        "🌐 Web Content/Tutorials"
        "🌐 Web Content/Guides"
        "📝 Notes & Drafts/Daily_Notes"
        "📝 Notes & Drafts/Literature_Notes"
        "📝 Notes & Drafts/Untitled"
    )
    
    local missing_dirs=()
    for dir in "${required_structure[@]}"; do
        if [[ ! -d "$base_dir/$dir" ]]; then
            missing_dirs+=("$dir")
        fi
    done
    
    if [[ ${#missing_dirs[@]} -gt 0 ]]; then
        echo "📂 Creating missing directories:"
        for dir in "${missing_dirs[@]}"; do
            echo "   + $dir"
            mkdir -p "$base_dir/$dir"
        done
    else
        echo "✅ Folder structure is complete"
    fi
}

# File integrity checking
check_file_integrity() {
    local file="$1"
    
    # Check if file is readable
    if [[ ! -r "$file" ]]; then
        echo "⚠️  File not readable: $file"
        return 1
    fi
    
    # Check minimum file size
    local size=$(wc -c < "$file" 2>/dev/null || echo 0)
    if [[ $size -lt $MIN_FILE_SIZE ]]; then
        echo "⚠️  File too small ($size bytes): $file"
        return 1
    fi
    
    # Check for binary content in .md files
    if [[ "$file" == *.md ]]; then
        if file "$file" | grep -q "binary"; then
            echo "⚠️  Binary content in markdown file: $file"
            return 1
        fi
    fi
    
    return 0
}

# Smart categorization based on content analysis
analyze_content_category() {
    local file="$1"
    local content=""
    
    # Read first few lines for analysis
    content=$(head -20 "$file" 2>/dev/null | tr '[:upper:]' '[:lower:]' || echo "")
    
    # AI/ML keywords
    if echo "$content" | grep -qE "(machine learning|neural network|deep learning|artificial intelligence|transformer|llm|gpt|agent|model|algorithm|pytorch|tensorflow)"; then
        if echo "$content" | grep -qE "(agent|agentic|multi-agent|autonomous)"; then
            echo "🤖 AI & ML/Agents"
        elif echo "$content" | grep -qE "(transformer|attention|bert|gpt)"; then
            echo "🤖 AI & ML/Transformers"
        elif echo "$content" | grep -qE "(neural|network|cnn|rnn|lstm)"; then
            echo "🤖 AI & ML/Neural_Networks"
        elif echo "$content" | grep -qE "(llm|language model|chatgpt|claude|gemini)"; then
            echo "🤖 AI & ML/LLMs"
        else
            echo "🤖 AI & ML/Tools_Frameworks"
        fi
        return
    fi
    
    # Research papers
    if echo "$content" | grep -qE "(abstract|introduction|methodology|conclusion|references|doi:|arxiv:|paper|study|research)"; then
        if echo "$content" | grep -qE "(physics|quantum|mechanics|thermodynamics)"; then
            echo "📚 Research Papers/Physics"
        elif echo "$content" | grep -qE "(brain|neuroscience|cognitive|neural|neuron)"; then
            echo "📚 Research Papers/Neuroscience"
        elif echo "$content" | grep -qE "(mathematics|theorem|proof|equation|calculus)"; then
            echo "📚 Research Papers/Mathematics"
        else
            echo "📚 Research Papers/AI_ML"
        fi
        return
    fi
    
    # Development content
    if echo "$content" | grep -qE "(api|endpoint|rest|graphql|json|http)"; then
        echo "💻 Development/APIs"
    elif echo "$content" | grep -qE "(kubernetes|k8s|docker|container|pod|deploy)"; then
        echo "💻 Development/Kubernetes"
    elif echo "$content" | grep -qE "(git|github|commit|branch|merge|pull request)"; then
        echo "💻 Development/Git"
    elif echo "$content" | grep -qE "(documentation|docs|guide|tutorial|how to)"; then
        echo "💻 Development/Documentation"
    elif echo "$content" | grep -qE "(tutorial|guide|how-to|step-by-step)"; then
        echo "🌐 Web Content/Tutorials"
    elif echo "$content" | grep -qE "(article|blog|post|news)"; then
        echo "🌐 Web Content/Articles"
    else
        echo "🌐 Web Content/Guides"
    fi
}

# Cross-sync validation
validate_sync_consistency() {
    echo "🔄 Validating sync consistency across locations..."
    
    local inconsistencies=()
    local reference_dir="${SYNC_LOCATIONS[0]}"
    
    if [[ ! -d "$reference_dir" ]]; then
        echo "⚠️  Reference directory not found: $reference_dir"
        return 1
    fi
    
    # Check each sync location against reference
    for sync_dir in "${SYNC_LOCATIONS[@]:1}"; do
        if [[ ! -d "$sync_dir" ]]; then
            echo "⚠️  Sync directory not found: $sync_dir"
            inconsistencies+=("Missing directory: $sync_dir")
            continue
        fi
        
        # Compare directory structures
        local ref_dirs=$(find "$reference_dir" -type d | sed "s|$reference_dir||" | sort)
        local sync_dirs=$(find "$sync_dir" -type d | sed "s|$sync_dir||" | sort)
        
        if [[ "$ref_dirs" != "$sync_dirs" ]]; then
            inconsistencies+=("Directory structure mismatch: $sync_dir")
        fi
    done
    
    if [[ ${#inconsistencies[@]} -gt 0 ]]; then
        echo "⚠️  Found ${#inconsistencies[@]} sync inconsistencies:"
        printf '%s\n' "${inconsistencies[@]}"
        return 1
    else
        echo "✅ All sync locations are consistent"
        return 0
    fi
}

# Enhanced move function with content analysis
move_file_enhanced() {
    local src="$1"
    local dest_dir="$2"
    local filename=$(basename "$src")
    local smart_category=""
    
    # Validate file integrity first
    if ! check_file_integrity "$src"; then
        echo "🗑️  Removing corrupted file: $filename"
        rm "$src" 2>/dev/null || true
        return
    fi
    
    # Use smart categorization if enabled and no destination specified
    if [[ "$ENABLE_SMART_CATEGORIZATION" == "true" && "$dest_dir" == "auto" ]]; then
        smart_category=$(analyze_content_category "$src")
        if [[ -n "$smart_category" ]]; then
            dest_dir="$smart_category"
            echo "🧠 Smart categorization: $filename -> $dest_dir"
        else
            dest_dir="🌐 Web Content/Articles"  # fallback
        fi
    fi
    
    # Check filename length and suggest shortening
    if [[ ${#filename} -gt $MAX_FILENAME_LENGTH ]]; then
        local short_name=$(echo "$filename" | cut -c1-$((MAX_FILENAME_LENGTH-3)))
        short_name="${short_name}...${filename##*.}"
        echo "✂️  Long filename detected: $filename (${#filename} chars)"
        echo "   Suggested short name: $short_name"
    fi
    
    if [[ -f "$src" ]]; then
        mkdir -p "$dest_dir"
        if [[ -f "$dest_dir/$filename" ]]; then
            echo "⚠️  Duplicate found: $filename"
            
            # Compare file sizes and dates
            local src_size=$(wc -c < "$src" 2>/dev/null || echo 0)
            local dest_size=$(wc -c < "$dest_dir/$filename" 2>/dev/null || echo 0)
            
            if [[ "$src" -nt "$dest_dir/$filename" ]] || [[ $src_size -gt $dest_size ]]; then
                echo "   Replacing with newer/larger version"
                mv "$src" "$dest_dir/"
            else
                echo "   Keeping existing version"
                rm "$src" 2>/dev/null || true
            fi
        else
            mv "$src" "$dest_dir/"
        fi
    fi
}

# Pre-organization validation
echo "🔍 Running pre-organization validation..."
for sync_location in "${SYNC_LOCATIONS[@]}"; do
    validate_folder_structure "$sync_location"
done

if [[ "$ENABLE_CROSS_SYNC_VALIDATION" == "true" ]]; then
    validate_sync_consistency
fi

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

# Organize AI & ML content
echo "🤖 Organizing AI & ML content..."
find . -name "*gent*" -type f -name "*.md" | while read file; do
    move_file_enhanced "$file" "🤖 AI & ML/Agents"
done

find . -name "*transform*" -o -name "*attention*" -type f -name "*.md" | while read file; do
    move_file_enhanced "$file" "🤖 AI & ML/Transformers"
done

find . -name "*neural*" -o -name "*network*" -o -name "*activation*" -type f -name "*.md" | while read file; do
    move_file_enhanced "$file" "🤖 AI & ML/Neural_Networks"
done

find . -name "*llm*" -o -name "*language*model*" -o -name "*gpt*" -o -name "*claude*" -type f -name "*.md" | while read file; do
    move_file_enhanced "$file" "🤖 AI & ML/LLMs"
done

find . -name "*quantization*" -o -name "*random*forest*" -type f -name "*.md" | while read file; do
    move_file_enhanced "$file" "🤖 AI & ML/Tools_Frameworks"
done

# Organize research papers
echo "📚 Organizing research papers..."
find . -name "*physics*" -type f -name "*.md" | while read file; do
    move_file_enhanced "$file" "📚 Research Papers/Physics"
done

find . -name "*brain*" -o -name "*language*develop*" -type f -name "*.md" | while read file; do
    move_file_enhanced "$file" "📚 Research Papers/Neuroscience"
done

find . -name "*calculus*" -o -name "*matrix*" -o -name "*linear*algebra*" -type f -name "*.md" | while read file; do
    move_file_enhanced "$file" "📚 Research Papers/Mathematics"
done

find . -name "*learning*optimal*" -o -name "*meta*learning*" -type f -name "*.md" | while read file; do
    move_file_enhanced "$file" "📚 Research Papers/AI_ML"
done

# Organize development content
echo "💻 Organizing development content..."
find . -name "*api*" -o -name "*graphql*" -type f -name "*.md" | while read file; do
    move_file_enhanced "$file" "💻 Development/APIs"
done

find . -name "*kubernetes*" -type f -name "*.md" | while read file; do
    move_file_enhanced "$file" "💻 Development/Kubernetes"
done

find . -name "*git*" -type f -name "*.md" | while read file; do
    move_file_enhanced "$file" "💻 Development/Git"
done

find . -name "*cursor*" -o -name "*documentation*" -type f -name "*.md" | while read file; do
    move_file_enhanced "$file" "💻 Development/Documentation"
done

# Organize notes
echo "📝 Organizing notes..."
find . -name "2025-*.md" -type f | while read file; do
    move_file_enhanced "$file" "📝 Notes & Drafts/Daily_Notes"
done

find . -name "Untitled*.md" -type f | while read file; do
    move_file_enhanced "$file" "📝 Notes & Drafts/Untitled"
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
            move_file_enhanced "$file" "🤖 AI & ML/Tools_Frameworks"
            ;;
        *nvidia*|*llama*)
            move_file_enhanced "$file" "🤖 AI & ML/LLMs"
            ;;
        *)
            move_file_enhanced "$file" "🌐 Web Content/Articles"
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
