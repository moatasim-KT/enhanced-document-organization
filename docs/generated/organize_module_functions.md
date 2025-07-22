# Function Documentation: organize_module.sh

This document contains automatically extracted documentation for functions in `organize_module.sh`.

## Table of Contents

- [log](#log)
- [initialize_cache](#initialize_cache)
- [update_progress](#update_progress)
- [calculate_content_hash](#calculate_content_hash)
- [is_recently_processed](#is_recently_processed)
- [update_processed_db](#update_processed_db)
- [validate_folder_structure](#validate_folder_structure)
- [check_file_integrity](#check_file_integrity)
- [show_usage](#show_usage)
- [main](#main)

## Functions

### log

 * Logs a message to both console and log file
 *
 *
 * log "Processing file: document.md"
 * log "${RED}Error: File not found${NC}"
 

**Parameters:**

- `message` (string): - The message to log

**Returns:**


**Example:**

```bash
 * log "Processing file: document.md"
 * log "${RED}Error: File not found${NC}"
 */

```

**Implementation:**

```bash
log() {
```

---

### initialize_cache

 * Initializes cache directory and databases
 * Creates necessary directories and database files if they don't exist
 *
 *
 * initialize_cache
 

**Returns:**


**Example:**

```bash
 * initialize_cache
 */

```

**Implementation:**

```bash
initialize_cache() {
```

---

### update_progress

 * Updates and displays progress information
 * Shows a visual progress bar if ENABLE_PROGRESS_TRACKING is true
 *
 *
 * update_progress 45 100 "Categorizing files"
 

**Parameters:**

- `current` (number): - Current progress count
- `total` (number): - Total items to process
- `operation` (string): - Description of the current operation

**Returns:**


**Example:**

```bash
 * update_progress 45 100 "Categorizing files"
 */

```

**Implementation:**

```bash
update_progress() {
```

---

### calculate_content_hash

 * Calculates a content hash for a file with special handling for different file types
 * For markdown files, normalizes whitespace before hashing to improve deduplication
 *
 *
 * hash=$(calculate_content_hash "document.md")
 * hash=$(calculate_content_hash "image.jpg" "md5")
 

**Parameters:**

- `file` (string): - Path to the file to hash
- `[hash_type=sha256]` (string): - Hash algorithm to use (sha256, md5, etc.)

**Returns:**

- string: - The calculated hash or "invalid_file" if file doesn't exist

**Example:**

```bash
 * hash=$(calculate_content_hash "document.md")
 * hash=$(calculate_content_hash "image.jpg" "md5")
 */

```

**Implementation:**

```bash
calculate_content_hash() {
```

---

### is_recently_processed

 * Checks if a file was recently processed based on the incremental threshold
 * Used to skip unchanged files for faster processing
 *
 *
 * if is_recently_processed "document.md"; then
 *     echo "Skipping recently processed file"
 * fi
 

**Parameters:**

- `file` (string): - Path to the file to check

**Returns:**

- boolean: - Returns 0 (true) if recently processed, 1 (false) otherwise

**Example:**

```bash
 * if is_recently_processed "document.md"; then
 *     echo "Skipping recently processed file"
 * fi
 */

```

**Implementation:**

```bash
is_recently_processed() {
```

---

### update_processed_db

 * Updates the processed files database with information about a processed file
 * Maintains a record of processed files for incremental processing
 *
 *
 * update_processed_db "document.md" "a1b2c3..." "Research Papers"
 

**Parameters:**

- `file` (string): - Path to the processed file
- `hash` (string): - Content hash of the file
- `category` (string): - Category assigned to the file

**Returns:**


**Example:**

```bash
 * update_processed_db "document.md" "a1b2c3..." "Research Papers"
 */

```

**Implementation:**

```bash
update_processed_db() {
```

---

### validate_folder_structure

 * Validates and creates the required folder structure for document organization
 * Creates missing directories based on the selected categorization scheme
 *
 *
 * validate_folder_structure "/path/to/documents"
 

**Parameters:**

- `base_dir` (string): - Base directory where the folder structure should exist

**Returns:**

- number: - Returns 0 on success, 1 on failure

**Example:**

```bash
 * validate_folder_structure "/path/to/documents"
 */

```

**Implementation:**

```bash
validate_folder_structure() {
```

---

### check_file_integrity

 * Checks file integrity to identify potential issues
 * Validates file existence, readability, size, encoding, and content
 *
 *
 * if ! check_file_integrity "document.md"; then
 *     log "File integrity check failed"
 * fi
 

**Parameters:**

- `file` (string): - Path to the file to check

**Returns:**

- number: - Returns 0 if file passes all checks, 1 if issues found

**Example:**

```bash
 * if ! check_file_integrity "document.md"; then
 *     log "File integrity check failed"
 * fi
 */

```

**Implementation:**

```bash
check_file_integrity() {
```

---

### show_usage

 * Displays usage information and available commands
 * Provides help text for the module's command-line interface
 *
 *
 * show_usage
 

**Returns:**


**Example:**

```bash
 * show_usage
 */

```

**Implementation:**

```bash
show_usage() {
```

---

### main

 * Main function that processes command-line arguments and executes commands
 * Entry point for the module's functionality
 *
 *
 * main "run" "--source" "/path/to/documents"
 

**Parameters:**

- `args` (string[]): - Command-line arguments

**Returns:**

- number: - Exit code (0 for success, non-zero for errors)

**Example:**

```bash
 * main "run" "--source" "/path/to/documents"
 */

```

**Implementation:**

```bash
main() {
```

---

