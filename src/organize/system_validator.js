#!/usr/bin/env node

/**
 * System Validation and Dependency Checking Module
 * Validates system dependencies, configuration, and paths before system startup
 */

import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';
import { createErrorHandler, ErrorTypes, EnhancedError } from './error_handler.js';

/**
 * Validation result types
 */
export const ValidationStatus = {
    PASS: 'PASS',
    WARN: 'WARN',
    FAIL: 'FAIL',
    SKIP: 'SKIP'
};

/**
 * Validation categories
 */
export const ValidationCategories = {
    DEPENDENCIES: 'dependencies',
    CONFIGURATION: 'configuration',
    PATHS: 'paths',
    PERMISSIONS: 'permissions',
    MODULES: 'modules',
    SYSTEM: 'system'
};

/**
 * System Validator class
 */
export class SystemValidator {
    constructor(options = {}) {
        this.projectRoot = options.projectRoot || this.detectProjectRoot();
        this.errorHandler = createErrorHandler('SystemValidator', {
            projectRoot: this.projectRoot,
            enableConsoleLogging: options.enableConsoleLogging !== false
        });
        
        this.validationResults = [];
        this.criticalFailures = [];
        this.warnings = [];
        this.skipFastFail = options.skipFastFail || false;
        this.verbose = options.verbose || false;
    }

    /**
     * Detect project root directory
     */
    detectProjectRoot() {
        let currentDir = process.cwd();
        const maxDepth = 5;

        for (let i = 0; i < maxDepth; i++) {
            const configPath = path.join(currentDir, 'config', 'config.env');
            try {
                require('fs').accessSync(configPath);
                return currentDir;
            } catch (error) {
                const parentDir = path.dirname(currentDir);
                if (parentDir === currentDir) break;
                currentDir = parentDir;
            }
        }

        return process.cwd();
    }

    /**
     * Add validation result
     */
    addResult(category, name, status, message, details = {}) {
        const result = {
            category,
            name,
            status,
            message,
            details,
            timestamp: new Date().toISOString()
        };

        this.validationResults.push(result);

        if (status === ValidationStatus.FAIL) {
            this.criticalFailures.push(result);
        } else if (status === ValidationStatus.WARN) {
            this.warnings.push(result);
        }

        if (this.verbose) {
            const statusIcon = this.getStatusIcon(status);
            console.log(`${statusIcon} [${category.toUpperCase()}] ${name}: ${message}`);
        }

        return result;
    }

    /**
     * Get status icon for display
     */
    getStatusIcon(status) {
        switch (status) {
            case ValidationStatus.PASS: return '✅';
            case ValidationStatus.WARN: return '⚠️';
            case ValidationStatus.FAIL: return '❌';
            case ValidationStatus.SKIP: return '⏭️';
            default: return '❓';
        }
    }

    /**
     * Run all validations
     */
    async validateSystem() {
        await this.errorHandler.logInfo('Starting system validation');

        try {
            // Run validation categories in order of importance
            await this.validateDependencies();
            await this.validateConfiguration();
            await this.validatePaths();
            await this.validatePermissions();
            await this.validateModules();
            await this.validateSystemHealth();

            const summary = this.generateValidationSummary();
            await this.errorHandler.logInfo('System validation completed', summary);

            return {
                success: this.criticalFailures.length === 0,
                summary,
                results: this.validationResults,
                criticalFailures: this.criticalFailures,
                warnings: this.warnings
            };

        } catch (error) {
            const errorInfo = await this.errorHandler.handleError(error, {
                operation: 'validateSystem'
            });

            return {
                success: false,
                error: errorInfo.error,
                summary: this.generateValidationSummary(),
                results: this.validationResults,
                criticalFailures: this.criticalFailures,
                warnings: this.warnings
            };
        }
    }

    /**
     * Validate system dependencies
     */
    async validateDependencies() {
        await this.errorHandler.logDebug('Validating system dependencies');

        // Check Node.js
        await this.checkCommand('node', '--version', 'Node.js', {
            category: ValidationCategories.DEPENDENCIES,
            required: true,
            minVersion: '14.0.0'
        });

        // Check npm
        await this.checkCommand('npm', '--version', 'npm', {
            category: ValidationCategories.DEPENDENCIES,
            required: true
        });

        // Check Unison
        await this.checkCommand('unison', '-version', 'Unison', {
            category: ValidationCategories.DEPENDENCIES,
            required: true,
            installHint: 'Install with: brew install unison'
        });

        // Check flock (for file locking)
        await this.checkCommand('flock', '--version', 'flock', {
            category: ValidationCategories.DEPENDENCIES,
            required: false,
            installHint: 'Install with: brew install util-linux (on macOS)'
        });

        // Check git (optional but recommended)
        await this.checkCommand('git', '--version', 'Git', {
            category: ValidationCategories.DEPENDENCIES,
            required: false
        });
    }

