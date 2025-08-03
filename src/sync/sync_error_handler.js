#!/usr/bin/env node

/**
 * Sync Configuration Error Handler and Logger
 * 
 * Provides comprehensive logging and error handling specifically for sync configuration operations:
 * - Profile cleanup actions
 * - Profile corruption detection
 * - User-friendly error messages with correction guidance
 * 
 * Requirements: 5.3, 5.4
 */

import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Sync-specific error types
 */
export const SyncErrorTypes = {
    PROFILE_CORRUPTION: 'PROFILE_CORRUPTION',
    PROFILE_BACKUP_FAILED: 'PROFILE_BACKUP_FAILED',
    PROFILE_REGENERATION_FAILED: 'PROFILE_REGENERATION_FAILED',
    ARCHIVE_CORRUPTION: 'ARCHIVE_CORRUPTION',
    ARCHIVE_CLEANUP_FAILED: 'ARCHIVE_CLEANUP_FAILED',
    ROOT_PATH_VALIDATION_FAILED: 'ROOT_PATH_VALIDATION_FAILED',
    SYNC_CONFIGURATION_ERROR: 'SYNC_CONFIGURATION_ERROR',
    UNISON_DIRECTORY_ACCESS_ERROR: 'UNISON_DIRECTORY_ACCESS_ERROR'
};

/**
 * Sync operation types for context tracking
 */
export const SyncOperations = {
    PROFILE_VALIDATION: 'profile_validation',
    PROFILE_BACKUP: 'profile_backup',
    PROFILE_CLEANUP: 'profile_cleanup',
    PROFILE_REGENERATION: 'profile_regeneration',
    ARCHIVE_DETECTION: 'archive_detection',
    ARCHIVE_CLEANUP: 'archive_cleanup',
    ROOT_PATH_VALIDATION: 'root_path_validation',
    SYNC_CONFIGURATION_VALIDATION: 'sync_configuration_validation'
};

/**
 * Enhanced Sync Error class with sync-specific context
 */
export class SyncError extends Error {
    constructor(message, type, context = {}, originalError = null, userGuidance = null) {
        super(message);
        this.name = 'SyncError';
        this.type = type;
        this.context = context;
        this.originalError = originalError;
        this.userGuidance = userGuidance;
        this.timestamp = new Date().toISOString();
        this.component = 'sync-configuration';
        this.operation = context.operation || 'unknown';
        this.severity = this.determineSeverity(type, context);

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, SyncError);
        }
    }

    /**
     * Determine error severity based on type and context
     */
    determineSeverity(type, context) {
        const criticalErrors = [
            SyncErrorTypes.UNISON_DIRECTORY_ACCESS_ERROR,
            SyncErrorTypes.ROOT_PATH_VALIDATION_FAILED
        ];

        const highSeverityErrors = [
            SyncErrorTypes.PROFILE_CORRUPTION,
            SyncErrorTypes.ARCHIVE_CORRUPTION,
            SyncErrorTypes.SYNC_CONFIGURATION_ERROR
        ];

        if (criticalErrors.includes(type)) return 'critical';
        if (highSeverityErrors.includes(type)) return 'high';
        if (context.profileName === 'default') return 'high'; // Default profile issues are more serious
        return 'medium';
    }

    /**
     * Convert to JSON for logging
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            type: this.type,
            component: this.component,
            operation: this.operation,
            severity: this.severity,
            context: this.context,
            userGuidance: this.userGuidance,
            timestamp: this.timestamp,
            stack: this.stack,
            ...(this.originalError && {
                originalError: {
                    name: this.originalError.name,
                    message: this.originalError.message,
                    code: this.originalError.code,
                    stack: this.originalError.stack
                }
            })
        };
    }
}

/**
 * Sync Configuration Error Handler and Logger
 */
export class SyncErrorHandler {
    constructor(options = {}) {
        this.component = 'sync-configuration';
        this.projectRoot = this.detectProjectRoot();
        this.logDirectory = options.logDirectory || path.join(this.projectRoot, 'logs');
        this.unisonDir = path.join(os.homedir(), '.unison');

        this.enableConsoleLogging = options.enableConsoleLogging !== false;
        this.enableFileLogging = options.enableFileLogging !== false;
        this.logLevel = options.logLevel || 'INFO';

        // Ensure log directory exists
        this.ensureLogDirectory();
    }

