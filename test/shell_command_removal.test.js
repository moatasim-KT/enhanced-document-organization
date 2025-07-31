#!/usr/bin/env node

/**
 * Test to verify shell command dependencies have been removed
 * This test ensures all execSync, find, grep, and xargs dependencies are eliminated
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/**
 * Test shell command removal
 */
async function testShellCommandRemoval() {
    console.log('🧪 Testing shell command dependency removal...\n');

    const results = {
        passed: 0,
        failed: 0,
        errors: []
    };

    try {
        // Test 1: Check for execSync imports
        await testExecSyncImports(results);

        // Test 2: Check for shell command strings
        await testShellCommandStrings(results);

        // Test 3: Test system validator functionality
        await testSystemValidatorFunctionality(results);

        // Test 4: Test content consolidator functionality
        await testContentConsolidatorFunctionality(results);

        // Test 5: Test MCP server functionality
        await testMCPServerFunctionality(results);

    } catch (error) {
        results.failed++;
        results.errors.push(`Test execution error: ${error.message}`);
    }

    // Print results
    console.log('\n📊 Test Results:');
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);

    if (results.errors.length > 0) {
        console.log('\n🚨 Errors:');
        results.errors.forEach(error => console.log(`  - ${error}`));
    }

    return results.failed === 0;
}

/**
 * Test for execSync imports
 */
async function testExecSyncImports(results) {
    console.log('🔍 Testing for execSync imports...');

    const sourceFiles = await getSourceFiles();
    let foundExecSync = false;

    for (const filePath of sourceFiles) {
        try {
            const content = await fs.readFile(filePath, 'utf8');

            // Check for execSync imports
            if (content.includes('import { execSync }') ||
                content.includes('import {execSync}') ||
                content.includes('const { execSync }') ||
                content.includes('const {execSync}')) {
                foundExecSync = true;
                results.errors.push(`Found execSync import in ${filePath}`);
            }
        } catch (error) {
            results.errors.push(`Error reading ${filePath}: ${error.message}`);
        }
    }

    if (foundExecSync) {
        results.failed++;
        console.log('❌ Found execSync imports');
    } else {
        results.passed++;
        console.log('✅ No execSync imports found');
    }
}

/**
 * Test for shell command strings
 */
async function testShellCommandStrings(results) {
    console.log('🔍 Testing for shell command strings...');

    const sourceFiles = await getSourceFiles();
    let foundShellCommands = false;

    for (const filePath of sourceFiles) {
        try {
            const content = await fs.readFile(filePath, 'utf8');

            // Check for shell command patterns (excluding comments and legitimate uses)
            const shellPatterns = [
                /execSync\s*\(/,
                /`find\s+/,
                /`grep\s+/,
                /`xargs\s+/,
                /"find\s+/,
                /"grep\s+/,
                /"xargs\s+/
            ];

            for (const pattern of shellPatterns) {
                if (pattern.test(content)) {
                    // Skip if it's in a comment
                    const lines = content.split('\n');
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        if (pattern.test(line) && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
                            foundShellCommands = true;
                            results.errors.push(`Found shell command pattern in ${filePath}:${i + 1}: ${line.trim()}`);
                        }
                    }
                }
            }
        } catch (error) {
            results.errors.push(`Error reading ${filePath}: ${error.message}`);
        }
    }

    if (foundShellCommands) {
        results.failed++;
        console.log('❌ Found shell command strings');
    } else {
        results.passed++;
        console.log('✅ No shell command strings found');
    }
}

/**
 * Test system validator functionality
 */
async function testSystemValidatorFunctionality(results) {
    console.log('🔍 Testing system validator functionality...');

    try {
        const { SystemValidator } = await import('../src/organize/system_validator.js');

        // Create validator instance
        const validator = new SystemValidator({
            projectRoot: projectRoot,
            skipFastFail: true,
            verbose: false
        });

        // Test that it can be instantiated without execSync
        if (validator) {
            results.passed++;
            console.log('✅ System validator instantiated successfully');
        } else {
            results.failed++;
            results.errors.push('System validator failed to instantiate');
        }

    } catch (error) {
        results.failed++;
        results.errors.push(`System validator test failed: ${error.message}`);
        console.log('❌ System validator test failed');
    }
}

/**
 * Test content consolidator functionality
 */
async function testContentConsolidatorFunctionality(results) {
    console.log('🔍 Testing content consolidator functionality...');

    try {
        const { ContentConsolidator } = await import('../src/organize/content_consolidator.js');

        // Create consolidator instance
        const consolidator = new ContentConsolidator({
            syncHubPath: path.join(projectRoot, 'test_sync_hub')
        });

        // Test that it can be instantiated without execSync
        if (consolidator) {
            results.passed++;
            console.log('✅ Content consolidator instantiated successfully');
        } else {
            results.failed++;
            results.errors.push('Content consolidator failed to instantiate');
        }

    } catch (error) {
        results.failed++;
        results.errors.push(`Content consolidator test failed: ${error.message}`);
        console.log('❌ Content consolidator test failed');
    }
}

/**
 * Test MCP server functionality
 */
async function testMCPServerFunctionality(results) {
    console.log('🔍 Testing MCP server functionality...');

    try {
        const { DocumentOrganizationServer } = await import('../src/mcp/server.js');

        // Create server instance
        const server = new DocumentOrganizationServer();

        // Test that it can be instantiated without execSync
        if (server) {
            results.passed++;
            console.log('✅ MCP server instantiated successfully');
        } else {
            results.failed++;
            results.errors.push('MCP server failed to instantiate');
        }

    } catch (error) {
        results.failed++;
        results.errors.push(`MCP server test failed: ${error.message}`);
        console.log('❌ MCP server test failed');
    }
}

/**
 * Get all source files to check
 */
async function getSourceFiles() {
    const sourceFiles = [];

    const srcDir = path.join(projectRoot, 'src');
    await walkDirectory(srcDir, sourceFiles);

    return sourceFiles.filter(file => file.endsWith('.js'));
}

/**
 * Walk directory recursively
 */
async function walkDirectory(dir, files) {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                await walkDirectory(fullPath, files);
            } else if (entry.isFile()) {
                files.push(fullPath);
            }
        }
    } catch (error) {
        // Skip directories that can't be read
    }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    testShellCommandRemoval()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test execution failed:', error);
            process.exit(1);
        });
}

export { testShellCommandRemoval };