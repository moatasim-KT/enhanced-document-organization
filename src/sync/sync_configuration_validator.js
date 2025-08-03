#!/usr/bin/env node

/**
 * Sync Configuration Validator
 * 
 * Comprehensive validation script that demonstrates the enhanced logging and error handling
 * for sync configuration operations. This script validates the entire sync configuration
 * and provides detailed logging and user-friendly error messages.
 * 
 * Requirements: 3.4, 5.4
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { SyncErrorHandler, SyncOperations } from './sync_error_handler.js';
import ProfileValidator from './profile_validator.js';
import ArchiveManager from './archive_manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Comprehensive Sync Configuration Validator
 */
class SyncConfigurationValidator {
    constructor(options = {}) {
        this.errorHandler = new SyncErrorHandler({
            component: 'sync-configuration-validator',
            enableConsoleLogging: true,
            enableFileLogging: true,
            ...options
        });

        this.profileValidator = new ProfileValidator();
        this.archiveManager = new ArchiveManager();
        this.unisonDir = path.join(os.homedir(), '.unison');

        // Expected sync configuration
        this.expectedConfig = {
            sourceRoot: '/Users/moatasimfarooque/Sync_Hub_New',
            profiles: ['icloud', 'google_drive'],
            requiredIgnorePatterns: [
                '.git', 'node_modules', '.npm', '.nvm', '.cache',
                '.local', '.vscode', '.idea', '.kiro', '.codeium'
            ]
        };
    }

    /**
     * Run comprehensive sync configuration validation
     * @param {Object} options - Validation options
     * @param {boolean} options.autoFix - Automatically fix detected issues
     * @param {boolean} options.dryRun - Show what would be fixed without applying changes
     * @returns {Object} Validation results
     */
    async validateSyncConfiguration(options = {}) {
        const validationId = `SYNC_VALIDATION_${Date.now()}`;
        const { autoFix = false, dryRun = false } = options;

        try {
            await this.errorHandler.logInfo('Starting comprehensive sync configuration validation', {
                validationId,
                operation: SyncOperations.SYNC_CONFIGURATION_VALIDATION,
                options,
                autoFix,
                dryRun
            });

            const results = {
                validationId,
                timestamp: new Date().toISOString(),
                overall: { success: true, issues: [] },
                unisonDirectory: null,
                profiles: {},
                archives: null,
                rootPaths: {},
                ignorePatterns: {},
                recommendations: []
            };

            // Step 1: Validate Unison directory access
            await this.errorHandler.logInfo('Step 1: Validating Unison directory access', { validationId });
            results.unisonDirectory = await this.validateUnisonDirectory();
            if (!results.unisonDirectory.success) {
                results.overall.success = false;
                results.overall.issues.push('Unison directory access failed');
            }

            // Step 2: Validate all profiles
            await this.errorHandler.logInfo('Step 2: Validating sync profiles', { validationId });
            for (const profileName of this.expectedConfig.profiles) {
                results.profiles[profileName] = await this.validateProfile(profileName);
                if (!results.profiles[profileName].success) {
                    results.overall.success = false;
                    results.overall.issues.push(`Profile ${profileName} validation failed`);
                }
            }

            // Step 3: Validate archive files
            await this.errorHandler.logInfo('Step 3: Validating archive files', { validationId });
            results.archives = await this.validateArchives();
            if (!results.archives.success) {
                results.overall.success = false;
                results.overall.issues.push('Archive validation failed');
            }

            // Step 4: Validate root paths
            await this.errorHandler.logInfo('Step 4: Validating sync root paths', { validationId });
            for (const profileName of this.expectedConfig.profiles) {
                results.rootPaths[profileName] = await this.validateRootPaths(profileName);
                if (!results.rootPaths[profileName].success) {
                    results.overall.success = false;
                    results.overall.issues.push(`Root path validation failed for ${profileName}`);
                }
            }

            // Step 5: Validate ignore patterns
            await this.errorHandler.logInfo('Step 5: Validating ignore patterns', { validationId });
            for (const profileName of this.expectedConfig.profiles) {
                results.ignorePatterns[profileName] = await this.validateIgnorePatterns(profileName);
                if (!results.ignorePatterns[profileName].success) {
                    results.overall.success = false;
                    results.overall.issues.push(`Ignore pattern validation failed for ${profileName}`);
                }
            }

            // Step 6: Generate recommendations
            await this.errorHandler.logInfo('Step 6: Generating recommendations', { validationId });
            results.recommendations = this.generateRecommendations(results);

            // Step 7: Auto-fix issues if requested
            if (autoFix && !results.overall.success) {
                await this.errorHandler.logInfo('Step 7: Auto-fixing detected issues', { validationId, dryRun });
                results.autoFixResults = await this.autoFixIssues(results, dryRun);

                // Re-validate after fixes to update results
                if (!dryRun && results.autoFixResults.fixesApplied > 0) {
                    await this.errorHandler.logInfo('Re-validating after auto-fixes', { validationId });
                    const revalidationResults = await this.validateSyncConfiguration({ autoFix: false });
                    results.postFixValidation = revalidationResults;
                    results.overall.success = revalidationResults.overall.success;
                }
            }

            // Log final results
            const logLevel = results.overall.success ? 'INFO' : 'WARN';
            await this.errorHandler.log(logLevel, 'Sync configuration validation completed', {
                validationId,
                success: results.overall.success,
                issueCount: results.overall.issues.length,
                recommendationCount: results.recommendations.length,
                autoFixEnabled: autoFix,
                fixesApplied: results.autoFixResults?.fixesApplied || 0
            });

            return results;

        } catch (error) {
            await this.errorHandler.handleSyncError(error, SyncOperations.SYNC_CONFIGURATION_VALIDATION, {
                validationId
            });

            return {
                validationId,
                timestamp: new Date().toISOString(),
                overall: { success: false, issues: ['Validation process failed'] },
                error: error.message
            };
        }
    }

