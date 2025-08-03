#!/usr/bin/env node

/**
 * Dry-Run Preview Module
 * 
 * Implements dry-run preview functionality for sync operations.
 * Shows what files would be synced, which files are ignored, and provides
 * a comprehensive summary without performing actual file transfer.
 */

import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';

class DryRunPreview {
    constructor(projectDir) {
        this.projectDir = projectDir;
        this.configFile = path.join(projectDir, 'config', 'config.env');
        this.config = this.loadConfig();
        this.logFile = path.join(projectDir, 'logs', 'dry_run.log');

        // Ensure logs directory exists
        const logsDir = path.dirname(this.logFile);
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
    }

    /**
     * Load configuration from config.env file
     */
    loadConfig() {
        if (!fs.existsSync(this.configFile)) {
            throw new Error(`Config file not found: ${this.configFile}`);
        }

        const configContent = fs.readFileSync(this.configFile, 'utf8');
        const config = {};

        configContent.split('\n').forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#') && line.includes('=')) {
                const [key, ...valueParts] = line.split('=');
                const value = valueParts.join('=').replace(/^["']|["']$/g, '');
                config[key.trim()] = value.trim();
            }
        });

        return config;
    }

    /**
     * Log messages to both console and file
     */
    log(level, message) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const logMessage = `[${timestamp}] [${level}] ${message}`;

        console.log(logMessage);

        try {
            fs.appendFileSync(this.logFile, logMessage + '\n');
        } catch (error) {
            console.error(`Failed to write to log file: ${error.message}`);
        }
    }

    /**
     * Parse Unison profile to extract ignore patterns
     */
    parseUnisonProfile(profileName) {
        const profilePath = path.join(process.env.HOME, '.unison', `${profileName}.prf`);

        if (!fs.existsSync(profilePath)) {
            throw new Error(`Unison profile not found: ${profilePath}`);
        }

        const profileContent = fs.readFileSync(profilePath, 'utf8');
        const ignorePatterns = [];
        const roots = [];

        profileContent.split('\n').forEach(line => {
            line = line.trim();
            if (line.startsWith('ignore = ')) {
                const pattern = line.substring('ignore = '.length);
                ignorePatterns.push(pattern);
            } else if (line.startsWith('root = ')) {
                const root = line.substring('root = '.length);
                roots.push(root);
            }
        });

        return { ignorePatterns, roots, profilePath };
    }

    /**
     * Get all files in a directory recursively
     */
    getAllFiles(dirPath, relativeTo = dirPath) {
        const files = [];

        if (!fs.existsSync(dirPath)) {
            return files;
        }

        const traverse = (currentPath) => {
            try {
                const items = fs.readdirSync(currentPath);

                for (const item of items) {
                    const fullPath = path.join(currentPath, item);
                    const relativePath = path.relative(relativeTo, fullPath);

                    try {
                        const stats = fs.statSync(fullPath);

                        if (stats.isDirectory()) {
                            files.push({
                                path: relativePath,
                                fullPath: fullPath,
                                type: 'directory',
                                size: 0,
                                modified: stats.mtime
                            });
                            traverse(fullPath);
                        } else if (stats.isFile()) {
                            files.push({
                                path: relativePath,
                                fullPath: fullPath,
                                type: 'file',
                                size: stats.size,
                                modified: stats.mtime
                            });
                        }
                    } catch (statError) {
                        // Skip files that can't be accessed
                        this.log('WARN', `Cannot access: ${fullPath} - ${statError.message}`);
                    }
                }
            } catch (readError) {
                this.log('WARN', `Cannot read directory: ${currentPath} - ${readError.message}`);
            }
        };

        traverse(dirPath);
        return files;
    }

    /**
     * Check if a file matches any ignore pattern
     */
    matchesIgnorePattern(filePath, ignorePatterns) {
        const fileName = path.basename(filePath);
        const dirName = path.dirname(filePath);

        for (const pattern of ignorePatterns) {
            // Handle different Unison ignore pattern types
            if (pattern.startsWith('Name ')) {
                const namePattern = pattern.substring(5);

                // Handle wildcard patterns
                if (namePattern.includes('*')) {
                    // Convert Unison wildcard pattern to regex
                    const regexPattern = namePattern
                        .replace(/\./g, '\\.')  // Escape dots
                        .replace(/\*/g, '.*');  // Convert * to .*

                    try {
                        const regex = new RegExp(`^${regexPattern}$`);
                        if (regex.test(fileName)) {
                            return { matched: true, pattern };
                        }
                    } catch (regexError) {
                        this.log('WARN', `Invalid wildcard pattern: ${namePattern}`);
                    }
                } else {
                    // Exact name match or path contains pattern
                    if (fileName === namePattern || filePath.includes(`/${namePattern}/`) || filePath.includes(`/${namePattern}`)) {
                        return { matched: true, pattern };
                    }
                }
            } else if (pattern.startsWith('Path ')) {
                const pathPattern = pattern.substring(5);

                // Handle wildcard patterns in paths
                if (pathPattern.includes('*')) {
                    // Convert Unison path wildcard pattern to regex
                    const regexPattern = pathPattern
                        .replace(/\./g, '\\.')  // Escape dots
                        .replace(/\*/g, '.*');  // Convert * to .*

                    try {
                        const regex = new RegExp(regexPattern);
                        if (regex.test(filePath)) {
                            return { matched: true, pattern };
                        }
                    } catch (regexError) {
                        this.log('WARN', `Invalid path wildcard pattern: ${pathPattern}`);
                    }
                } else {
                    // Exact path match
                    if (filePath.includes(pathPattern)) {
                        return { matched: true, pattern };
                    }
                }
            } else if (pattern.startsWith('Regex ')) {
                const regexPattern = pattern.substring(6);
                try {
                    const regex = new RegExp(regexPattern);
                    if (regex.test(filePath)) {
                        return { matched: true, pattern };
                    }
                } catch (regexError) {
                    this.log('WARN', `Invalid regex pattern: ${regexPattern}`);
                }
            } else {
                // Default pattern matching
                if (filePath.includes(pattern) || fileName === pattern) {
                    return { matched: true, pattern };
                }
            }
        }

        return { matched: false, pattern: null };
    }

    /**
     * Categorize files into sync and ignore lists
     */
    categorizeFiles(files, ignorePatterns) {
        const toSync = [];
        const toIgnore = [];

        for (const file of files) {
            const matchResult = this.matchesIgnorePattern(file.path, ignorePatterns);

            if (matchResult.matched) {
                toIgnore.push({
                    ...file,
                    ignoredBy: matchResult.pattern
                });
            } else {
                toSync.push(file);
            }
        }

        return { toSync, toIgnore };
    }

    /**
     * Format file size in human readable format
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Generate dry-run preview for a specific profile
     */
    async generatePreview(profileName) {
        this.log('INFO', `Starting dry-run preview for profile: ${profileName}`);

        try {
            // Parse Unison profile
            const { ignorePatterns, roots, profilePath } = this.parseUnisonProfile(profileName);

            this.log('INFO', `Profile loaded: ${profilePath}`);
            this.log('INFO', `Found ${ignorePatterns.length} ignore patterns`);
            this.log('INFO', `Found ${roots.length} sync roots`);

            if (roots.length < 2) {
                throw new Error(`Profile must have at least 2 roots (source and destination)`);
            }

            const sourceRoot = roots[0];
            const destinationRoot = roots[1];

            this.log('INFO', `Source root: ${sourceRoot}`);
            this.log('INFO', `Destination root: ${destinationRoot}`);

            // Get all files from source
            this.log('INFO', 'Scanning source directory...');
            const allFiles = this.getAllFiles(sourceRoot);
            this.log('INFO', `Found ${allFiles.length} total items in source`);

            // Categorize files
            this.log('INFO', 'Categorizing files based on ignore patterns...');
            const { toSync, toIgnore } = this.categorizeFiles(allFiles, ignorePatterns);

            // Calculate statistics
            const syncStats = this.calculateStats(toSync);
            const ignoreStats = this.calculateStats(toIgnore);

            // Generate preview report
            const preview = {
                profile: profileName,
                profilePath,
                sourceRoot,
                destinationRoot,
                timestamp: new Date().toISOString(),
                ignorePatterns,
                statistics: {
                    total: {
                        files: allFiles.filter(f => f.type === 'file').length,
                        directories: allFiles.filter(f => f.type === 'directory').length,
                        size: allFiles.reduce((sum, f) => sum + f.size, 0)
                    },
                    toSync: syncStats,
                    toIgnore: ignoreStats
                },
                filesToSync: toSync,
                filesToIgnore: toIgnore
            };

            this.log('INFO', 'Dry-run preview completed successfully');
            return preview;

        } catch (error) {
            this.log('ERROR', `Dry-run preview failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Calculate statistics for a file list
     */
    calculateStats(files) {
        const fileList = files.filter(f => f.type === 'file');
        const dirList = files.filter(f => f.type === 'directory');
        const totalSize = files.reduce((sum, f) => sum + f.size, 0);

        return {
            files: fileList.length,
            directories: dirList.length,
            size: totalSize,
            formattedSize: this.formatFileSize(totalSize)
        };
    }

    /**
     * Display preview results in a formatted way
     */
    displayPreview(preview) {
        console.log('\n' + '='.repeat(80));
        console.log('DRY-RUN SYNC PREVIEW');
        console.log('='.repeat(80));

        console.log(`\nProfile: ${preview.profile}`);
        console.log(`Source: ${preview.sourceRoot}`);
        console.log(`Destination: ${preview.destinationRoot}`);
        console.log(`Generated: ${new Date(preview.timestamp).toLocaleString()}`);

        console.log('\n' + '-'.repeat(50));
        console.log('SYNC STATISTICS');
        console.log('-'.repeat(50));

        const { total, toSync, toIgnore } = preview.statistics;

        console.log(`Total Items Scanned:`);
        console.log(`  Files: ${total.files.toLocaleString()}`);
        console.log(`  Directories: ${total.directories.toLocaleString()}`);
        console.log(`  Total Size: ${this.formatFileSize(total.size)}`);

        console.log(`\nItems to Sync:`);
        console.log(`  Files: ${toSync.files.toLocaleString()}`);
        console.log(`  Directories: ${toSync.directories.toLocaleString()}`);
        console.log(`  Total Size: ${toSync.formattedSize}`);

        console.log(`\nItems to Ignore:`);
        console.log(`  Files: ${toIgnore.files.toLocaleString()}`);
        console.log(`  Directories: ${toIgnore.directories.toLocaleString()}`);
        console.log(`  Total Size: ${toIgnore.formattedSize}`);

        // Show ignore patterns
        console.log('\n' + '-'.repeat(50));
        console.log('IGNORE PATTERNS');
        console.log('-'.repeat(50));

        preview.ignorePatterns.forEach((pattern, index) => {
            console.log(`${index + 1}. ${pattern}`);
        });

        // Show sample files to sync (first 10)
        if (preview.filesToSync.length > 0) {
            console.log('\n' + '-'.repeat(50));
            console.log('SAMPLE FILES TO SYNC (first 10)');
            console.log('-'.repeat(50));

            preview.filesToSync.slice(0, 10).forEach(file => {
                const sizeStr = file.type === 'file' ? ` (${this.formatFileSize(file.size)})` : '';
                console.log(`${file.type === 'directory' ? '[DIR]' : '[FILE]'} ${file.path}${sizeStr}`);
            });

            if (preview.filesToSync.length > 10) {
                console.log(`... and ${preview.filesToSync.length - 10} more items`);
            }
        }

        // Show sample ignored files (first 10)
        if (preview.filesToIgnore.length > 0) {
            console.log('\n' + '-'.repeat(50));
            console.log('SAMPLE IGNORED FILES (first 10)');
            console.log('-'.repeat(50));

            preview.filesToIgnore.slice(0, 10).forEach(file => {
                const sizeStr = file.type === 'file' ? ` (${this.formatFileSize(file.size)})` : '';
                console.log(`${file.type === 'directory' ? '[DIR]' : '[FILE]'} ${file.path}${sizeStr}`);
                console.log(`      Ignored by: ${file.ignoredBy}`);
            });

            if (preview.filesToIgnore.length > 10) {
                console.log(`... and ${preview.filesToIgnore.length - 10} more ignored items`);
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('END OF DRY-RUN PREVIEW');
        console.log('='.repeat(80));
    }

    /**
     * Save preview results to a file
     */
    savePreview(preview, outputFile) {
        const outputPath = path.resolve(outputFile);

        try {
            fs.writeFileSync(outputPath, JSON.stringify(preview, null, 2));
            this.log('INFO', `Preview saved to: ${outputPath}`);
            return outputPath;
        } catch (error) {
            this.log('ERROR', `Failed to save preview: ${error.message}`);
            throw error;
        }
    }

    /**
     * Interactive mode to add additional ignore patterns
     */
    async addIgnorePatterns(profileName) {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (prompt) => {
            return new Promise((resolve) => {
                rl.question(prompt, resolve);
            });
        };

        try {
            console.log('\n' + '-'.repeat(50));
            console.log('ADD ADDITIONAL IGNORE PATTERNS');
            console.log('-'.repeat(50));
            console.log('Enter ignore patterns one by one. Press Enter with empty line to finish.');
            console.log('Pattern formats:');
            console.log('  Name <filename>     - Ignore files/dirs with exact name');
            console.log('  Path <path>         - Ignore paths containing this string');
            console.log('  Regex <pattern>     - Ignore using regular expression');
            console.log('  <pattern>           - Simple pattern matching');
            console.log('');

            const newPatterns = [];
            let patternInput;

            do {
                patternInput = await question(`Enter ignore pattern (${newPatterns.length + 1}): `);
                if (patternInput.trim()) {
                    newPatterns.push(patternInput.trim());
                    console.log(`Added: ${patternInput.trim()}`);
                }
            } while (patternInput.trim());

            if (newPatterns.length > 0) {
                const profilePath = path.join(process.env.HOME, '.unison', `${profileName}.prf`);

                // Backup original profile
                const backupPath = `${profilePath}.backup.${Date.now()}`;
                fs.copyFileSync(profilePath, backupPath);
                this.log('INFO', `Profile backed up to: ${backupPath}`);

                // Add new patterns to profile
                const ignoreLines = newPatterns.map(pattern => `ignore = ${pattern}`).join('\n');
                fs.appendFileSync(profilePath, '\n' + ignoreLines + '\n');

                console.log(`\nAdded ${newPatterns.length} new ignore patterns to profile: ${profilePath}`);
                console.log('New patterns:');
                newPatterns.forEach((pattern, index) => {
                    console.log(`  ${index + 1}. ignore = ${pattern}`);
                });

                this.log('INFO', `Added ${newPatterns.length} ignore patterns to profile: ${profileName}`);
            } else {
                console.log('No new patterns added.');
            }

        } finally {
            rl.close();
        }
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const profileName = args[1];

    // Get project directory (go up two levels from src/sync)
    const projectDir = path.resolve(__dirname, '..', '..');

    try {
        const dryRun = new DryRunPreview(projectDir);

        switch (command) {
            case 'preview':
                if (!profileName) {
                    console.error('Usage: node dry_run_preview.cjs preview <profile_name>');
                    process.exit(1);
                }

                const preview = await dryRun.generatePreview(profileName);
                dryRun.displayPreview(preview);

                // Ask if user wants to save the preview
                const readline = require('readline');
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });

                rl.question('\nSave preview to file? (y/N): ', (answer) => {
                    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                        const outputFile = `dry_run_preview_${profileName}_${Date.now()}.json`;
                        try {
                            dryRun.savePreview(preview, outputFile);
                            console.log(`Preview saved to: ${outputFile}`);
                        } catch (error) {
                            console.error(`Failed to save preview: ${error.message}`);
                        }
                    }
                    rl.close();
                });
                break;

            case 'add-ignore':
                if (!profileName) {
                    console.error('Usage: node dry_run_preview.cjs add-ignore <profile_name>');
                    process.exit(1);
                }

                await dryRun.addIgnorePatterns(profileName);
                break;

            case 'help':
            default:
                console.log('Dry-Run Preview Tool');
                console.log('');
                console.log('Usage:');
                console.log('  node dry_run_preview.cjs preview <profile_name>    - Generate dry-run preview');
                console.log('  node dry_run_preview.cjs add-ignore <profile_name> - Add ignore patterns interactively');
                console.log('  node dry_run_preview.cjs help                      - Show this help');
                console.log('');
                console.log('Examples:');
                console.log('  node dry_run_preview.cjs preview icloud');
                console.log('  node dry_run_preview.cjs preview google_drive');
                console.log('  node dry_run_preview.cjs add-ignore icloud');
                break;
        }

    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

// Export for use as module
export default DryRunPreview;

// Run CLI if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error(`Fatal error: ${error.message}`);
        process.exit(1);
    });
}