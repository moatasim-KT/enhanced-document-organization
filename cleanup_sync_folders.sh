#!/bin/bash

# Comprehensive Sync Folder Cleanup Script
# Removes all unwanted files while preserving Obsidian-related files and legitimate documents

set -euo pipefail

# Configuration
SYNC_HUB="/Users/moatasimfarooque/Sync_Hub_New"
ICLOUD_SYNC="/Users/moatasimfarooque/Library/Mobile Documents/iCloud~md~obsidian/Documents/Sync"
GDRIVE_SYNC="/Users/moatasimfarooque/Library/CloudStorage/GoogleDrive-moatasim23android@gmail.com/My Drive/Sync"
BACKUP_DIR="/Users/moatasimfarooque/Sync_Cleanup_Backup_$(date +%Y%m%d_%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Create backup directory
create_backup() {
    log "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
}

# Function to check if a file/directory should be preserved
should_preserve() {
    local item="$1"
    local basename=$(basename "$item")
    
    # Preserve Obsidian-related files
    if [[ "$basename" == ".obsidian" ]] || [[ "$basename" =~ ^\.obsidian ]]; then
        return 0
    fi
    
    # Preserve legitimate category directories
    if [[ "$basename" == "AI & ML" ]] || \
       [[ "$basename" == "Development" ]] || \
       [[ "$basename" == "Finance" ]] || \
       [[ "$basename" == "Inbox" ]] || \
       [[ "$basename" == "Mathematics & Statistics" ]] || \
       [[ "$basename" == "Notes & Drafts" ]] || \
       [[ "$basename" == "Projects & Ideas" ]] || \
       [[ "$basename" == "Research Papers" ]] || \
       [[ "$basename" == "Web Content" ]]; then
        return 0
    fi
    
    # Preserve legitimate document files (basic check)
    if [[ -f "$item" ]] && [[ "$basename" =~ \.(md|txt|pdf|doc|docx|png|jpg|jpeg|gif)$ ]]; then
        # Additional check: make sure it's not a system file
        if [[ ! "$basename" =~ ^\. ]] && [[ ! "$basename" =~ _history$ ]] && [[ ! "$basename" =~ \.log$ ]]; then
            return 0
        fi
    fi
    
    # Don't preserve anything else
    return 1
}

# Function to clean a directory
clean_directory() {
    local dir="$1"
    local dir_name="$2"
    
    if [[ ! -d "$dir" ]]; then
        warn "$dir_name directory does not exist: $dir"
        return
    fi
    
    log "Cleaning $dir_name: $dir"
    
    local removed_count=0
    local preserved_count=0
    
    # Process all items in the directory
    while IFS= read -r -d '' item; do
        if should_preserve "$item"; then
            log "  Preserving: $(basename "$item")"
            ((preserved_count++))
        else
            log "  Removing: $(basename "$item")"
            
            # Backup before removal
            local backup_path="$BACKUP_DIR/$dir_name/$(basename "$item")"
            mkdir -p "$(dirname "$backup_path")"
            
            if [[ -d "$item" ]]; then
                cp -R "$item" "$backup_path" 2>/dev/null || warn "Failed to backup: $item"
                rm -rf "$item"
            else
                cp "$item" "$backup_path" 2>/dev/null || warn "Failed to backup: $item"
                rm -f "$item"
            fi
            
            ((removed_count++))
        fi
    done < <(find "$dir" -maxdepth 1 -mindepth 1 -print0)
    
    success "$dir_name cleanup complete: $removed_count removed, $preserved_count preserved"
}

