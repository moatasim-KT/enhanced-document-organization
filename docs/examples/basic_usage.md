# Basic Usage Examples

This document provides basic usage examples for the document organization system modules.

## Sync Module

### Basic Sync Operations

The sync module provides reliable synchronization between cloud services and your local sync hub.

```bash
# Run a complete sync operation
./sync/sync_module.sh sync

# Check the health of sync services
./sync/sync_module.sh health

# Reset circuit breakers if sync is blocked
./sync/sync_module.sh reset-circuit-breakers
```

### Checking Sync Status

You can check the status of the circuit breakers to see if any sync operations are blocked:

```bash
# Display circuit breaker status
./sync/sync_module.sh status
```

## Organize Module

### Basic Organization Operations

The organize module helps categorize and manage your documents.

```bash
# Run the organization process
./organize/organize_module.sh run

# Test organization without making changes (dry run)
./organize/organize_module.sh dry-run

# Check system status
./organize/organize_module.sh status
```

### Processing Inbox Folders

Process only the inbox folders to categorize new files:

```bash
# Process inbox folders only
./organize/organize_module.sh process-inbox
```

### Creating Custom Categories

You can create custom categories for your specific needs:

```bash
# Create a new custom category
./organize/organize_module.sh create-category "Data Science" "📊" "data science,machine learning,statistics"
```

## Common Workflow

A typical workflow combines both modules:

```bash
# 1. Sync files from cloud services
./sync/sync_module.sh sync

# 2. Organize the synced files
./organize/organize_module.sh run

# 3. Check system status
./organize/organize_module.sh status
./sync/sync_module.sh status
```