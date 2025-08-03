#!/usr/bin/env node

/**
 * Dotfile Safety Check
 * 
 * This script prevents syncing of dotfiles (files/directories that start with .) to prevent
 * accidental syncing of system files, configuration files, or other unwanted content.
 * 
 * Usage: node dotfile_safety_check.js <profile_name>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// Configuration
const MAX_ALLOWED_DOTFILES = 5; // Maximum number of dotfiles allowed before warning
const ALLOWED_DOTFILES = ['.obsidian', '.attachments']; // Whitelisted dotfiles/folders

/**
 * Get the Unison command to check what would be synced
 * @param {string} profileName - Unison profile name
 * @returns {string} - Command to execute
 */
function getUnisonCheckCommand(profileName) {
    return `unison ${profileName} -batch -auto -itemize`;
}

/**
 * Parse the output of Unison itemize command to detect dotfiles that would be synced
 * @param {string} output - Output from Unison command
 * @returns {Array<{path: string, action: string}>} - Array of dotfiles that would be synced
 */
function detectDotfiles(output) {
    const lines = output.split('\n');
    const dotfiles = [];
    
    for (const line of lines) {
        // Itemize format looks like: <action> <path>
        const match = line.match(/^(.*?)\s+(.*)$/);
        if (!match) continue;
        
        const [, action, itemPath] = match;
        
        // Check if it's a dotfile or in a dotfile directory
        if (isPathDotfile(itemPath) && !isWhitelistedDotfile(itemPath)) {
            dotfiles.push({
                path: itemPath,
                action: action
            });
        }
    }
    
    return dotfiles;
}

/**
 * Check if the path represents a dotfile or is within a dotfile directory
 * @param {string} filePath - Path to check
 * @returns {boolean} - True if it's a dotfile or in a dotfile directory
 */
function isPathDotfile(filePath) {
    const pathParts = filePath.split('/');
    
    // Check each part of the path for a dotfile component
    for (const part of pathParts) {
        if (part.startsWith('.') && part !== '.' && part !== '..') {
            return true;
        }
    }
    
    return false;
}

/**
 * Check if the path is a whitelisted dotfile
 * @param {string} filePath - Path to check
 * @returns {boolean} - True if it's a whitelisted dotfile
 */
function isWhitelistedDotfile(filePath) {
    for (const allowed of ALLOWED_DOTFILES) {
        // Check if it's exactly the allowed dotfile or a path under it
        if (filePath === allowed || filePath.startsWith(`${allowed}/`)) {
            return true;
        }
    }
    return false;
}

/**
 * Create a backup of a Unison profile
 * @param {string} profileName - Name of the profile to backup
 */
function backupUnisonProfile(profileName) {
    const homeDir = os.homedir();
    const unisonDir = path.join(homeDir, '.unison');
    const profilePath = path.join(unisonDir, `${profileName}.prf`);
    
    if (fs.existsSync(profilePath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(unisonDir, 'backup');
        
        // Create backup directory if it doesn't exist
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const backupPath = path.join(backupDir, `${profileName}_${timestamp}.prf`);
        fs.copyFileSync(profilePath, backupPath);
        
        console.log(`Profile backup created: ${backupPath}`);
    } else {
        console.error(`Profile not found: ${profilePath}`);
    }
}

/**
 * Main function to check for dotfiles in sync operation
 */
async function main() {
    // Get profile name from command line argument
    const profileName = process.argv[2];
    if (!profileName) {
        console.error('Error: Profile name is required');
        console.error('Usage: node dotfile_safety_check.js <profile_name>');
        process.exit(1);
    }
    
    try {
        // Backup the profile first
        backupUnisonProfile(profileName);
        
        // Run the Unison check command
        const output = execSync(getUnisonCheckCommand(profileName), { encoding: 'utf-8' });
        
        // Detect dotfiles that would be synced
        const dotfiles = detectDotfiles(output);
        
        // Output results
        if (dotfiles.length > 0) {
            console.error(`WARNING: Detected ${dotfiles.length} dotfiles that would be synced!`);
            console.error('This may indicate an issue with your Unison profile or a potential security risk.');
            
            // Show the first few dotfiles detected
            const samplesToShow = Math.min(10, dotfiles.length);
            console.error(`\nSample of dotfiles that would be synced (showing ${samplesToShow} of ${dotfiles.length}):`);
            
            for (let i = 0; i < samplesToShow; i++) {
                console.error(`  ${dotfiles[i].action} ${dotfiles[i].path}`);
            }
            
            // Abort if too many dotfiles detected
            if (dotfiles.length > MAX_ALLOWED_DOTFILES) {
                console.error('\nAborting sync operation for safety!');
                process.exit(1);
            } else {
                console.error('\nNumber of dotfiles is below threshold. Proceeding with caution.');
            }
        } else {
            console.log('Safety check passed: No unauthorized dotfiles detected in sync operation.');
        }
    } catch (error) {
        console.error(`Error checking for dotfiles: ${error.message}`);
        process.exit(1);
    }
}

// Run the main function
main();
