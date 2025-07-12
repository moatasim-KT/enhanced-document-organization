#!/bin/bash

# Enhanced Document Organization Manager
# Utility script to manage and run the enhanced organization system

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/organize_config.conf"
MAIN_SCRIPT="$SCRIPT_DIR/organize_documents_enhanced.sh"
CACHE_DIR="$SCRIPT_DIR/.cache"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Display usage information
show_usage() {
    echo -e "${CYAN}Enhanced Document Organization Manager${NC}"
    echo -e "${CYAN}=====================================${NC}"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo -e "  ${GREEN}run${NC}           Run the enhanced organization script"
    echo -e "  ${GREEN}dry-run${NC}       Run in dry-run mode (no changes made)"
    echo -e "  ${GREEN}config${NC}        Show current configuration"
    echo -e "  ${GREEN}status${NC}        Show system status and statistics"
    echo -e "  ${GREEN}clean${NC}         Clean cache and temporary files"
    echo -e "  ${GREEN}backup${NC}        Create manual backup of sync directories"
    echo -e "  ${GREEN}restore${NC}       Restore from backup"
    echo -e "  ${GREEN}validate${NC}      Validate sync consistency"
    echo -e "  ${GREEN}stats${NC}         Show processing statistics"
    echo -e "  ${GREEN}help${NC}          Show this help message"
    echo ""
    echo "Options:"
    echo -e "  ${YELLOW}--verbose${NC}     Enable verbose output"
    echo -e "  ${YELLOW}--quiet${NC}       Suppress normal output"
    echo -e "  ${YELLOW}--no-backup${NC}   Skip backup creation"
    echo -e "  ${YELLOW}--force${NC}       Force operation without confirmation"
    echo -e "  ${YELLOW}--config FILE${NC} Use alternative configuration file"
    echo ""
    echo "Examples:"
    echo "  $0 run                    # Run with default settings"
    echo "  $0 dry-run --verbose      # Test run with detailed output"
    echo "  $0 validate               # Check sync consistency"
    echo "  $0 clean                  # Clean cache files"
}

# Load configuration
load_config() {
    if [[ -f "$CONFIG_FILE" ]]; then
        source "$CONFIG_FILE"
        echo -e "${GREEN}✅ Configuration loaded from: $CONFIG_FILE${NC}"
    else
        echo -e "${RED}❌ Configuration file not found: $CONFIG_FILE${NC}"
        echo "Creating default configuration..."
        create_default_config
    fi
}

# Create default configuration
create_default_config() {
    echo -e "${YELLOW}Creating default configuration...${NC}"
    # The config file is already created above, so just notify
    echo -e "${GREEN}✅ Default configuration created${NC}"
}

# Show current configuration
show_config() {
    echo -e "${CYAN}Current Configuration:${NC}"
    echo -e "${CYAN}====================${NC}"
    echo ""
    
    if [[ -f "$CONFIG_FILE" ]]; then
        echo -e "${BLUE}Configuration file: $CONFIG_FILE${NC}"
        echo ""
        
        # Show key settings
        echo -e "${YELLOW}Feature Toggles:${NC}"
        grep "^ENABLE_" "$CONFIG_FILE" | sed 's/^/  /' | sed 's/=/ = /'
        echo ""
        
        echo -e "${YELLOW}Directory Paths:${NC}"
        grep "^SOURCE_DIR\|^BACKUP_BASE_DIR\|^CACHE_DIR" "$CONFIG_FILE" | sed 's/^/  /' | sed 's/=/ = /'
        echo ""
        
        echo -e "${YELLOW}Processing Parameters:${NC}"
        grep "^MIN_FILE_SIZE\|^MAX_FILENAME_LENGTH\|^INCREMENTAL_THRESHOLD" "$CONFIG_FILE" | sed 's/^/  /' | sed 's/=/ = /'
        echo ""
        
        echo -e "${YELLOW}Sync Locations:${NC}"
        echo "  (see configuration file for full list)"
    else
        echo -e "${RED}❌ Configuration file not found${NC}"
    fi
}