    /**
     * Validate Unison directory access
     */
    async validateUnisonDirectory() {
        try {
            await this.errorHandler.logDebug('Checking Unison directory access', {
                unisonDir: this.unisonDir
            });

            if (!fs.existsSync(this.unisonDir)) {
                await this.errorHandler.logWarn('Unison directory does not exist', {
                    unisonDir: this.unisonDir
                });
                return {
                    success: false,
                    issue: 'directory_missing',
                    message: 'Unison directory does not exist',
                    autoFix: 'Directory will be created automatically'
                };
            }

            // Check read/write permissions
            try {
                fs.accessSync(this.unisonDir, fs.constants.R_OK | fs.constants.W_OK);
            } catch (permError) {
                await this.errorHandler.handleSyncError(permError, SyncOperations.SYNC_CONFIGURATION_VALIDATION, {
                    path: this.unisonDir,
                    requiredPermissions: 'read/write'
                });

                return {
                    success: false,
                    issue: 'permission_denied',
                    message: 'Insufficient permissions for Unison directory',
                    error: permError.message
                };
            }

            await this.errorHandler.logInfo('Unison directory access validated successfully', {
                unisonDir: this.unisonDir
            });

            return {
                success: true,
                message: 'Unison directory is accessible'
            };

        } catch (error) {
            await this.errorHandler.handleSyncError(error, SyncOperations.SYNC_CONFIGURATION_VALIDATION, {
                unisonDir: this.unisonDir
            });

            return {
                success: false,
                issue: 'validation_error',
                message: 'Error validating Unison directory',
                error: error.message
            };
        }
    }

    /**
     * Validate individual profile
     */
    async validateProfile(profileName) {
        try {
            await this.errorHandler.logDebug('Validating profile', {
                profileName,
                operation: SyncOperations.PROFILE_VALIDATION
            });

            const profilePath = path.join(this.unisonDir, `${profileName}.prf`);
            const validation = await this.profileValidator.detectCorruptedProfile(profilePath);

            if (!validation.exists) {
                await this.errorHandler.logWarn('Profile does not exist', {
                    profileName,
                    profilePath
                });
                return {
                    success: false,
                    issue: 'profile_missing',
                    message: `Profile ${profileName} does not exist`,
                    autoFix: 'Profile will be created with default configuration'
                };
            }

            if (validation.isCorrupted) {
                await this.errorHandler.logError('Profile corruption detected', {
                    profileName,
                    issues: validation.issues,
                    fileSize: validation.fileSize
                });
                return {
                    success: false,
                    issue: 'profile_corrupted',
                    message: `Profile ${profileName} is corrupted`,
                    details: validation.issues,
                    autoFix: 'Profile will be backed up and regenerated'
                };
            }

            await this.errorHandler.logInfo('Profile validation passed', {
                profileName,
                fileSize: validation.fileSize,
                lineCount: validation.lineCount
            });

            return {
                success: true,
                message: `Profile ${profileName} is valid`,
                details: {
                    fileSize: validation.fileSize,
                    lineCount: validation.lineCount,
                    hasValidStructure: validation.hasValidStructure
                }
            };

        } catch (error) {
            await this.errorHandler.handleSyncError(error, SyncOperations.PROFILE_VALIDATION, {
                profileName
            });

            return {
                success: false,
                issue: 'validation_error',
                message: `Error validating profile ${profileName}`,
                error: error.message
            };
        }
    }