    /**
     * Check if a command exists and works
     */
    async checkCommand(command, versionFlag, displayName, options = {}) {
        try {
            const output = execSync(`${command} ${versionFlag}`, { 
                encoding: 'utf8',
                timeout: 5000,
                stdio: ['ignore', 'pipe', 'ignore']
            }).trim();

            const version = this.extractVersion(output);
            
            this.addResult(
                options.category || ValidationCategories.DEPENDENCIES,
                displayName,
                ValidationStatus.PASS,
                `${displayName} is available${version ? ` (${version})` : ''}`,
                { command, version, output: output.split('\n')[0] }
            );

            // Check minimum version if specified
            if (options.minVersion && version) {
                const isVersionValid = this.compareVersions(version, options.minVersion) >= 0;
                if (!isVersionValid) {
                    this.addResult(
                        options.category || ValidationCategories.DEPENDENCIES,
                        `${displayName} Version`,
                        ValidationStatus.WARN,
                        `${displayName} version ${version} is below recommended minimum ${options.minVersion}`,
                        { currentVersion: version, minVersion: options.minVersion }
                    );
                }
            }

        } catch (error) {
            const status = options.required ? ValidationStatus.FAIL : ValidationStatus.WARN;
            const message = options.required 
                ? `${displayName} is required but not available`
                : `${displayName} is not available (optional)`;

            this.addResult(
                options.category || ValidationCategories.DEPENDENCIES,
                displayName,
                status,
                message,
                { 
                    command, 
                    error: error.message,
                    installHint: options.installHint
                }
            );

            if (options.required && !this.skipFastFail) {
                throw new EnhancedError(
                    `Critical dependency missing: ${displayName}`,
                    ErrorTypes.VALIDATION_ERROR,
                    {
                        operation: 'checkCommand',
                        command,
                        displayName,
                        installHint: options.installHint
                    },
                    error
                );
            }
        }
    }

    /**
     * Extract version from command output
     */
    extractVersion(output) {
        const versionRegex = /(\d+\.\d+\.\d+)/;
        const match = output.match(versionRegex);
        return match ? match[1] : null;
    }

    /**
     * Compare version strings
     */
    compareVersions(version1, version2) {
        const v1Parts = version1.split('.').map(Number);
        const v2Parts = version2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
            const v1Part = v1Parts[i] || 0;
            const v2Part = v2Parts[i] || 0;
            
            if (v1Part > v2Part) return 1;
            if (v1Part < v2Part) return -1;
        }
        
