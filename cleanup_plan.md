# Cleanup Plan

## Redundant Test Scripts to Remove

1. `test_adaptive_retry_final.sh` - Final test script for adaptive retry, functionality now integrated into sync_reliability_enhanced.sh
2. `test_category_patterns.py` - Python test script for category patterns, redundant with test_category_patterns.sh
3. `test_category_patterns.sh` - Test script for category patterns, redundant with test_category_patterns_simple.sh
4. `test_category_patterns_simple.sh` - Can be kept as the main test script for category patterns
5. `test_circuit_breaker.sh` - Test script for circuit breaker, functionality now integrated into circuit_breaker.sh
6. `test_recovery_action_registry.sh` - Test script for recovery action registry, functionality now integrated
7. `test_recovery_time.sh` - Test script for recovery time, redundant with other test scripts
8. `test_simplified_categorization.sh` - Can be kept for testing the simplified categorization

## Redundant Markdown Files to Remove

1. All markdown files in the archive_old_files directory:
   - `archive_old_files/CONSOLIDATION_SUMMARY.md`
   - `archive_old_files/IMPLEMENTATION_SUMMARY.md`
   - `archive_old_files/ORGANIZATION_SUMMARY.md`
   - `archive_old_files/README_Enhanced.md`
   - `archive_old_files/README_old.md`

## Redundant Log Files to Remove

1. Old log files in the archive_old_files directory:
   - `archive_old_files/alerts.log`
   - `archive_old_files/performance.log`
   - `archive_old_files/sync_manager.log`
   - `archive_old_files/sync_health_report.txt`
   - `archive_old_files/sync_metrics.json`
   - `archive_old_files/unison_google_drive_cron.log`
   - `archive_old_files/unison_icloud_cron.log`

## Redundant Shell Scripts to Remove

1. Old scripts in the archive_old_files directory:
   - `archive_old_files/cleanup_agents.sh`
   - `archive_old_files/cleanup_ai_ml_comprehensive.sh`
   - `archive_old_files/organize_documents.sh`
   - `archive_old_files/organize_gdrive.sh`
   - `archive_old_files/sync_manager.sh.bak`

## Files to Keep

1. Core scripts:
   - `organize_documents_enhanced.sh` - Main organization engine
   - `organize_manager.sh` - Management interface
   - `sync_manager.sh` - Advanced sync management
   - `sync_reliability_enhanced.sh` - Reliability enhancements
   - `circuit_breaker.sh` - Circuit breaker implementation
   - `recovery_engine.sh` - Recovery engine
   - `recovery_action_registry.sh` - Recovery action registry
   - `simplified_categorization.sh` - Simplified categorization system
   - `run_automation.sh` - Automation workflow
   - `check_automation_status.sh` - Status checking

2. Configuration files:
   - `config.env` - Environment configuration
   - `organize_config.conf` - Organization settings
   - `unison_icloud.prf` - iCloud sync profile
   - `unison_google_drive.prf` - Google Drive sync profile
   - `com.moatasim.enhanced-document-organization.plist` - LaunchAgent

3. MCP server:
   - `mcp-server/` directory - MCP server implementation
   - `mcp_manager.sh` - MCP server management

4. Test samples:
   - `test_samples/` directory - Sample files for testing

5. Integration scripts:
   - `integrate_recovery_engine.sh` - Integration script

6. Spec files:
   - `.kiro/specs/` directory - Specification files