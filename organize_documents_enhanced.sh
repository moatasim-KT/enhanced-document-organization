#!/bin/bash

# Enhanced Document Organization Script v2.0
# Features: Content-based categorization, incremental processing, intelligent deduplication,
# metadata preservation, and advanced sync management

set -euo pipefail

# Configuration
SOURCE_DIR="/Users/moatasimfarooque/Downloads/Data_Science/Sync_iCloud"
BACKUP_DIR="/Users/moatasimfarooque/Downloads/Data_Science/Sync_iCloud_backup_$(date +%Y%m%d_%H%M%S)"
CACHE_DIR="/Users/moatasimfarooque/Downloads/Programming/CascadeProjects/Drive_sync/.cache"
PROCESSED_FILES_DB="$CACHE_DIR/processed_files.db"
CONTENT_HASH_DB="$CACHE_DIR/content_hashes.db"

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
ENABLE_CROSS_SYNC_VALIDATION=false
ENABLE_INCREMENTAL_PROCESSING=true
ENABLE_METADATA_PRESERVATION=true
ENABLE_ADVANCED_DEDUPLICATION=true
ENABLE_PROGRESS_TRACKING=true

MIN_FILE_SIZE=10  # bytes
MAX_FILENAME_LENGTH=80
INCREMENTAL_THRESHOLD=3600  # seconds (1 hour)

# Progress tracking variables
TOTAL_FILES=0
PROCESSED_FILES=0
MOVED_FILES=0
DEDUPLICATED_FILES=0
ERROR_FILES=0
CATEGORIZED_FILES=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Initialize cache directory and databases
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

# Progress reporting
update_progress() {
    local current=$1
    local total=$2
    local operation=$3
    
    if [[ "$ENABLE_PROGRESS_TRACKING" == "true" ]]; then
        local percent=$((current * 100 / total))
        local progress_bar=""
        local filled=$((percent / 2))
        
        for ((i=0; i<filled; i++)); do progress_bar+="█"; done
        for ((i=filled; i<50; i++)); do progress_bar+="░"; done
        
        printf "\r${CYAN}%s${NC} [%s] %d%% (%d/%d)" "$operation" "$progress_bar" "$percent" "$current" "$total"
    fi
}

# Enhanced file hashing with content analysis
calculate_content_hash() {
    local file="$1"
    local hash_type="${2:-sha256}"
    
    if [[ -f "$file" ]]; then
        # Use different hashing based on file type
        if [[ "$file" == *.md ]]; then
            # For markdown files, normalize whitespace and calculate hash
            sed 's/[[:space:]]*$//' "$file" | sed '/^$/d' | $hash_type"sum" | cut -d' ' -f1
        else
            # For other files, use regular hash
            $hash_type"sum" "$file" | cut -d' ' -f1
        fi
    else
        echo "invalid_file"
    fi
}

# Check if file was recently processed
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

# Update processed files database
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
    
    # Add new entry
    echo "${file}|${hash}|${timestamp}|${category}|${file_timestamp}" >> "$PROCESSED_FILES_DB"
}