# Function to clean system dotfiles from directory
clean_system_dotfiles() {
    local dir="$1"
    local dir_name="$2"
    
    if [[ ! -d "$dir" ]]; then
        warn "$dir_name directory does not exist: $dir"
        return
    fi
    
    log "Removing system dotfiles from $dir_name: $dir"
    
    local removed_count=0
    
    # Remove system dotfiles (but preserve .obsidian)
    while IFS= read -r -d '' item; do
        local basename=$(basename "$item")
        
        # Skip if it's .obsidian related
        if [[ "$basename" == ".obsidian" ]] || [[ "$basename" =~ ^\.obsidian ]]; then
            log "  Preserving Obsidian file: $basename"
            continue
        fi
        
        # Remove other dotfiles
        if [[ "$basename" =~ ^\. ]]; then
            log "  Removing system dotfile: $basename"
            
            # Backup before removal
            local backup_path="$BACKUP_DIR/$dir_name/dotfiles/$(basename "$item")"
            mkdir -p "$(dirname "$backup_path")"
            
            if [[ -d "$item" ]]; then
                cp -R "$item" "$backup_path" 2>/dev/null || warn "Failed to backup: $item"
                rm -rf "$item"
            else
                cp "$item" "$backup_path" 2>/dev/null || warn "Failed to backup: $item"
                rm -f "$item"
            fi
            
            ((removed_count++))
        fi
    done < <(find "$dir" -maxdepth 1 -name ".*" -print0)
    
    success "System dotfiles cleanup complete: $removed_count removed"
}

# Function to clean corrupted log directories
clean_log_directories() {
    local dir="$1"
    local dir_name="$2"
    
    if [[ ! -d "$dir" ]]; then
        warn "$dir_name directory does not exist: $dir"
        return
    fi
    
    log "Removing corrupted log directories from $dir_name: $dir"
    
    local removed_count=0
    
    # Remove directories with log message names
    while IFS= read -r -d '' item; do
        local basename=$(basename "$item")
        
        # Check if it's a log message directory
        if [[ "$basename" =~ ^\[20[0-9][0-9]-[0-9][0-9]-[0-9][0-9] ]] && [[ "$basename" =~ organize_module ]]; then
            log "  Removing corrupted log directory: ${basename:0:50}..."
            
            # Backup before removal
            local backup_path="$BACKUP_DIR/$dir_name/log_dirs/log_dir_$removed_count"
            mkdir -p "$(dirname "$backup_path")"
            
            cp -R "$item" "$backup_path" 2>/dev/null || warn "Failed to backup: $item"
            rm -rf "$item"
            
            ((removed_count++))
        fi
    done < <(find "$dir" -maxdepth 1 -type d -print0)
    
    success "Corrupted log directories cleanup complete: $removed_count removed"
}

# Main cleanup function
main() {
    log "Starting comprehensive sync folder cleanup"
    log "Backup will be created at: $BACKUP_DIR"
    
    # Create backup directory
    create_backup
    
    # Clean Sync Hub
    log "=== CLEANING SYNC HUB ==="
    clean_system_dotfiles "$SYNC_HUB" "sync_hub"
    clean_log_directories "$SYNC_HUB" "sync_hub"
    clean_directory "$SYNC_HUB" "sync_hub"
    
    # Clean iCloud Sync
    log "=== CLEANING ICLOUD SYNC ==="
    clean_system_dotfiles "$ICLOUD_SYNC" "icloud"
    clean_log_directories "$ICLOUD_SYNC" "icloud"
    clean_directory "$ICLOUD_SYNC" "icloud"
    
    # Clean Google Drive Sync
    log "=== CLEANING GOOGLE DRIVE SYNC ==="
    clean_system_dotfiles "$GDRIVE_SYNC" "gdrive"
    clean_log_directories "$GDRIVE_SYNC" "gdrive"
    clean_directory "$GDRIVE_SYNC" "gdrive"
    
    # Final summary
    log "=== CLEANUP SUMMARY ==="
    success "Cleanup completed successfully!"
    log "Backup created at: $BACKUP_DIR"
    log "You can restore any accidentally removed files from the backup"
    
    # Show what's left
    log "=== REMAINING CONTENT ==="
    log "Sync Hub contents:"
    ls -la "$SYNC_HUB" 2>/dev/null | head -20 || warn "Could not list Sync Hub contents"
    
    warn "IMPORTANT: Review the cleanup results and test sync functionality"
    warn "If anything important was removed, restore from: $BACKUP_DIR"
}

# Run main function
main "$@"