    /**
     * Validate archive files
     */
    async validateArchives() {
        try {
            await this.errorHandler.logDebug('Validating archive files', {
                operation: SyncOperations.ARCHIVE_DETECTION
            });

            const detection = await this.archiveManager.detectCorruptedArchives();

            if (!detection.success) {
                return {
                    success: false,
                    issue: 'archive_detection_failed',
                    message: 'Failed to detect archive corruption',
                    error: detection.message
                };
            }

            if (detection.corruptedCount > 0) {
                await this.errorHandler.logWarn('Corrupted archives detected', {
                    totalArchives: detection.totalArchives,
                    corruptedCount: detection.corruptedCount
                });

                return {
                    success: false,
                    issue: 'archives_corrupted',
                    message: `Found ${detection.corruptedCount} corrupted archives`,
                    details: {
                        totalArchives: detection.totalArchives,
                        corruptedCount: detection.corruptedCount,
                        corruptedFiles: detection.corruptedArchives.map(a => a.filename)
                    },
                    autoFix: 'Corrupted archives will be backed up and removed'
                };
            }

            await this.errorHandler.logInfo('Archive validation passed', {
                totalArchives: detection.totalArchives
            });

            return {
                success: true,
                message: 'All archive files are valid',
                details: {
                    totalArchives: detection.totalArchives
                }
            };

        } catch (error) {
            await this.errorHandler.handleSyncError(error, SyncOperations.ARCHIVE_DETECTION);

            return {
                success: false,
                issue: 'validation_error',
                message: 'Error validating archives',
                error: error.message
            };
        }
    }

    /**
     * Validate root paths for a profile
     */
    async validateRootPaths(profileName) {
        try {
            await this.errorHandler.logDebug('Validating root paths', {
                profileName,
                operation: SyncOperations.ROOT_PATH_VALIDATION
            });

            const profilePath = path.join(this.unisonDir, `${profileName}.prf`);

            if (!fs.existsSync(profilePath)) {
                return {
                    success: false,
                    issue: 'profile_missing',
                    message: `Cannot validate root paths - profile ${profileName} does not exist`
                };
            }

            const content = fs.readFileSync(profilePath, 'utf8');
            const lines = content.split('\n');
            const rootLines = lines.filter(line => line.trim().startsWith('root ='));

            if (rootLines.length !== 2) {
                await this.errorHandler.logError('Invalid root configuration', {
                    profileName,
                    expectedRoots: 2,
                    foundRoots: rootLines.length
                });

                return {
                    success: false,
                    issue: 'invalid_root_count',
                    message: `Profile ${profileName} should have exactly 2 root directives`,
                    details: { expected: 2, found: rootLines.length }
                };
            }

            // Extract root paths
            const rootPaths = rootLines.map(line => {
                const match = line.match(/root\s*=\s*(.+)/);
                return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
            }).filter(Boolean);

            // Validate source root
            const sourceRoot = rootPaths.find(root => root.includes('Sync_Hub_New'));
            if (!sourceRoot) {
                await this.errorHandler.logError('Source root validation failed', {
                    profileName,
                    expectedSource: this.expectedConfig.sourceRoot,
                    foundRoots: rootPaths
                });

                return {
                    success: false,
                    issue: 'invalid_source_root',
                    message: `Profile ${profileName} does not have correct source root`,
                    details: {
                        expected: this.expectedConfig.sourceRoot,
                        found: rootPaths
                    },
                    autoFix: 'Profile will be regenerated with correct source root'
                };
            }

            // Validate destination root exists
            const destinationRoot = rootPaths.find(root => !root.includes('Sync_Hub_New'));
            if (!destinationRoot) {
                return {
                    success: false,
                    issue: 'missing_destination_root',
                    message: `Profile ${profileName} is missing destination root`
                };
            }

            await this.errorHandler.logInfo('Root path validation passed', {
                profileName,
                sourceRoot,
                destinationRoot
            });

            return {
                success: true,
                message: `Root paths for ${profileName} are valid`,
                details: {
                    sourceRoot,
                    destinationRoot
                }
            };

        } catch (error) {
            await this.errorHandler.handleSyncError(error, SyncOperations.ROOT_PATH_VALIDATION, {
                profileName
            });

            return {
                success: false,
                issue: 'validation_error',
                message: `Error validating root paths for ${profileName}`,
                error: error.message
            };
        }
    }