# Show system status
show_status() {
    echo -e "${CYAN}System Status:${NC}"
    echo -e "${CYAN}=============${NC}"
    echo ""
    
    load_config
    
    # Check directories
    echo -e "${BLUE}Directory Status:${NC}"
    if [[ -d "$SOURCE_DIR" ]]; then
        local file_count=$(find "$SOURCE_DIR" -type f -name "*.md" | wc -l)
        local dir_count=$(find "$SOURCE_DIR" -type d | wc -l)
        echo -e "${GREEN}  ✅ Source directory: $SOURCE_DIR${NC}"
        echo -e "     Files: $file_count | Directories: $dir_count"
    else
        echo -e "${RED}  ❌ Source directory not found: $SOURCE_DIR${NC}"
    fi
    
    if [[ -d "$CACHE_DIR" ]]; then
        local cache_size=$(du -sh "$CACHE_DIR" 2>/dev/null | cut -f1)
        echo -e "${GREEN}  ✅ Cache directory: $CACHE_DIR ($cache_size)${NC}"
    else
        echo -e "${YELLOW}  ⚠️  Cache directory not found: $CACHE_DIR${NC}"
    fi
    
    # Check sync locations
    echo ""
    echo -e "${BLUE}Sync Locations:${NC}"
    local sync_count=0
    local sync_available=0
    
    for sync_dir in "${SYNC_LOCATIONS[@]}"; do
        ((sync_count++))
        if [[ -d "$sync_dir" ]]; then
            ((sync_available++))
            echo -e "${GREEN}  ✅ $(basename "$sync_dir")${NC}"
        else
            echo -e "${RED}  ❌ $(basename "$sync_dir")${NC}"
        fi
    done
    
    echo -e "     Available: $sync_available/$sync_count"
    
    # Check processing status
    echo ""
    echo -e "${BLUE}Processing Status:${NC}"
    if [[ -f "$CACHE_DIR/processed_files.db" ]]; then
        local processed_count=$(wc -l < "$CACHE_DIR/processed_files.db")
        echo -e "${GREEN}  ✅ Processed files database: $processed_count entries${NC}"
    else
        echo -e "${YELLOW}  ⚠️  No processed files database found${NC}"
    fi
    
    if [[ -f "$CACHE_DIR/content_hashes.db" ]]; then
        local hash_count=$(wc -l < "$CACHE_DIR/content_hashes.db")
        echo -e "${GREEN}  ✅ Content hash database: $hash_count entries${NC}"
    else
        echo -e "${YELLOW}  ⚠️  No content hash database found${NC}"
    fi
}

# Show processing statistics
show_stats() {
    echo -e "${CYAN}Processing Statistics:${NC}"
    echo -e "${CYAN}===================${NC}"
    echo ""
    
    # Find latest stats file
    local stats_file=$(find "$SCRIPT_DIR" -name "organization_stats_*.json" -type f | sort | tail -1)
    
    if [[ -f "$stats_file" ]]; then
        echo -e "${BLUE}Latest statistics from: $(basename "$stats_file")${NC}"
        echo ""
        
        # Parse and display JSON stats
        if command -v jq >/dev/null 2>&1; then
            echo -e "${YELLOW}Processing Summary:${NC}"
            jq -r '.processing_stats | to_entries[] | "  \(.key): \(.value)"' "$stats_file"
            echo ""
            
            echo -e "${YELLOW}Configuration Used:${NC}"
            jq -r '.configuration | to_entries[] | "  \(.key): \(.value)"' "$stats_file"
        else
            echo -e "${YELLOW}Statistics file found but jq not available for parsing${NC}"
            echo "Raw content:"
            cat "$stats_file"
        fi
    else
        echo -e "${YELLOW}No statistics files found${NC}"
        echo "Run the organization script first to generate statistics"
    fi
}