    /**
     * Detect project root directory
     */
    detectProjectRoot() {
        let currentDir = __dirname;

        while (currentDir !== path.dirname(currentDir)) {
            if (existsSync(path.join(currentDir, 'package.json')) ||
                existsSync(path.join(currentDir, 'config', 'config.env'))) {
                return currentDir;
            }
            currentDir = path.dirname(currentDir);
        }

        return process.cwd();
    }

    /**
     * Ensure log directory exists
     */
    ensureLogDirectory() {
        try {
            if (!existsSync(this.logDirectory)) {
                require('fs').mkdirSync(this.logDirectory, { recursive: true });
            }
        } catch (error) {
            console.error(`Failed to create log directory: ${this.logDirectory}`, error);
        }
    }

    /**
     * Generate unique error ID for tracking
     */
    generateErrorId(error) {
        const timestamp = Date.now();
        const errorHash = this.simpleHash(error.message + (error.stack || ''));
        return `SYNC_ERR_${timestamp}_${errorHash}`.substring(0, 32);
    }

    /**
     * Simple hash function for ID generation
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Create user-friendly error messages with correction guidance
     */
    createUserGuidance(errorType, context = {}) {
        const guidance = {
            [SyncErrorTypes.PROFILE_CORRUPTION]: {
                summary: "Your Unison profile has become corrupted and needs to be cleaned up.",
                causes: [
                    "Previous sync operations were interrupted",
                    "Sync data was accidentally written to the profile file",
                    "File system corruption or disk errors"
                ],
                solutions: [
                    "The system will automatically backup your current profile",
                    "A clean profile will be regenerated with proper settings",
                    "Your sync configuration will be restored to working order"
                ],
                nextSteps: [
                    "Allow the automatic cleanup to complete",
                    "Test the sync with a small file to verify it's working",
                    "Check the backup directory if you need to recover any custom settings"
                ],
                preventionTips: [
                    "Avoid interrupting sync operations",
                    "Ensure sufficient disk space before syncing",
                    "Regular profile validation can catch issues early"
                ]
            },

            [SyncErrorTypes.PROFILE_BACKUP_FAILED]: {
                summary: "Failed to create a backup of your profile before cleanup.",
                causes: [
                    "Insufficient disk space in the backup directory",
                    "Permission issues with the .unison directory",
                    "The profile file is locked by another process"
                ],
                solutions: [
                    "Free up disk space in your home directory",
                    "Close any running Unison processes",
                    "Check file permissions on the .unison directory"
                ],
                nextSteps: [
                    "Manually backup the profile file if needed",
                    "Retry the cleanup operation",
                    "Contact support if the issue persists"
                ],
                preventionTips: [
                    "Ensure adequate free disk space",
                    "Don't run multiple sync operations simultaneously",
                    "Regular cleanup of old backup files"
                ]
            },

            [SyncErrorTypes.ARCHIVE_CORRUPTION]: {
                summary: "Unison archive files have become corrupted and need cleanup.",
                causes: [
                    "Interrupted sync operations left partial data",
                    "File system errors or disk corruption",
                    "Archive files grew too large due to sync conflicts"
                ],
                solutions: [
                    "Corrupted archives will be safely removed",
                    "Fresh archives will be created on next sync",
                    "This will reset the sync state to ensure clean operation"
                ],
                nextSteps: [
                    "Allow the archive cleanup to complete",
                    "The first sync after cleanup may take longer as it rebuilds state",
                    "Monitor sync performance to ensure improvement"
                ],
                preventionTips: [
                    "Don't interrupt sync operations in progress",
                    "Ensure stable network connection for cloud syncs",
                    "Regular archive cleanup prevents accumulation"
                ]
            },

            [SyncErrorTypes.ROOT_PATH_VALIDATION_FAILED]: {
                summary: "The sync root paths are incorrect and could cause data loss.",
                causes: [
                    "Profile configuration points to wrong directories",
                    "Source path is not the intended Sync_Hub_New directory",
                    "Destination paths don't match cloud storage locations"
                ],
                solutions: [
                    "Profiles will be regenerated with correct paths",
                    "Source will be set to Sync_Hub_New only",
                    "Destination paths will be validated for cloud storage"
                ],
                nextSteps: [
                    "Verify the corrected paths before running sync",
                    "Test with a small file to confirm correct operation",
                    "Check that only intended files are being synced"
                ],
                preventionTips: [
                    "Always validate sync paths before starting",
                    "Use absolute paths to avoid confusion",
                    "Regular path validation prevents accidents"
                ]
            },

            [SyncErrorTypes.UNISON_DIRECTORY_ACCESS_ERROR]: {
                summary: "Cannot access the Unison configuration directory.",
                causes: [
                    "Permission issues with the .unison directory",
                    "Directory doesn't exist or was deleted",
                    "File system corruption or disk errors"
                ],
                solutions: [
                    "Check and fix directory permissions",
                    "Recreate the .unison directory if missing",
                    "Verify disk health and file system integrity"
                ],
                nextSteps: [
                    "Run: chmod 755 ~/.unison",
                    "If directory is missing, it will be recreated",
                    "Contact system administrator if permission issues persist"
                ],
                preventionTips: [
                    "Don't manually modify .unison directory permissions",
                    "Regular system maintenance prevents corruption",
                    "Backup important configuration files"
                ]
            }
        };

        const defaultGuidance = {
            summary: "An unexpected error occurred during sync configuration.",
            causes: ["Unknown cause - requires investigation"],
            solutions: ["Check the error details and logs for more information"],
            nextSteps: ["Contact support with the error ID and details"],
            preventionTips: ["Regular system maintenance and monitoring"]
        };

        return guidance[errorType] || defaultGuidance;
    }