    /**
     * Validate ignore patterns for a profile
     */
    async validateIgnorePatterns(profileName) {
        try {
            await this.errorHandler.logDebug('Validating ignore patterns', {
                profileName
            });

            const profilePath = path.join(this.unisonDir, `${profileName}.prf`);

            if (!fs.existsSync(profilePath)) {
                return {
                    success: false,
                    issue: 'profile_missing',
                    message: `Cannot validate ignore patterns - profile ${profileName} does not exist`
                };
            }

            const content = fs.readFileSync(profilePath, 'utf8');
            const lines = content.split('\n');
            const ignoreLines = lines.filter(line => line.trim().startsWith('ignore ='));

            // Extract ignore patterns
            const ignorePatterns = ignoreLines.map(line => {
                const match = line.match(/ignore\s*=\s*(.+)/);
                return match ? match[1].trim() : null;
            }).filter(Boolean);

            // Check for required patterns
            const missingPatterns = [];
            for (const requiredPattern of this.expectedConfig.requiredIgnorePatterns) {
                const hasPattern = ignorePatterns.some(pattern =>
                    pattern.includes(requiredPattern)
                );
                if (!hasPattern) {
                    missingPatterns.push(requiredPattern);
                }
            }

            if (missingPatterns.length > 0) {
                await this.errorHandler.logWarn('Missing required ignore patterns', {
                    profileName,
                    missingPatterns,
                    totalPatterns: ignorePatterns.length
                });

                return {
                    success: false,
                    issue: 'missing_ignore_patterns',
                    message: `Profile ${profileName} is missing required ignore patterns`,
                    details: {
                        missing: missingPatterns,
                        total: ignorePatterns.length
                    },
                    autoFix: 'Missing ignore patterns will be added to profile'
                };
            }

            await this.errorHandler.logInfo('Ignore pattern validation passed', {
                profileName,
                patternCount: ignorePatterns.length
            });

            return {
                success: true,
                message: `Ignore patterns for ${profileName} are complete`,
                details: {
                    patternCount: ignorePatterns.length,
                    patterns: ignorePatterns.slice(0, 5) // Show first 5 patterns
                }
            };

        } catch (error) {
            await this.errorHandler.handleSyncError(error, SyncOperations.SYNC_CONFIGURATION_VALIDATION, {
                profileName,
                component: 'ignore-pattern-validation'
            });

            return {
                success: false,
                issue: 'validation_error',
                message: `Error validating ignore patterns for ${profileName}`,
                error: error.message
            };
        }
    }

