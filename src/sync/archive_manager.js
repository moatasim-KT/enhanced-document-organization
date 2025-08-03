#!/usr/bin/env node

/**
 * Unison Archive Manager Module
 * 
 * This module provides functions to:
 * 1. Detect and remove corrupted Unison archive files
 * 2. Create selective archive cleanup for specific profiles
 * 3. Add validation to ensure new archives are created correctly
 * 
 * Requirements: 5.1, 5.4
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { SyncErrorHandler, SyncOperations } from './sync_error_handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ArchiveManager {
    constructor() {
        this.unisonDir = path.join(os.homedir(), '.unison');
        this.backupDir = path.join(this.unisonDir, 'archive_backups');

        // Initialize error handler for comprehensive logging
        this.errorHandler = new SyncErrorHandler({
            component: 'archive-manager',
            enableConsoleLogging: true,
            enableFileLogging: true
        });

        // Archive file patterns and thresholds
        this.archivePatterns = {
            // Standard archive files
            archive: /^ar[a-f0-9]+$/,
            // Fingerprint files
            fingerprint: /^fp[a-f0-9]+$/,
            // Lock files
            lock: /^lk[a-f0-9]+$/,
            // Temporary files
            temp: /^tmp[a-f0-9]+$/
        };

        // Size thresholds for detecting corrupted archives (in bytes)
        this.sizeThresholds = {
            maxArchiveSize: 100 * 1024 * 1024, // 100MB
            maxFingerprintSize: 10 * 1024 * 1024, // 10MB
            suspiciouslyLarge: 50 * 1024 * 1024, // 50MB
            suspiciouslySmall: 10 // 10 bytes
        };

        // Age thresholds for cleanup (in milliseconds)
        this.ageThresholds = {
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            staleAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            lockFileAge: 1 * 60 * 60 * 1000 // 1 hour for lock files
        };

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
     * Detect corrupted Unison archive files
     * @param {string} profileName - Optional profile name to filter archives
     * @returns {Object} Detection result with corrupted archives list
     */
    async detectCorruptedArchives(profileName = null) {
        try {
            await this.log('INFO', `Starting archive corruption detection`, {
                profileName,
                operation: SyncOperations.ARCHIVE_DETECTION
            });

            if (!fs.existsSync(this.unisonDir)) {
                await this.log('ERROR', `Unison directory does not exist`, {
                    unisonDir: this.unisonDir
                });
                return {
                    success: false,
                    message: `Unison directory does not exist: ${this.unisonDir}`
                };
            }

            const files = fs.readdirSync(this.unisonDir);
            const archiveFiles = this.identifyArchiveFiles(files);
            const corruptedArchives = [];
            const analysisResults = {};

            for (const file of archiveFiles) {
                const filePath = path.join(this.unisonDir, file);
                const analysis = this.analyzeArchiveFile(filePath, profileName);

                analysisResults[file] = analysis;

                if (analysis.isCorrupted) {
                    corruptedArchives.push({
                        filename: file,
                        path: filePath,
                        type: analysis.type,
                        issues: analysis.issues,
                        size: analysis.size,
                        age: analysis.age,
                        relatedProfile: analysis.relatedProfile
                    });
                }
            }

            const result = {
                success: true,
                totalArchives: archiveFiles.length,
                corruptedCount: corruptedArchives.length,
                corruptedArchives,
                analysisResults,
                profileFilter: profileName,
                message: corruptedArchives.length > 0 ?
                    `Found ${corruptedArchives.length} corrupted archives out of ${archiveFiles.length} total` :
                    `All ${archiveFiles.length} archive files appear to be valid`
            };

            // Log detailed results
            if (corruptedArchives.length > 0) {
                await this.errorHandler.logArchiveCleanupAction('corruption_detected', {
                    totalArchives: archiveFiles.length,
                    corruptedCount: corruptedArchives.length,
                    corruptedFiles: corruptedArchives.map(a => a.filename),
                    profileFilter: profileName
                });

                await this.log('WARN', `Archive corruption detected`, {
                    totalArchives: archiveFiles.length,
                    corruptedCount: corruptedArchives.length,
                    profileFilter: profileName
                });
            } else {
                await this.log('INFO', `All archive files are valid`, {
                    totalArchives: archiveFiles.length,
                    profileFilter: profileName
                });
            }

            return result;

        } catch (error) {
            await this.errorHandler.handleSyncError(error, SyncOperations.ARCHIVE_DETECTION, {
                profileName,
                unisonDir: this.unisonDir
            });

            return {
                success: false,
                error: error.message,
                message: `Error detecting corrupted archives: ${error.message}`
            };
        }
    }

    /**
     * Identify archive files from directory listing
     * @param {Array} files - Array of filenames
     * @returns {Array} Array of archive filenames
     */
    identifyArchiveFiles(files) {
        const archiveFiles = [];

        for (const file of files) {
            // Check against known archive patterns
            for (const [type, pattern] of Object.entries(this.archivePatterns)) {
                if (pattern.test(file)) {
                    archiveFiles.push(file);
                    break;
                }
            }
        }

        return archiveFiles;
    }

    /**
     * Analyze individual archive file for corruption
     * @param {string} filePath - Path to archive file
     * @param {string} profileFilter - Optional profile name filter
     * @returns {Object} Analysis result
     */
    analyzeArchiveFile(filePath, profileFilter = null) {
        try {
            const filename = path.basename(filePath);
            const stats = fs.statSync(filePath);
            const now = Date.now();
            const age = now - stats.mtime.getTime();

            const analysis = {
                filename,
                path: filePath,
                type: this.getArchiveType(filename),
                size: stats.size,
                age,
                lastModified: stats.mtime,
                isCorrupted: false,
                issues: [],
                relatedProfile: null
            };

            // Try to determine related profile
            analysis.relatedProfile = this.determineRelatedProfile(filename, filePath);

            // Skip if profile filter is specified and doesn't match
            if (profileFilter && analysis.relatedProfile !== profileFilter) {
                analysis.skipped = true;
                return analysis;
            }

            // Check file size thresholds
            this.checkSizeThresholds(analysis);

            // Check file age
            this.checkAgeThresholds(analysis);

            // Check file accessibility and content
            this.checkFileAccessibility(analysis);

            // Check for specific corruption patterns
            this.checkCorruptionPatterns(analysis);

            // Determine if file is corrupted based on issues
            analysis.isCorrupted = analysis.issues.length > 0;

            return analysis;

        } catch (error) {
            return {
                filename: path.basename(filePath),
                path: filePath,
                isCorrupted: true,
                error: error.message,
                issues: [`Error analyzing file: ${error.message}`]
            };
        }
    }

    /**
     * Get archive file type based on filename pattern
     * @param {string} filename - Archive filename
     * @returns {string} Archive type
     */
    getArchiveType(filename) {
        for (const [type, pattern] of Object.entries(this.archivePatterns)) {
            if (pattern.test(filename)) {
                return type;
            }
        }
        return 'unknown';
    }

    /**
     * Determine which profile an archive file is related to
     * @param {string} filename - Archive filename
     * @param {string} filePath - Full path to archive file
     * @returns {string|null} Related profile name or null
     */
    determineRelatedProfile(filename, filePath) {
        try {
            // For archive files, we can sometimes determine the profile by checking
            // which profile files exist and their modification times
            const unisonDir = path.dirname(filePath);
            const profileFiles = fs.readdirSync(unisonDir)
                .filter(file => file.endsWith('.prf'))
                .map(file => ({
                    name: path.basename(file, '.prf'),
                    path: path.join(unisonDir, file),
                    mtime: fs.statSync(path.join(unisonDir, file)).mtime
                }));

            if (profileFiles.length === 0) {
                return null;
            }

            // If there's only one profile, assume it's related
            if (profileFiles.length === 1) {
                return profileFiles[0].name;
            }

            // Try to match based on timing - archives are usually created/modified
            // around the same time as profile usage
            const archiveStats = fs.statSync(filePath);
            const timeDifferences = profileFiles.map(profile => ({
                name: profile.name,
                timeDiff: Math.abs(archiveStats.mtime.getTime() - profile.mtime.getTime())
            }));

            // Find the profile with the closest modification time
            timeDifferences.sort((a, b) => a.timeDiff - b.timeDiff);

            // If the closest profile was modified within 1 hour of the archive, assume it's related
            if (timeDifferences[0].timeDiff < 60 * 60 * 1000) { // 1 hour
                return timeDifferences[0].name;
            }

            return null;

        } catch (error) {
            this.log('WARN', `Could not determine related profile for ${filename}: ${error.message}`);
            return null;
        }
    }

    /**
     * Check file size thresholds for corruption indicators
     * @param {Object} analysis - Analysis object to update
     */
    checkSizeThresholds(analysis) {
        const { size, type } = analysis;

        // Check maximum size limits
        if (type === 'archive' && size > this.sizeThresholds.maxArchiveSize) {
            analysis.issues.push(`Archive file is too large (${this.formatBytes(size)} > ${this.formatBytes(this.sizeThresholds.maxArchiveSize)})`);
        }

        if (type === 'fingerprint' && size > this.sizeThresholds.maxFingerprintSize) {
            analysis.issues.push(`Fingerprint file is too large (${this.formatBytes(size)} > ${this.formatBytes(this.sizeThresholds.maxFingerprintSize)})`);
        }

        // Check for suspiciously large files
        if (size > this.sizeThresholds.suspiciouslyLarge) {
            analysis.issues.push(`File is suspiciously large (${this.formatBytes(size)}), may contain sync data`);
        }

        // Check for suspiciously small files (might be corrupted)
        if (size < this.sizeThresholds.suspiciouslySmall && type !== 'lock') {
            analysis.issues.push(`File is suspiciously small (${this.formatBytes(size)}), may be corrupted`);
        }
    }

    /**
     * Check file age thresholds
     * @param {Object} analysis - Analysis object to update
     */
    checkAgeThresholds(analysis) {
        const { age, type } = analysis;

        // Check for very old files that might be stale
        if (age > this.ageThresholds.maxAge) {
            analysis.issues.push(`File is very old (${this.formatDuration(age)}), may be stale`);
        }

        // Check for stale lock files
        if (type === 'lock' && age > this.ageThresholds.lockFileAge) {
            analysis.issues.push(`Lock file is stale (${this.formatDuration(age)}), sync may have crashed`);
        }
    }

    /**
     * Check file accessibility and basic content validation
     * @param {Object} analysis - Analysis object to update
     */
    checkFileAccessibility(analysis) {
        try {
            const { path: filePath } = analysis;

            // Check if file is readable
            fs.accessSync(filePath, fs.constants.R_OK);

            // For non-lock files, try to read a small portion to check for corruption
            if (analysis.type !== 'lock' && analysis.size > 0) {
                const fd = fs.openSync(filePath, 'r');
                const buffer = Buffer.alloc(Math.min(1024, analysis.size));
                const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
                fs.closeSync(fd);

                // Check for null bytes or other corruption indicators
                if (bytesRead === 0 && analysis.size > 0) {
                    analysis.issues.push('File appears to be empty despite non-zero size');
                }

                // Check for excessive null bytes (might indicate corruption)
                const nullBytes = buffer.subarray(0, bytesRead).filter(byte => byte === 0).length;
                if (nullBytes > bytesRead * 0.5) {
                    analysis.issues.push('File contains excessive null bytes, may be corrupted');
                }
            }

        } catch (error) {
            analysis.issues.push(`File accessibility error: ${error.message}`);
        }
    }

    /**
     * Check for specific corruption patterns in archive files
     * @param {Object} analysis - Analysis object to update
     */
    checkCorruptionPatterns(analysis) {
        try {
            const { path: filePath, type, size } = analysis;

            // Skip pattern checking for very large files to avoid performance issues
            if (size > 10 * 1024 * 1024) { // 10MB
                return;
            }

            // Read first few KB to check for corruption patterns
            const fd = fs.openSync(filePath, 'r');
            const sampleSize = Math.min(4096, size); // 4KB sample
            const buffer = Buffer.alloc(sampleSize);
            const bytesRead = fs.readSync(fd, buffer, 0, sampleSize, 0);
            fs.closeSync(fd);

            if (bytesRead === 0) {
                return;
            }

            const content = buffer.subarray(0, bytesRead).toString('binary');

            // Check for text content in binary files (corruption indicator)
            if (type === 'archive' || type === 'fingerprint') {
                // Look for patterns that suggest the file contains sync data instead of binary archive data
                const textPatterns = [
                    /^(changed|deleted|created|modified)/m,
                    /^\d{4}-\d{2}-\d{2}/m,
                    /^(local|remote)/m,
                    /^props\s+/m,
                    /^archive\s+/m
                ];

                for (const pattern of textPatterns) {
                    if (pattern.test(content)) {
                        analysis.issues.push('Archive file contains text data instead of binary data, likely corrupted');
                        break;
                    }
                }
            }

            // Check for repeated patterns that might indicate corruption
            const repeatedPattern = this.detectRepeatedPatterns(content);
            if (repeatedPattern) {
                analysis.issues.push(`File contains repeated patterns, may be corrupted: ${repeatedPattern}`);
            }

        } catch (error) {
            // Don't add this as an issue since it might be a legitimate binary file
            this.log('DEBUG', `Could not check corruption patterns for ${analysis.filename}: ${error.message}`);
        }
    }

    /**
     * Detect repeated patterns in content that might indicate corruption
     * @param {string} content - File content to analyze
     * @returns {string|null} Description of repeated pattern or null
     */
    detectRepeatedPatterns(content) {
        // Check for repeated null bytes
        const nullBytePattern = /\0{100,}/;
        if (nullBytePattern.test(content)) {
            return 'excessive null bytes';
        }

        // Check for repeated characters
        const repeatedCharPattern = /(.)\1{200,}/;
        const match = content.match(repeatedCharPattern);
        if (match) {
            const char = match[1];
            const charCode = char.charCodeAt(0);
            return `repeated character (code: ${charCode})`;
        }

        return null;
    }

    /**
     * Remove corrupted archive files with backup
     * @param {Array} corruptedArchives - Array of corrupted archive objects
     * @param {boolean} dryRun - If true, only report what would be done
     * @returns {Object} Cleanup result
     */
    removeCorruptedArchives(corruptedArchives, dryRun = false) {
        try {
            this.log('INFO', `${dryRun ? 'Dry run: ' : ''}Removing ${corruptedArchives.length} corrupted archives`);

            const results = {
                success: true,
                processed: [],
                failed: [],
                backed_up: [],
                dryRun
            };

            for (const archive of corruptedArchives) {
                try {
                    const result = {
                        filename: archive.filename,
                        path: archive.path,
                        type: archive.type,
                        size: archive.size,
                        issues: archive.issues
                    };

                    if (dryRun) {
                        result.action = 'would_remove';
                        result.message = `Would remove corrupted ${archive.type} file: ${archive.filename}`;
                        results.processed.push(result);
                        continue;
                    }

                    // Create backup before removal
                    const backupResult = this.backupArchiveFile(archive.path);
                    if (backupResult.success) {
                        result.backupPath = backupResult.backupPath;
                        results.backed_up.push(result.filename);
                    } else {
                        this.log('WARN', `Failed to backup ${archive.filename}: ${backupResult.message}`);
                        result.backupWarning = backupResult.message;
                    }

                    // Remove the corrupted file
                    fs.unlinkSync(archive.path);

                    result.action = 'removed';
                    result.message = `Successfully removed corrupted ${archive.type} file: ${archive.filename}`;
                    results.processed.push(result);

                    this.log('INFO', result.message);

                } catch (error) {
                    const failResult = {
                        filename: archive.filename,
                        path: archive.path,
                        error: error.message,
                        message: `Failed to remove ${archive.filename}: ${error.message}`
                    };
                    results.failed.push(failResult);
                    results.success = false;

                    this.log('ERROR', failResult.message);
                }
            }

            const summary = dryRun ?
                `Dry run completed: Would process ${results.processed.length} files` :
                `Cleanup completed: ${results.processed.length} removed, ${results.failed.length} failed`;

            return {
                ...results,
                message: summary
            };

        } catch (error) {
            this.log('ERROR', `Error removing corrupted archives: ${error.message}`);
            return {
                success: false,
                error: error.message,
                message: `Error removing corrupted archives: ${error.message}`
            };
        }
    }

    /**
     * Create backup of archive file before removal
     * @param {string} archivePath - Path to archive file to backup
     * @returns {Object} Backup result
     */
    backupArchiveFile(archivePath) {
        try {
            if (!fs.existsSync(archivePath)) {
                return {
                    success: false,
                    message: `Archive file does not exist: ${archivePath}`
                };
            }

            const filename = path.basename(archivePath);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `${filename}.backup.${timestamp}`;
            const backupPath = path.join(this.backupDir, backupFileName);

            // Copy the file
            fs.copyFileSync(archivePath, backupPath);

            // Verify backup was created successfully
            if (fs.existsSync(backupPath)) {
                const originalStats = fs.statSync(archivePath);
                const backupStats = fs.statSync(backupPath);

                if (originalStats.size === backupStats.size) {
                    return {
                        success: true,
                        backupPath,
                        message: `Archive backed up to: ${backupPath}`
                    };
                } else {
                    return {
                        success: false,
                        message: `Backup verification failed: size mismatch`
                    };
                }
            } else {
                return {
                    success: false,
                    message: `Backup file was not created: ${backupPath}`
                };
            }

        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: `Error creating backup: ${error.message}`
            };
        }
    }

    /**
     * Selective archive cleanup for specific profiles
     * @param {string} profileName - Profile name to clean archives for
     * @param {boolean} dryRun - If true, only report what would be done
     * @returns {Object} Cleanup result
     */
    cleanupProfileArchives(profileName, dryRun = false) {
        try {
            this.log('INFO', `${dryRun ? 'Dry run: ' : ''}Cleaning archives for profile: ${profileName}`);

            // First detect corrupted archives for this profile
            const detectionResult = this.detectCorruptedArchives(profileName);
            if (!detectionResult.success) {
                return detectionResult;
            }

            if (detectionResult.corruptedCount === 0) {
                return {
                    success: true,
                    profileName,
                    message: `No corrupted archives found for profile: ${profileName}`
                };
            }

            // Remove the corrupted archives
            const cleanupResult = this.removeCorruptedArchives(detectionResult.corruptedArchives, dryRun);

            return {
                ...cleanupResult,
                profileName,
                detectionResult,
                message: `Profile ${profileName} archive cleanup: ${cleanupResult.message}`
            };

        } catch (error) {
            this.log('ERROR', `Error cleaning profile archives: ${error.message}`);
            return {
                success: false,
                profileName,
                error: error.message,
                message: `Error cleaning archives for profile ${profileName}: ${error.message}`
            };
        }
    }

    /**
     * Validate that new archives are created correctly after cleanup
     * @param {string} profileName - Profile name to validate
     * @param {number} timeoutMs - Timeout in milliseconds to wait for new archives
     * @returns {Object} Validation result
     */
    validateNewArchives(profileName, timeoutMs = 30000) {
        try {
            this.log('INFO', `Validating new archives for profile: ${profileName}`);

            const startTime = Date.now();
            const initialArchives = this.getCurrentArchives(profileName);

            // Wait for new archives to be created (this would typically happen during a sync)
            const checkInterval = 1000; // Check every second
            let newArchivesDetected = false;

            while (Date.now() - startTime < timeoutMs && !newArchivesDetected) {
                // Sleep for check interval
                const sleepStart = Date.now();
                while (Date.now() - sleepStart < checkInterval) {
                    // Busy wait (in a real implementation, you might use setTimeout)
                }

                const currentArchives = this.getCurrentArchives(profileName);

                // Check if new archives have been created
                const newArchives = currentArchives.filter(current =>
                    !initialArchives.some(initial => initial.filename === current.filename)
                );

                if (newArchives.length > 0) {
                    newArchivesDetected = true;

                    // Validate the new archives
                    const validationResults = [];
                    for (const archive of newArchives) {
                        const analysis = this.analyzeArchiveFile(archive.path, profileName);
                        validationResults.push({
                            filename: archive.filename,
                            isValid: !analysis.isCorrupted,
                            issues: analysis.issues,
                            size: analysis.size,
                            type: analysis.type
                        });
                    }

                    const validArchives = validationResults.filter(r => r.isValid);
                    const invalidArchives = validationResults.filter(r => !r.isValid);

                    return {
                        success: invalidArchives.length === 0,
                        profileName,
                        newArchivesCount: newArchives.length,
                        validCount: validArchives.length,
                        invalidCount: invalidArchives.length,
                        validationResults,
                        waitTime: Date.now() - startTime,
                        message: invalidArchives.length === 0 ?
                            `All ${newArchives.length} new archives are valid` :
                            `${invalidArchives.length} of ${newArchives.length} new archives are invalid`
                    };
                }
            }

            // Timeout reached without detecting new archives
            return {
                success: false,
                profileName,
                timeout: true,
                waitTime: timeoutMs,
                message: `Timeout: No new archives detected for profile ${profileName} within ${timeoutMs}ms`
            };

        } catch (error) {
            this.log('ERROR', `Error validating new archives: ${error.message}`);
            return {
                success: false,
                profileName,
                error: error.message,
                message: `Error validating new archives: ${error.message}`
            };
        }
    }

    /**
     * Get current archive files for a profile
     * @param {string} profileName - Profile name
     * @returns {Array} Array of current archive objects
     */
    getCurrentArchives(profileName) {
        try {
            if (!fs.existsSync(this.unisonDir)) {
                return [];
            }

            const files = fs.readdirSync(this.unisonDir);
            const archiveFiles = this.identifyArchiveFiles(files);
            const archives = [];

            for (const file of archiveFiles) {
                const filePath = path.join(this.unisonDir, file);
                const relatedProfile = this.determineRelatedProfile(file, filePath);

                if (!profileName || relatedProfile === profileName) {
                    const stats = fs.statSync(filePath);
                    archives.push({
                        filename: file,
                        path: filePath,
                        type: this.getArchiveType(file),
                        size: stats.size,
                        mtime: stats.mtime,
                        relatedProfile
                    });
                }
            }

            return archives;

        } catch (error) {
            this.log('ERROR', `Error getting current archives: ${error.message}`);
            return [];
        }
    }

    /**
     * Format bytes to human readable string
     * @param {number} bytes - Number of bytes
     * @returns {string} Formatted string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Format duration to human readable string
     * @param {number} ms - Duration in milliseconds
     * @returns {string} Formatted string
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} days`;
        if (hours > 0) return `${hours} hours`;
        if (minutes > 0) return `${minutes} minutes`;
        return `${seconds} seconds`;
    }

    /**
     * Get archive cleanup summary and recommendations
     * @returns {Object} Summary and recommendations
     */
    getCleanupSummary() {
        try {
            const detectionResult = this.detectCorruptedArchives();
            if (!detectionResult.success) {
                return detectionResult;
            }

            const summary = {
                totalArchives: detectionResult.totalArchives,
                corruptedCount: detectionResult.corruptedCount,
                healthyCount: detectionResult.totalArchives - detectionResult.corruptedCount,
                corruptedArchives: detectionResult.corruptedArchives,
                recommendations: []
            };

            // Generate recommendations
            if (summary.corruptedCount === 0) {
                summary.recommendations.push('All archive files appear to be healthy');
                summary.recommendations.push('No cleanup action required');
            } else {
                summary.recommendations.push(`${summary.corruptedCount} corrupted archives detected`);
                summary.recommendations.push('Run cleanup to remove corrupted archives');
                summary.recommendations.push('Consider running a fresh sync after cleanup');

                // Profile-specific recommendations
                const profileGroups = {};
                for (const archive of summary.corruptedArchives) {
                    const profile = archive.relatedProfile || 'unknown';
                    if (!profileGroups[profile]) {
                        profileGroups[profile] = [];
                    }
                    profileGroups[profile].push(archive);
                }

                for (const [profile, archives] of Object.entries(profileGroups)) {
                    summary.recommendations.push(`Profile '${profile}': ${archives.length} corrupted archives`);
                }
            }

            return {
                success: true,
                summary,
                message: `Archive summary: ${summary.healthyCount} healthy, ${summary.corruptedCount} corrupted`
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: `Error generating cleanup summary: ${error.message}`
            };
        }
    }
}