    /**
     * Handle sync-specific errors with comprehensive logging and user guidance
     */
    async handleSyncError(error, operation, context = {}) {
        const errorType = this.classifySyncError(error, operation, context);
        const userGuidance = this.createUserGuidance(errorType, context);

        const syncError = new SyncError(
            error.message || 'Unknown sync error occurred',
            errorType,
            { ...context, operation },
            error,
            userGuidance
        );

        const errorId = this.generateErrorId(syncError);
        syncError.errorId = errorId;

        // Log the error with full context
        await this.logError(syncError.message, {
            errorId,
            operation,
            errorType,
            severity: syncError.severity,
            ...context
        }, syncError);

        // Log user guidance
        await this.logInfo(`User guidance for ${errorType}`, {
            errorId,
            guidance: userGuidance,
            operation
        });

        // Display user-friendly message
        this.displayUserFriendlyError(syncError);

        return {
            error: syncError,
            errorId,
            userGuidance,
            severity: syncError.severity,
            operation,
            troubleshooting: this.generateTroubleshootingSteps(syncError)
        };
    }

    /**
     * Classify sync-specific errors
     */
    classifySyncError(error, operation, context = {}) {
        const message = error.message?.toLowerCase() || '';
        const code = error.code;

        // Check for specific sync error patterns
        if (message.includes('corrupted') || message.includes('corruption')) {
            if (operation === SyncOperations.PROFILE_VALIDATION || context.profileName) {
                return SyncErrorTypes.PROFILE_CORRUPTION;
            }
            if (operation === SyncOperations.ARCHIVE_DETECTION || message.includes('archive')) {
                return SyncErrorTypes.ARCHIVE_CORRUPTION;
            }
        }

        if (operation === SyncOperations.PROFILE_BACKUP && (code === 'ENOSPC' || message.includes('backup'))) {
            return SyncErrorTypes.PROFILE_BACKUP_FAILED;
        }

        if (operation === SyncOperations.PROFILE_REGENERATION || message.includes('regenerat')) {
            return SyncErrorTypes.PROFILE_REGENERATION_FAILED;
        }

        if (operation === SyncOperations.ARCHIVE_CLEANUP || message.includes('archive')) {
            return SyncErrorTypes.ARCHIVE_CLEANUP_FAILED;
        }

        if (operation === SyncOperations.ROOT_PATH_VALIDATION || message.includes('root') || message.includes('path')) {
            return SyncErrorTypes.ROOT_PATH_VALIDATION_FAILED;
        }

        if (code === 'EACCES' || code === 'ENOENT') {
            if (context.path?.includes('.unison') || message.includes('unison')) {
                return SyncErrorTypes.UNISON_DIRECTORY_ACCESS_ERROR;
            }
        }

        return SyncErrorTypes.SYNC_CONFIGURATION_ERROR;
    }