    /**
     * Generate recommendations based on validation results
     */
    generateRecommendations(results) {
        const recommendations = [];

        // Check overall success
        if (!results.overall.success) {
            recommendations.push({
                priority: 'high',
                category: 'configuration',
                title: 'Fix Configuration Issues',
                description: 'Multiple configuration issues detected that need immediate attention',
                action: 'Run automatic cleanup and regeneration process'
            });
        }

        // Check for corrupted profiles
        for (const [profileName, profileResult] of Object.entries(results.profiles)) {
            if (!profileResult.success && profileResult.issue === 'profile_corrupted') {
                recommendations.push({
                    priority: 'high',
                    category: 'profile',
                    title: `Regenerate ${profileName} Profile`,
                    description: `Profile ${profileName} is corrupted and needs to be regenerated`,
                    action: `Run: node profile_validator.js regenerate ${profileName}`
                });
            }
        }

        // Check for corrupted archives
        if (results.archives && !results.archives.success && results.archives.issue === 'archives_corrupted') {
            recommendations.push({
                priority: 'medium',
                category: 'archive',
                title: 'Clean Up Corrupted Archives',
                description: 'Corrupted archive files are affecting sync performance',
                action: 'Run: node archive_manager.js cleanup'
            });
        }

        // Check for missing ignore patterns
        for (const [profileName, patternResult] of Object.entries(results.ignorePatterns)) {
            if (!patternResult.success && patternResult.issue === 'missing_ignore_patterns') {
                recommendations.push({
                    priority: 'medium',
                    category: 'ignore-patterns',
                    title: `Update ${profileName} Ignore Patterns`,
                    description: `Profile ${profileName} is missing important ignore patterns`,
                    action: `Regenerate profile to include comprehensive ignore patterns`
                });
            }
        }

        // Performance recommendations
        if (results.archives && results.archives.success && results.archives.details?.totalArchives > 50) {
            recommendations.push({
                priority: 'low',
                category: 'performance',
                title: 'Archive Cleanup for Performance',
                description: 'Large number of archive files may impact sync performance',
                action: 'Consider periodic archive cleanup'
            });
        }

        return recommendations;
    }

    /**
     * Auto-fix detected issues
     * @param {Object} results - Validation results
     * @param {boolean} dryRun - If true, only show what would be fixed
     * @returns {Object} Auto-fix results
     */
    async autoFixIssues(results, dryRun = false) {
        const fixResults = {
            dryRun,
            fixesAttempted: 0,
            fixesApplied: 0,
            fixesFailed: 0,
            fixes: [],
            errors: []
        };

        try {
            await this.errorHandler.logInfo(`${dryRun ? 'Dry run: ' : ''}Starting auto-fix process`, {
                totalIssues: results.overall.issues.length
            });

            // Fix corrupted profiles
            for (const [profileName, profileResult] of Object.entries(results.profiles)) {
                if (!profileResult.success) {
                    const fixResult = await this.fixProfileIssue(profileName, profileResult, dryRun);
                    fixResults.fixes.push(fixResult);
                    fixResults.fixesAttempted++;

                    if (fixResult.success) {
                        fixResults.fixesApplied++;
                    } else {
                        fixResults.fixesFailed++;
                        fixResults.errors.push(fixResult.error);
                    }
                }
            }

            // Fix corrupted archives
            if (results.archives && !results.archives.success) {
                const fixResult = await this.fixArchiveIssues(results.archives, dryRun);
                fixResults.fixes.push(fixResult);
                fixResults.fixesAttempted++;

                if (fixResult.success) {
                    fixResults.fixesApplied++;
                } else {
                    fixResults.fixesFailed++;
                    fixResults.errors.push(fixResult.error);
                }
            }

            // Fix missing ignore patterns
            for (const [profileName, patternResult] of Object.entries(results.ignorePatterns)) {
                if (!patternResult.success && patternResult.issue === 'missing_ignore_patterns') {
                    const fixResult = await this.fixIgnorePatterns(profileName, patternResult, dryRun);
                    fixResults.fixes.push(fixResult);
                    fixResults.fixesAttempted++;

                    if (fixResult.success) {
                        fixResults.fixesApplied++;
                    } else {
                        fixResults.fixesFailed++;
                        fixResults.errors.push(fixResult.error);
                    }
                }
            }

            // Fix root path issues
            for (const [profileName, rootResult] of Object.entries(results.rootPaths)) {
                if (!rootResult.success) {
                    const fixResult = await this.fixRootPathIssues(profileName, rootResult, dryRun);
                    fixResults.fixes.push(fixResult);
                    fixResults.fixesAttempted++;

                    if (fixResult.success) {
                        fixResults.fixesApplied++;
                    } else {
                        fixResults.fixesFailed++;
                        fixResults.errors.push(fixResult.error);
                    }
                }
            }

            await this.errorHandler.logInfo(`Auto-fix process completed`, {
                dryRun,
                fixesAttempted: fixResults.fixesAttempted,
                fixesApplied: fixResults.fixesApplied,
                fixesFailed: fixResults.fixesFailed
            });

            return fixResults;

        } catch (error) {
            await this.errorHandler.handleSyncError(error, SyncOperations.SYNC_CONFIGURATION_VALIDATION, {
                component: 'auto-fix',
                dryRun
            });

            fixResults.errors.push(error.message);
            return fixResults;
        }
    }