// Export the class
export default ArchiveManager;

// CLI interface when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const manager = new ArchiveManager();

    const command = process.argv[2];
    const profileName = process.argv[3];
    const dryRunFlag = process.argv.includes('--dry-run');

    switch (command) {
        case 'detect':
            const detectResult = manager.detectCorruptedArchives(profileName);
            console.log(JSON.stringify(detectResult, null, 2));
            break;

        case 'cleanup':
            if (profileName) {
                const profileCleanupResult = manager.cleanupProfileArchives(profileName, dryRunFlag);
                console.log(JSON.stringify(profileCleanupResult, null, 2));
            } else {
                const detectionResult = manager.detectCorruptedArchives();
                if (detectionResult.success && detectionResult.corruptedCount > 0) {
                    const cleanupResult = manager.removeCorruptedArchives(detectionResult.corruptedArchives, dryRunFlag);
                    console.log(JSON.stringify(cleanupResult, null, 2));
                } else {
                    console.log(JSON.stringify(detectionResult, null, 2));
                }
            }
            break;

        case 'validate':
            if (!profileName) {
                console.error('Profile name required for validate command');
                process.exit(1);
            }
            const validateResult = manager.validateNewArchives(profileName);
            console.log(JSON.stringify(validateResult, null, 2));
            break;

        case 'summary':
            const summaryResult = manager.getCleanupSummary();
            console.log(JSON.stringify(summaryResult, null, 2));
            break;

        default:
            console.log(`
Unison Archive Manager

Usage: node archive_manager.js <command> [profile_name] [options]

Commands:
    detect [profile_name]        - Detect corrupted archive files
    cleanup [profile_name]       - Clean up corrupted archives
    validate <profile_name>      - Validate new archives after cleanup
    summary                      - Get cleanup summary and recommendations

Options:
    --dry-run                    - Show what would be done without making changes

Examples:
    node archive_manager.js detect
    node archive_manager.js detect icloud
    node archive_manager.js cleanup --dry-run
    node archive_manager.js cleanup icloud
    node archive_manager.js validate google_drive
    node archive_manager.js summary
            `);
            break;
    }
}