    /**
     * Display user-friendly error message
     */
    displayUserFriendlyError(syncError) {
        const { userGuidance, errorId, severity } = syncError;

        console.log('\n' + '='.repeat(80));
        console.log(`🔧 SYNC CONFIGURATION ${severity.toUpperCase()} ERROR`);
        console.log('='.repeat(80));
        console.log(`Error ID: ${errorId}`);
        console.log(`\n📋 SUMMARY:`);
        console.log(`   ${userGuidance.summary}`);

        console.log(`\n🔍 POSSIBLE CAUSES:`);
        userGuidance.causes.forEach((cause, index) => {
            console.log(`   ${index + 1}. ${cause}`);
        });

        console.log(`\n✅ AUTOMATIC SOLUTIONS:`);
        userGuidance.solutions.forEach((solution, index) => {
            console.log(`   ${index + 1}. ${solution}`);
        });

        console.log(`\n👉 NEXT STEPS:`);
        userGuidance.nextSteps.forEach((step, index) => {
            console.log(`   ${index + 1}. ${step}`);
        });

        console.log(`\n💡 PREVENTION TIPS:`);
        userGuidance.preventionTips.forEach((tip, index) => {
            console.log(`   ${index + 1}. ${tip}`);
        });

        console.log('\n' + '='.repeat(80));
        console.log(`📝 Full error details have been logged for troubleshooting.`);
        console.log('='.repeat(80) + '\n');
    }

    /**
     * Generate troubleshooting steps
     */
    generateTroubleshootingSteps(syncError) {
        const { type, context } = syncError;

        const commonSteps = [
            'Check the sync configuration logs for detailed error information',
            'Verify that the Unison directory (~/.unison) is accessible',
            'Ensure sufficient disk space is available',
            'Close any running sync processes before retrying'
        ];

        const specificSteps = {
            [SyncErrorTypes.PROFILE_CORRUPTION]: [
                'Run profile validation to identify specific corruption issues',
                'Check if profile files contain sync data instead of configuration',
                'Verify profile backup was created successfully'
            ],
            [SyncErrorTypes.ARCHIVE_CORRUPTION]: [
                'Check archive file sizes for unusually large files',
                'Look for stale lock files that may indicate crashed processes',
                'Verify archive backup was created before cleanup'
            ],
            [SyncErrorTypes.ROOT_PATH_VALIDATION_FAILED]: [
                'Verify source path points to Sync_Hub_New directory',
                'Check that destination paths match cloud storage locations',
                'Ensure paths are absolute and properly formatted'
            ]
        };

        return {
            common: commonSteps,
            specific: specificSteps[type] || [],
            errorId: syncError.errorId,
            timestamp: syncError.timestamp
        };
    }

    /**
     * Log profile cleanup actions with detailed context
     */
    async logProfileCleanupAction(action, profileName, details = {}) {
        const context = {
            operation: SyncOperations.PROFILE_CLEANUP,
            profileName,
            action,
            ...details
        };

        await this.logInfo(`Profile cleanup action: ${action}`, context);

        // Also log to dedicated profile cleanup log
        await this.logToFile('profile_cleanup', {
            timestamp: new Date().toISOString(),
            level: 'INFO',
            component: this.component,
            profileName,
            action,
            details,
            message: `Profile cleanup: ${action} for ${profileName}`
        });
    }

    /**
     * Log archive cleanup actions with detailed context
     */
    async logArchiveCleanupAction(action, archiveInfo = {}) {
        const context = {
            operation: SyncOperations.ARCHIVE_CLEANUP,
            action,
            ...archiveInfo
        };

        await this.logInfo(`Archive cleanup action: ${action}`, context);

        // Also log to dedicated archive cleanup log
        await this.logToFile('archive_cleanup', {
            timestamp: new Date().toISOString(),
            level: 'INFO',
            component: this.component,
            action,
            archiveInfo,
            message: `Archive cleanup: ${action}`
        });
    }

