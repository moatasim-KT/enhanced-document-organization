# Troubleshooting Guide

This document provides solutions for common issues encountered with the document organization system.

## Sync Issues

### Circuit Breaker Blocking Sync

**Problem:** Sync operations are blocked by the circuit breaker.

**Symptoms:**
- Error message: "Circuit breaker is open for iCloud/Google Drive"
- Sync operations fail consistently

**Solutions:**
1. Check the circuit breaker status:
   ```bash
   ./sync/sync_module.sh status
   ```

2. Reset the circuit breakers:
   ```bash
   ./sync/sync_module.sh reset-circuit-breakers
   ```

3. If the issue persists, check the specific error type and address the root cause:
   - For authentication errors: Verify your cloud service credentials
   - For network errors: Check your internet connection
   - For quota errors: Free up space in your cloud storage

### Cloud Service Not Accessible

**Problem:** Cloud services (iCloud or Google Drive) are not accessible.

**Symptoms:**
- Error message: "iCloud/Google Drive is not accessible"
- Sync operations fail with timeout errors

**Solutions:**
1. Verify that cloud services are mounted and accessible:
   ```bash
   ls -la "$ICLOUD_PATH"
   ls -la "$GDRIVE_PATH"
   ```

2. For iCloud, try forcing a download of cloud files:
   ```bash
   ./sync/sync_module.sh force-download
   ```

3. Check if the paths in `config.env` are correct:
   ```bash
   cat config.env | grep PATH
   ```

4. Restart the cloud service applications or reconnect to the services

### Sync Conflicts

**Problem:** File conflicts during synchronization.

**Symptoms:**
- Error message containing "conflict" or "locked"
- Multiple versions of the same file

**Solutions:**
1. Manually resolve conflicts by choosing which version to keep
2. Use the `--force` option for sync (use with caution):
   ```bash
   ./sync/sync_module.sh sync --force
   ```

3. Check for locked files and close applications that might be using them

## Organization Issues

### Files Not Being Categorized Correctly

**Problem:** Files are not being placed in the expected categories.

**Symptoms:**
- Files remain in inbox folders
- Files are categorized incorrectly

**Solutions:**
1. Check if content analysis is enabled:
   ```bash
   cat config.env | grep ENABLE_CONTENT_ANALYSIS
   ```

2. Increase the content analysis depth:
   ```bash
   # In config.env
   CONTENT_ANALYSIS_DEPTH=100  # Analyze more lines for better categorization
   ```

3. Create custom categories with relevant keywords:
   ```bash
   ./organize/organize_module.sh create-category "Your Category" "🔖" "keyword1,keyword2,keyword3"
   ```

### Duplicate Files Not Being Detected

**Problem:** Duplicate files are not being identified and managed.

**Symptoms:**
- Multiple copies of the same file exist in different locations
- Duplicates are not moved to the Archives/Duplicates folder

**Solutions:**
1. Ensure advanced deduplication is enabled:
   ```bash
   # In config.env
   ENABLE_ADVANCED_DEDUPLICATION=true
   ```

2. Clear the content hash database to rebuild it:
   ```bash
   rm -f .cache/content_hashes.db
   ```

3. Run organization with verbose logging:
   ```bash
   ENABLE_DETAILED_LOGGING=true ./organize/organize_module.sh run
   ```

### Performance Issues

**Problem:** Organization process is slow or consumes too many resources.

**Symptoms:**
- Organization takes a long time to complete
- High CPU or memory usage

**Solutions:**
1. Enable incremental processing to only process new or changed files:
   ```bash
   # In config.env
   ENABLE_INCREMENTAL_PROCESSING=true
   ```

2. Reduce the content analysis depth:
   ```bash
   # In config.env
   CONTENT_ANALYSIS_DEPTH=25  # Analyze fewer lines (faster but less accurate)
   ```

3. Process only inbox folders instead of all directories:
   ```bash
   ./organize/organize_module.sh process-inbox
   ```

## Log Analysis

### Finding Error Messages

To find specific error messages in the logs:

```bash
# Find authentication errors
grep -i "authentication\|permission\|denied" *.log

# Find network errors
grep -i "network\|timeout\|connection" *.log

# Find quota errors
grep -i "quota\|space\|limit" *.log
```

### Checking System Health

To check the overall health of the system:

```bash
# Check sync health
./sync/sync_module.sh health

# Check organization status
./organize/organize_module.sh status

# View recent errors
tail -n 100 *.log | grep -i "error\|warn\|fail"
```

## Recovery Procedures

### Complete System Reset

If you need to reset the entire system:

1. Reset all circuit breakers:
   ```bash
   ./sync/sync_module.sh reset-circuit-breakers
   ```

2. Clear the cache and databases:
   ```bash
   rm -rf .cache/*
   ```

3. Validate folder structure:
   ```bash
   ./organize/organize_module.sh status
   ```

4. Run a full sync and organization:
   ```bash
   ./sync/sync_module.sh sync
   ./organize/organize_module.sh run
   ```

### Recovering from Failed Sync

If a sync operation fails repeatedly:

1. Check the circuit breaker status:
   ```bash
   ./sync/sync_module.sh status
   ```

2. Identify the specific error type from the logs:
   ```bash
   tail -n 50 *.log
   ```

3. Address the root cause based on the error type

4. Reset the specific circuit breaker:
   ```bash
   # For iCloud
   ./sync/sync_module.sh reset-circuit-breakers icloud
   
   # For Google Drive
   ./sync/sync_module.sh reset-circuit-breakers google_drive
   ```

5. Try syncing again:
   ```bash
   ./sync/sync_module.sh sync
   ```