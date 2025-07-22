# Advanced Configuration Examples

This document provides advanced configuration examples for the document organization system.

## Configuration File Structure

The system uses a central `config.env` file in the project root directory for all configuration settings.

```bash
# Example config.env file
ICLOUD_PATH="/Users/username/Library/Mobile Documents/com~apple~CloudDocs"
GDRIVE_PATH="/Users/username/Google Drive"
SYNC_HUB="/Users/username/Documents/Sync_Hub"
INBOX_LOCATIONS=("/Users/username/Downloads" "/Users/username/Desktop")
ENABLE_CONTENT_ANALYSIS=true
ENABLE_SMART_CATEGORIZATION=true
ENABLE_SIMPLIFIED_CATEGORIZATION=true
```

## Sync Module Configuration

### Customizing Circuit Breaker Behavior

You can customize the circuit breaker behavior for different error types:

```bash
# In config.env

# Customize failure thresholds for different error types
# Higher values mean more failures are allowed before blocking sync
AUTHENTICATION_FAILURE_THRESHOLD=3  # Authentication issues
NETWORK_FAILURE_THRESHOLD=5         # Network connectivity issues
QUOTA_FAILURE_THRESHOLD=2           # Storage quota issues

# Customize reset timeouts (in seconds)
# Higher values mean longer wait before retrying after failures
AUTHENTICATION_RESET_TIMEOUT=3600   # 1 hour for auth issues
NETWORK_RESET_TIMEOUT=900           # 15 minutes for network issues
QUOTA_RESET_TIMEOUT=7200            # 2 hours for quota issues
```

### Configuring Sync Paths

Configure the paths for cloud services and local sync hub:

```bash
# In config.env

# Cloud service paths
ICLOUD_PATH="/custom/path/to/iCloud"
GDRIVE_PATH="/custom/path/to/Google Drive"

# Local sync hub
SYNC_HUB="/custom/path/to/sync_hub"

# Unison profiles (optional)
UNISON_ICLOUD_PROFILE="custom_icloud"
UNISON_GDRIVE_PROFILE="custom_gdrive"
```

## Organize Module Configuration

### Customizing Categorization

Configure the categorization behavior:

```bash
# In config.env

# Enable/disable features
ENABLE_CONTENT_ANALYSIS=true        # Analyze file content for categorization
ENABLE_SMART_CATEGORIZATION=true    # Use AI-like pattern matching for categories
ENABLE_SIMPLIFIED_CATEGORIZATION=true  # Use simplified 5-category structure
ENABLE_ADVANCED_DEDUPLICATION=true  # Use content hashing for deduplication

# Threshold settings
MIN_FILE_SIZE=10                    # Minimum file size in bytes
MAX_FILENAME_LENGTH=80              # Maximum filename length
INCREMENTAL_THRESHOLD=3600          # Time threshold for incremental processing (1 hour)
CONTENT_ANALYSIS_DEPTH=50           # Number of lines to analyze for content
```

### Custom Category Configuration

Create a custom categories file (`custom_categories.txt`):

```
# Format: name|emoji|keywords|date_added
Data Science|📊|data science,machine learning,statistics,pandas,numpy,jupyter|2023-01-15
Project Management|📋|project,management,gantt,timeline,milestone,task|2023-01-20
Personal Finance|💰|finance,budget,investment,expense,income,money|2023-01-25
```

## Advanced Integration Configuration

For advanced integration between modules:

```bash
# In config.env

# Cross-module integration
ENABLE_CROSS_SYNC_VALIDATION=true   # Validate sync before organizing
ENABLE_AUTO_RECOVERY=true           # Automatically recover from errors
ENABLE_METADATA_PRESERVATION=true   # Preserve file metadata during organization

# Logging configuration
LOG_LEVEL="INFO"                    # Log level (DEBUG, INFO, WARN, ERROR)
ENABLE_DETAILED_LOGGING=true        # Enable detailed logging
LOG_RETENTION_DAYS=30               # Number of days to keep logs
```