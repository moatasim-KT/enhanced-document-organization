#!/usr/bin/env node

/**
 * Sync Root Path Validator Module
 * 
 * This module provides functions to:
 * 1. Verify source root is exactly Sync_Hub_New directory
 * 2. Validate cloud storage destination paths (iCloud and Google Drive)
 * 3. Create safety check to prevent home directory root sync
 * 
 * Requirements: 3.1, 3.2, 3.3
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

class SyncRootValidator {
    constructor() {
        this.homeDir = os.homedir();
        this.expectedSourceRoot = path.join(this.homeDir, 'Sync_Hub_New');

        // Define valid cloud storage destination patterns
        this.validDestinations = {
            icloud: {
                pattern: /^\/Users\/[^\/]+\/Library\/Mobile Documents\/iCloud~[^\/]+\/Documents\/Sync$/,
                example: '/Users/username/Library/Mobile Documents/iCloud~md~obsidian/Documents/Sync'
            },
            google_drive: {
                pattern: /^\/Users\/[^\/]+\/Library\/CloudStorage\/GoogleDrive-[^\/]+\/My Drive\/Sync$/,
                example: '/Users/username/Library/CloudStorage/GoogleDrive-email@gmail.com/My Drive/Sync'
            }
        };

        // Define dangerous root patterns that should never be synced
        this.dangerousRootPatterns = [
            /^\/$/,                           // Root directory
            /^\/Users\/[^\/]+\/?$/,          // Home directory
            /^\/Users\/[^\/]+\/Desktop\/?$/, // Desktop
            /^\/Users\/[^\/]+\/Documents\/?$/, // Documents root
            /^\/System/,                      // System directories
            /^\/Library/,                     // System Library
            /^\/Applications/,                // Applications
            /^\/usr/,                         // System usr
            /^\/var/,                         // System var
            /^\/tmp/,                         // Temporary directory
            /^\/private/                      // Private system directories
        ];
    }

    /**
     * Log messages with timestamp
     * @param {string} level - Log level (INFO, WARN, ERROR)
     * @param {string} message - Message to log
     */
    log(level, message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [SYNC_ROOT_VALIDATOR] [${level}] ${message}`);
    }

    /**
     * Validate that source root is exactly the Sync_Hub_New directory
     * @param {string} sourcePath - Source path to validate
     * @returns {Object} Validation result with isValid flag and details
     */
    validateSourceRoot(sourcePath) {
        try {
            // Clean and normalize the path
            const cleanPath = this.cleanPath(sourcePath);
            const normalizedPath = path.isAbsolute(cleanPath) ? cleanPath : path.resolve(cleanPath);
            const expectedPath = path.resolve(this.expectedSourceRoot);

            this.log('INFO', `Validating source root: ${normalizedPath}`);
            this.log('INFO', `Expected source root: ${expectedPath}`);

            const validation = {
                isValid: false,
                path: normalizedPath,
                expectedPath,
                issues: [],
                warnings: []
            };

            // Check if path exists
            if (!fs.existsSync(normalizedPath)) {
                validation.issues.push(`Source path does not exist: ${normalizedPath}`);
                return {
                    ...validation,
                    message: `Source path validation failed: Path does not exist`
                };
            }

            // Check if it's a directory
            const stats = fs.statSync(normalizedPath);
            if (!stats.isDirectory()) {
                validation.issues.push(`Source path is not a directory: ${normalizedPath}`);
                return {
                    ...validation,
                    message: `Source path validation failed: Not a directory`
                };
            }

            // Check if it matches exactly the expected Sync_Hub_New directory
            if (normalizedPath !== expectedPath) {
                validation.issues.push(`Source path must be exactly: ${expectedPath}`);
                validation.issues.push(`Provided path: ${normalizedPath}`);

                // Check if it's a subdirectory or parent directory
                if (normalizedPath.startsWith(expectedPath)) {
                    validation.warnings.push(`Path is a subdirectory of expected source root`);
                } else if (expectedPath.startsWith(normalizedPath)) {
                    validation.warnings.push(`Path is a parent directory of expected source root`);
                }

                return {
                    ...validation,
                    message: `Source path validation failed: Path must be exactly ${expectedPath}`
                };
            }

            // Check for dangerous root patterns
            const dangerousCheck = this.checkDangerousRootPatterns(normalizedPath);
            if (!dangerousCheck.isSafe) {
                validation.issues.push(...dangerousCheck.issues);
                return {
                    ...validation,
                    message: `Source path validation failed: ${dangerousCheck.message}`
                };
            }

            // Validation passed
            validation.isValid = true;
            this.log('INFO', `Source root validation passed: ${normalizedPath}`);

            return {
                ...validation,
                message: `Source root validation passed`
            };

        } catch (error) {
            this.log('ERROR', `Error validating source root: ${error.message}`);
            return {
                isValid: false,
                path: sourcePath,
                error: error.message,
                message: `Error validating source root: ${error.message}`
            };
        }
    }

    /**
     * Validate cloud storage destination paths
     * @param {string} destinationPath - Destination path to validate
     * @param {string} cloudService - Cloud service type ('icloud' or 'google_drive')
     * @returns {Object} Validation result with isValid flag and details
     */
    validateDestinationRoot(destinationPath, cloudService = null) {
        try {
            const cleanPath = this.cleanPath(destinationPath);
            const normalizedPath = path.isAbsolute(cleanPath) ? cleanPath : path.resolve(cleanPath);

            this.log('INFO', `Validating destination root: ${normalizedPath}`);
            if (cloudService) {
                this.log('INFO', `Expected cloud service: ${cloudService}`);
            }

            const validation = {
                isValid: false,
                path: normalizedPath,
                cloudService: cloudService,
                detectedService: null,
                issues: [],
                warnings: []
            };

            // Check for dangerous root patterns first
            const dangerousCheck = this.checkDangerousRootPatterns(normalizedPath);
            if (!dangerousCheck.isSafe) {
                validation.issues.push(...dangerousCheck.issues);
                return {
                    ...validation,
                    message: `Destination path validation failed: ${dangerousCheck.message}`
                };
            }

            // Detect cloud service type from path
            const detectedService = this.detectCloudService(normalizedPath);
            validation.detectedService = detectedService;

            if (!detectedService) {
                validation.issues.push(`Path does not match any known cloud storage pattern`);
                validation.issues.push(`Supported patterns:`);
                Object.entries(this.validDestinations).forEach(([service, config]) => {
                    validation.issues.push(`  ${service}: ${config.example}`);
                });
                return {
                    ...validation,
                    message: `Destination path validation failed: Unknown cloud storage pattern`
                };
            }

            // If cloud service was specified, verify it matches detected service
            if (cloudService && cloudService !== detectedService) {
                validation.issues.push(`Specified cloud service '${cloudService}' does not match detected service '${detectedService}'`);
                return {
                    ...validation,
                    message: `Destination path validation failed: Service mismatch`
                };
            }

            // Validate path format for the detected service
            const serviceConfig = this.validDestinations[detectedService];
            if (!serviceConfig.pattern.test(normalizedPath)) {
                validation.issues.push(`Path format is invalid for ${detectedService}`);
                validation.issues.push(`Expected pattern: ${serviceConfig.example}`);
                return {
                    ...validation,
                    message: `Destination path validation failed: Invalid format for ${detectedService}`
                };
            }

            // Check if parent directory exists (destination might not exist yet)
            const parentDir = path.dirname(normalizedPath);
            if (!fs.existsSync(parentDir)) {
                validation.warnings.push(`Parent directory does not exist: ${parentDir}`);
                validation.warnings.push(`This may indicate the cloud service is not properly set up`);
            }

            // If destination exists, verify it's a directory
            if (fs.existsSync(normalizedPath)) {
                const stats = fs.statSync(normalizedPath);
                if (!stats.isDirectory()) {
                    validation.issues.push(`Destination path exists but is not a directory: ${normalizedPath}`);
                    return {
                        ...validation,
                        message: `Destination path validation failed: Not a directory`
                    };
                }
                this.log('INFO', `Destination directory exists and is valid`);
            } else {
                validation.warnings.push(`Destination directory does not exist yet: ${normalizedPath}`);
                validation.warnings.push(`It will be created during sync if parent directory exists`);
            }

            // Validation passed
            validation.isValid = true;
            validation.cloudService = detectedService;
            this.log('INFO', `Destination root validation passed: ${normalizedPath} (${detectedService})`);

            return {
                ...validation,
                message: `Destination root validation passed for ${detectedService}`
            };

        } catch (error) {
            this.log('ERROR', `Error validating destination root: ${error.message}`);
            return {
                isValid: false,
                path: destinationPath,
                error: error.message,
                message: `Error validating destination root: ${error.message}`
            };
        }
    }

    /**
     * Create safety check to prevent home directory root sync
     * @param {string} rootPath - Root path to check for safety
     * @returns {Object} Safety check result with isSafe flag and details
     */
    checkDangerousRootPatterns(rootPath) {
        try {
            const cleanPath = this.cleanPath(rootPath);
            const normalizedPath = path.isAbsolute(cleanPath) ? cleanPath : path.resolve(cleanPath);

            this.log('INFO', `Checking for dangerous root patterns: ${normalizedPath}`);

            const safetyCheck = {
                isSafe: true,
                path: normalizedPath,
                issues: [],
                matchedPatterns: []
            };

            // Check against each dangerous pattern with specific error messages
            for (let i = 0; i < this.dangerousRootPatterns.length; i++) {
                const pattern = this.dangerousRootPatterns[i];
                if (pattern.test(normalizedPath)) {
                    safetyCheck.isSafe = false;
                    safetyCheck.matchedPatterns.push(pattern.toString());

                    // Add specific error messages based on pattern index
                    switch (i) {
                        case 0: // Root directory
                            safetyCheck.issues.push('Cannot sync from root directory (/)');
                            break;
                        case 1: // Home directory
                            safetyCheck.issues.push('Cannot sync from home directory root');
                            break;
                        case 2: // Desktop
                            safetyCheck.issues.push('Cannot sync from Desktop directory');
                            break;
                        case 3: // Documents root
                            safetyCheck.issues.push('Cannot sync from Documents root directory');
                            break;
                        case 4: // System directories
                        case 5: // Library
                        case 6: // Applications
                        case 7: // usr
                        case 8: // var
                        case 9: // tmp
                        case 10: // private
                            safetyCheck.issues.push('Cannot sync from system directories');
                            break;
                        default:
                            safetyCheck.issues.push(`Path matches dangerous pattern: ${pattern}`);
                    }
                }
            }

            if (!safetyCheck.isSafe) {
                this.log('ERROR', `Dangerous root pattern detected: ${normalizedPath}`);
                return {
                    ...safetyCheck,
                    message: `Dangerous root path detected: ${safetyCheck.issues.join('; ')}`
                };
            }

            this.log('INFO', `Root path safety check passed: ${normalizedPath}`);
            return {
                ...safetyCheck,
                message: 'Root path safety check passed'
            };

        } catch (error) {
            this.log('ERROR', `Error checking dangerous root patterns: ${error.message}`);
            return {
                isSafe: false,
                path: rootPath,
                error: error.message,
                message: `Error checking root path safety: ${error.message}`
            };
        }
    }

    /**
     * Detect cloud service type from destination path
     * @param {string} destinationPath - Destination path to analyze
     * @returns {string|null} Detected cloud service type or null
     */
    detectCloudService(destinationPath) {
        const normalizedPath = path.isAbsolute(destinationPath) ? destinationPath : path.resolve(destinationPath);

        for (const [service, config] of Object.entries(this.validDestinations)) {
            if (config.pattern.test(normalizedPath)) {
                return service;
            }
        }

        return null;
    }

    /**
     * Clean and normalize path string
     * @param {string} pathString - Path string to clean
     * @returns {string} Cleaned path string
     */
    cleanPath(pathString) {
        if (!pathString || typeof pathString !== 'string') {
            throw new Error('Path must be a non-empty string');
        }

        // Remove quotes and trim whitespace
        return pathString.replace(/^["']|["']$/g, '').trim();
    }

    /**
     * Validate complete sync configuration (source and destination)
     * @param {string} sourcePath - Source root path
     * @param {string} destinationPath - Destination root path
     * @param {string} cloudService - Optional cloud service type
     * @returns {Object} Complete validation result
     */
    validateSyncConfiguration(sourcePath, destinationPath, cloudService = null) {
        try {
            this.log('INFO', `Validating complete sync configuration`);
            this.log('INFO', `Source: ${sourcePath}`);
            this.log('INFO', `Destination: ${destinationPath}`);

            const validation = {
                isValid: false,
                source: null,
                destination: null,
                issues: [],
                warnings: []
            };

            // Validate source root
            const sourceValidation = this.validateSourceRoot(sourcePath);
            validation.source = sourceValidation;

            if (!sourceValidation.isValid) {
                validation.issues.push(`Source validation failed: ${sourceValidation.message}`);
            }

            // Validate destination root
            const destinationValidation = this.validateDestinationRoot(destinationPath, cloudService);
            validation.destination = destinationValidation;

            if (!destinationValidation.isValid) {
                validation.issues.push(`Destination validation failed: ${destinationValidation.message}`);
            }

            // Collect warnings
            if (sourceValidation.warnings) {
                validation.warnings.push(...sourceValidation.warnings);
            }
            if (destinationValidation.warnings) {
                validation.warnings.push(...destinationValidation.warnings);
            }

            // Overall validation result
            validation.isValid = sourceValidation.isValid && destinationValidation.isValid;

            if (validation.isValid) {
                this.log('INFO', `Complete sync configuration validation passed`);
                return {
                    ...validation,
                    message: `Sync configuration validation passed`
                };
            } else {
                this.log('ERROR', `Complete sync configuration validation failed`);
                return {
                    ...validation,
                    message: `Sync configuration validation failed: ${validation.issues.join('; ')}`
                };
            }

        } catch (error) {
            this.log('ERROR', `Error validating sync configuration: ${error.message}`);
            return {
                isValid: false,
                error: error.message,
                message: `Error validating sync configuration: ${error.message}`
            };
        }
    }

    /**
     * Get sync path recommendations based on current system
     * @returns {Object} Recommended sync paths
     */
    getSyncPathRecommendations() {
        const username = os.userInfo().username;

        return {
            source: {
                recommended: this.expectedSourceRoot,
                description: 'Dedicated sync directory for document organization'
            },
            destinations: {
                icloud: {
                    recommended: `/Users/${username}/Library/Mobile Documents/iCloud~md~obsidian/Documents/Sync`,
                    description: 'iCloud Drive sync location for Obsidian',
                    requirements: ['iCloud Drive enabled', 'Obsidian app installed']
                },
                google_drive: {
                    recommended: `/Users/${username}/Library/CloudStorage/GoogleDrive-email@gmail.com/My Drive/Sync`,
                    description: 'Google Drive sync location',
                    requirements: ['Google Drive app installed', 'Replace email@gmail.com with actual email']
                }
            },
            notes: [
                'Source must be exactly the Sync_Hub_New directory',
                'Destination paths depend on your cloud service setup',
                'Never sync from home directory root or system directories',
                'Ensure cloud service apps are properly configured before syncing'
            ]
        };
    }
}

// Export the class
export default SyncRootValidator;

// CLI interface when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const validator = new SyncRootValidator();

    const command = process.argv[2];
    const arg1 = process.argv[3];
    const arg2 = process.argv[4];
    const arg3 = process.argv[5];

    switch (command) {
        case 'validate-source':
            if (!arg1) {
                console.error('Source path required for validate-source command');
                process.exit(1);
            }
            const sourceResult = validator.validateSourceRoot(arg1);
            console.log(JSON.stringify(sourceResult, null, 2));
            break;

        case 'validate-destination':
            if (!arg1) {
                console.error('Destination path required for validate-destination command');
                process.exit(1);
            }
            const destResult = validator.validateDestinationRoot(arg1, arg2);
            console.log(JSON.stringify(destResult, null, 2));
            break;

        case 'validate-config':
            if (!arg1 || !arg2) {
                console.error('Both source and destination paths required for validate-config command');
                process.exit(1);
            }
            const configResult = validator.validateSyncConfiguration(arg1, arg2, arg3);
            console.log(JSON.stringify(configResult, null, 2));
            break;

        case 'check-safety':
            if (!arg1) {
                console.error('Path required for check-safety command');
                process.exit(1);
            }
            const safetyResult = validator.checkDangerousRootPatterns(arg1);
            console.log(JSON.stringify(safetyResult, null, 2));
            break;

        case 'recommendations':
            const recommendations = validator.getSyncPathRecommendations();
            console.log(JSON.stringify(recommendations, null, 2));
            break;

        default:
            console.log(`
Sync Root Path Validator

Usage: node sync_root_validator.js <command> [arguments]

Commands:
    validate-source <source_path>                    - Validate source root path
    validate-destination <dest_path> [cloud_service] - Validate destination root path
    validate-config <source_path> <dest_path> [cloud_service] - Validate complete sync configuration
    check-safety <path>                              - Check if path is safe for syncing
    recommendations                                  - Get recommended sync paths

Examples:
    node sync_root_validator.js validate-source /Users/username/Sync_Hub_New
    node sync_root_validator.js validate-destination "/Users/username/Library/Mobile Documents/iCloud~md~obsidian/Documents/Sync" icloud
    node sync_root_validator.js validate-config /Users/username/Sync_Hub_New "/Users/username/Library/CloudStorage/GoogleDrive-email@gmail.com/My Drive/Sync" google_drive
    node sync_root_validator.js check-safety /Users/username
    node sync_root_validator.js recommendations
            `);
            break;
    }
}