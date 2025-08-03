#!/usr/bin/env node

/**
 * Centralized Error Handling and Logging System
 * Provides comprehensive error classification, handling, and structured logging
 */

import { promises as fs } from 'fs';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import os from 'os';
import { SimplePathResolver, PathUtils } from './simple_path_resolver.js';

/**
 * Error classification types
 */
export const ErrorTypes = {
    FILE_NOT_FOUND: 'FILE_NOT_FOUND',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    MODULE_IMPORT_FAILURE: 'MODULE_IMPORT_FAILURE',
    CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    ASYNC_OPERATION_ERROR: 'ASYNC_OPERATION_ERROR',
    CONTENT_PROCESSING_ERROR: 'CONTENT_PROCESSING_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * Log levels
 */
export const LogLevels = {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    FATAL: 'FATAL'
};

/**
 * Enhanced Error class with additional context
 */
export class EnhancedError extends Error {
    constructor(message, type = ErrorTypes.UNKNOWN_ERROR, context = {}, originalError = null) {
        super(message);
        this.name = 'EnhancedError';
        this.type = type;
        this.context = context;
        this.originalError = originalError;
        this.timestamp = new Date().toISOString();
        this.component = context.component || 'unknown';
        this.operation = context.operation || 'unknown';

        // Capture stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, EnhancedError);
        }
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
            context: this.context,
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
 * Centralized Error Handler and Logger
 */
export class ErrorHandler {
    constructor(options = {}) {
        // Use simplified path resolver
        this.pathResolver = new SimplePathResolver(options);
        this.projectRoot = this.pathResolver.projectRoot;

        // Load configuration from config folder
        this.config = this.loadConfiguration();

        // Set up logging directory (always within project, never in sync folder)
        this.logDirectory = options.logDirectory || this.pathResolver.joinPaths(this.projectRoot, 'logs');

        // Ensure sync folder is NEVER created in project directory
        this.syncFolderPath = this.config.syncFolderPath || this.pathResolver.syncHubPath;

        this.component = options.component || 'system';
        this.enableConsoleLogging = options.enableConsoleLogging !== false;
        this.enableFileLogging = options.enableFileLogging !== false;
        this.logLevel = options.logLevel || LogLevels.INFO;
        this.maxLogFileSize = options.maxLogFileSize || 10 * 1024 * 1024; // 10MB
        this.maxLogFiles = options.maxLogFiles || 5;

        // Validate paths to prevent sync folder creation in project
        this.validatePaths();

        // Ensure log directory exists
        this.ensureLogDirectory();
    }

    /**
     * Detect project root directory with multiple robust indicators
     * NEVER allows defaulting to system root (/) to prevent permission issues
     */
    detectProjectRoot() {
        // Delegate to simplified path resolver
        return this.pathResolver.detectProjectRoot();
    }

    /**
     * Check if a directory is likely the project root
     */
    isProjectRoot(dirPath) {
        if (!dirPath) return false;

        // Check for package.json
        const packageJsonPath = this.pathResolver.joinPaths(dirPath, 'package.json');
        if (PathUtils.existsSync(packageJsonPath)) {
            return true;
        }

        // Check for config directory
        const configPath = this.pathResolver.joinPaths(dirPath, 'config', 'config.env');
        return PathUtils.existsSync(configPath);
    }

    /**
     * Load configuration from the config folder
     */
    loadConfiguration() {
        const configFile = this.pathResolver.joinPaths(this.projectRoot, 'config', 'config.env');

        try {
            // Check if config file exists
            if (!this.pathResolver.fileExistsSync(configFile)) {
                console.warn(`Config file not found: ${configFile}`);
                return this.getDefaultConfig();
            }

            // Read and parse config file
            const configContent = readFileSync(configFile, 'utf8');
            const config = this.parseConfigFile(configContent);

            // Validate critical paths
            if (config.syncFolderPath && this.pathResolver.isPathWithin(config.syncFolderPath, this.projectRoot)) {
                console.error(`CRITICAL: Sync folder path cannot be within project directory!`);
                console.error(`Project root: ${this.projectRoot}`);
                console.error(`Sync folder path: ${config.syncFolderPath}`);
                config.syncFolderPath = this.pathResolver.syncHubPath;
            }

            return config;
        } catch (error) {
            console.error(`Failed to load configuration: ${error.message}`);
            return this.getDefaultConfig();
        }
    }

    /**
     * Parse configuration file content
     */
    parseConfigFile(content) {
        const config = {};
        const lines = content.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();

            // Skip comments and empty lines
            if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
                continue;
            }

            // Parse key=value pairs
            const equalIndex = trimmedLine.indexOf('=');
            if (equalIndex > 0) {
                const key = trimmedLine.substring(0, equalIndex).trim();
                let value = trimmedLine.substring(equalIndex + 1).trim();

                // Remove quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }

                // Map common config keys
                if (key.toLowerCase().includes('sync') && key.toLowerCase().includes('path')) {
                    config.syncFolderPath = value;
                } else if (key.toLowerCase().includes('log') && key.toLowerCase().includes('level')) {
                    config.logLevel = value;
                } else {
                    config[key] = value;
                }
            }
        }

        return config;
    }

    /**
     * Get default configuration
     */
    getDefaultConfig() {
        return {
            syncFolderPath: '/Users/moatasimfarooque/Sync_Hub_New',
            logLevel: 'INFO'
        };
    }

    /**
     * Validate paths to ensure sync folder is never in project directory
     */
    validatePaths() {
        // Ensure sync folder path is outside project
        if (this.syncFolderPath && this.pathResolver.isPathWithin(this.syncFolderPath, this.projectRoot)) {
            console.error(`CRITICAL ERROR: Sync folder cannot be within project directory!`);
            console.error(`Project root: ${this.projectRoot}`);
            console.error(`Sync folder: ${this.syncFolderPath}`);
            console.error(`Resetting sync folder to safe default.`);
            this.syncFolderPath = this.pathResolver.syncHubPath;
        }

        // Ensure log directory is within project (this is correct)
        if (!this.pathResolver.isPathWithin(this.logDirectory, this.projectRoot)) {
            console.warn(`Log directory is outside project root, this may cause permission issues.`);
            console.warn(`Project root: ${this.projectRoot}`);
            console.warn(`Log directory: ${this.logDirectory}`);
        }
    }

    /**
     * Ensure log directory exists
     */
    async ensureLogDirectory() {
        try {
            await this.pathResolver.ensureDirectory(this.logDirectory);
        } catch (error) {
            console.error(`Failed to create log directory: ${this.logDirectory}`, error);
        }
    }

    /**
     * Classify error based on error properties
     */
    static classifyError(error) {
        if (!error) return ErrorTypes.UNKNOWN_ERROR;

        // Check error code first
        if (error.code === 'ENOENT') return ErrorTypes.FILE_NOT_FOUND;
        if (error.code === 'EACCES') return ErrorTypes.PERMISSION_DENIED;
        if (error.code === 'ETIMEDOUT' || error.code === 'TIMEOUT') return ErrorTypes.TIMEOUT_ERROR;
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') return ErrorTypes.NETWORK_ERROR;

        // Check error message patterns
        const message = error.message?.toLowerCase() || '';

        if (message.includes('import') || message.includes('module') || message.includes('require')) {
            return ErrorTypes.MODULE_IMPORT_FAILURE;
        }
        if (message.includes('config') || message.includes('configuration')) {
            return ErrorTypes.CONFIGURATION_ERROR;
        }
        if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
            return ErrorTypes.VALIDATION_ERROR;
        }
        if (message.includes('network') || message.includes('connection') || message.includes('fetch')) {
            return ErrorTypes.NETWORK_ERROR;
        }
        if (message.includes('timeout') || message.includes('timed out')) {
            return ErrorTypes.TIMEOUT_ERROR;
        }
        if (message.includes('async') || message.includes('promise') || message.includes('await')) {
            return ErrorTypes.ASYNC_OPERATION_ERROR;
        }
        if (message.includes('content') || message.includes('parse') || message.includes('process')) {
            return ErrorTypes.CONTENT_PROCESSING_ERROR;
        }
        if (message.includes('temporary') || message.includes('retry')) {
            return ErrorTypes.ASYNC_OPERATION_ERROR; // Temporary failures should be retryable
        }

        return ErrorTypes.UNKNOWN_ERROR;
    }

    /**
     * Create recovery strategy based on error type
     */
    static createRecoveryStrategy(errorType, _context = {}) {
        const strategies = {
            [ErrorTypes.FILE_NOT_FOUND]: {
                action: 'skip',
                message: 'File not found, skipping operation',
                retryable: false,
                fallback: 'continue_without_file'
            },
            [ErrorTypes.PERMISSION_DENIED]: {
                action: 'retry_with_fallback',
                message: 'Permission denied, attempting fallback approach',
                retryable: true,
                fallback: 'use_alternative_path'
            },
            [ErrorTypes.MODULE_IMPORT_FAILURE]: {
                action: 'use_fallback',
                message: 'Module import failed, using fallback implementation',
                retryable: false,
                fallback: 'graceful_degradation'
            },
            [ErrorTypes.CONFIGURATION_ERROR]: {
                action: 'use_defaults',
                message: 'Configuration error, using default values',
                retryable: false,
                fallback: 'default_configuration'
            },
            [ErrorTypes.VALIDATION_ERROR]: {
                action: 'reject',
                message: 'Validation failed, operation cannot continue',
                retryable: false,
                fallback: 'none'
            },
            [ErrorTypes.NETWORK_ERROR]: {
                action: 'retry',
                message: 'Network error, retrying operation',
                retryable: true,
                fallback: 'offline_mode'
            },
            [ErrorTypes.TIMEOUT_ERROR]: {
                action: 'retry',
                message: 'Operation timed out, retrying with extended timeout',
                retryable: true,
                fallback: 'skip_operation'
            },
            [ErrorTypes.ASYNC_OPERATION_ERROR]: {
                action: 'retry',
                message: 'Async operation failed, retrying',
                retryable: true,
                fallback: 'synchronous_fallback'
            },
            [ErrorTypes.CONTENT_PROCESSING_ERROR]: {
                action: 'skip_with_warning',
                message: 'Content processing failed, skipping with warning',
                retryable: false,
                fallback: 'basic_processing'
            },
            [ErrorTypes.UNKNOWN_ERROR]: {
                action: 'log_and_continue',
                message: 'Unknown error occurred, logging and continuing',
                retryable: false,
                fallback: 'best_effort'
            }
        };

        return strategies[errorType] || strategies[ErrorTypes.UNKNOWN_ERROR];
    }

    /**
     * Handle error with comprehensive processing and structured response
     */
    async handleError(error, context = {}) {
        // Preserve existing error type if it's already an EnhancedError
        const errorType = error.type || ErrorHandler.classifyError(error);

        let enhancedError;
        if (error instanceof EnhancedError) {
            // If it's already an EnhancedError, preserve it but add context
            enhancedError = error;
            enhancedError.context = { ...enhancedError.context, ...context, component: this.component };
        } else {
            // Create new EnhancedError
            enhancedError = new EnhancedError(
                error.message || 'Unknown error occurred',
                errorType,
                { ...context, component: this.component },
                error
            );
        }

        const recoveryStrategy = ErrorHandler.createRecoveryStrategy(errorType, context);

        // Log the error with comprehensive details
        await this.logError(enhancedError.message, {
            ...enhancedError.context,
            errorId: this.generateErrorId(enhancedError),
            severity: this.determineSeverity(enhancedError, context),
            category: errorType
        }, enhancedError);

        // Log recovery strategy
        await this.logInfo(`Recovery strategy: ${recoveryStrategy.action} - ${recoveryStrategy.message}`, {
            errorType,
            retryable: recoveryStrategy.retryable,
            fallback: recoveryStrategy.fallback,
            errorId: this.generateErrorId(enhancedError)
        });

        return {
            error: enhancedError,
            strategy: recoveryStrategy,
            shouldRetry: recoveryStrategy.retryable,
            fallbackAction: recoveryStrategy.fallback,
            errorId: this.generateErrorId(enhancedError),
            severity: this.determineSeverity(enhancedError, context),
            troubleshooting: this.generateTroubleshootingInfo(enhancedError, context)
        };
    }

    /**
     * Generate unique error ID for tracking
     */
    generateErrorId(error) {
        const timestamp = Date.now();
        const errorHash = this.simpleHash(error.message + (error.stack || ''));
        return `ERR_${this.component}_${timestamp}_${errorHash}`.substring(0, 32);
    }

    /**
     * Determine error severity level
     */
    determineSeverity(error, context = {}) {
        // Critical errors that prevent system operation
        if (error.code === 'EACCES' || error.message?.includes('CRITICAL') ||
            error.type === ErrorTypes.PERMISSION_DENIED) {
            return 'critical';
        }

        // High severity for data loss or corruption risks
        if (error.message?.includes('corrupt') || error.message?.includes('delete') ||
            context.operation?.includes('delete') || context.operation?.includes('move') ||
            error.type === ErrorTypes.CONFIGURATION_ERROR) {
            return 'high';
        }

        // Medium severity for functional failures
        if (error.code === 'ENOENT' || error.message?.includes('not found') ||
            error.message?.includes('failed to') || error.type === ErrorTypes.FILE_NOT_FOUND ||
            error.type === ErrorTypes.MODULE_IMPORT_FAILURE) {
            return 'medium';
        }

        // Low severity for recoverable issues
        if (error.message?.includes('warning') || error.message?.includes('skip') ||
            error.type === ErrorTypes.VALIDATION_ERROR) {
            return 'low';
        }

        return 'medium'; // Default
    }

    /**
     * Generate comprehensive troubleshooting information
     */
    generateTroubleshootingInfo(error, context = {}) {
        const errorType = error.type || ErrorHandler.classifyError(error);

        return {
            errorId: this.generateErrorId(error),
            category: errorType,
            commonCauses: this.getCommonCauses(errorType),
            diagnosticSteps: this.getDiagnosticSteps(errorType, context),
            preventionTips: this.getPreventionTips(errorType),
            relatedDocumentation: this.getRelatedDocumentation(errorType),
            supportInfo: {
                component: this.component,
                timestamp: new Date().toISOString(),
                context: this.sanitizeContextForSupport(context)
            }
        };
    }

    /**
     * Get common causes for error type
     */
    getCommonCauses(errorType) {
        const causes = {
            [ErrorTypes.FILE_NOT_FOUND]: [
                'File was moved or deleted',
                'Incorrect file path specified',
                'File is in a different directory than expected',
                'Permissions prevent file access'
            ],
            [ErrorTypes.PERMISSION_DENIED]: [
                'Insufficient user permissions',
                'File or directory is read-only',
                'File is locked by another process',
                'Security restrictions in place'
            ],
            [ErrorTypes.MODULE_IMPORT_FAILURE]: [
                'Module not installed or missing',
                'Incorrect import path',
                'Version compatibility issues',
                'Circular dependency problems'
            ],
            [ErrorTypes.CONFIGURATION_ERROR]: [
                'Configuration file missing or corrupted',
                'Invalid configuration values',
                'Environment variables not set',
                'Configuration format errors'
            ],
            [ErrorTypes.VALIDATION_ERROR]: [
                'Required parameters missing',
                'Invalid parameter types',
                'Parameter values out of range',
                'Malformed input data'
            ],
            [ErrorTypes.CONTENT_PROCESSING_ERROR]: [
                'Content format not supported',
                'Content is corrupted or malformed',
                'Insufficient memory for processing',
                'Content size exceeds limits'
            ]
        };

        return causes[errorType] || ['Unknown cause - requires investigation'];
    }

    /**
     * Get diagnostic steps for error type
     */
    getDiagnosticSteps(errorType, context) {
        const steps = {
            [ErrorTypes.FILE_NOT_FOUND]: [
                'Verify the file path exists',
                'Check parent directory permissions',
                'List directory contents to confirm file location',
                'Check if file was recently moved or deleted'
            ],
            [ErrorTypes.PERMISSION_DENIED]: [
                'Check file/directory permissions',
                'Verify current user has necessary access',
                'Check if file is locked by another process',
                'Try accessing with elevated permissions'
            ],
            [ErrorTypes.MODULE_IMPORT_FAILURE]: [
                'Verify module is installed',
                'Check import path syntax',
                'Verify module version compatibility',
                'Check for circular dependencies'
            ],
            [ErrorTypes.CONFIGURATION_ERROR]: [
                'Check configuration file exists',
                'Validate configuration syntax',
                'Verify environment variables',
                'Test with default configuration'
            ],
            [ErrorTypes.VALIDATION_ERROR]: [
                'Review input parameters',
                'Check parameter types and formats',
                'Verify required fields are present',
                'Test with minimal valid input'
            ],
            [ErrorTypes.CONTENT_PROCESSING_ERROR]: [
                'Check content format and encoding',
                'Verify content is not corrupted',
                'Test with smaller content samples',
                'Check available memory and resources'
            ]
        };

        return steps[errorType] || ['Investigate error message and stack trace'];
    }

    /**
     * Get prevention tips for error type
     */
    getPreventionTips(errorType) {
        const tips = {
            [ErrorTypes.FILE_NOT_FOUND]: [
                'Use absolute paths when possible',
                'Implement file existence checks before operations',
                'Add file monitoring for critical files'
            ],
            [ErrorTypes.PERMISSION_DENIED]: [
                'Set up proper file permissions during setup',
                'Use user-writable directories for operations',
                'Implement permission checks before operations'
            ],
            [ErrorTypes.MODULE_IMPORT_FAILURE]: [
                'Add dependency checks during startup',
                'Use package.json to manage dependencies',
                'Implement graceful degradation for optional modules'
            ],
            [ErrorTypes.CONFIGURATION_ERROR]: [
                'Validate configuration during startup',
                'Provide default configuration values',
                'Use configuration schema validation'
            ],
            [ErrorTypes.VALIDATION_ERROR]: [
                'Add input validation at entry points',
                'Provide clear parameter documentation',
                'Use schema validation for complex inputs'
            ],
            [ErrorTypes.CONTENT_PROCESSING_ERROR]: [
                'Add content format validation',
                'Implement streaming for large content',
                'Add memory usage monitoring'
            ]
        };

        return tips[errorType] || ['Implement proper error handling and validation'];
    }

    /**
     * Get related documentation for error type
     */
    getRelatedDocumentation(errorType) {
        // This could be enhanced to return actual documentation links
        return {
            errorType,
            documentation: [
                'Check the component documentation',
                'Review error handling best practices',
                'Consult troubleshooting guides'
            ]
        };
    }

    /**
     * Sanitize context for support reporting
     */
    sanitizeContextForSupport(context) {
        const sanitized = { ...context };

        // Remove sensitive information
        const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth'];
        sensitiveKeys.forEach(key => {
            if (sanitized[key]) {
                sanitized[key] = '[REDACTED]';
            }
        });

        // Truncate large content
        if (sanitized.content && sanitized.content.length > 500) {
            sanitized.content = sanitized.content.substring(0, 500) + '... [truncated]';
        }

        return sanitized;
    }

    /**
     * Simple hash function for ID generation
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Wrap async operations with error handling
     */
    async wrapAsync(operation, context = {}, retryOptions = {}) {
        const maxRetries = retryOptions.maxRetries || 0; // Default to no retries
        const retryDelay = retryOptions.retryDelay || 1000;
        const backoffMultiplier = retryOptions.backoffMultiplier || 2;

        let lastError = null;
        let currentDelay = retryDelay;
        const totalAttempts = maxRetries + 1; // First attempt + retries

        for (let attempt = 1; attempt <= totalAttempts; attempt++) {
            try {
                await this.logDebug(`Attempting operation: ${context.operation || 'unknown'}`, {
                    attempt,
                    maxAttempts: totalAttempts,
                    ...context
                });

                const result = await operation();

                if (attempt > 1) {
                    await this.logInfo(`Operation succeeded after ${attempt} attempts`, context);
                }

                return result;
            } catch (error) {
                lastError = error;
                const errorInfo = await this.handleError(error, {
                    ...context,
                    attempt,
                    maxAttempts: totalAttempts
                });

                // Don't retry if this is the last attempt or error is not retryable
                if (attempt === totalAttempts || !errorInfo.shouldRetry) {
                    throw errorInfo.error;
                }

                await this.logWarn(`Operation failed, retrying in ${currentDelay}ms`, {
                    attempt,
                    maxAttempts: totalAttempts,
                    error: error.message,
                    ...context
                });

                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, currentDelay));
                currentDelay *= backoffMultiplier;
            }
        }

        throw lastError;
    }

    /**
     * Get log file path for specific log level
     */
    getLogFilePath(level = 'main') {
        const timestamp = new Date().toISOString().split('T')[0];
        return this.pathResolver.joinPaths(this.logDirectory, `${level.toLowerCase()}_${timestamp}.log`);
    }

    /**
     * Create context-aware error with stack trace enhancement
     */
    createContextualError(message, type, context = {}, originalError = null) {
        const enhancedError = new EnhancedError(message, type, {
            ...context,
            component: this.component,
            timestamp: new Date().toISOString(),
            processId: process.pid,
            hostname: os.hostname()
        }, originalError);

        // Enhance stack trace with context
        if (enhancedError.stack && context.operation) {
            enhancedError.stack = `Operation: ${context.operation}\n${enhancedError.stack}`;
        }

        return enhancedError;
    }

    /**
     * Handle critical system errors that require immediate attention
     */
    async handleCriticalError(error, context = {}) {
        const criticalError = this.createContextualError(
            `CRITICAL: ${error.message}`,
            ErrorHandler.classifyError(error),
            { ...context, severity: 'CRITICAL' },
            error
        );

        await this.logFatal(criticalError.message, criticalError.context, criticalError);

        // Also log to console regardless of settings for critical errors
        console.error(`🚨 CRITICAL ERROR in ${this.component}:`, criticalError.message);
        if (criticalError.stack) {
            console.error(criticalError.stack);
        }

        return criticalError;
    }

    /**
     * Check if log level should be logged
     */
    shouldLog(level) {
        const levels = [LogLevels.DEBUG, LogLevels.INFO, LogLevels.WARN, LogLevels.ERROR, LogLevels.FATAL];
        const currentLevelIndex = levels.indexOf(this.logLevel);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex >= currentLevelIndex;
    }

    /**
     * Core logging function
     */
    async log(level, message, context = {}, error = null) {
        if (!this.shouldLog(level)) return;

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
            await this.logToFile(level, logEntry);
        }
    }

    /**
     * Log to console with appropriate formatting
     */
    logToConsole(level, message, context, error) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level}] [${this.component}]`;
        const contextStr = Object.keys(context).length > 0 ? ` | Context: ${JSON.stringify(context)}` : '';
        const errorStr = error ? ` | Error: ${error.message || error}` : '';

        const fullMessage = `${prefix} ${message}${contextStr}${errorStr}`;

        switch (level) {
            case LogLevels.ERROR:
            case LogLevels.FATAL:
                console.error(fullMessage);
                if (error && error.stack) {
                    console.error(error.stack);
                }
                break;
            case LogLevels.WARN:
                console.warn(fullMessage);
                break;
            case LogLevels.DEBUG:
                if (process.env.NODE_ENV !== 'production') {
                    console.debug(fullMessage);
                }
                break;
            default:
                console.log(fullMessage);
        }
    }

    /**
     * Log to file with rotation
     */
    async logToFile(level, logEntry) {
        try {
            const logFilePath = this.getLogFilePath('main');
            const logLine = JSON.stringify(logEntry) + '\n';

            // Check file size and rotate if necessary
            await this.rotateLogIfNeeded(logFilePath);

            await fs.appendFile(logFilePath, logLine);
        } catch (error) {
            console.error(`Failed to write to log file: ${error.message}`);
        }
    }

    /**
     * Rotate log file if it exceeds maximum size
     */
    async rotateLogIfNeeded(logFilePath) {
        try {
            const stats = await fs.stat(logFilePath);
            if (stats.size > this.maxLogFileSize) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const rotatedPath = `${logFilePath}.${timestamp}`;
                await fs.rename(logFilePath, rotatedPath);

                // Clean up old log files
                await this.cleanupOldLogs();

                // Log rotation event (but avoid infinite recursion)
                console.log(`Log file rotated: ${logFilePath} -> ${rotatedPath} (size: ${stats.size})`);
            }
        } catch (error) {
            // File doesn't exist yet, no rotation needed
            if (error.code !== 'ENOENT') {
                console.error(`Failed to rotate log file: ${error.message}`);
            }
        }
    }

    /**
     * Clean up old log files
     */
    async cleanupOldLogs() {
        try {
            const files = await fs.readdir(this.logDirectory);
            const logFiles = files
                .filter(file => file.endsWith('.log'))
                .map(file => ({
                    name: file,
                    path: path.join(this.logDirectory, file),
                    stat: null
                }));

            // Get file stats
            for (const file of logFiles) {
                try {
                    file.stat = await fs.stat(file.path);
                } catch (error) {
                    // Skip files that can't be accessed
                }
            }

            // Sort by modification time (newest first)
            const sortedFiles = logFiles
                .filter(file => file.stat)
                .sort((a, b) => b.stat.mtime - a.stat.mtime);

            // Remove excess files
            if (sortedFiles.length > this.maxLogFiles) {
                const filesToDelete = sortedFiles.slice(this.maxLogFiles);
                for (const file of filesToDelete) {
                    await fs.unlink(file.path);
                }
            }
        } catch (error) {
            console.error(`Failed to cleanup old logs: ${error.message}`);
        }
    }

    /**
     * Serialize error for logging
     */
    serializeError(error) {
        if (!error) return null;

        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: error.code,
            type: error.type || ErrorHandler.classifyError(error),
            ...(error.context && { context: error.context })
        };
    }

    /**
     * Convenience logging methods
     */
    async logDebug(message, context = {}) {
        await this.log(LogLevels.DEBUG, message, context);
    }

    async logInfo(message, context = {}) {
        await this.log(LogLevels.INFO, message, context);
    }

    async logWarn(message, context = {}, error = null) {
        await this.log(LogLevels.WARN, message, context, error);
    }

    async logError(message, context = {}, error = null) {
        await this.log(LogLevels.ERROR, message, context, error);
    }

    async logFatal(message, context = {}, error = null) {
        await this.log(LogLevels.FATAL, message, context, error);
    }

    /**
     * Get error handler statistics
     */
    getStats() {
        return {
            component: this.component,
            logDirectory: this.logDirectory,
            logLevel: this.logLevel,
            enableConsoleLogging: this.enableConsoleLogging,
            enableFileLogging: this.enableFileLogging,
            maxLogFileSize: this.maxLogFileSize,
            maxLogFiles: this.maxLogFiles
        };
    }
}

/**
 * Create a component-specific error handler
 */
export function createErrorHandler(component, options = {}) {
    return new ErrorHandler({
        component,
        ...options
    });
}

/**
 * Global error handler instance
 */
export const globalErrorHandler = new ErrorHandler({
    component: 'global'
});

export default ErrorHandler;