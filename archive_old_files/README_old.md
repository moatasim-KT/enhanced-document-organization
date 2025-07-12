# Drive Sync System

Consolidated synchronization system for iCloud and Google Drive using Unison with intelligent scheduling, error handling, and monitoring.

## Quick Start

```bash
# Run sync (recommended)
./sync_manager.sh

# Check status
./sync_manager.sh status

# Generate health report
./sync_manager.sh monitor

# Emergency stop
./sync_manager.sh stop
```

## Files

**Core System:**
- `sync_manager.sh` - All-in-one sync, monitoring, and management
- `unison_icloud.prf` - iCloud configuration
- `unison_google_drive.prf` - Google Drive configuration

**Logs:**
- `unison_icloud_cron.log` - iCloud sync logs
- `unison_google_drive_cron.log` - Google Drive sync logs
- `sync_health_report.txt` - Latest health report

## Cron Setup

```bash
# Sync every 30 minutes
*/30 * * * * /Users/moatasimfarooque/CascadeProjects/Drive_sync/sync_manager.sh

# Enhanced health monitoring every 2 hours
0 */2 * * * /Users/moatasimfarooque/CascadeProjects/Drive_sync/sync_manager.sh monitor

# Daily performance analysis
0 9 * * * /Users/moatasimfarooque/CascadeProjects/Drive_sync/sync_manager.sh performance
```

## Monitoring Configuration

### Alert Thresholds (configurable in sync_manager.sh)
```bash
DISK_SPACE_THRESHOLD=85        # Alert when disk usage > 85%
CONSECUTIVE_FAILURES=3         # Alert after 3 consecutive failures
SYNC_DURATION_THRESHOLD=600    # Alert if sync takes > 10 minutes
BANDWIDTH_THRESHOLD_MB=1000    # Alert if transfer > 1GB
```

### Notification Settings
```bash
ENABLE_EMAIL_ALERTS=false      # Set to true and configure EMAIL_RECIPIENT
ENABLE_DESKTOP_NOTIFICATIONS=true  # macOS/Linux desktop notifications
```

## Features

### 🔄 Core Sync Features
- ✅ **Smart Scheduling** - Avoids conflicts with 30min intervals and quiet hours
- ✅ **Enhanced Error Recovery** - 3-attempt retry with exponential backoff and timeout protection
- ✅ **Lock Management** - Prevents concurrent sync conflicts
- ✅ **Cloud Detection** - Waits for iCloud/Google Drive availability
- ✅ **Automatic Problem Resolution** - Detects and fixes problematic files causing deadlocks

### 📊 Advanced Monitoring & Alerting
- ✅ **Real-time Performance Tracking** - Records sync duration, items transferred, and failure rates
- ✅ **Trend Analysis** - Analyzes sync patterns over time with success rate calculations
- ✅ **Predictive Alerts** - Warns about potential issues before they become critical
- ✅ **Desktop Notifications** - Real-time alerts for macOS and Linux
- ✅ **Email Alerts** - Configurable email notifications for critical issues
- ✅ **Bandwidth Monitoring** - Tracks data transfer volumes and usage patterns
- ✅ **Disk Space Alerts** - Automatic warnings when storage approaches limits

### ⚡ Performance & Reliability
- ✅ **Adaptive Sync Optimization** - Intelligent argument selection based on sync priority
- ✅ **Incremental Sync Strategy** - Optimized for faster subsequent syncs
- ✅ **Parallel Sync Capability** - Experimental concurrent sync for multiple services
- ✅ **Enhanced Error Recovery** - Exponential backoff with adaptive retry delays
- ✅ **Fallback Strategies** - Automatic corrective actions for common error patterns
- ✅ **Performance Benchmarking** - Built-in sync performance testing and analysis
- ✅ **Large File Detection** - Warns about files that may impact sync performance
- ✅ **Process Priority Management** - CPU and I/O nice levels for system responsiveness

### 🛠️ Maintenance & Diagnostics
- ✅ **Comprehensive Diagnostics** - Built-in troubleshooting and system validation
- ✅ **Profile Validation** - Ensures Unison configurations are correct
- ✅ **Automatic Log Rotation** - Prevents log files from growing too large
- ✅ **Performance Metrics** - JSON-based metrics storage for analysis

## Commands

### 📋 Basic Commands
```bash
./sync_manager.sh sync     # Run intelligent sync (default)
./sync_manager.sh status   # Check current status
./sync_manager.sh stop     # Emergency stop all syncs
```

### 📊 Advanced Monitoring Commands
```bash
./sync_manager.sh monitor     # Generate enhanced health report
./sync_manager.sh performance # Show performance analysis [service] [days]
./sync_manager.sh trends      # Show sync trends [days]
./sync_manager.sh alerts      # Manage alerts [list|clear|test]
```

### ⚡ Performance Commands
```bash
./sync_manager.sh optimize    # Performance optimization [status|speed|reliability|balanced|parallel|reset]
./sync_manager.sh benchmark   # Run sync performance benchmark [iterations] [service]
```

### 🛠️ Maintenance Commands
```bash
./sync_manager.sh diagnose # Run system diagnostics
./sync_manager.sh fix      # Fix known issues automatically
./sync_manager.sh cleanup  # Clean old files
./sync_manager.sh full     # Sync + monitor + cleanup
```

### 📈 Examples
```bash
./sync_manager.sh performance icloud 14      # iCloud performance for 14 days
./sync_manager.sh optimize speed              # Optimize for fastest sync
./sync_manager.sh benchmark 5 icloud          # Benchmark iCloud sync 5 times
./sync_manager.sh optimize parallel enable    # Enable experimental parallel sync
./sync_manager.sh trends 30                   # Show trends for 30 days
./sync_manager.sh alerts test                 # Send test alert
```

## Troubleshooting

**Quick Fixes:**
- Auto-fix issues: `./sync_manager.sh fix`
- Run diagnostics: `./sync_manager.sh diagnose`
- Check status: `./sync_manager.sh status`
- View health: `./sync_manager.sh monitor`

**Sync Issues:**
- **Deadlock Errors**: Run `./sync_manager.sh fix` to rename problematic files
- **Timeout Issues**: Normal for first sync; subsequent syncs will be faster
- **Profile Errors**: Diagnostics will detect and fix automatically

**Log Analysis:**
```bash
tail -50 unison_icloud_cron.log | grep -i error
cat sync_health_report.txt
./sync_manager.sh diagnose  # Comprehensive system check
```

**Configuration:**
Edit timing/retry settings in `sync_manager.sh` variables section.