# Enhanced folder structure validation with auto-creation
validate_folder_structure() {
    local base_dir="$1"
    echo -e "${BLUE}🔍 Validating folder structure in: $base_dir${NC}"
    
    if [[ ! -d "$base_dir" ]]; then
        echo -e "${RED}⚠️  Directory not found: $base_dir${NC}"
        return 1
    fi
    
    local required_structure=()
    
    # Use simplified structure if enabled
    if [[ "$ENABLE_SIMPLIFIED_CATEGORIZATION" == "true" ]]; then
        # Simplified 5-category structure
        required_structure=(
            "🤖 AI & ML"
            "📚 Research Papers"
            "🌐 Web Content"
            "📝 Notes & Drafts"
            "💻 Development"
            "🗄️ Archives/Duplicates"
            "🗄️ Archives/Legacy"
            "🗄️ Archives/Quarantine"
        )
        
        # Add Inbox folder to each sync location
        for inbox_path in "${INBOX_LOCATIONS[@]}"; do
            if [[ ! -d "$inbox_path" ]]; then
                echo -e "${YELLOW}📂 Creating Inbox folder: $inbox_path${NC}"
                mkdir -p "$inbox_path"
            fi
        done
        
        # Add custom categories if they exist
        if [[ -f "$CUSTOM_CATEGORIES_FILE" ]]; then
            while IFS='|' read -r cat_name cat_emoji cat_keywords cat_date; do
                if [[ -n "$cat_name" && -n "$cat_emoji" ]]; then
                    required_structure+=("$cat_emoji $cat_name")
                fi
            done < "$CUSTOM_CATEGORIES_FILE"
        fi
    else
        # Enhanced folder structure with more granular categories (legacy)
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
    
    for dir in "${required_structure[@]}"; do
        if [[ ! -d "$base_dir/$dir" ]]; then
            missing_dirs+=("$dir")
        fi
    done
    
    if [[ ${#missing_dirs[@]} -gt 0 ]]; then
        echo -e "${YELLOW}📂 Creating missing directories:${NC}"
        for dir in "${missing_dirs[@]}"; do
            echo -e "${GREEN}   + $dir${NC}"
            mkdir -p "$base_dir/$dir"
            ((created_dirs++))
        done
        echo -e "${GREEN}✅ Created $created_dirs directories${NC}"
    else
        echo -e "${GREEN}✅ Folder structure is complete${NC}"
    fi
}

# Enhanced file integrity checking
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
    local size=$(wc -c < "$file" 2>/dev/null || echo 0)
    if [[ $size -lt $MIN_FILE_SIZE ]]; then
        issues+=("File too small ($size bytes)")
        return 1
    fi
    
    # Check for binary content in text files
    if [[ "$file" == *.md || "$file" == *.txt ]]; then
        if file "$file" | grep -q "binary"; then
            issues+=("Binary content in text file")
            return 1
        fi
    fi
    
    # Check for corrupted UTF-8 encoding
    if [[ "$file" == *.md ]]; then
        if ! iconv -f utf-8 -t utf-8 "$file" >/dev/null 2>&1; then
            issues+=("Invalid UTF-8 encoding")
            return 1
        fi
    fi
    
    # Check for extremely long lines (potential corruption)
    if [[ "$file" == *.md ]]; then
        local max_line_length=$(awk 'length > max_length { max_length = length } END { print max_length }' "$file" 2>/dev/null || echo 0)
        if [[ $max_line_length -gt 10000 ]]; then
            issues+=("Extremely long line detected ($max_line_length chars)")
            return 1
        fi
    fi
    
    return 0
}

# Enhanced content analysis with simplified categorization
analyze_content_category() {
    local file="$1"
    local content=""
    local filename=$(basename "$file")
    
    # Skip if recently processed and incremental mode is enabled
    if [[ "$ENABLE_INCREMENTAL_PROCESSING" == "true" ]] && is_recently_processed "$file"; then
        # Return cached category
        local cached_category=$(grep "^${file}|" "$PROCESSED_FILES_DB" | cut -d'|' -f4)
        if [[ -n "$cached_category" ]]; then
            echo "$cached_category"
            return
        fi
    fi
    
    # Read content for analysis (first 50 lines + filename)
    content=$(head -50 "$file" 2>/dev/null | tr '[:upper:]' '[:lower:]' || echo "")
    content="$content $(echo "$filename" | tr '[:upper:]' '[:lower:]')"
    
    # If simplified categorization is enabled, use the simplified approach
    if [[ "$ENABLE_SIMPLIFIED_CATEGORIZATION" == "true" ]]; then
        # Check against each main category pattern
        for category in "${MAIN_CATEGORIES[@]}"; do
            local pattern="${CATEGORY_PATTERNS[$category]}"
            if [[ -n "$pattern" ]] && echo "$content" | grep -qE "($pattern)"; then
                echo "$category"
                return
            fi
        done
        
        # Check for custom categories if defined
        if [[ -f "$CUSTOM_CATEGORIES_FILE" ]]; then
            while IFS='|' read -r cat_name cat_emoji cat_keywords cat_date; do
                if [[ -n "$cat_keywords" ]]; then
                    # Replace commas with pipe for regex OR
                    local custom_pattern=$(echo "$cat_keywords" | tr ',' '|')
                    if echo "$content" | grep -qE "($custom_pattern)"; then
                        echo "$cat_emoji $cat_name"
                        return
                    fi
                fi
            done < "$CUSTOM_CATEGORIES_FILE"
        fi
        
        # Fallback to Notes & Drafts if no match found
        echo "📝 Notes & Drafts"
        return
    fi
    
    # Legacy categorization logic (47+ categories) if simplified mode is disabled
    # Enhanced AI/ML categorization with scoring
    local ai_ml_score=0
    local research_score=0
    local dev_score=0
    local web_score=0
    local notes_score=0
    
    # AI/ML keyword scoring
    if echo "$content" | grep -qE "(machine learning|ml|artificial intelligence|ai|deep learning|neural|network|model|algorithm|pytorch|tensorflow|keras|scikit|pandas|numpy)"; then
        ((ai_ml_score+=3))
    fi
    
    # Specific AI/ML subcategories
    if echo "$content" | grep -qE "(agent|agentic|multi.agent|autonomous|agent.based|langchain|autogen)"; then
        echo "🤖 AI & ML/Agents"
        return
    elif echo "$content" | grep -qE "(transformer|attention|bert|gpt|llama|claude|language.model|llm|chatgpt|openai)"; then
        echo "🤖 AI & ML/LLMs"
        return
    elif echo "$content" | grep -qE "(cnn|convolutional|computer.vision|opencv|image|vision|detection|recognition)"; then
        echo "🤖 AI & ML/Computer_Vision"
        return
    elif echo "$content" | grep -qE "(nlp|natural.language|text.processing|sentiment|tokenization|embedding)"; then
        echo "🤖 AI & ML/NLP"
        return
    elif echo "$content" | grep -qE "(reinforcement.learning|rl|q.learning|policy|reward|environment)"; then
        echo "🤖 AI & ML/Reinforcement_Learning"
        return
    elif echo "$content" | grep -qE "(mlops|model.deployment|kubernetes|docker|production|monitoring|pipeline)"; then
        echo "🤖 AI & ML/MLOps"
        return
    elif echo "$content" | grep -qE "(neural.network|backpropagation|gradient|activation|layer|epoch|loss)"; then
        echo "🤖 AI & ML/Neural_Networks"
        return
    elif echo "$content" | grep -qE "(framework|library|tool|api|sdk|package|installation|setup)"; then
        echo "🤖 AI & ML/Tools_Frameworks"
        return
    fi
    
    # Research paper detection
    if echo "$content" | grep -qE "(abstract|introduction|methodology|conclusion|references|doi:|arxiv:|paper|study|research|journal|proceedings|conference)"; then
        ((research_score+=3))
        
        if echo "$content" | grep -qE "(physics|quantum|mechanics|thermodynamics|relativity|particle)"; then
            echo "📚 Research Papers/Physics"
            return
        elif echo "$content" | grep -qE "(brain|neuroscience|cognitive|neural|neuron|synaptic|cortex)"; then
            echo "📚 Research Papers/Neuroscience"
            return
        elif echo "$content" | grep -qE "(mathematics|theorem|proof|equation|calculus|algebra|geometry)"; then
            echo "📚 Research Papers/Mathematics"
            return
        elif echo "$content" | grep -qE "(biology|dna|rna|protein|gene|cell|organism|evolution)"; then
            echo "📚 Research Papers/Biology"
            return
        elif echo "$content" | grep -qE "(computer.science|algorithm|data.structure|complexity|programming|software)"; then
            echo "📚 Research Papers/Computer_Science"
            return
        elif [[ $ai_ml_score -gt 0 ]]; then
            echo "📚 Research Papers/AI_ML"
            return
        fi
    fi
    
    # Development content detection
    if echo "$content" | grep -qE "(api|endpoint|rest|graphql|json|http|web.service|microservice)"; then
        echo "💻 Development/APIs"
        return
    elif echo "$content" | grep -qE "(kubernetes|k8s|docker|container|pod|deploy|orchestration|helm)"; then
        echo "💻 Development/Kubernetes"
        return
    elif echo "$content" | grep -qE "(git|github|gitlab|commit|branch|merge|pull.request|version.control)"; then
        echo "💻 Development/Git"
        return
    elif echo "$content" | grep -qE "(database|sql|nosql|mongodb|postgresql|mysql|redis|elasticsearch)"; then
        echo "💻 Development/Databases"
        return
    elif echo "$content" | grep -qE "(react|vue|angular|javascript|typescript|html|css|frontend|ui|ux)"; then
        echo "💻 Development/Frontend"
        return
    elif echo "$content" | grep -qE "(node|express|django|flask|backend|server|api|microservice)"; then
        echo "💻 Development/Backend"
        return
    elif echo "$content" | grep -qE "(devops|ci/cd|jenkins|github.actions|terraform|ansible|infrastructure)"; then
        echo "💻 Development/DevOps"
        return
    elif echo "$content" | grep -qE "(documentation|docs|guide|tutorial|how.to|readme|manual)"; then
        echo "💻 Development/Documentation"
        return
    fi
    
    # Web content detection
    if echo "$content" | grep -qE "(tutorial|guide|how.to|step.by.step|walkthrough|example)"; then
        echo "🌐 Web Content/Tutorials"
        return
    elif echo "$content" | grep -qE "(article|blog|post|news|update|announcement|press.release)"; then
        echo "🌐 Web Content/Articles"
        return
    elif echo "$content" | grep -qE "(guide|manual|reference|handbook|documentation)"; then
        echo "🌐 Web Content/Guides"
        return
    elif echo "$content" | grep -qE "(news|breaking|update|announcement|latest|today)"; then
        echo "🌐 Web Content/News"
        return
    fi
    
    # Notes and drafts detection
    if echo "$content" | grep -qE "(meeting|notes|discussion|agenda|action.items|minutes)"; then
        echo "📝 Notes & Drafts/Meeting_Notes"
        return
    elif echo "$content" | grep -qE "(idea|brainstorm|concept|thought|inspiration|innovation)"; then
        echo "📝 Notes & Drafts/Ideas"
        return
    elif echo "$content" | grep -qE "(literature|book|chapter|summary|review|analysis)"; then
        echo "📝 Notes & Drafts/Literature_Notes"
        return
    elif echo "$filename" | grep -qE "^(untitled|new|draft|temp|temporary)"; then
        echo "📝 Notes & Drafts/Untitled"
        return
    elif echo "$filename" | grep -qE "^[0-9]{4}-[0-9]{2}-[0-9]{2}"; then
        echo "📝 Notes & Drafts/Daily_Notes"
        return
    fi
    
    # Data and analysis detection
    if echo "$content" | grep -qE "(dataset|data|csv|analysis|visualization|chart|graph|statistics)"; then
        if echo "$content" | grep -qE "(dataset|data.collection|raw.data|structured)"; then
            echo "📊 Data/Datasets"
            return
        elif echo "$content" | grep -qE "(analysis|statistical|correlation|regression|hypothesis)"; then
            echo "📊 Data/Analysis"
            return
        elif echo "$content" | grep -qE "(visualization|chart|graph|plot|dashboard|report)"; then
            echo "📊 Data/Visualizations"
            return
        fi
    fi
    
    # Project detection
    if echo "$content" | grep -qE "(project|plan|roadmap|milestone|deliverable|timeline)"; then
        if echo "$content" | grep -qE "(active|current|ongoing|in.progress|wip)"; then
            echo "🔬 Projects/Active"
            return
        elif echo "$content" | grep -qE "(completed|finished|done|delivered|closed)"; then
            echo "🔬 Projects/Completed"
            return
        elif echo "$content" | grep -qE "(idea|concept|proposal|draft|brainstorm)"; then
            echo "🔬 Projects/Ideas"
            return
        fi
    fi
    
    # Default fallback based on highest score
    if [[ $ai_ml_score -gt 0 ]]; then
        echo "🤖 AI & ML/Tools_Frameworks"
    elif [[ $research_score -gt 0 ]]; then
        echo "📚 Research Papers/Computer_Science"
    elif [[ $dev_score -gt 0 ]]; then
        echo "💻 Development/Documentation"
    elif [[ $web_score -gt 0 ]]; then
        echo "🌐 Web Content/Articles"
    else
        echo "📝 Notes & Drafts/Untitled"
    fi
}

# Advanced duplicate detection with content hashing
detect_duplicates() {
    local file="$1"
    local content_hash=$(calculate_content_hash "$file")
    local duplicates=()
    
    if [[ "$ENABLE_ADVANCED_DEDUPLICATION" == "true" ]]; then
        # Check content hash database for duplicates
        while IFS='|' read -r hash filepath size timestamp; do
            if [[ "$hash" == "$content_hash" && "$filepath" != "$file" && -f "$filepath" ]]; then
                duplicates+=("$filepath")
            fi
        done < "$CONTENT_HASH_DB"
        
        # Update hash database
        local file_size=$(wc -c < "$file" 2>/dev/null || echo 0)
        local file_timestamp=$(stat -f %m "$file" 2>/dev/null || echo 0)
        
        # Remove old entries for this file
        if [[ -f "$CONTENT_HASH_DB" ]]; then
            grep -v "|${file}|" "$CONTENT_HASH_DB" > "$CONTENT_HASH_DB.tmp" 2>/dev/null || true
            mv "$CONTENT_HASH_DB.tmp" "$CONTENT_HASH_DB"
        fi
        
        # Add new entry
        echo "${content_hash}|${file}|${file_size}|${file_timestamp}" >> "$CONTENT_HASH_DB"
    fi
    
    printf '%s\n' "${duplicates[@]}"
}

# Enhanced file movement with metadata preservation
move_file_enhanced() {
    local src="$1"
    local dest_dir="$2"
    local filename=$(basename "$src")
    local preserve_metadata="${3:-true}"
    
    # Validate file integrity first
    if ! check_file_integrity "$src"; then
        echo -e "${RED}🗑️  Removing corrupted file: $filename${NC}"
        rm "$src" 2>/dev/null || true
        ((ERROR_FILES++))
        return
    fi
    
    # Detect and handle duplicates
    local duplicates=($(detect_duplicates "$src"))
    if [[ ${#duplicates[@]} -gt 0 ]]; then
        echo -e "${YELLOW}⚠️  Found ${#duplicates[@]} duplicate(s) for: $filename${NC}"
        
        # Find the best version (newest, largest, or most content)
        local best_file="$src"
        local best_size=$(wc -c < "$src" 2>/dev/null || echo 0)
        local best_timestamp=$(stat -f %m "$src" 2>/dev/null || echo 0)
        
        for duplicate in "${duplicates[@]}"; do
            if [[ -f "$duplicate" ]]; then
                local dup_size=$(wc -c < "$duplicate" 2>/dev/null || echo 0)
                local dup_timestamp=$(stat -f %m "$duplicate" 2>/dev/null || echo 0)
                
                # Choose based on size first, then timestamp
                if [[ $dup_size -gt $best_size ]] || [[ $dup_size -eq $best_size && $dup_timestamp -gt $best_timestamp ]]; then
                    best_file="$duplicate"
                    best_size=$dup_size
                    best_timestamp=$dup_timestamp
                fi
            fi
        done
        
        # Move inferior versions to duplicates archive
        mkdir -p "🗄️ Archives/Duplicates"
        for duplicate in "${duplicates[@]}"; do
            if [[ -f "$duplicate" && "$duplicate" != "$best_file" ]]; then
                local dup_name=$(basename "$duplicate")
                local dup_hash=$(calculate_content_hash "$duplicate" | cut -c1-8)
                mv "$duplicate" "🗄️ Archives/Duplicates/${dup_name%.md}_${dup_hash}.md" 2>/dev/null || true
                echo -e "${GREEN}   Archived duplicate: $dup_name${NC}"
            fi
        done
        
        # If the best file is not the current one, remove current
        if [[ "$best_file" != "$src" ]]; then
            rm "$src" 2>/dev/null || true
            echo -e "${GREEN}   Kept better version: $(basename "$best_file")${NC}"
            ((DEDUPLICATED_FILES++))
            return
        fi
        
        ((DEDUPLICATED_FILES++))
    fi
    
    # Use smart categorization if enabled and no destination specified
    if [[ "$ENABLE_SMART_CATEGORIZATION" == "true" && "$dest_dir" == "auto" ]]; then
        dest_dir=$(analyze_content_category "$src")
        if [[ -n "$dest_dir" ]]; then
            echo -e "${PURPLE}🧠 Smart categorization: $filename -> $dest_dir${NC}"
            ((CATEGORIZED_FILES++))
        else
            dest_dir="📝 Notes & Drafts/Untitled"  # fallback
        fi
    fi
    
    # Check filename length and suggest shortening
    if [[ ${#filename} -gt $MAX_FILENAME_LENGTH ]]; then
        local short_name=$(echo "$filename" | cut -c1-$((MAX_FILENAME_LENGTH-7)))
        local extension="${filename##*.}"
        short_name="${short_name}...${extension}"
        echo -e "${YELLOW}✂️  Long filename detected: $filename (${#filename} chars)${NC}"
        echo -e "${YELLOW}   Suggested short name: $short_name${NC}"
    fi
    
    if [[ -f "$src" ]]; then
        mkdir -p "$dest_dir"
        
        # Preserve metadata if requested
        if [[ "$preserve_metadata" == "true" && "$ENABLE_METADATA_PRESERVATION" == "true" ]]; then
            # Store original timestamps
            local access_time=$(stat -f %a "$src" 2>/dev/null || echo 0)
            local modify_time=$(stat -f %m "$src" 2>/dev/null || echo 0)
            
            # Move file
            mv "$src" "$dest_dir/"
            
            # Restore timestamps
            if [[ $access_time -gt 0 && $modify_time -gt 0 ]]; then
                touch -t "$(date -r $modify_time '+%Y%m%d%H%M.%S')" "$dest_dir/$filename" 2>/dev/null || true
            fi
        else
            mv "$src" "$dest_dir/"
        fi
        
        ((MOVED_FILES++))
        
        # Update processed database
        local content_hash=$(calculate_content_hash "$dest_dir/$filename")
        update_processed_db "$dest_dir/$filename" "$content_hash" "$dest_dir"
    fi
}

# Cross-sync validation with detailed reporting
validate_sync_consistency() {
    echo -e "${BLUE}🔄 Validating sync consistency across locations...${NC}"
    
    local inconsistencies=()
    local reference_dir="${SYNC_LOCATIONS[0]}"
    local total_checks=0
    local passed_checks=0
    
    if [[ ! -d "$reference_dir" ]]; then
        echo -e "${RED}⚠️  Reference directory not found: $reference_dir${NC}"
        return 1
    fi
    
    # Check each sync location against reference
    for sync_dir in "${SYNC_LOCATIONS[@]:1}"; do
        if [[ ! -d "$sync_dir" ]]; then
            echo -e "${RED}⚠️  Sync directory not found: $sync_dir${NC}"
            inconsistencies+=("Missing directory: $sync_dir")
            continue
        fi
        
        ((total_checks++))
        
        # Compare directory structures
        local ref_structure=$(find "$reference_dir" -type d 2>/dev/null | sed "s|$reference_dir||" | sort)
        local sync_structure=$(find "$sync_dir" -type d 2>/dev/null | sed "s|$sync_dir||" | sort)
        
        if [[ "$ref_structure" == "$sync_structure" ]]; then
            echo -e "${GREEN}✅ Directory structure matches: $(basename "$sync_dir")${NC}"
            ((passed_checks++))
        else
            echo -e "${RED}❌ Directory structure mismatch: $(basename "$sync_dir")${NC}"
            inconsistencies+=("Directory structure mismatch: $sync_dir")
        fi
        
        # Compare file counts
        local ref_files=$(find "$reference_dir" -type f -name "*.md" | wc -l)
        local sync_files=$(find "$sync_dir" -type f -name "*.md" | wc -l)
        
        if [[ $ref_files -eq $sync_files ]]; then
            echo -e "${GREEN}✅ File count matches: $sync_files files${NC}"
        else
            echo -e "${YELLOW}⚠️  File count mismatch: $ref_files vs $sync_files${NC}"
            inconsistencies+=("File count mismatch: $sync_dir ($ref_files vs $sync_files)")
        fi
    done
    
    echo -e "${CYAN}📊 Sync validation summary: $passed_checks/$total_checks locations passed${NC}"
    
    if [[ ${#inconsistencies[@]} -gt 0 ]]; then
        echo -e "${RED}⚠️  Found ${#inconsistencies[@]} sync inconsistencies:${NC}"
        printf '%s\n' "${inconsistencies[@]}"
        return 1
    else
        echo -e "${GREEN}✅ All sync locations are consistent${NC}"
        return 0
    fi
}

# Generate comprehensive statistics
generate_statistics() {
    echo -e "${CYAN}📊 Generating comprehensive statistics...${NC}"
    
    local stats_file="organization_stats_$(date +%Y%m%d_%H%M%S).json"
    local report_file="organization_report_$(date +%Y%m%d_%H%M%S).md"
    
    # Create JSON stats
    cat > "$stats_file" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "processing_stats": {
    "total_files": $TOTAL_FILES,
    "processed_files": $PROCESSED_FILES,
    "moved_files": $MOVED_FILES,
    "deduplicated_files": $DEDUPLICATED_FILES,
    "categorized_files": $CATEGORIZED_FILES,
    "error_files": $ERROR_FILES
  },
  "configuration": {
    "enable_content_analysis": $ENABLE_CONTENT_ANALYSIS,
    "enable_smart_categorization": $ENABLE_SMART_CATEGORIZATION,
    "enable_incremental_processing": $ENABLE_INCREMENTAL_PROCESSING,
    "enable_metadata_preservation": $ENABLE_METADATA_PRESERVATION,
    "enable_advanced_deduplication": $ENABLE_ADVANCED_DEDUPLICATION,
    "min_file_size": $MIN_FILE_SIZE,
    "max_filename_length": $MAX_FILENAME_LENGTH
  },
  "sync_locations": [
$(printf '    "%s"' "${SYNC_LOCATIONS[@]}" | sed 's/$/,/g' | sed '$s/,$//g')
  ]
}
EOF
    
    # Create markdown report
    cat > "$report_file" << EOF
# 📋 Enhanced Document Organization Report

**Date:** $(date)  
**Script Version:** 2.0 Enhanced

## 📊 Processing Statistics

- **Total Files Processed:** $TOTAL_FILES
- **Files Moved/Organized:** $MOVED_FILES
- **Files Deduplicated:** $DEDUPLICATED_FILES
- **Files Auto-Categorized:** $CATEGORIZED_FILES
- **Files with Errors:** $ERROR_FILES
- **Processing Success Rate:** $((PROCESSED_FILES * 100 / TOTAL_FILES))%

## 🗂️ Directory Structure

\`\`\`
$(find "$SOURCE_DIR" -type d | sort | sed "s|$SOURCE_DIR||g" | sed 's|^|  |g')
\`\`\`

## 📈 File Distribution

\`\`\`
$(find "$SOURCE_DIR" -name "*.md" -type f | cut -d'/' -f2-3 | sort | uniq -c | sort -nr)
\`\`\`

## 🔧 Configuration Used

- Content Analysis: $ENABLE_CONTENT_ANALYSIS
- Smart Categorization: $ENABLE_SMART_CATEGORIZATION
- Incremental Processing: $ENABLE_INCREMENTAL_PROCESSING
- Metadata Preservation: $ENABLE_METADATA_PRESERVATION
- Advanced Deduplication: $ENABLE_ADVANCED_DEDUPLICATION

## 🌐 Sync Locations

$(printf '- %s\n' "${SYNC_LOCATIONS[@]}")

## 📁 Backup Location

Backup created at: \`$BACKUP_DIR\`

---
*Generated by Enhanced Document Organization Script v2.0*
EOF
    
    echo -e "${GREEN}✅ Statistics saved to: $stats_file${NC}"
    echo -e "${GREEN}✅ Report saved to: $report_file${NC}"
}

# Main execution
main() {
    echo -e "${CYAN}🗂️  Starting Enhanced Document Organization v2.0...${NC}"
    echo -e "${CYAN}📁 Source: $SOURCE_DIR${NC}"
    echo -e "${CYAN}💾 Backup: $BACKUP_DIR${NC}"
    echo -e "${CYAN}🔄 Sync locations: ${#SYNC_LOCATIONS[@]} directories${NC}"
    
    # Initialize system
    initialize_cache
    
    # Count total files for progress tracking
    TOTAL_FILES=$(find "$SOURCE_DIR" -type f -name "*.md" | wc -l)
    echo -e "${CYAN}📊 Total files to process: $TOTAL_FILES${NC}"
    
    # Pre-organization validation
    echo -e "${BLUE}🔍 Running pre-organization validation...${NC}"
    for sync_location in "${SYNC_LOCATIONS[@]}"; do
        if [[ -d "$sync_location" ]]; then
            validate_folder_structure "$sync_location"
        fi
    done
    
    if [[ "$ENABLE_CROSS_SYNC_VALIDATION" == "true" ]]; then
        validate_sync_consistency
    fi
    
    # Create backup
    echo -e "${BLUE}📋 Creating backup...${NC}"
    cp -R "$SOURCE_DIR" "$BACKUP_DIR"
    
    cd "$SOURCE_DIR"
    
    # Create enhanced directory structure
    echo -e "${BLUE}📂 Creating enhanced directory structure...${NC}"
    validate_folder_structure "$SOURCE_DIR"
    
    # Remove empty files
    echo -e "${BLUE}🗑️  Removing empty files...${NC}"
    local empty_files=$(find . -type f -name "*.md" -size 0)
    if [[ -n "$empty_files" ]]; then
        echo "$empty_files" | xargs rm -f
        echo -e "${GREEN}✅ Removed empty files${NC}"
    fi
    
    # Process files with enhanced logic
    echo -e "${BLUE}🔍 Processing files with enhanced categorization...${NC}"
    
    local current_file=0
    find . -maxdepth 1 -type f -name "*.md" | while read -r file; do
        ((current_file++))
        ((PROCESSED_FILES++))
        
        update_progress $current_file $TOTAL_FILES "Processing files"
        
        # Skip if recently processed (incremental mode)
        if [[ "$ENABLE_INCREMENTAL_PROCESSING" == "true" ]] && is_recently_processed "$file"; then
            continue
        fi
        
        # Auto-categorize and move
        move_file_enhanced "$file" "auto" true
    done
    
    echo -e "\n${BLUE}🧹 Cleaning up empty directories...${NC}"
    find . -type d -empty -delete 2>/dev/null || true
    
    # Final validation
    echo -e "${BLUE}🔍 Running final validation...${NC}"
    if [[ "$ENABLE_CROSS_SYNC_VALIDATION" == "true" ]]; then
        validate_sync_consistency
    fi
    
    # Generate comprehensive statistics
    generate_statistics
    
    echo -e "${GREEN}✅ Enhanced organization complete!${NC}"
    echo -e "${GREEN}📊 Processed: $PROCESSED_FILES files${NC}"
    echo -e "${GREEN}📦 Moved: $MOVED_FILES files${NC}"
    echo -e "${GREEN}🔄 Deduplicated: $DEDUPLICATED_FILES files${NC}"
    echo -e "${GREEN}🧠 Auto-categorized: $CATEGORIZED_FILES files${NC}"
    echo -e "${GREEN}💾 Backup: $BACKUP_DIR${NC}"
}

# Run main function
main "$@"
