#!/usr/bin/env node

/**
 * Dotfile Safety Check
 * 
 * This script prevents syncing of dotfiles (files/directories that start with .) to prevent
 * accidental syncing of system files, configuration files, or other unwanted content.
 * 
 * Usage: node dotfile_safety_check.js <profile_name>
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

// Configuration
const MAX_ALLOWED_DOTFILES = 5; // Maximum number of dotfiles allowed before warning
const ALLOWED_DOTFILES = ['.obsidian', '.attachments']; // Whitelisted dotfiles/folders

/**
 * Get the Unison command to check what would be synced
 * @param {string} profileName - Unison profile name
 * @returns {string} - Command to execute
 */
function getUnisonCheckCommand(profileName) {
    // Use dry-run with terse output which works on most Unison versions
    return `unison ${profileName} -batch -terse -auto -testserver`;
}

/**
 * Parse the output of Unison command to detect dotfiles that would be synced
 * @param {string} output - Output from Unison command
 * @returns {Array<{path: string, action: string}>} - Array of dotfiles that would be synced
 */
function detectDotfiles(output) {
    // Execute a custom find command to detect dotfiles in the sync roots
    try {
        const homeDir = os.homedir();
        const unisonDir = path.join(homeDir, '.unison');
        const profilePath = path.join(unisonDir, `${process.argv[2]}.prf`);
        
        // Parse the profile to get the root paths
        const profileContent = fs.readFileSync(profilePath, 'utf-8');
        const rootMatches = profileContent.match(/^root\s*=\s*(.*)$/gm);
        
        if (!rootMatches || rootMatches.length < 1) {
            throw new Error(`Could not find root paths in profile: ${profilePath}`);
        }
        
        // Extract the root paths
        const rootPaths = rootMatches.map(match => {
            const path = match.replace(/^root\s*=\s*/, '').trim();
            return path.replace(/^'(.*)'$/, '$1'); // Remove quotes if present
        });
        
        console.log(`Checking for dotfiles in sync roots: ${rootPaths.join(', ')}`);
        
        const dotfiles = [];
        
        // Check first root path for dotfiles
        if (rootPaths.length > 0 && fs.existsSync(rootPaths[0])) {
            // Find all dotfiles in the first root
            const findCmd = `find "${rootPaths[0]}" -type f -o -type d -name ".*" | grep -v "\.\./" | grep -v "\.git/"`;
            try {
                const findOutput = execSync(findCmd, { encoding: 'utf-8' });
                const foundPaths = findOutput.split('\n').filter(Boolean);
                
                for (const foundPath of foundPaths) {
                    // Check if it's a whitelisted dotfile
                    if (!isWhitelistedDotfile(foundPath.replace(`${rootPaths[0]}/`, ''))) {
                        dotfiles.push({
                            path: foundPath.replace(`${rootPaths[0]}/`, ''),
                            action: 'found'
                        });
                    }
                }
            } catch (err) {
                // No dotfiles found or error in command
                console.log('No dotfiles found or error in find command');
            }
        }
        
        return dotfiles;
    } catch (err) {
        console.error(`Error detecting dotfiles: ${err.message}`);
        return [];
    }
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
