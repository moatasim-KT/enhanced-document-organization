# Organize_module Module Documentation

**Version:** Unknown  
**Author:** Unknown

No description available.

## Overview

This document provides comprehensive documentation for the `organize_module` module.

## Usage

```bash
   ./organize_module.sh run                     # Run organization process
   ./organize_module.sh dry-run                 # Test without making changes
   ./organize_module.sh status                  # Check system status
   ./organize_module.sh create-category NAME EMOJI KEYWORDS  # Create custom category
   ./organize_module.sh process-inbox           # Process inbox folders only
```

## Configuration

   All settings are loaded from config.env in the parent directory.
   Key settings include:
   - SOURCE_DIR: Main directory to organize
   - INBOX_LOCATIONS: Array of inbox folders to monitor
   - ENABLE_CONTENT_ANALYSIS: Enable/disable content-based categorization
   - ENABLE_SIMPLIFIED_CATEGORIZATION: Use simplified 5-category structure

## Functions

The module provides the following functions:\n
### CONSOLIDATED ORGANIZATION MODULE


### CONFIGURATION SETTINGS


### THRESHOLD SETTINGS


### PROGRESS TRACKING VARIABLES


### OUTPUT FORMATTING


### UTILITY FUNCTIONS

- `log`
- `initialize_cache`
- `update_progress`
- `calculate_content_hash`
- `is_recently_processed`
- `update_processed_db`
- `validate_folder_structure`
- `check_file_integrity`
- `show_usage`
- `main`

For detailed function documentation, see [Function Documentation](organize_module_module_functions.md).

