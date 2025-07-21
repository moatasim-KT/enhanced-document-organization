# Design Document

## Overview

The simplified organization system redesigns the document categorization from a complex 47+ category structure to a streamlined 5-category approach with extensibility. The system will focus on processing documents from Inbox folders across synced locations and categorizing them into intuitive main categories.

## Architecture

### Core Components

1. **Simplified Categorization Engine**
   - Replaces the existing complex categorization logic
   - Uses focused keyword detection for 5 main categories
   - Supports dynamic category creation and management

2. **Inbox Processing System**
   - Monitors and processes files from designated Inbox folders
   - Handles multiple sync locations (google_drive, icloud_sync)
   - Ensures consistent processing across all locations

3. **Category Management System**
   - Manages the 5 main categories plus user-created categories
   - Handles category creation, validation, and persistence
   - Maintains category configuration and metadata

4. **Migration Engine**
   - Handles transition from existing 47+ category structure
   - Maps old categories to new main categories
   - Preserves file integrity during migration

## Components and Interfaces

### SimplifiedCategorizer Class
```bash
# Main categorization logic
categorize_document() {
    local file="$1"
    local content=$(analyze_content "$file")
    
    # Check against 5 main categories
    for category in "${MAIN_CATEGORIES[@]}"; do
        if matches_category "$content" "$category"; then
            echo "$category"
            return
        fi
    done
    
    # Check against custom categories
    check_custom_categories "$content"
}
```

### InboxProcessor Class
```bash
# Process files from Inbox folders
process_inbox_folders() {
    for sync_location in "${SYNC_LOCATIONS[@]}"; do
        local inbox_path="${sync_location}/Inbox"
        if [[ -d "$inbox_path" ]]; then
            process_inbox_files "$inbox_path"
        else
            create_inbox_folder "$inbox_path"
        fi
    done
}
```

### CategoryManager Class
```bash
# Manage categories and their configuration
create_new_category() {
    local category_name="$1"
    local emoji="$2"
    local keywords="$3"
    
    # Validate and add to configuration
    add_to_custom_categories "$emoji $category_name" "$keywords"
    create_category_folder "$emoji $category_name"
}
```

### MigrationEngine Class
```bash
# Handle migration from old structure
migrate_existing_structure() {
    # Map old categories to new main categories
    local category_mapping=(
        "📚 Research Papers/AI_ML->🤖 AI & ML"
        "📚 Research Papers/Physics->📚 Research Papers"
        "🤖 AI & ML/Agents->🤖 AI & ML"
        "💻 Development/APIs->💻 Development"
        # ... more mappings
    )
    
    perform_migration "$category_mapping"
}
```

## Data Models

### Main Categories Configuration
```bash
# Core 5 categories with their detection patterns
MAIN_CATEGORIES=(
    "🤖 AI & ML"
    "📚 Research Papers"
    "🌐 Web Content"
    "📝 Notes & Drafts"
    "💻 Development"
)

# Category detection patterns
declare -A CATEGORY_PATTERNS=(
    ["🤖 AI & ML"]="machine learning|neural network|transformer|llm|agent|computer vision|nlp|deep learning"
    ["📚 Research Papers"]="abstract|introduction|methodology|references|doi:|arxiv:|journal|conference"
    ["🌐 Web Content"]="article|tutorial|guide|blog|news|web content|how-to"
    ["📝 Notes & Drafts"]="meeting|notes|daily|idea|draft|untitled|brainstorm"
    ["💻 Development"]="code|api|git|database|framework|programming|software|documentation"
)
```

### Custom Categories Storage
```bash
# User-created categories stored in configuration
CUSTOM_CATEGORIES_FILE="$CONFIG_DIR/custom_categories.conf"

# Format: CATEGORY_NAME|EMOJI|KEYWORDS|CREATED_DATE
# Example: Data Analysis|📊|dataset,analysis,statistics,visualization|2025-01-21
```