    /**
     * Core logging function
     */
    async log(level, message, context = {}, error = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            component: this.component,
            message,
            context,
            hostname: os.hostname(),
            pid: process.pid,
            ...(error && { error: error.toJSON ? error.toJSON() : this.serializeError(error) })
        };

        // Console logging
        if (this.enableConsoleLogging) {
            this.logToConsole(level, message, context, error);
        }

        // File logging
        if (this.enableFileLogging) {
            await this.logToFile('sync', logEntry);
        }
    }

    /**
     * Log to console with appropriate formatting
     */
    logToConsole(level, message, context, error) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level}] [${this.component}]`;
        const contextStr = Object.keys(context).length > 0 ? ` | Context: ${JSON.stringify(context, null, 2)}` : '';
        const errorStr = error ? ` | Error: ${error.message || error}` : '';

        const fullMessage = `${prefix} ${message}${contextStr}${errorStr}`;

        switch (level) {
            case 'ERROR':
            case 'FATAL':
                console.error(fullMessage);
                break;
            case 'WARN':
                console.warn(fullMessage);
                break;
            case 'DEBUG':
                if (process.env.NODE_ENV === 'development') {
                    console.debug(fullMessage);
                }
                break;
            default:
                console.log(fullMessage);
        }
    }

    /**
     * Log to file
     */
    async logToFile(logType, logEntry) {
        try {
            const logFile = path.join(this.logDirectory, `${logType}.log`);
            const logLine = JSON.stringify(logEntry) + '\n';
            await fs.appendFile(logFile, logLine, 'utf8');
        } catch (error) {
            console.error(`Failed to write to log file: ${error.message}`);
        }
    }

    /**
     * Serialize error for logging
     */
    serializeError(error) {
        return {
            name: error.name,
            message: error.message,
            code: error.code,
            stack: error.stack,
            ...(error.context && { context: error.context })
        };
    }

    // Convenience logging methods
    async logDebug(message, context = {}) {
        await this.log('DEBUG', message, context);
    }

    async logInfo(message, context = {}) {
        await this.log('INFO', message, context);
    }

    async logWarn(message, context = {}) {
        await this.log('WARN', message, context);
    }

    async logError(message, context = {}, error = null) {
        await this.log('ERROR', message, context, error);
    }

    async logFatal(message, context = {}, error = null) {
        await this.log('FATAL', message, context, error);
    }
}

// Export the class and create a default instance
export default SyncErrorHandler;

// CLI interface when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const handler = new SyncErrorHandler();

    const command = process.argv[2];
    const errorType = process.argv[3];

    switch (command) {
        case 'test-error':
            if (!errorType) {
                console.error('Error type required for test-error command');
                process.exit(1);
            }

            // Create a test error
            const testError = new Error(`Test ${errorType} error`);
            handler.handleSyncError(testError, SyncOperations.PROFILE_VALIDATION, {
                profileName: 'test_profile',
                testMode: true
            }).then(result => {
                console.log('Test error handling result:', JSON.stringify(result, null, 2));
            });
            break;

        case 'test-guidance':
            if (!errorType || !SyncErrorTypes[errorType]) {
                console.error('Valid error type required. Available types:', Object.keys(SyncErrorTypes));
                process.exit(1);
            }

            const guidance = handler.createUserGuidance(SyncErrorTypes[errorType]);
            console.log(JSON.stringify(guidance, null, 2));
            break;

        default:
            console.log(`
Sync Error Handler

Usage: node sync_error_handler.js <command> [options]

Commands:
    test-error <error_type>     - Test error handling for specific error type
    test-guidance <error_type>  - Display user guidance for error type

Error Types:
    ${Object.keys(SyncErrorTypes).join('\n    ')}

Examples:
    node sync_error_handler.js test-error PROFILE_CORRUPTION
    node sync_error_handler.js test-guidance ARCHIVE_CORRUPTION
            `);
            break;
    }
}