        return 0;
    }

    /**
     * Validate configuration files
     */
    async validateConfiguration() {
        await this.errorHandler.logDebug('Validating configuration files');

        // Check main config.env
        const configEnvPath = path.join(this.projectRoot, 'config', 'config.env');
        await this.checkFileExists(configEnvPath, 'Main Configuration (config.env)', {
            category: ValidationCategories.CONFIGURATION,
            required: true,
            createDefault: true
        });

        // Check organize_config.conf
        const organizeConfigPath = path.join(this.projectRoot, 'config', 'organize_config.conf');
        await this.checkFileExists(organizeConfigPath, 'Organization Configuration', {
            category: ValidationCategories.CONFIGURATION,
            required: false,
            createDefault: true
        });

        // Validate config.env content
        await this.validateConfigEnvContent(configEnvPath);

        // Check package.json
        const packageJsonPath = path.join(this.projectRoot, 'package.json');
        await this.checkFileExists(packageJsonPath, 'Package Configuration (package.json)', {
            category: ValidationCategories.CONFIGURATION,
            required: false
        });

        // Check MCP server package.json
        const mcpPackageJsonPath = path.join(this.projectRoot, 'src', 'mcp', 'package.json');
        await this.checkFileExists(mcpPackageJsonPath, 'MCP Server Configuration', {
            category: ValidationCategories.CONFIGURATION,
            required: false
        });
    }

    /**
     * Validate config.env content
     */
    async validateConfigEnvContent(configPath) {
        try {
            const content = await fs.readFile(configPath, 'utf8');
            const requiredVars = ['SYNC_HUB', 'ICLOUD_PATH', 'GOOGLE_DRIVE_PATH'];
            const missingVars = [];

            for (const varName of requiredVars) {
                const regex = new RegExp(`^${varName}=`, 'm');
                if (!regex.test(content)) {
                    missingVars.push(varName);
                }
            }

            if (missingVars.length === 0) {
                this.addResult(
                    ValidationCategories.CONFIGURATION,
                    'Configuration Variables',
                    ValidationStatus.PASS,
                    'All required configuration variables are present'
                );
            } else {
                this.addResult(
                    ValidationCategories.CONFIGURATION,
                    'Configuration Variables',
                    ValidationStatus.WARN,
                    `Missing configuration variables: ${missingVars.join(', ')}`,
                    { missingVars }
                );
            }

        } catch (error) {
            this.addResult(
                ValidationCategories.CONFIGURATION,
                'Configuration Content',
                ValidationStatus.FAIL,
                `Failed to validate configuration content: ${error.message}`,
                { error: error.message }
            );
        }
    }

    /**
     * Check if file exists
     */
    async checkFileExists(filePath, displayName, options = {}) {
        try {
            await fs.access(filePath);
            
            const stats = await fs.stat(filePath);
            this.addResult(
                options.category || ValidationCategories.PATHS,
                displayName,
                ValidationStatus.PASS,
                `${displayName} exists and is accessible`,
                { 
                    path: filePath,
                    size: stats.size,
                    modified: stats.mtime.toISOString()
                }
            );

        } catch (error) {
            const status = options.required ? ValidationStatus.FAIL : ValidationStatus.WARN;
            const message = `${displayName} not found: ${filePath}`;

            this.addResult(
                options.category || ValidationCategories.PATHS,
                displayName,
                status,
                message,
                { path: filePath, error: error.message }
            );

            // Create default file if requested
            if (options.createDefault && options.required) {
                await this.createDefaultFile(filePath, displayName);
            }

            if (options.required && !this.skipFastFail) {
                throw new EnhancedError(
                    `Required file missing: ${displayName}`,
                    ErrorTypes.FILE_NOT_FOUND,
                    {
                        operation: 'checkFileExists',
                        filePath,
                        displayName
                    },
                    error
                );
            }
        }
    }

    /**
     * Create default configuration file
     */
    async createDefaultFile(filePath, displayName) {
        try {
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });

            let defaultContent = '';
            
            if (filePath.endsWith('config.env')) {
                defaultContent = this.getDefaultConfigEnv();
            } else if (filePath.endsWith('organize_config.conf')) {
                defaultContent = this.getDefaultOrganizeConfig();
            }

            if (defaultContent) {
                await fs.writeFile(filePath, defaultContent);
                this.addResult(
                    ValidationCategories.CONFIGURATION,
                    `${displayName} (Created)`,
                    ValidationStatus.PASS,
                    `Created default ${displayName} at ${filePath}`,
                    { path: filePath, created: true }
                );
            }

        } catch (error) {
            this.addResult(
                ValidationCategories.CONFIGURATION,
                `${displayName} (Creation Failed)`,
                ValidationStatus.FAIL,
                `Failed to create default ${displayName}: ${error.message}`,
                { path: filePath, error: error.message }
            );
        }
    }

    /**
     * Get default config.env content
     */
    getDefaultConfigEnv() {
        return `# Enhanced Document Organization System Configuration
# Generated by system validator

# ============================================================================
# PATH CONFIGURATION
# ============================================================================

# Local sync hub - central location for all documents
SYNC_HUB="${os.homedir()}/Sync_Hub_New"

# iCloud sync path (Obsidian documents)
ICLOUD_PATH="\${HOME}/Library/Mobile Documents/iCloud~md~obsidian/Documents/Sync"

# Google Drive sync path (adjust to match your setup)
GOOGLE_DRIVE_PATH="\${HOME}/Library/CloudStorage/GoogleDrive-*/My Drive/Sync"

# ============================================================================
# SYNC CONFIGURATION
# ============================================================================

# Sync behavior
SYNC_ENABLED=true
SYNC_BIDIRECTIONAL=true
SYNC_CONFLICT_RESOLUTION="newer"

# ============================================================================
# ORGANIZATION CONFIGURATION
# ============================================================================

# Enable/disable organization features
ORGANIZATION_ENABLED=true
AUTO_CATEGORIZATION=true
SIMPLIFIED_CATEGORIES=true

# Organization behavior
DRY_RUN_MODE=false
BACKUP_BEFORE_MOVE=true
PRESERVE_EXISTING_ORGANIZATION=true

# ============================================================================
# LOGGING AND MONITORING
# ============================================================================

# Logging configuration
LOG_LEVEL="INFO"
LOG_RETENTION_DAYS=7
LOG_TO_FILE=true
LOG_TO_CONSOLE=true

# Export all variables for use in scripts
export SYNC_HUB ICLOUD_PATH GOOGLE_DRIVE_PATH
export SYNC_ENABLED SYNC_BIDIRECTIONAL SYNC_CONFLICT_RESOLUTION
export ORGANIZATION_ENABLED AUTO_CATEGORIZATION SIMPLIFIED_CATEGORIES
export DRY_RUN_MODE BACKUP_BEFORE_MOVE PRESERVE_EXISTING_ORGANIZATION
export LOG_LEVEL LOG_RETENTION_DAYS LOG_TO_FILE LOG_TO_CONSOLE
`;
    }

    /**
     * Get default organize_config.conf content
     */
    getDefaultOrganizeConfig() {
        return `# Organization Configuration
# Generated by system validator

[categories]
ai_ml = "AI & ML"
research = "Research Papers"
web = "Web Content"
notes = "Notes & Drafts"
development = "Development"

[settings]
similarity_threshold = 0.8
enable_ai_enhancement = true
enable_duplicate_detection = true
`;
    }

    /**
     * Validate paths and directories
     */
    async validatePaths() {
        await this.errorHandler.logDebug('Validating paths and directories');

        // Load configuration to get paths
        const configEnvPath = path.join(this.projectRoot, 'config', 'config.env');
        let syncHub = path.join(os.homedir(), 'Sync_Hub_New'); // Default fallback

        try {
            const configContent = await fs.readFile(configEnvPath, 'utf8');
            const syncHubMatch = configContent.match(/^SYNC_HUB="?(.*?)"?$/m);
            if (syncHubMatch && syncHubMatch[1]) {
                syncHub = syncHubMatch[1].replace(/\$\{HOME\}/g, os.homedir());
            }
        } catch (error) {
            await this.errorHandler.logWarn('Could not load configuration for path validation', {
                configPath: configEnvPath,
                error: error.message
            });
        }

        // Check critical directories
        const criticalPaths = [
            { path: this.projectRoot, name: 'Project Root', required: true },
            { path: path.join(this.projectRoot, 'config'), name: 'Config Directory', required: true },
            { path: path.join(this.projectRoot, 'src'), name: 'Source Directory', required: true },
            { path: path.join(this.projectRoot, 'src', 'organize'), name: 'Organization Module Directory', required: true },
            { path: path.join(this.projectRoot, 'src', 'mcp'), name: 'MCP Server Directory', required: false },
            { path: path.join(this.projectRoot, 'logs'), name: 'Logs Directory', required: false, createIfMissing: true },
            { path: syncHub, name: 'Sync Hub', required: true, createIfMissing: true }
        ];

        for (const pathInfo of criticalPaths) {
            await this.checkDirectoryExists(pathInfo.path, pathInfo.name, {
                required: pathInfo.required,
                createIfMissing: pathInfo.createIfMissing
            });
        }
    }

    /**
     * Check if directory exists
     */
    async checkDirectoryExists(dirPath, displayName, options = {}) {
        try {
            const stats = await fs.stat(dirPath);
            
            if (stats.isDirectory()) {
                this.addResult(
                    ValidationCategories.PATHS,
                    displayName,
                    ValidationStatus.PASS,
                    `${displayName} exists and is accessible`,
                    { path: dirPath, size: stats.size }
                );
            } else {
                this.addResult(
                    ValidationCategories.PATHS,
                    displayName,
                    ValidationStatus.FAIL,
                    `${displayName} exists but is not a directory`,
                    { path: dirPath }
                );
            }

        } catch (error) {
            if (error.code === 'ENOENT' && options.createIfMissing) {
                await this.createDirectory(dirPath, displayName);
            } else {
                const status = options.required ? ValidationStatus.FAIL : ValidationStatus.WARN;
                this.addResult(
                    ValidationCategories.PATHS,
                    displayName,
                    status,
                    `${displayName} not found: ${dirPath}`,
                    { path: dirPath, error: error.message }
                );

                if (options.required && !this.skipFastFail) {
                    throw new EnhancedError(
                        `Required directory missing: ${displayName}`,
                        ErrorTypes.FILE_NOT_FOUND,
                        {
                            operation: 'checkDirectoryExists',
                            dirPath,
                            displayName
                        },
                        error
                    );
                }
            }
        }
    }

    /**
     * Create directory
     */
    async createDirectory(dirPath, displayName) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
            this.addResult(
                ValidationCategories.PATHS,
                `${displayName} (Created)`,
                ValidationStatus.PASS,
                `Created ${displayName} at ${dirPath}`,
                { path: dirPath, created: true }
            );
        } catch (error) {
            this.addResult(
                ValidationCategories.PATHS,
                `${displayName} (Creation Failed)`,
                ValidationStatus.FAIL,
                `Failed to create ${displayName}: ${error.message}`,
                { path: dirPath, error: error.message }
            );
        }
    }

    /**
     * Validate permissions
     */
    async validatePermissions() {
        await this.errorHandler.logDebug('Validating permissions');

        const pathsToCheck = [
            { path: this.projectRoot, name: 'Project Root', permissions: ['read', 'write'] },
            { path: path.join(this.projectRoot, 'config'), name: 'Config Directory', permissions: ['read', 'write'] },
            { path: path.join(this.projectRoot, 'logs'), name: 'Logs Directory', permissions: ['read', 'write'] }
        ];

        for (const pathInfo of pathsToCheck) {
            await this.checkPermissions(pathInfo.path, pathInfo.name, pathInfo.permissions);
        }
    }

    /**
     * Check permissions for a path
     */
    async checkPermissions(checkPath, displayName, requiredPermissions) {
        try {
            // Check if path exists first
            await fs.access(checkPath);

            const permissionChecks = [];
            
            for (const permission of requiredPermissions) {
                try {
                    switch (permission) {
                        case 'read':
                            await fs.access(checkPath, fs.constants.R_OK);
                            permissionChecks.push({ permission, status: 'OK' });
                            break;
                        case 'write':
                            await fs.access(checkPath, fs.constants.W_OK);
                            permissionChecks.push({ permission, status: 'OK' });
                            break;
                        case 'execute':
                            await fs.access(checkPath, fs.constants.X_OK);
                            permissionChecks.push({ permission, status: 'OK' });
                            break;
                    }
                } catch (permError) {
                    permissionChecks.push({ permission, status: 'DENIED', error: permError.message });
                }
            }

            const deniedPermissions = permissionChecks.filter(p => p.status === 'DENIED');
            
            if (deniedPermissions.length === 0) {
                this.addResult(
                    ValidationCategories.PERMISSIONS,
                    displayName,
                    ValidationStatus.PASS,
                    `${displayName} has required permissions: ${requiredPermissions.join(', ')}`,
                    { path: checkPath, permissions: permissionChecks }
                );
            } else {
                this.addResult(
                    ValidationCategories.PERMISSIONS,
                    displayName,
                    ValidationStatus.FAIL,
                    `${displayName} missing permissions: ${deniedPermissions.map(p => p.permission).join(', ')}`,
                    { path: checkPath, deniedPermissions }
                );
            }

        } catch (error) {
            this.addResult(
                ValidationCategories.PERMISSIONS,
                displayName,
                ValidationStatus.SKIP,
                `Cannot check permissions for ${displayName}: ${error.message}`,
                { path: checkPath, error: error.message }
            );
        }
    }

    /**
     * Validate modules
     */
    async validateModules() {
        await this.errorHandler.logDebug('Validating modules');

        const modulesToCheck = [
            { path: path.join(this.projectRoot, 'src', 'organize', 'error_handler.js'), name: 'Error Handler', required: true },
            { path: path.join(this.projectRoot, 'src', 'organize', 'content_analyzer.js'), name: 'Content Analyzer', required: false },
            { path: path.join(this.projectRoot, 'src', 'organize', 'content_consolidator.js'), name: 'Content Consolidator', required: false },
            { path: path.join(this.projectRoot, 'src', 'organize', 'category_manager.js'), name: 'Category Manager', required: false },
            { path: path.join(this.projectRoot, 'src', 'organize', 'batch_processor.js'), name: 'Batch Processor', required: false },
            { path: path.join(this.projectRoot, 'src', 'organize', 'module_loader.js'), name: 'Module Loader', required: false },
            { path: path.join(this.projectRoot, 'src', 'mcp', 'server.js'), name: 'MCP Server', required: false }
        ];

        for (const moduleInfo of modulesToCheck) {
            await this.checkModule(moduleInfo.path, moduleInfo.name, moduleInfo.required);
        }
    }

    /**
     * Check if module exists and can be imported
     */
    async checkModule(modulePath, displayName, required = false) {
        try {
            // Check if file exists
            await fs.access(modulePath);

            // Try to import the module (basic syntax check)
            try {
                const moduleUrl = `file://${path.resolve(modulePath)}`;
                await import(moduleUrl);
                
                this.addResult(
                    ValidationCategories.MODULES,
                    displayName,
                    ValidationStatus.PASS,
                    `${displayName} is available and importable`,
                    { path: modulePath }
                );
            } catch (importError) {
                this.addResult(
                    ValidationCategories.MODULES,
                    displayName,
                    ValidationStatus.WARN,
                    `${displayName} exists but has import issues: ${importError.message}`,
                    { path: modulePath, importError: importError.message }
                );
            }

        } catch (error) {
            const status = required ? ValidationStatus.FAIL : ValidationStatus.WARN;
            this.addResult(
                ValidationCategories.MODULES,
                displayName,
                status,
                `${displayName} not found: ${modulePath}`,
                { path: modulePath, error: error.message }
            );

            if (required && !this.skipFastFail) {
                throw new EnhancedError(
                    `Required module missing: ${displayName}`,
                    ErrorTypes.MODULE_IMPORT_FAILURE,
                    {
                        operation: 'checkModule',
                        modulePath,
                        displayName
                    },
                    error
                );
            }
        }
    }

    /**
     * Validate system health
     */
    async validateSystemHealth() {
        await this.errorHandler.logDebug('Validating system health');

        // Check available disk space
        await this.checkDiskSpace();

        // Check memory usage
        await this.checkMemoryUsage();

        // Check Node.js version compatibility
        await this.checkNodeCompatibility();

        // Check for common issues
        await this.checkCommonIssues();
    }

    /**
     * Check available disk space
     */
    async checkDiskSpace() {
        try {
            // Use statvfs if available (more portable than statfs)
            let stats = null;
            
            try {
                // Try to use statvfs first
                if (fs.statvfs) {
                    stats = await fs.statvfs(this.projectRoot);
                } else if (fs.statfs) {
                    stats = await fs.statfs(this.projectRoot);
                }
            } catch (fsError) {
                // Fall back to using df command on Unix-like systems
                try {
                    const { execSync } = await import('child_process');
                    const dfOutput = execSync(`df -h "${this.projectRoot}"`, { 
                        encoding: 'utf8',
                        timeout: 5000 
                    });
                    
                    const lines = dfOutput.trim().split('\n');
                    if (lines.length >= 2) {
                        const parts = lines[1].split(/\s+/);
                        if (parts.length >= 4) {
                            const availableStr = parts[3];
                            const freeSpaceGB = this.parseStorageSize(availableStr);
                            
                            if (freeSpaceGB > 1) {
                                this.addResult(
                                    ValidationCategories.SYSTEM,
                                    'Disk Space',
                                    ValidationStatus.PASS,
                                    `Sufficient disk space available: ${freeSpaceGB.toFixed(1)}GB free`,
                                    { freeSpaceGB, method: 'df_command' }
                                );
                            } else {
                                this.addResult(
                                    ValidationCategories.SYSTEM,
                                    'Disk Space',
                                    ValidationStatus.WARN,
                                    `Low disk space: ${freeSpaceGB.toFixed(1)}GB free`,
                                    { freeSpaceGB, method: 'df_command' }
                                );
                            }
                            return;
                        }
                    }
                } catch (dfError) {
                    // df command failed, continue to skip
                }
            }
            
            if (stats && stats.bavail && stats.bsize) {
                const freeSpaceGB = (stats.bavail * stats.bsize) / (1024 * 1024 * 1024);
                const totalSpaceGB = (stats.blocks * stats.bsize) / (1024 * 1024 * 1024);
                const usagePercent = totalSpaceGB > 0 ? ((totalSpaceGB - freeSpaceGB) / totalSpaceGB) * 100 : 0;

                if (freeSpaceGB > 1) {
                    this.addResult(
                        ValidationCategories.SYSTEM,
                        'Disk Space',
                        ValidationStatus.PASS,
                        `Sufficient disk space available: ${freeSpaceGB.toFixed(1)}GB free`,
                        { freeSpaceGB, totalSpaceGB, usagePercent, method: 'fs_stats' }
                    );
                } else {
                    this.addResult(
                        ValidationCategories.SYSTEM,
                        'Disk Space',
                        ValidationStatus.WARN,
                        `Low disk space: ${freeSpaceGB.toFixed(1)}GB free`,
                        { freeSpaceGB, totalSpaceGB, usagePercent, method: 'fs_stats' }
                    );
                }
            } else {
                this.addResult(
                    ValidationCategories.SYSTEM,
                    'Disk Space',
                    ValidationStatus.SKIP,
                    'Cannot check disk space on this platform'
                );
            }
        } catch (error) {
            this.addResult(
                ValidationCategories.SYSTEM,
                'Disk Space',
                ValidationStatus.SKIP,
                `Cannot check disk space: ${error.message}`,
                { error: error.message }
            );
        }
    }

    /**
     * Parse storage size string (e.g., "15G", "1.2T", "500M")
     */
    parseStorageSize(sizeStr) {
        const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?)$/i);
        if (!match) return 0;
        
        const value = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        
        switch (unit) {
            case 'T': return value * 1024;
            case 'G': return value;
            case 'M': return value / 1024;
            case 'K': return value / (1024 * 1024);
            default: return value / (1024 * 1024 * 1024); // Assume bytes
        }
    }

    /**
     * Check memory usage
     */
    async checkMemoryUsage() {
        try {
            const totalMemory = os.totalmem();
            const freeMemory = os.freemem();
            const usedMemory = totalMemory - freeMemory;
            const usagePercent = (usedMemory / totalMemory) * 100;

            const totalMemoryGB = totalMemory / (1024 * 1024 * 1024);
            const freeMemoryGB = freeMemory / (1024 * 1024 * 1024);

            if (freeMemoryGB > 0.5) {
                this.addResult(
                    ValidationCategories.SYSTEM,
                    'Memory Usage',
                    ValidationStatus.PASS,
                    `Memory usage is acceptable: ${usagePercent.toFixed(1)}% used, ${freeMemoryGB.toFixed(1)}GB free`,
                    { totalMemoryGB, freeMemoryGB, usagePercent }
                );
            } else {
                this.addResult(
                    ValidationCategories.SYSTEM,
                    'Memory Usage',
                    ValidationStatus.WARN,
                    `High memory usage: ${usagePercent.toFixed(1)}% used, ${freeMemoryGB.toFixed(1)}GB free`,
                    { totalMemoryGB, freeMemoryGB, usagePercent }
                );
            }
        } catch (error) {
            this.addResult(
                ValidationCategories.SYSTEM,
                'Memory Usage',
                ValidationStatus.SKIP,
                `Cannot check memory usage: ${error.message}`,
                { error: error.message }
            );
        }
    }

    /**
     * Check Node.js version compatibility
     */
    async checkNodeCompatibility() {
        try {
            const nodeVersion = process.version;
            const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

            if (majorVersion >= 14) {
                this.addResult(
                    ValidationCategories.SYSTEM,
                    'Node.js Compatibility',
                    ValidationStatus.PASS,
                    `Node.js version ${nodeVersion} is compatible`,
                    { nodeVersion, majorVersion }
                );
            } else {
                this.addResult(
                    ValidationCategories.SYSTEM,
                    'Node.js Compatibility',
                    ValidationStatus.WARN,
                    `Node.js version ${nodeVersion} may have compatibility issues (recommended: 14+)`,
                    { nodeVersion, majorVersion }
                );
            }
        } catch (error) {
            this.addResult(
                ValidationCategories.SYSTEM,
                'Node.js Compatibility',
                ValidationStatus.SKIP,
                `Cannot check Node.js compatibility: ${error.message}`,
                { error: error.message }
            );
        }
    }

    /**
     * Check for common issues
     */
    async checkCommonIssues() {
        // Check for common macOS issues
        if (process.platform === 'darwin') {
            await this.checkMacOSIssues();
        }

        // Check for permission issues
        await this.checkPermissionIssues();

        // Check for path issues
        await this.checkPathIssues();
    }

    /**
     * Check macOS specific issues
     */
    async checkMacOSIssues() {
        try {
            // Check if running on Apple Silicon
            const arch = process.arch;
            if (arch === 'arm64') {
                this.addResult(
                    ValidationCategories.SYSTEM,
                    'Apple Silicon Compatibility',
                    ValidationStatus.PASS,
                    'Running on Apple Silicon (arm64)',
                    { architecture: arch }
                );
            }

            // Check for Xcode Command Line Tools
            try {
                execSync('xcode-select -p', { stdio: 'ignore' });
                this.addResult(
                    ValidationCategories.SYSTEM,
                    'Xcode Command Line Tools',
                    ValidationStatus.PASS,
                    'Xcode Command Line Tools are installed'
                );
            } catch (error) {
                this.addResult(
                    ValidationCategories.SYSTEM,
                    'Xcode Command Line Tools',
                    ValidationStatus.WARN,
                    'Xcode Command Line Tools may not be installed',
                    { installHint: 'Install with: xcode-select --install' }
                );
            }

        } catch (error) {
            await this.errorHandler.logWarn('Error checking macOS issues', {}, error);
        }
    }

    /**
     * Check permission issues
     */
    async checkPermissionIssues() {
        // Check if running as root (not recommended)
        if (process.getuid && process.getuid() === 0) {
            this.addResult(
                ValidationCategories.SYSTEM,
                'Root User Check',
                ValidationStatus.WARN,
                'Running as root user is not recommended for security reasons',
                { uid: process.getuid() }
            );
        }
    }

    /**
     * Check path issues
     */
    async checkPathIssues() {
        // Check for spaces in paths (can cause issues with some tools)
        if (this.projectRoot.includes(' ')) {
            this.addResult(
                ValidationCategories.SYSTEM,
                'Path Spaces Check',
                ValidationStatus.WARN,
                'Project path contains spaces, which may cause issues with some tools',
                { projectRoot: this.projectRoot }
            );
        }

        // Check path length (very long paths can cause issues)
        if (this.projectRoot.length > 200) {
            this.addResult(
                ValidationCategories.SYSTEM,
                'Path Length Check',
                ValidationStatus.WARN,
                'Project path is very long, which may cause issues',
                { projectRoot: this.projectRoot, length: this.projectRoot.length }
            );
        }
    }

    /**
     * Generate validation summary
     */
    generateValidationSummary() {
        const totalChecks = this.validationResults.length;
        const passed = this.validationResults.filter(r => r.status === ValidationStatus.PASS).length;
        const warnings = this.validationResults.filter(r => r.status === ValidationStatus.WARN).length;
        const failed = this.validationResults.filter(r => r.status === ValidationStatus.FAIL).length;
        const skipped = this.validationResults.filter(r => r.status === ValidationStatus.SKIP).length;

        const categoryStats = {};
        for (const category of Object.values(ValidationCategories)) {
            const categoryResults = this.validationResults.filter(r => r.category === category);
            categoryStats[category] = {
                total: categoryResults.length,
                passed: categoryResults.filter(r => r.status === ValidationStatus.PASS).length,
                warnings: categoryResults.filter(r => r.status === ValidationStatus.WARN).length,
                failed: categoryResults.filter(r => r.status === ValidationStatus.FAIL).length,
                skipped: categoryResults.filter(r => r.status === ValidationStatus.SKIP).length
            };
        }

        return {
            totalChecks,
            passed,
            warnings,
            failed,
            skipped,
            successRate: totalChecks > 0 ? ((passed / totalChecks) * 100).toFixed(1) : '0',
            categoryStats,
            criticalFailures: this.criticalFailures.length,
            overallStatus: failed > 0 ? 'FAILED' : warnings > 0 ? 'WARNING' : 'PASSED'
        };
    }

    /**
     * Print validation report
     */
    printReport() {
        const summary = this.generateValidationSummary();
        
        console.log('\n🔍 System Validation Report');
        console.log('=' .repeat(50));
        
        console.log(`\nOverall Status: ${this.getStatusIcon(summary.overallStatus === 'PASSED' ? ValidationStatus.PASS : summary.overallStatus === 'WARNING' ? ValidationStatus.WARN : ValidationStatus.FAIL)} ${summary.overallStatus}`);
        console.log(`Total Checks: ${summary.totalChecks}`);
        console.log(`✅ Passed: ${summary.passed}`);
        console.log(`⚠️  Warnings: ${summary.warnings}`);
        console.log(`❌ Failed: ${summary.failed}`);
        console.log(`⏭️  Skipped: ${summary.skipped}`);
        console.log(`Success Rate: ${summary.successRate}%`);

        // Category breakdown
        console.log('\n📊 Category Breakdown:');
        for (const [category, stats] of Object.entries(summary.categoryStats)) {
            if (stats.total > 0) {
                console.log(`  ${category.toUpperCase()}: ${stats.passed}/${stats.total} passed`);
                if (stats.failed > 0) console.log(`    ❌ ${stats.failed} failed`);
                if (stats.warnings > 0) console.log(`    ⚠️  ${stats.warnings} warnings`);
            }
        }

        // Critical failures
        if (this.criticalFailures.length > 0) {
            console.log('\n🚨 Critical Failures:');
            for (const failure of this.criticalFailures) {
                console.log(`  ❌ [${failure.category.toUpperCase()}] ${failure.name}: ${failure.message}`);
                if (failure.details.installHint) {
                    console.log(`     💡 ${failure.details.installHint}`);
                }
            }
        }

        // Warnings
        if (this.warnings.length > 0 && this.warnings.length <= 5) {
            console.log('\n⚠️  Warnings:');
            for (const warning of this.warnings) {
                console.log(`  ⚠️  [${warning.category.toUpperCase()}] ${warning.name}: ${warning.message}`);
            }
        } else if (this.warnings.length > 5) {
            console.log(`\n⚠️  ${this.warnings.length} warnings (use --verbose to see all)`);
        }

        console.log('\n');
    }
}

/**
 * Create and run system validator
 */
export async function validateSystem(options = {}) {
    const validator = new SystemValidator(options);
    const result = await validator.validateSystem();
    
    if (options.printReport !== false) {
        validator.printReport();
    }
    
    return result;
}

export default SystemValidator;