    /**
     * Fix profile-related issues
     */
    async fixProfileIssue(profileName, profileResult, dryRun = false) {
        try {
            await this.errorHandler.logInfo(`${dryRun ? 'Dry run: ' : ''}Fixing profile issue`, {
                profileName,
                issue: profileResult.issue
            });

            if (profileResult.issue === 'profile_corrupted' || profileResult.issue === 'profile_missing') {
                if (dryRun) {
                    return {
                        type: 'profile_fix',
                        profileName,
                        action: 'would_regenerate',
                        success: true,
                        message: `Would regenerate corrupted profile: ${profileName}`
                    };
                }

                // Regenerate the profile
                const regenerateResult = await this.profileValidator.regenerateProfile(profileName);

                return {
                    type: 'profile_fix',
                    profileName,
                    action: 'regenerated',
                    success: regenerateResult.success,
                    message: regenerateResult.message,
                    details: regenerateResult
                };
            }

            return {
                type: 'profile_fix',
                profileName,
                action: 'no_action_needed',
                success: true,
                message: `No fix needed for profile issue: ${profileResult.issue}`
            };

        } catch (error) {
            return {
                type: 'profile_fix',
                profileName,
                action: 'failed',
                success: false,
                error: error.message,
                message: `Failed to fix profile ${profileName}: ${error.message}`
            };
        }
    }

    /**
     * Fix archive-related issues
     */
    async fixArchiveIssues(archiveResult, dryRun = false) {
        try {
            await this.errorHandler.logInfo(`${dryRun ? 'Dry run: ' : ''}Fixing archive issues`, {
                issue: archiveResult.issue
            });

            if (archiveResult.issue === 'archives_corrupted') {
                if (dryRun) {
                    return {
                        type: 'archive_fix',
                        action: 'would_cleanup',
                        success: true,
                        message: `Would clean up ${archiveResult.details?.corruptedCount || 0} corrupted archives`
                    };
                }

                // Clean up corrupted archives
                const cleanupResult = await this.archiveManager.detectCorruptedArchives();
                if (cleanupResult.success && cleanupResult.corruptedCount > 0) {
                    const removeResult = await this.archiveManager.removeCorruptedArchives(
                        cleanupResult.corruptedArchives,
                        false
                    );

                    return {
                        type: 'archive_fix',
                        action: 'cleaned_up',
                        success: removeResult.success,
                        message: removeResult.message,
                        details: removeResult
                    };
                }
            }

            return {
                type: 'archive_fix',
                action: 'no_action_needed',
                success: true,
                message: 'No archive cleanup needed'
            };

        } catch (error) {
            return {
                type: 'archive_fix',
                action: 'failed',
                success: false,
                error: error.message,
                message: `Failed to fix archive issues: ${error.message}`
            };
        }
    }

    /**
     * Fix ignore pattern issues
     */
    async fixIgnorePatterns(profileName, patternResult, dryRun = false) {
        try {
            await this.errorHandler.logInfo(`${dryRun ? 'Dry run: ' : ''}Fixing ignore patterns`, {
                profileName,
                missingPatterns: patternResult.details?.missing
            });

            if (dryRun) {
                return {
                    type: 'ignore_pattern_fix',
                    profileName,
                    action: 'would_regenerate',
                    success: true,
                    message: `Would regenerate profile ${profileName} with comprehensive ignore patterns`
                };
            }

            // Regenerate profile with comprehensive ignore patterns
            const regenerateResult = await this.profileValidator.regenerateProfile(profileName);

            return {
                type: 'ignore_pattern_fix',
                profileName,
                action: 'regenerated',
                success: regenerateResult.success,
                message: `Regenerated profile ${profileName} with comprehensive ignore patterns`,
                details: regenerateResult
            };

        } catch (error) {
            return {
                type: 'ignore_pattern_fix',
                profileName,
                action: 'failed',
                success: false,
                error: error.message,
                message: `Failed to fix ignore patterns for ${profileName}: ${error.message}`
            };
        }
    }

