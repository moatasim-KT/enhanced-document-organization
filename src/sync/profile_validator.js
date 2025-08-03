#!/usr/bin/env node

/**
 * Unison Profile Validator and Cleanup Module
 * 
 * This module provides functions to:
 * 1. Detect corrupted Unison profile files
 * 2. Backup existing profiles before cleanup
 * 3. Regenerate profiles from clean templates
 * 
 * Requirements: 5.1, 5.2, 5.3
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { SyncErrorHandler, SyncOperations } from './sync_error_handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ProfileValidator {
    constructor() {
        this.unisonDir = path.join(os.homedir(), '.unison');
        this.backupDir = path.join(this.unisonDir, 'backups');
        this.templateDir = path.join(__dirname, '..', '..', 'config', 'unison_templates');

        // Initialize error handler for comprehensive logging
        this.errorHandler = new SyncErrorHandler({
            component: 'profile-validator',
            enableConsoleLogging: true,
            enableFileLogging: true
        });

        // Ensure backup directory exists
        this.ensureDirectory(this.backupDir);
    }

    /**
     * Ensure directory exists, create if it doesn't
     * @param {string} dirPath - Directory path to ensure
     */
    ensureDirectory(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    /**
     * Log messages with timestamp using enhanced error handler
     * @param {string} level - Log level (INFO, WARN, ERROR)
     * @param {string} message - Message to log
     * @param {Object} context - Additional context for logging
     */
    async log(level, message, context = {}) {
        switch (level.toUpperCase()) {
            case 'DEBUG':
                await this.errorHandler.logDebug(message, context);
                break;
            case 'INFO':
                await this.errorHandler.logInfo(message, context);
                break;
            case 'WARN':
                await this.errorHandler.logWarn(message, context);
                break;
            case 'ERROR':
                await this.errorHandler.logError(message, context);
                break;
            case 'FATAL':
                await this.errorHandler.logFatal(message, context);
                break;
            default:
                await this.errorHandler.logInfo(message, context);
        }
    }

    /**
     * Detect corrupted Unison profile files
     * Checks for non-comment content in first lines that shouldn't be there
     * @param {string} profilePath - Path to the profile file
     * @returns {Object} Validation result with isCorrupted flag and details
     */
    async detectCorruptedProfile(profilePath) {
        const profileName = path.basename(profilePath, '.prf');

        try {
            await this.log('INFO', `Starting profile corruption detection`, {
                profilePath,
                profileName,
                operation: SyncOperations.PROFILE_VALIDATION
            });

            if (!fs.existsSync(profilePath)) {
                await this.log('WARN', `Profile file does not exist`, {
                    profilePath,
                    profileName
                });
                return {
                    isCorrupted: false,
                    exists: false,
                    message: `Profile file does not exist: ${profilePath}`
                };
            }

            const content = fs.readFileSync(profilePath, 'utf8');
            const lines = content.split('\n');

            const issues = [];
            let hasValidStructure = false;
            let hasRootDirectives = false;
            let rootCount = 0;

            // Check each line for corruption indicators
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                // Skip empty lines
                if (!line) continue;

                // Check for sync data corruption in first few lines
                if (i < 10 && !line.startsWith('#') && !this.isValidProfileDirective(line)) {
                    // Look for patterns that indicate sync data corruption
                    if (this.containsSyncDataPatterns(line)) {
                        issues.push(`Line ${i + 1}: Contains sync data instead of profile directive: "${line.substring(0, 50)}..."`);
                    }
                }

                // Validate profile directives
                if (line.startsWith('root =')) {
                    hasRootDirectives = true;
                    rootCount++;
                    hasValidStructure = true;

                    // Validate root path format
                    const rootPath = line.substring(6).trim();
                    if (!this.isValidRootPath(rootPath)) {
                        issues.push(`Line ${i + 1}: Invalid root path format: "${rootPath}"`);
                    }
                } else if (this.isValidProfileDirective(line)) {
                    hasValidStructure = true;
                } else if (!line.startsWith('#') && line.length > 0) {
                    // Check for malformed directives
                    if (!this.isValidProfileDirective(line)) {
                        issues.push(`Line ${i + 1}: Invalid or malformed directive: "${line}"`);
                    }
                }
            }

            // Check for required structure (only for non-default profiles)
            if (profileName !== 'default') {
                if (!hasRootDirectives) {
                    issues.push('Missing required root directives');
                }

                if (rootCount !== 2) {
                    issues.push(`Expected exactly 2 root directives, found ${rootCount}`);
                }
            }

            // Check file size (corrupted profiles might be unusually large)
            const stats = fs.statSync(profilePath);
            if (stats.size > 50000) { // 50KB threshold
                issues.push(`Profile file is unusually large (${stats.size} bytes), may contain sync data`);
            }

            const isCorrupted = issues.length > 0;

            const result = {
                isCorrupted,
                exists: true,
                hasValidStructure,
                issues,
                fileSize: stats.size,
                lineCount: lines.length,
                message: isCorrupted ?
                    `Profile corruption detected: ${issues.join('; ')}` :
                    'Profile appears to be valid'
            };

            // Log detailed results
            if (isCorrupted) {
                await this.errorHandler.logProfileCleanupAction('corruption_detected', profileName, {
                    issues,
                    fileSize: stats.size,
                    lineCount: lines.length
                });

                await this.log('ERROR', `Profile corruption detected`, {
                    profileName,
                    issues,
                    fileSize: stats.size,
                    lineCount: lines.length
                });
            } else {
                await this.log('INFO', `Profile validation passed`, {
                    profileName,
                    fileSize: stats.size,
                    lineCount: lines.length
                });
            }

            return result;

        } catch (error) {
            await this.errorHandler.handleSyncError(error, SyncOperations.PROFILE_VALIDATION, {
                profilePath,
                profileName
            });

            return {
                isCorrupted: true,
                exists: fs.existsSync(profilePath),
                error: error.message,
                message: `Error reading profile: ${error.message}`
            };
        }
    }

    /**
     * Check if a line contains sync data patterns that indicate corruption
     * @param {string} line - Line to check
     * @returns {boolean} True if line contains sync data patterns
     */
    containsSyncDataPatterns(line) {
        const syncDataPatterns = [
            /^[a-f0-9]{32,}/, // Long hex strings (file hashes)
            /^\d{4}-\d{2}-\d{2}/, // Date patterns
            /^(changed|deleted|created|modified)/, // Sync operation words
            /^(local|remote)/, // Sync location indicators
            /^\s*\d+\s+\d+/, // Numeric sync data
            /^props\s+/, // Properties data
            /^archive\s+/, // Archive data
            /^\s*<\w+>/, // XML-like tags
        ];

        return syncDataPatterns.some(pattern => pattern.test(line));
    }

    /**
     * Check if a line is a valid Unison profile directive
     * @param {string} line - Line to validate
     * @returns {boolean} True if line is a valid directive
     */
    isValidProfileDirective(line) {
        const validDirectives = [
            /^root\s*=/, /^auto\s*=/, /^batch\s*=/, /^prefer\s*=/, /^log\s*=/,
            /^silent\s*=/, /^backup\s*=/, /^backupcurr\s*=/, /^backupnot\s*=/,
            /^maxbackups\s*=/, /^ignore\s*=/, /^retry\s*=/, /^confirmbigdel\s*=/,
            /^times\s*=/, /^perms\s*=/, /^maxthreads\s*=/, /^rsrc\s*=/,
            /^servercmd\s*=/, /^clientHostName\s*=/, /^fastcheck\s*=/, /^#/, // Comments
        ];

        return validDirectives.some(pattern => pattern.test(line));
    }

    /**
     * Validate root path format
     * @param {string} rootPath - Root path to validate
     * @returns {boolean} True if path format is valid
     */
    isValidRootPath(rootPath) {
        // Remove quotes if present
        const cleanPath = rootPath.replace(/^["']|["']$/g, '');

        // Check for absolute path
        if (!path.isAbsolute(cleanPath)) {
            return false;
        }

        // Check for dangerous patterns
        const dangerousPatterns = [
            /^\s*$/, // Empty path
            /^\/\s*$/, // Root directory only
            /\.\.\//,  // Parent directory traversal
        ];

        return !dangerousPatterns.some(pattern => pattern.test(cleanPath));
    }

    /**
     * Create backup of existing profile before cleanup
     * @param {string} profilePath - Path to profile to backup
     * @returns {Object} Backup result with success flag and backup path
     */
    async backupProfile(profilePath) {
        const profileName = path.basename(profilePath, '.prf');

        try {
            await this.log('INFO', `Starting profile backup`, {
                profilePath,
                profileName,
                operation: SyncOperations.PROFILE_BACKUP
            });

            if (!fs.existsSync(profilePath)) {
                await this.log('ERROR', `Profile file does not exist for backup`, {
                    profilePath,
                    profileName
                });
                return {
                    success: false,
                    message: `Profile file does not exist: ${profilePath}`
                };
            }

            const profileName = path.basename(profilePath);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `${profileName}.backup.${timestamp}`;
            const backupPath = path.join(this.backupDir, backupFileName);

            // Copy the file
            fs.copyFileSync(profilePath, backupPath);

            // Verify backup was created successfully
            if (fs.existsSync(backupPath)) {
                const originalStats = fs.statSync(profilePath);
                const backupStats = fs.statSync(backupPath);

                if (originalStats.size === backupStats.size) {
                    await this.errorHandler.logProfileCleanupAction('backup_created', profileName, {
                        backupPath,
                        originalSize: originalStats.size,
                        backupSize: backupStats.size
                    });

                    await this.log('INFO', `Profile backed up successfully`, {
                        profileName,
                        backupPath,
                        fileSize: originalStats.size
                    });

                    return {
                        success: true,
                        backupPath,
                        message: `Profile backed up to: ${backupPath}`
                    };
                } else {
                    await this.log('ERROR', `Backup verification failed: size mismatch`, {
                        profileName,
                        originalSize: originalStats.size,
                        backupSize: backupStats.size
                    });
                    return {
                        success: false,
                        message: `Backup verification failed: size mismatch`
                    };
                }
            } else {
                await this.log('ERROR', `Backup file was not created`, {
                    profileName,
                    expectedPath: backupPath
                });
                return {
                    success: false,
                    message: `Backup file was not created: ${backupPath}`
                };
            }

        } catch (error) {
            await this.errorHandler.handleSyncError(error, SyncOperations.PROFILE_BACKUP, {
                profilePath,
                profileName,
                backupDir: this.backupDir
            });

            return {
                success: false,
                error: error.message,
                message: `Error creating backup: ${error.message}`
            };
        }
    }

    /**
     * Generate clean profile from template
     * @param {string} profileName - Name of the profile (e.g., 'icloud', 'google_drive')
     * @param {Object} config - Configuration object with paths and settings
     * @returns {Object} Generation result with success flag and profile content
     */
    generateCleanProfile(profileName, config = {}) {
        try {
            // Default configuration
            const defaultConfig = {
                sourceRoot: '/Users/moatasimfarooque/Sync_Hub_New',
                destinationRoot: '',
                auto: true,
                batch: true,
                prefer: 'newer',
                log: true,
                silent: false,
                maxbackups: 5,
                retry: 3,
                confirmbigdel: false,
                times: true,
                perms: '0o644',
                maxthreads: 4,
                rsrc: false
            };

            const profileConfig = { ...defaultConfig, ...config };

            // Set destination based on profile name
            if (!profileConfig.destinationRoot) {
                switch (profileName) {
                    case 'icloud':
                        profileConfig.destinationRoot = '/Users/moatasimfarooque/Library/Mobile Documents/iCloud~md~obsidian/Documents/Sync';
                        break;
                    case 'google_drive':
                        profileConfig.destinationRoot = '/Users/moatasimfarooque/Library/CloudStorage/GoogleDrive-moatasim23android@gmail.com/My Drive/Sync';
                        break;
                    default:
                        // For unknown profile names, use a generic destination if not provided
                        if (!config.destinationRoot) {
                            profileConfig.destinationRoot = `/tmp/sync_destination_${profileName}`;
                        }
                        break;
                }
            }

            // Generate profile content
            const profileContent = this.generateProfileContent(profileName, profileConfig);

            return {
                success: true,
                content: profileContent,
                config: profileConfig,
                message: `Clean profile generated for: ${profileName}`
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: `Error generating clean profile: ${error.message}`
            };
        }
    }
    /**
      * Generate profile content from configuration
      * @param {string} profileName - Profile name
      * @param {Object} config - Configuration object
      * @returns {string} Generated profile content
      */
    generateProfileContent(profileName, config) {
        const lines = [];

        // Header comment
        lines.push(`# Unison profile for ${profileName} sync`);
        lines.push(`# Generated by Profile Validator on ${new Date().toISOString()}`);
        lines.push('');

        // Sync directories
        lines.push('# Sync directories');
        lines.push(`root = ${config.sourceRoot}`);
        lines.push(`root = ${config.destinationRoot}`);
        lines.push('');

        // Basic sync options
        lines.push('# Basic sync options');
        lines.push(`auto = ${config.auto}`);
        lines.push(`batch = ${config.batch}`);
        lines.push(`prefer = ${config.prefer}`);
        lines.push(`log = ${config.log}`);
        lines.push(`silent = ${config.silent}`);
        lines.push('');

        // Conflict resolution
        lines.push('# Conflict resolution');
        lines.push('backup = Name *');
        lines.push('backupcurr = Name *');
        lines.push('backupnot = Name *.tmp');
        lines.push(`maxbackups = ${config.maxbackups}`);
        lines.push('');

        // Add comprehensive ignore patterns
        lines.push(...this.getComprehensiveIgnorePatterns(profileName));

        // Performance settings
        lines.push('# Performance settings');
        lines.push(`retry = ${config.retry}`);
        lines.push(`confirmbigdel = ${config.confirmbigdel}`);
        lines.push(`times = ${config.times}`);
        lines.push(`perms = ${config.perms}`);
        lines.push(`maxthreads = ${config.maxthreads}`);
        lines.push(`rsrc = ${config.rsrc}`);
        lines.push('');

        return lines.join('\n');
    }

    /**
     * Get comprehensive ignore patterns for a profile
     * @param {string} profileName - Profile name
     * @returns {Array} Array of ignore pattern lines
     */
    getComprehensiveIgnorePatterns(profileName) {
        const patterns = [];

        // Standard system ignore patterns
        patterns.push('# Standard system ignore patterns');
        patterns.push('ignore = Name .DS_Store');
        patterns.push('ignore = Name .localized');
        patterns.push('ignore = Name .Spotlight-V100');
        patterns.push('ignore = Name .Trashes');
        patterns.push('ignore = Name .fseventsd');
        patterns.push('ignore = Name .TemporaryItems');
        patterns.push('ignore = Name *.tmp');
        patterns.push('ignore = Name *.swp');
        patterns.push('ignore = Name *~');
        patterns.push('ignore = Name .#*');
        patterns.push('ignore = Name #*#');
        patterns.push('');

        // Development tools ignore patterns
        patterns.push('# Development tools ignore patterns');
        patterns.push('ignore = Name .git');
        patterns.push('ignore = Path .git/*');
        patterns.push('ignore = Name node_modules');
        patterns.push('ignore = Path node_modules/*');
        patterns.push('ignore = Path */node_modules/*');
        patterns.push('ignore = Name .npm');
        patterns.push('ignore = Path .npm/*');
        patterns.push('ignore = Name .nvm');
        patterns.push('ignore = Path .nvm/*');
        patterns.push('ignore = Name .yarn');
        patterns.push('ignore = Path .yarn/*');
        patterns.push('ignore = Name .pnpm');
        patterns.push('ignore = Path .pnpm/*');
        patterns.push('');

        // System cache ignore patterns
        patterns.push('# System cache ignore patterns');
        patterns.push('ignore = Name .cache');
        patterns.push('ignore = Path .cache/*');
        patterns.push('ignore = Name .local');
        patterns.push('ignore = Path .local/*');
        patterns.push('ignore = Name .tmp');
        patterns.push('ignore = Path .tmp/*');
        patterns.push('ignore = Name .temp');
        patterns.push('ignore = Path .temp/*');
        patterns.push('');

        // IDE and editor ignore patterns
        patterns.push('# IDE and editor ignore patterns');
        patterns.push('ignore = Name .vscode');
        patterns.push('ignore = Path .vscode/*');
        patterns.push('ignore = Name .idea');
        patterns.push('ignore = Path .idea/*');
        patterns.push('ignore = Name .kiro');
        patterns.push('ignore = Path .kiro/*');
        patterns.push('ignore = Name .vim');
        patterns.push('ignore = Path .vim/*');
        patterns.push('');

        // Application-specific ignore patterns
        patterns.push('# Application-specific ignore patterns');
        patterns.push('ignore = Name .codeium');
        patterns.push('ignore = Path .codeium/*');
        patterns.push('ignore = Name .docker');
        patterns.push('ignore = Path .docker/*');
        patterns.push('ignore = Name .aws');
        patterns.push('ignore = Path .aws/*');
        patterns.push('');

        // Profile-specific patterns
        if (profileName === 'icloud') {
            patterns.push('# iCloud specific ignore patterns');
            patterns.push('ignore = Name *.icloud');
            patterns.push('ignore = Name .com.apple.timemachine.donotpresent');
            patterns.push('');

            patterns.push('# Obsidian specific ignore patterns');
            patterns.push('ignore = Name .obsidian');
            patterns.push('ignore = Path .obsidian/*');
            patterns.push('ignore = Name plugins');
            patterns.push('ignore = Path plugins/*');
            patterns.push('ignore = Name .obsidian.vimrc');
            patterns.push('ignore = Name workspace.json');
            patterns.push('ignore = Name app.json');
            patterns.push('ignore = Name hotkeys.json');
            patterns.push('ignore = Name appearance.json');
            patterns.push('ignore = Name community-plugins.json');
            patterns.push('ignore = Name core-plugins.json');
            patterns.push('ignore = Name core-plugins-migration.json');
            patterns.push('');
        } else if (profileName === 'google_drive') {
            patterns.push('# Google Drive specific ignore patterns');
            patterns.push('ignore = Name *.gdoc');
            patterns.push('ignore = Name *.gsheet');
            patterns.push('ignore = Name *.gslides');
            patterns.push('ignore = Name .tmp.driveupload');
            patterns.push('ignore = Name .tmp.drivedownload');
            patterns.push('');
        }

        // Common problematic file patterns
        patterns.push('# Common problematic file patterns');
        patterns.push('ignore = Regex .*:.*');
        patterns.push('ignore = Regex .*".*');
        patterns.push('ignore = Regex .*<.*');
        patterns.push('ignore = Regex .*>.*');
        patterns.push('ignore = Regex .*\\|.*');
        patterns.push('ignore = Name *.lock');
        patterns.push('ignore = Name *.lnk');
        patterns.push('ignore = Name desktop.ini');
        patterns.push('ignore = Name Thumbs.db');
        patterns.push('ignore = Name *conflicted copy*');
        patterns.push('ignore = Name *conflict*');
        patterns.push('');

        return patterns;
    }

    /**
     * Regenerate profile from clean template
     * @param {string} profileName - Name of the profile to regenerate
     * @param {Object} config - Optional configuration overrides
     * @returns {Object} Regeneration result with success flag and details
     */
    async regenerateProfile(profileName, config = {}) {
        try {
            await this.log('INFO', `Starting profile regeneration`, {
                profileName,
                config,
                operation: SyncOperations.PROFILE_REGENERATION
            });

            const profilePath = path.join(this.unisonDir, `${profileName}.prf`);

            // First, backup existing profile if it exists
            let backupResult = null;
            if (fs.existsSync(profilePath)) {
                await this.log('INFO', `Backing up existing profile before regeneration`, {
                    profileName,
                    profilePath
                });

                backupResult = await this.backupProfile(profilePath);
                if (!backupResult.success) {
                    await this.log('ERROR', `Failed to backup existing profile`, {
                        profileName,
                        error: backupResult.message
                    });
                    return {
                        success: false,
                        message: `Failed to backup existing profile: ${backupResult.message}`
                    };
                }
            }

            // Generate clean profile content
            const generateResult = this.generateCleanProfile(profileName, config);
            if (!generateResult.success) {
                return {
                    success: false,
                    message: `Failed to generate clean profile: ${generateResult.message}`
                };
            }

            // Write the new profile
            fs.writeFileSync(profilePath, generateResult.content, 'utf8');

            // Verify the new profile was written correctly
            if (fs.existsSync(profilePath)) {
                const verification = await this.detectCorruptedProfile(profilePath);
                if (verification.isCorrupted) {
                    await this.log('ERROR', `Generated profile failed validation`, {
                        profileName,
                        issues: verification.issues
                    });
                    return {
                        success: false,
                        message: `Generated profile failed validation: ${verification.message}`
                    };
                }

                await this.errorHandler.logProfileCleanupAction('profile_regenerated', profileName, {
                    profilePath,
                    backupPath: backupResult?.backupPath,
                    config: generateResult.config,
                    fileSize: fs.statSync(profilePath).size
                });

                await this.log('INFO', `Profile regenerated successfully`, {
                    profileName,
                    profilePath,
                    backupPath: backupResult?.backupPath,
                    fileSize: fs.statSync(profilePath).size
                });

                return {
                    success: true,
                    profilePath,
                    backupPath: backupResult?.backupPath,
                    config: generateResult.config,
                    message: `Profile regenerated successfully: ${profileName}`
                };
            } else {
                await this.log('ERROR', `Profile file was not created after regeneration`, {
                    profileName,
                    expectedPath: profilePath
                });
                return {
                    success: false,
                    message: `Profile file was not created: ${profilePath}`
                };
            }

        } catch (error) {
            await this.errorHandler.handleSyncError(error, SyncOperations.PROFILE_REGENERATION, {
                profileName,
                config,
                unisonDir: this.unisonDir
            });

            return {
                success: false,
                error: error.message,
                message: `Error regenerating profile: ${error.message}`
            };
        }
    }

    /**
     * Validate all profiles in the Unison directory
     * @returns {Object} Validation results for all profiles
     */
    validateAllProfiles() {
        try {
            const results = {};

            if (!fs.existsSync(this.unisonDir)) {
                return {
                    success: false,
                    message: `Unison directory does not exist: ${this.unisonDir}`
                };
            }

            const files = fs.readdirSync(this.unisonDir);
            const profileFiles = files.filter(file => file.endsWith('.prf'));

            if (profileFiles.length === 0) {
                return {
                    success: true,
                    results: {},
                    message: 'No profile files found'
                };
            }

            for (const profileFile of profileFiles) {
                const profilePath = path.join(this.unisonDir, profileFile);
                const profileName = path.basename(profileFile, '.prf');

                results[profileName] = this.detectCorruptedProfile(profilePath);
            }

            const corruptedProfiles = Object.entries(results)
                .filter(([, result]) => result.isCorrupted)
                .map(([name]) => name);

            return {
                success: true,
                results,
                corruptedProfiles,
                totalProfiles: profileFiles.length,
                corruptedCount: corruptedProfiles.length,
                message: corruptedProfiles.length > 0 ?
                    `Found ${corruptedProfiles.length} corrupted profiles: ${corruptedProfiles.join(', ')}` :
                    `All ${profileFiles.length} profiles are valid`
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: `Error validating profiles: ${error.message}`
            };
        }
    }

    /**
     * Clean up all corrupted profiles
     * @param {boolean} dryRun - If true, only report what would be done
     * @returns {Object} Cleanup results
     */
    cleanupCorruptedProfiles(dryRun = false) {
        try {
            const validationResult = this.validateAllProfiles();
            if (!validationResult.success) {
                return validationResult;
            }

            const { corruptedProfiles } = validationResult;

            if (corruptedProfiles.length === 0) {
                return {
                    success: true,
                    message: 'No corrupted profiles found'
                };
            }

            const results = {};

            for (const profileName of corruptedProfiles) {
                if (dryRun) {
                    results[profileName] = {
                        success: true,
                        action: 'would_regenerate',
                        message: `Would regenerate corrupted profile: ${profileName}`
                    };
                } else {
                    results[profileName] = this.regenerateProfile(profileName);
                }
            }

            const successCount = Object.values(results).filter(r => r.success).length;

            return {
                success: successCount === corruptedProfiles.length,
                results,
                processedProfiles: corruptedProfiles,
                successCount,
                failedCount: corruptedProfiles.length - successCount,
                dryRun,
                message: dryRun ?
                    `Dry run: Would process ${corruptedProfiles.length} corrupted profiles` :
                    `Processed ${corruptedProfiles.length} corrupted profiles, ${successCount} successful`
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: `Error cleaning up profiles: ${error.message}`
            };
        }
    }
}

// Export the class and create a default instance
export default ProfileValidator;

// CLI interface when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const validator = new ProfileValidator();

    const command = process.argv[2];
    const profileName = process.argv[3];

    switch (command) {
        case 'validate':
            if (profileName) {
                const profilePath = path.join(validator.unisonDir, `${profileName}.prf`);
                const result = validator.detectCorruptedProfile(profilePath);
                console.log(JSON.stringify(result, null, 2));
            } else {
                const result = validator.validateAllProfiles();
                console.log(JSON.stringify(result, null, 2));
            }
            break;

        case 'backup':
            if (!profileName) {
                console.error('Profile name required for backup command');
                process.exit(1);
            }
            const profilePath = path.join(validator.unisonDir, `${profileName}.prf`);
            const backupResult = validator.backupProfile(profilePath);
            console.log(JSON.stringify(backupResult, null, 2));
            break;

        case 'regenerate':
            if (!profileName) {
                console.error('Profile name required for regenerate command');
                process.exit(1);
            }
            const regenResult = validator.regenerateProfile(profileName);
            console.log(JSON.stringify(regenResult, null, 2));
            break;

        case 'cleanup':
            const dryRun = process.argv.includes('--dry-run');
            const cleanupResult = validator.cleanupCorruptedProfiles(dryRun);
            console.log(JSON.stringify(cleanupResult, null, 2));
            break;

        default:
            console.log(`
Unison Profile Validator

Usage: node profile_validator.js <command> [profile_name] [options]

Commands:
    validate [profile_name]  - Validate profile(s) for corruption
    backup <profile_name>    - Backup a profile before cleanup
    regenerate <profile_name> - Regenerate a clean profile
    cleanup [--dry-run]      - Clean up all corrupted profiles

Examples:
    node profile_validator.js validate
    node profile_validator.js validate icloud
    node profile_validator.js backup icloud
    node profile_validator.js regenerate google_drive
    node profile_validator.js cleanup --dry-run
            `);
            break;
    }
}