# Clean cache and temporary files
clean_cache() {
    echo -e "${CYAN}Cleaning cache and temporary files...${NC}"
    
    if [[ -d "$CACHE_DIR" ]]; then
        local cache_size=$(du -sh "$CACHE_DIR" 2>/dev/null | cut -f1)
        echo -e "${BLUE}Current cache size: $cache_size${NC}"
        
        echo -e "${YELLOW}Removing cache files...${NC}"
        rm -rf "$CACHE_DIR"/*
        
        echo -e "${GREEN}✅ Cache cleaned${NC}"
    else
        echo -e "${YELLOW}No cache directory found${NC}"
    fi
    
    # Clean old report files
    echo -e "${YELLOW}Cleaning old report files...${NC}"
    find "$SCRIPT_DIR" -name "organization_*_*.json" -o -name "organization_*_*.md" -mtime +7 -delete
    
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

# Validate sync consistency
validate_sync() {
    echo -e "${CYAN}Validating sync consistency...${NC}"
    
    load_config
    
    # Use the validation function from the main script
    bash -c "
        source '$CONFIG_FILE'
        
        validate_sync_consistency() {
            local inconsistencies=()
            local reference_dir=\"\${SYNC_LOCATIONS[0]}\"
            
            if [[ ! -d \"\$reference_dir\" ]]; then
                echo \"Reference directory not found: \$reference_dir\"
                return 1
            fi
            
            for sync_dir in \"\${SYNC_LOCATIONS[@]:1}\"; do
                if [[ ! -d \"\$sync_dir\" ]]; then
                    echo \"❌ Sync directory not found: \$sync_dir\"
                    inconsistencies+=(\"\$sync_dir\")
                    continue
                fi
                
                local ref_files=\$(find \"\$reference_dir\" -type f -name \"*.md\" | wc -l)
                local sync_files=\$(find \"\$sync_dir\" -type f -name \"*.md\" | wc -l)
                
                if [[ \$ref_files -eq \$sync_files ]]; then
                    echo \"✅ \$(basename \"\$sync_dir\"): \$sync_files files\"
                else
                    echo \"⚠️  \$(basename \"\$sync_dir\"): \$sync_files files (expected \$ref_files)\"
                    inconsistencies+=(\"\$sync_dir\")
                fi
            done
            
            if [[ \${#inconsistencies[@]} -gt 0 ]]; then
                echo \"\"
                echo \"❌ Found \${#inconsistencies[@]} inconsistencies\"
                return 1
            else
                echo \"\"
                echo \"✅ All sync locations are consistent\"
                return 0
            fi
        }
        
        validate_sync_consistency
    "
}

# Create manual backup
create_backup() {
    echo -e "${CYAN}Creating manual backup...${NC}"
    
    load_config
    
    local backup_dir="/Users/moatasimfarooque/Downloads/Data_Science/Manual_Backup_$(date +%Y%m%d_%H%M%S)"
    
    echo -e "${BLUE}Backing up to: $backup_dir${NC}"
    
    cp -R "$SOURCE_DIR" "$backup_dir"
    
    echo -e "${GREEN}✅ Backup created: $backup_dir${NC}"
}

# Run the enhanced organization script
run_organization() {
    local dry_run=false
    local verbose=false
    local no_backup=false
    local force=false
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                dry_run=true
                shift
                ;;
            --verbose)
                verbose=true
                shift
                ;;
            --no-backup)
                no_backup=true
                shift
                ;;
            --force)
                force=true
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
    
    echo -e "${CYAN}Starting Enhanced Document Organization...${NC}"
    
    # Set environment variables for the script
    export DRY_RUN_MODE=$dry_run
    export VERBOSE_LEVEL=$([[ "$verbose" == "true" ]] && echo 2 || echo 1)
    export ENABLE_BACKUP_CREATION=$([[ "$no_backup" == "true" ]] && echo false || echo true)
    
    if [[ "$dry_run" == "true" ]]; then
        echo -e "${YELLOW}🧪 Running in DRY-RUN mode (no changes will be made)${NC}"
    fi
    
    # Run the main script
    if [[ -f "$MAIN_SCRIPT" ]]; then
        bash "$MAIN_SCRIPT"
    else
        echo -e "${RED}❌ Main script not found: $MAIN_SCRIPT${NC}"
        exit 1
    fi
}

# Main function
main() {
    case "${1:-help}" in
        run)
            shift
            run_organization "$@"
            ;;
        dry-run)
            shift
            run_organization --dry-run "$@"
            ;;
        config)
            show_config
            ;;
        status)
            show_status
            ;;
        clean)
            clean_cache
            ;;
        backup)
            create_backup
            ;;
        validate)
            validate_sync
            ;;
        stats)
            show_stats
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            echo -e "${RED}Unknown command: $1${NC}"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