    /**
     * Fix root path issues
     */
    async fixRootPathIssues(profileName, rootResult, dryRun = false) {
        try {
            await this.errorHandler.logInfo(`${dryRun ? 'Dry run: ' : ''}Fixing root path issues`, {
                profileName,
                issue: rootResult.issue
            });

            if (rootResult.issue === 'invalid_source_root' || rootResult.issue === 'missing_destination_root') {
                if (dryRun) {
                    return {
                        type: 'root_path_fix',
                        profileName,
                        action: 'would_regenerate',
                        success: true,
                        message: `Would regenerate profile ${profileName} with correct root paths`
                    };
                }

                // Regenerate profile with correct root paths
                const regenerateResult = await this.profileValidator.regenerateProfile(profileName);

                return {
                    type: 'root_path_fix',
                    profileName,
                    action: 'regenerated',
                    success: regenerateResult.success,
                    message: `Regenerated profile ${profileName} with correct root paths`,
                    details: regenerateResult
                };
            }

            return {
                type: 'root_path_fix',
                profileName,
                action: 'no_action_needed',
                success: true,
                message: `No fix needed for root path issue: ${rootResult.issue}`
            };

        } catch (error) {
            return {
                type: 'root_path_fix',
                profileName,
                action: 'failed',
                success: false,
                error: error.message,
                message: `Failed to fix root paths for ${profileName}: ${error.message}`
            };
        }
    }

    /**
     * Display validation results in user-friendly format
     */
    displayResults(results) {
        console.log('\n' + '='.repeat(80));
        console.log('🔧 SYNC CONFIGURATION VALIDATION RESULTS');
        console.log('='.repeat(80));
        console.log(`Validation ID: ${results.validationId}`);
        console.log(`Timestamp: ${results.timestamp}`);
        console.log(`Overall Status: ${results.overall.success ? '✅ PASSED' : '❌ FAILED'}`);

        if (results.overall.issues.length > 0) {
            console.log(`\n📋 ISSUES FOUND (${results.overall.issues.length}):`);
            results.overall.issues.forEach((issue, index) => {
                console.log(`   ${index + 1}. ${issue}`);
            });
        }

        // Display profile results
        console.log('\n📁 PROFILE VALIDATION:');
        for (const [profileName, result] of Object.entries(results.profiles)) {
            const status = result.success ? '✅' : '❌';
            console.log(`   ${status} ${profileName}: ${result.message}`);
            if (result.autoFix) {
                console.log(`      🔧 Auto-fix: ${result.autoFix}`);
            }
        }

        // Display archive results
        if (results.archives) {
            console.log('\n📦 ARCHIVE VALIDATION:');
            const status = results.archives.success ? '✅' : '❌';
            console.log(`   ${status} ${results.archives.message}`);
            if (results.archives.autoFix) {
                console.log(`      🔧 Auto-fix: ${results.archives.autoFix}`);
            }
        }

        // Display auto-fix results
        if (results.autoFixResults) {
            const autoFix = results.autoFixResults;
            console.log('\n🔧 AUTO-FIX RESULTS:');
            console.log(`   Fixes Attempted: ${autoFix.fixesAttempted}`);
            console.log(`   Fixes Applied: ${autoFix.fixesApplied}`);
            console.log(`   Fixes Failed: ${autoFix.fixesFailed}`);

            if (autoFix.fixes.length > 0) {
                console.log('\n   📋 FIX DETAILS:');
                autoFix.fixes.forEach((fix, index) => {
                    const status = fix.success ? '✅' : '❌';
                    console.log(`      ${index + 1}. ${status} ${fix.message}`);
                });
            }

            if (autoFix.errors.length > 0) {
                console.log('\n   ❌ FIX ERRORS:');
                autoFix.errors.forEach((error, index) => {
                    console.log(`      ${index + 1}. ${error}`);
                });
            }

            // Show post-fix validation results
            if (results.postFixValidation) {
                const postFix = results.postFixValidation;
                console.log(`\n🔄 POST-FIX VALIDATION:`);
                console.log(`   Overall Status: ${postFix.overall.success ? '✅ PASSED' : '❌ FAILED'}`);
                if (postFix.overall.issues.length > 0) {
                    console.log(`   Remaining Issues: ${postFix.overall.issues.length}`);
                }
            }
        }

        // Display recommendations
        if (results.recommendations.length > 0) {
            console.log(`\n💡 RECOMMENDATIONS (${results.recommendations.length}):`);
            results.recommendations.forEach((rec, index) => {
                const priorityIcon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
                console.log(`   ${index + 1}. ${priorityIcon} ${rec.title}`);
                console.log(`      ${rec.description}`);
                console.log(`      Action: ${rec.action}`);
            });
        }

        console.log('\n' + '='.repeat(80));
        console.log('📝 Detailed logs have been saved for troubleshooting.');
        console.log('='.repeat(80) + '\n');
    }
}

