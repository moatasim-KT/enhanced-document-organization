# Usage Examples: organize_module.sh

This document contains usage examples extracted from `organize_module.sh`.

## Table of Contents

- [Basic Usage](#Basic'-'Usage)
- [Advanced Usage](#Advanced'-'Usage)
- [Troubleshooting](#Troubleshooting)
- [Configuration Examples](#Configuration'-'Examples)

## Basic Usage

These examples demonstrate the basic functionality of the module.\n
```bash
   ./organize_module.sh run                     # Run organization process
   ./organize_module.sh dry-run                 # Test without making changes
   ./organize_module.sh status                  # Check system status
   ./organize_module.sh create-category NAME EMOJI KEYWORDS  # Create custom category
   ./organize_module.sh process-inbox           # Process inbox folders only
```

### Example 1: Using `log`

 * Logs a message to both console and log file
 *
 *
 * log "Processing file: document.md"
 * log "${RED}Error: File not found${NC}"
 

```bash
 * log "Processing file: document.md"
 * log "${RED}Error: File not found${NC}"
 */

```

---

### Example 2: Using `initialize_cache`

 * Initializes cache directory and databases
 * Creates necessary directories and database files if they don't exist
 *
 *
 * initialize_cache
 

```bash
 * initialize_cache
 */

```

---

### Example 3: Using `update_progress`

 * Updates and displays progress information
 * Shows a visual progress bar if ENABLE_PROGRESS_TRACKING is true
 *
 *
 * update_progress 45 100 "Categorizing files"
 

```bash
 * update_progress 45 100 "Categorizing files"
 */

```

---

### Example 4: Using `calculate_content_hash`

 * Calculates a content hash for a file with special handling for different file types
 * For markdown files, normalizes whitespace before hashing to improve deduplication
 *
 *
 * hash=$(calculate_content_hash "document.md")
 * hash=$(calculate_content_hash "image.jpg" "md5")
 

```bash
 * hash=$(calculate_content_hash "document.md")
 * hash=$(calculate_content_hash "image.jpg" "md5")
 */

```

---

### Example 5: Using `is_recently_processed`

 * Checks if a file was recently processed based on the incremental threshold
 * Used to skip unchanged files for faster processing
 *
 *
 * if is_recently_processed "document.md"; then
 *     echo "Skipping recently processed file"
 * fi
 

```bash
 * if is_recently_processed "document.md"; then
 *     echo "Skipping recently processed file"
 * fi
 */

```

---

### Example 6: Using `update_processed_db`

 * Updates the processed files database with information about a processed file
 * Maintains a record of processed files for incremental processing
 *
 *
 * update_processed_db "document.md" "a1b2c3..." "Research Papers"
 

```bash
 * update_processed_db "document.md" "a1b2c3..." "Research Papers"
 */

```

---

### Example 7: Using `validate_folder_structure`

 * Validates and creates the required folder structure for document organization
 * Creates missing directories based on the selected categorization scheme
 *
 *
 * validate_folder_structure "/path/to/documents"
 

```bash
 * validate_folder_structure "/path/to/documents"
 */

```

---

### Example 8: Using `check_file_integrity`

 * Checks file integrity to identify potential issues
 * Validates file existence, readability, size, encoding, and content
 *
 *
 * if ! check_file_integrity "document.md"; then
 *     log "File integrity check failed"
 * fi
 

```bash
 * if ! check_file_integrity "document.md"; then
 *     log "File integrity check failed"
 * fi
 */

```

---

### Example 9: Using `show_usage`

 * Displays usage information and available commands
 * Provides help text for the module's command-line interface
 *
 *
 * show_usage
 

```bash
 * show_usage
 */

```

---

### Example 10: Using `main`

 * Main function that processes command-line arguments and executes commands
 * Entry point for the module's functionality
 *
 *
 * main "run" "--source" "/path/to/documents"
 

```bash
 * main "run" "--source" "/path/to/documents"
 */

```

---


## Advanced Usage

These examples demonstrate more complex use cases and advanced features.\n
```bash
  organize_module.sh run
  organize_module.sh dry-run
  organize_module.sh status
  organize_module.sh create-category "Data Science" "📊" "data science,machine learning,statistics"
  organize_module.sh process-inbox

```

## Troubleshooting

These examples demonstrate how to troubleshoot common issues.\n
No specific troubleshooting examples found.

## Configuration Examples

These examples demonstrate different configuration options.\n
No specific configuration options found.
