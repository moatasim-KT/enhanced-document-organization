#!/usr/bin/env node

/**
 * Unison Profile Updater
 * Updates Unison profiles with comprehensive ignore patterns and validates configuration
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to expand ~ in paths (MUST be defined before ProfileUpdater class)
path.expanduser = function (filePath) {
    if (filePath.startsWith('~/')) {
        return path.join(os.homedir(), filePath.slice(2));
    }
    return filePath;
};

class ProfileUpdater {
    constructor() {
        this.configDir = path.join(__dirname, '../../config');
        this.ignorePatternDir = path.join(this.configDir, 'ignore_patterns');
        this.profilePaths = {
            icloud: {
                config: path.join(this.configDir, 'unison_icloud.prf'),
                home: path.expanduser('~/.unison/icloud.prf')
            },
            google_drive: {
                config: path.join(this.configDir, 'unison_google_drive.prf'),
                home: path.expanduser('~/.unison/google_drive.prf')
            }
        };

        this.expectedRoots = {
            source: '/Users/moatasimfarooque/Sync_Hub_New',
            icloud: '/Users/moatasimfarooque/Library/Mobile Documents/iCloud~md~obsidian/Documents/Sync',
            google_drive: '/Users/moatasimfarooque/Library/CloudStorage/GoogleDrive-moatasim23android@gmail.com/My Drive/Sync'
        };
    }

    /**
     * Load ignore patterns from template files
     */
    loadIgnorePatterns() {
        const patterns = {
            development: [],
            system: [],
            ide: [],
            application: []
        };

        try {
            // Load development tools patterns
            const devFile = path.join(this.ignorePatternDir, 'development_tools.conf');
            if (fs.existsSync(devFile)) {
                patterns.development = this.parseIgnoreFile(devFile);
            }

            // Load system cache patterns
            const systemFile = path.join(this.ignorePatternDir, 'system_caches.conf');
            if (fs.existsSync(systemFile)) {
                patterns.system = this.parseIgnoreFile(systemFile);
            }

            // Load IDE patterns
            const ideFile = path.join(this.ignorePatternDir, 'ide_editors.conf');
            if (fs.existsSync(ideFile)) {
                patterns.ide = this.parseIgnoreFile(ideFile);
            }

            // Load application-specific patterns
            const appFile = path.join(this.ignorePatternDir, 'application_specific.conf');
            if (fs.existsSync(appFile)) {
                patterns.application = this.parseIgnoreFile(appFile);
            }

            return patterns;
        } catch (error) {
            console.error('Error loading ignore patterns:', error.message);
            return patterns;
        }
    }

    /**
     * Parse ignore pattern file and extract ignore lines
     */
    parseIgnoreFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            const ignoreLines = [];

            for (const line of lines) {
                const trimmed = line.trim();
                // Skip comments and empty lines
                if (trimmed && !trimmed.startsWith('#') && trimmed.startsWith('ignore =')) {
                    ignoreLines.push(trimmed);
                }
            }

            return ignoreLines;
        } catch (error) {
            console.error(`Error parsing ignore file ${filePath}:`, error.message);
            return [];
        }
    }

    /**
     * Generate comprehensive profile content
     */
    generateProfileContent(profileType) {
        const patterns = this.loadIgnorePatterns();
        const allIgnorePatterns = [
            ...patterns.development,
            ...patterns.system,
            ...patterns.ide,
            ...patterns.application
        ];

        let content = '';

        // Profile header
        if (profileType === 'icloud') {
            content += `# Unison profile for iCloud sync
# Syncs between local sync hub and iCloud (Obsidian documents)

# Sync directories
root = ${this.expectedRoots.source}
root = ${this.expectedRoots.icloud}

`;
        } else {
            content += `# Unison profile for Google Drive sync
# Syncs between local sync hub and Google Drive

# Sync directories
root = ${this.expectedRoots.source}
root = ${this.expectedRoots.google_drive}

`;
        }

        // Basic sync options
        content += `# Basic sync options
auto = true
batch = true
prefer = newer
log = true
silent = false

# Conflict resolution
backup = Name *
backupcurr = Name *
backupnot = Name *.tmp
maxbackups = 5

`;

        // Add comprehensive ignore patterns
        content += `# =============================================================================
# COMPREHENSIVE IGNORE PATTERNS
# =============================================================================

`;

        // Add development tools patterns
        if (patterns.development.length > 0) {
            content += `# Development Tools\n`;
            for (const pattern of patterns.development) {
                content += `${pattern}\n`;
            }
            content += '\n';
        }

        // Add system cache patterns
        if (patterns.system.length > 0) {
            content += `# System Caches and Temporary Files\n`;
            for (const pattern of patterns.system) {
                content += `${pattern}\n`;
            }
            content += '\n';
        }

        // Add IDE patterns
        if (patterns.ide.length > 0) {
            content += `# IDE and Editors\n`;
            for (const pattern of patterns.ide) {
                content += `${pattern}\n`;
            }
            content += '\n';
        }

        // Add application-specific patterns
        if (patterns.application.length > 0) {
            content += `# Application-Specific\n`;
            for (const pattern of patterns.application) {
                content += `${pattern}\n`;
            }
            content += '\n';
        }

        // Add service-specific patterns
        if (profileType === 'icloud') {
            content += `# iCloud specific ignores
ignore = Name *.icloud
ignore = Name .com.apple.timemachine.donotpresent

`;
        } else {
            content += `# Google Drive specific ignores
ignore = Name *.gdoc
ignore = Name *.gsheet
ignore = Name *.gslides
ignore = Name .tmp.driveupload
ignore = Name .tmp.drivedownload

`;
        }

        // Add problematic file patterns
        content += `# Problematic file patterns
ignore = Regex .*:.*
ignore = Regex .*".*
ignore = Regex .*<.*
ignore = Regex .*>.*
ignore = Regex .*\\|.*
ignore = Name *conflicted copy*
ignore = Name *conflict*

`;

        // Performance settings
        content += `# Performance settings
retry = 3
confirmbigdel = false
times = true
perms = 0o644
maxthreads = 4
rsrc = false

`;

        return content;
    }

    /**
     * Validate profile syntax and structure
     */
    validateProfile(content, profileType) {
        const errors = [];
        const lines = content.split('\n');

        let hasSourceRoot = false;
        let hasDestinationRoot = false;
        let rootCount = 0;

        for (const line of lines) {
            const trimmed = line.trim();

            // Check for root definitions
            if (trimmed.startsWith('root =')) {
                rootCount++;
                const rootPath = trimmed.substring(6).trim();

                if (rootPath === this.expectedRoots.source) {
                    hasSourceRoot = true;
                } else if (profileType === 'icloud' && rootPath === this.expectedRoots.icloud) {
                    hasDestinationRoot = true;
                } else if (profileType === 'google_drive' && rootPath === this.expectedRoots.google_drive) {
                    hasDestinationRoot = true;
                }
            }
        }

        // Validate root configuration
        if (!hasSourceRoot) {
            errors.push(`Missing source root: ${this.expectedRoots.source}`);
        }

        if (!hasDestinationRoot) {
            const expectedDest = profileType === 'icloud' ? this.expectedRoots.icloud : this.expectedRoots.google_drive;
            errors.push(`Missing destination root: ${expectedDest}`);
        }

        if (rootCount !== 2) {
            errors.push(`Expected exactly 2 root definitions, found ${rootCount}`);
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Update a single profile
     */
    updateProfile(profileType) {
        console.log(`\nUpdating ${profileType} profile...`);

        try {
            // Generate new profile content
            const content = this.generateProfileContent(profileType);

            // Validate the generated content
            const validation = this.validateProfile(content, profileType);
            if (!validation.isValid) {
                console.error(`Profile validation failed for ${profileType}:`);
                validation.errors.forEach(error => console.error(`  - ${error}`));
                return false;
            }

            // Update config directory profile
            const configPath = this.profilePaths[profileType].config;
            fs.writeFileSync(configPath, content, 'utf8');
            console.log(`✓ Updated config profile: ${configPath}`);

            // Update home directory profile
            const homePath = this.profilePaths[profileType].home;
            const homeDir = path.dirname(homePath);

            // Ensure .unison directory exists
            if (!fs.existsSync(homeDir)) {
                fs.mkdirSync(homeDir, { recursive: true });
                console.log(`✓ Created directory: ${homeDir}`);
            }

            fs.writeFileSync(homePath, content, 'utf8');
            console.log(`✓ Updated home profile: ${homePath}`);

            return true;
        } catch (error) {
            console.error(`Error updating ${profileType} profile:`, error.message);
            return false;
        }
    }

    /**
     * Update all profiles
     */
    updateAllProfiles() {
        console.log('Starting Unison profile update...');

        let success = true;

        // Update iCloud profile
        if (!this.updateProfile('icloud')) {
            success = false;
        }

        // Update Google Drive profile
        if (!this.updateProfile('google_drive')) {
            success = false;
        }

        if (success) {
            console.log('\n✅ All profiles updated successfully!');
            console.log('\nProfile Summary:');
            console.log(`  Source Root: ${this.expectedRoots.source}`);
            console.log(`  iCloud Root: ${this.expectedRoots.icloud}`);
            console.log(`  Google Drive Root: ${this.expectedRoots.google_drive}`);
        } else {
            console.log('\n❌ Some profiles failed to update. Check errors above.');
        }

        return success;
    }

    /**
     * Verify current profile configuration
     */
    verifyProfiles() {
        console.log('\nVerifying current profile configuration...');

        for (const [profileType, paths] of Object.entries(this.profilePaths)) {
            console.log(`\n${profileType.toUpperCase()} Profile:`);

            for (const [location, filePath] of Object.entries(paths)) {
                if (fs.existsSync(filePath)) {
                    try {
                        const content = fs.readFileSync(filePath, 'utf8');
                        const validation = this.validateProfile(content, profileType);

                        if (validation.isValid) {
                            console.log(`  ✓ ${location}: Valid`);
                        } else {
                            console.log(`  ❌ ${location}: Invalid`);
                            validation.errors.forEach(error => console.log(`    - ${error}`));
                        }
                    } catch (error) {
                        console.log(`  ❌ ${location}: Error reading file - ${error.message}`);
                    }
                } else {
                    console.log(`  ❌ ${location}: File not found - ${filePath}`);
                }
            }
        }
    }
}

// Helper function moved to top of file before ProfileUpdater class

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const updater = new ProfileUpdater();

    const command = process.argv[2] || 'update';

    switch (command) {
        case 'update':
            updater.updateAllProfiles();
            break;
        case 'verify':
            updater.verifyProfiles();
            break;
        case 'help':
            console.log('Usage: node profile_updater.js [command]');
            console.log('Commands:');
            console.log('  update  - Update all Unison profiles with comprehensive ignore patterns');
            console.log('  verify  - Verify current profile configuration');
            console.log('  help    - Show this help message');
            break;
        default:
            console.log(`Unknown command: ${command}`);
            console.log('Use "help" for available commands');
    }
}

export default ProfileUpdater;