// Export the class
export default SyncConfigurationValidator;

// CLI interface when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const validator = new SyncConfigurationValidator();

    const command = process.argv[2] || 'validate';
    const autoFix = process.argv.includes('--auto-fix');
    const dryRun = process.argv.includes('--dry-run');

    switch (command) {
        case 'validate':
            const actionText = autoFix ?
                (dryRun ? 'validation with dry-run auto-fix preview' : 'validation with auto-fix') :
                'validation';
            console.log(`🔧 Starting comprehensive sync configuration ${actionText}...\n`);

            validator.validateSyncConfiguration({ autoFix, dryRun })
                .then(results => {
                    validator.displayResults(results);

                    // Exit with appropriate code
                    if (autoFix && !dryRun) {
                        // For auto-fix, success depends on post-fix validation or original if no fixes were needed
                        const finalSuccess = results.postFixValidation ?
                            results.postFixValidation.overall.success :
                            results.overall.success;
                        process.exit(finalSuccess ? 0 : 1);
                    } else {
                        process.exit(results.overall.success ? 0 : 1);
                    }
                })
                .catch(error => {
                    console.error('❌ Validation failed:', error);
                    process.exit(1);
                });
            break;

        case 'fix':
            console.log('🔧 Starting sync configuration auto-fix...\n');
            validator.validateSyncConfiguration({ autoFix: true, dryRun: false })
                .then(results => {
                    validator.displayResults(results);
                    const finalSuccess = results.postFixValidation ?
                        results.postFixValidation.overall.success :
                        results.overall.success;
                    process.exit(finalSuccess ? 0 : 1);
                })
                .catch(error => {
                    console.error('❌ Auto-fix failed:', error);
                    process.exit(1);
                });
            break;

        case 'dry-run':
            console.log('🔧 Starting sync configuration dry-run preview...\n');
            validator.validateSyncConfiguration({ autoFix: true, dryRun: true })
                .then(results => {
                    validator.displayResults(results);
                    process.exit(results.overall.success ? 0 : 1);
                })
                .catch(error => {
                    console.error('❌ Dry-run failed:', error);
                    process.exit(1);
                });
            break;

        case 'test-logging':
            console.log('🧪 Testing comprehensive logging and error handling...\n');

            // Test various error scenarios
            const testScenarios = [
                { type: 'profile_corruption', profileName: 'test_profile' },
                { type: 'archive_corruption', archiveFile: 'ar123456' },
                { type: 'permission_error', path: '/restricted/path' }
            ];

            testScenarios.forEach(async (scenario, index) => {
                console.log(`Testing scenario ${index + 1}: ${scenario.type}`);

                const testError = new Error(`Test ${scenario.type} error`);
                if (scenario.type === 'permission_error') {
                    testError.code = 'EACCES';
                }

                await validator.errorHandler.handleSyncError(
                    testError,
                    'test_operation',
                    scenario
                );
            });

            console.log('\n✅ Logging test completed. Check log files for details.');
            break;

        default:
            console.log(`
Sync Configuration Validator

Usage: node sync_configuration_validator.js <command> [options]

Commands:
    validate        - Run comprehensive sync configuration validation
    fix             - Run validation and automatically fix detected issues
    dry-run         - Preview what would be fixed without applying changes
    test-logging    - Test logging and error handling functionality

Options:
    --auto-fix      - Automatically fix detected issues (can be used with validate)
    --dry-run       - Show what would be fixed without applying changes

Examples:
    node sync_configuration_validator.js validate
    node sync_configuration_validator.js validate --auto-fix
    node sync_configuration_validator.js validate --auto-fix --dry-run
    node sync_configuration_validator.js fix
    node sync_configuration_validator.js dry-run
    node sync_configuration_validator.js test-logging

Requirements Addressed:
    3.4 - Comprehensive validation of sync configuration including root paths
    5.4 - Automatic detection and fixing of configuration issues
            `);
            break;
    }
}