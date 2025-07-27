#!/usr/bin/env node

/**
 * Centralized Error Handling and Logging System
 * Provides comprehensive error classification, handling, and structured logging
 */

import { promises as fs } from 'fs';
import { accessSync, constants as fsConstants, readFileSync, existsSync } from 'fs';
import path from 'path';
import os from 'os';

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
        this.projectRoot = options.projectRoot || this.detectProjectRoot();
        
        // Load configuration from config folder
        this.config = this.loadConfiguration();
        
        // Set up logging directory (always within project, never in sync folder)
        this.logDirectory = options.logDirectory || path.join(this.projectRoot, 'logs');
        
        // Ensure sync folder is NEVER created in project directory
        this.syncFolderPath = this.config.syncFolderPath || '/Users/moatasimfarooque/Sync_Hub_New';
        
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
        // Strategy 1: Use this file's location (most reliable)
        if (import.meta.url) {
            try {
                const currentFileDir = path.dirname(new URL(import.meta.url).pathname);
                // Navigate up from src/organize to project root
                const potentialRoot = path.resolve(currentFileDir, '../../');
                if (this.isProjectRoot(potentialRoot)) {
                    console.log(`[ProjectRoot] Detected via import.meta.url: ${potentialRoot}`);
                    return potentialRoot;
                }
            } catch (error) {
                console.warn(`[ProjectRoot] import.meta.url detection failed: ${error.message}`);
            }
        }
        
        // Strategy 2: Known absolute path (most reliable fallback)
        const knownProjectPath = '/Users/moatasimfarooque/Downloads/Programming/CascadeProjects/Drive_sync';
        if (this.isProjectRoot(knownProjectPath)) {
            console.log(`[ProjectRoot] Using known absolute path: ${knownProjectPath}`);
            return knownProjectPath;
        }
        
        // Strategy 3: Search from current working directory
        let currentDir = process.cwd();
        console.log(`[ProjectRoot] Starting search from cwd: ${currentDir}`);
        
        const maxDepth = 10;
        const projectIndicators = [
            // Primary indicators (most reliable)
            'package.json',
            '.git',
            'config/config.env',
            
            // Secondary indicators
            'src',
            'node_modules',
            '.gitignore',
            'README.md',
            'yarn.lock',
            'package-lock.json'
        ];

        // Search upward from current directory
        for (let i = 0; i < maxDepth; i++) {
            // Check if this directory has project indicators
            if (this.isProjectRoot(currentDir)) {
                return currentDir;
            }
            
            const parentDir = path.dirname(currentDir);
            
            // Stop if we've reached the filesystem root or can't go higher
            if (parentDir === currentDir || parentDir === '/') {
                break;
            }
            
            currentDir = parentDir;
        }

        // Strategy 4: Comprehensive fallback strategies (NEVER allow system root)
        const fallbacks = [
            // Primary: Known absolute path
            '/Users/moatasimfarooque/Downloads/Programming/CascadeProjects/Drive_sync',
            
            // Secondary: Search common locations
            path.join(os.homedir(), 'Downloads/Programming/CascadeProjects/Drive_sync'),
            path.join(os.homedir(), 'Downloads/Drive_sync'),
            path.join(os.homedir(), 'Drive_sync'),
            
            // Tertiary: Safe fallback to user's home directory with a subdirectory
            path.join(os.homedir(), '.drive_sync'),
            
            // Last resort: temp directory (but create project structure)
            path.join(os.tmpdir(), 'drive_sync_fallback')
        ];
        
        console.warn(`[ProjectRoot] All detection strategies failed, trying fallbacks...`);
        
        for (const fallback of fallbacks) {
            console.log(`[ProjectRoot] Checking fallback: ${fallback}`);
            if (this.isProjectRoot(fallback)) {
                console.log(`[ProjectRoot] Using fallback: ${fallback}`);
                return fallback;
            }
        }
        
        // CRITICAL: Never return system root - use first known good path
        const safeFallback = fallbacks[0];
        console.error(`[ProjectRoot] CRITICAL: All fallbacks failed, using safe default: ${safeFallback}`);
        console.error(`[ProjectRoot] This may indicate a serious configuration issue`);
        return safeFallback;
    }
    
    /**
     * Check if a directory is likely the project root
     */
    isProjectRoot(dirPath) {
        try {
            // Primary indicators (any one of these is sufficient)
            const primaryIndicators = [
                path.join(dirPath, 'package.json'),
                path.join(dirPath, 'config', 'config.env')
            ];
            
            for (const indicator of primaryIndicators) {
                try {
                    // Use synchronous access check
                    accessSync(indicator, fsConstants.F_OK);
                    
                    // Additional validation: ensure it's not just a node_modules package.json
                    if (indicator.endsWith('package.json')) {
                        const parentDir = path.dirname(indicator);
                        if (path.basename(parentDir) === 'node_modules' || 
                            parentDir.includes('node_modules')) {
                            continue;
                        }
                    }
                    return true;
                } catch (error) {
                    // Continue checking other indicators
                }
            }
            
            // Secondary validation: check for src directory structure
            const srcDir = path.join(dirPath, 'src');
            const organizeDir = path.join(dirPath, 'src', 'organize');
            
            try {
                accessSync(srcDir, fsConstants.F_OK);
                accessSync(organizeDir, fsConstants.F_OK);
                return true;
            } catch (error) {
                // Not a match
            }
            
            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Load configuration from the config folder
     */
    loadConfiguration() {
        const configDir = path.join(this.projectRoot, 'config');
        const configFile = path.join(configDir, 'config.env');
        
        try {
            // Check if config directory exists
            if (!existsSync(configDir)) {
                console.warn(`Config directory not found: ${configDir}`);
                return this.getDefaultConfig();
            }
            
            // Check if config file exists
            if (!existsSync(configFile)) {
                console.warn(`Config file not found: ${configFile}`);
                return this.getDefaultConfig();
            }
            
            // Read and parse config file
            const configContent = readFileSync(configFile, 'utf8');
            const config = this.parseConfigFile(configContent);
            
            // Validate critical paths
            if (config.syncFolderPath && config.syncFolderPath.startsWith(this.projectRoot)) {
                console.error(`CRITICAL: Sync folder path cannot be within project directory!`);
                console.error(`Project root: ${this.projectRoot}`);
                console.error(`Sync folder path: ${config.syncFolderPath}`);
                config.syncFolderPath = '/Users/moatasimfarooque/Sync_Hub_New';
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
        // Ensure sync folder path is absolute and outside project
        if (this.syncFolderPath) {
            const resolvedSyncPath = path.resolve(this.syncFolderPath);
            const resolvedProjectPath = path.resolve(this.projectRoot);
            
            // Check if sync path is within project directory
            if (resolvedSyncPath.startsWith(resolvedProjectPath)) {
                console.error(`CRITICAL ERROR: Sync folder cannot be within project directory!`);
                console.error(`Project root: ${resolvedProjectPath}`);
                console.error(`Sync folder: ${resolvedSyncPath}`);
                console.error(`Resetting sync folder to safe default.`);
                this.syncFolderPath = '/Users/moatasimfarooque/Sync_Hub_New';
            }
        }
        
        // Ensure log directory is within project (this is correct)
        const resolvedLogPath = path.resolve(this.logDirectory);
        const resolvedProjectPath = path.resolve(this.projectRoot);
        
        if (!resolvedLogPath.startsWith(resolvedProjectPath)) {
            console.warn(`Log directory is outside project root, this may cause permission issues.`);
            console.warn(`Project root: ${resolvedProjectPath}`);
            console.warn(`Log directory: ${resolvedLogPath}`);
        }
    }
    
    /**
     * Ensure log directory exists
     */
    async ensureLogDirectory() {
        try {
            await fs.mkdir(this.logDirectory, { recursive: true });
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
     * Handle error with comprehensive processing
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

        // Log the error
        await this.logError(enhancedError.message, enhancedError.context, enhancedError);

        // Log recovery strategy
        await this.logInfo(`Recovery strategy: ${recoveryStrategy.action} - ${recoveryStrategy.message}`, {
            errorType,
            retryable: recoveryStrategy.retryable,
            fallback: recoveryStrategy.fallback
        });

        return {
            error: enhancedError,
            strategy: recoveryStrategy,
            shouldRetry: recoveryStrategy.retryable,
            fallbackAction: recoveryStrategy.fallback
        };
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
        return path.join(this.logDirectory, `${level.toLowerCase()}_${timestamp}.log`);
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