### Sync Locations Configuration
```bash
# Inbox locations across sync services
INBOX_LOCATIONS=(
    "$GOOGLE_DRIVE_PATH/Inbox"
    "$ICLOUD_SYNC_PATH/Inbox"
)

# Main organization directories
ORGANIZATION_ROOTS=(
    "$GOOGLE_DRIVE_PATH"
    "$ICLOUD_SYNC_PATH"
)
```

## Error Handling

### Categorization Errors
- **Unknown Content**: Files that don't match any category go to "📝 Notes & Drafts" as fallback
- **Multiple Matches**: Use priority order (AI & ML > Research Papers > Development > Web Content > Notes & Drafts)
- **Corrupted Files**: Move to quarantine folder for manual review

### Inbox Processing Errors
- **Missing Inbox**: Automatically create Inbox folder in sync location
- **Permission Issues**: Log error and skip location with notification
- **Sync Conflicts**: Detect and resolve using timestamp-based priority

### Migration Errors
- **Mapping Conflicts**: Log conflicts and use manual intervention file
- **File Move Failures**: Retry with exponential backoff, then quarantine
- **Backup Failures**: Abort migration and notify user

## Testing Strategy

### Unit Tests
1. **Categorization Logic Tests**
   - Test each category pattern against sample documents
   - Verify fallback behavior for unmatched content
   - Test custom category detection

2. **Inbox Processing Tests**
   - Test file discovery and processing from Inbox folders
   - Verify handling of empty and missing Inbox folders
   - Test concurrent processing across multiple sync locations

3. **Category Management Tests**
   - Test custom category creation and validation
   - Verify category persistence and loading
   - Test category deletion and cleanup

### Integration Tests
1. **End-to-End Workflow Tests**
   - Test complete flow from Inbox to categorized folders
   - Verify sync consistency across all locations
   - Test migration from existing structure

2. **Multi-Location Sync Tests**
   - Test processing across google_drive and icloud_sync
   - Verify consistency between sync locations
   - Test conflict resolution

### Performance Tests
1. **Large File Set Processing**
   - Test with 1000+ files in Inbox folders
   - Measure categorization performance
   - Verify memory usage stays within limits

2. **Migration Performance**
   - Test migration of existing 47+ category structure
   - Measure time to complete migration
   - Verify no data loss during migration

## Configuration Changes

### New Configuration Options
```bash
# Enable simplified categorization mode
ENABLE_SIMPLIFIED_CATEGORIZATION=true

# Inbox processing settings
INBOX_PROCESSING_ENABLED=true
INBOX_CHECK_INTERVAL=300  # 5 minutes

# Custom categories file location
CUSTOM_CATEGORIES_FILE="$CONFIG_DIR/custom_categories.conf"

# Migration settings
ENABLE_AUTOMATIC_MIGRATION=true
MIGRATION_BACKUP_ENABLED=true
```

### Updated Sync Locations
```bash
# Focus on these main sync locations
PRIMARY_SYNC_LOCATIONS=(
    "/path/to/google_drive"
    "/path/to/icloud_sync"
)

# Inbox folders within each sync location
INBOX_FOLDERS=(
    "/path/to/google_drive/Inbox"
    "/path/to/icloud_sync/Inbox"
)
```

## Implementation Phases

### Phase 1: Core Simplification
- Implement simplified categorization logic
- Update configuration for 5 main categories
- Create category detection patterns

### Phase 2: Inbox Processing
- Implement Inbox folder monitoring
- Add file processing from Inbox locations
- Create automatic Inbox folder creation

### Phase 3: Custom Categories
- Implement custom category creation system
- Add category management commands
- Create category persistence mechanism

### Phase 4: Migration System
- Implement migration from existing structure
- Create category mapping system
- Add backup and rollback capabilities

### Phase 5: Integration and Testing
- Integrate with existing sync system
- Add comprehensive testing
- Update documentation and user guides