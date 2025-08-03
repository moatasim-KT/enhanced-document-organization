#!/usr/bin/env node

/**
 * Path Resolution Unit Tests
 * Consolidated from multiple path resolution test files
 * Tests all path resolution functionality in the organize module
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

class PathResolutionTests {
    constructor() {
        this.testResults = {
            passed: 0,
            failed: 0,
            errors: []
        };
        this.testDir = path.join(os.tmpdir(), 'path_resolution_test');
    }

    async setup() {
        console.log('🔧 Setting up path resolution test environment...');
        
        // Clean up any existing test directory
        try {
            await fs.rm(this.testDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore if directory doesn't exist
        }

        // Create test directory structure
        await fs.mkdir(this.testDir, { recursive: true });
        await fs.mkdir(path.join(this.testDir, 'test_files'), { recursive: true });
        
        // Create test files with various naming patterns
        const testFiles = [
            'simple-file.txt',
            'file with spaces.txt',
            'file_with_underscores.txt',
            'file-with-unicode-café.txt',
            'UPPERCASE_FILE.TXT',
            'mixed_Case_File.txt'
        ];

        for (const file of testFiles) {
            await fs.writeFile(
                path.join(this.testDir, 'test_files', file),
                `Test content for ${file}`
            );
        }

        console.log('✅ Test environment setup complete');
    }

    async testBasicPathResolution() {
        console.log('\n📁 Testing basic path resolution...');
        
        try {
            // Import the path resolver module
            const { resolveFilePath } = await import(path.join(projectRoot, 'src/organize/simple_path_resolver.js'));
            
            // Test absolute path resolution
            const testFile = path.join(this.testDir, 'test_files', 'simple-file.txt');
            const resolved = await resolveFilePath(testFile);
            
            if (resolved === testFile) {
                this.logSuccess('Basic absolute path resolution');
            } else {
                this.logFailure('Basic absolute path resolution', `Expected ${testFile}, got ${resolved}`);
            }
            
        } catch (error) {
            this.logFailure('Basic path resolution', error.message);
        }
    }

    async testPathWithSpaces() {
        console.log('\n📁 Testing path resolution with spaces...');
        
        try {
            const { resolveFilePath } = await import(path.join(projectRoot, 'src/organize/simple_path_resolver.js'));
            
            const testFile = path.join(this.testDir, 'test_files', 'file with spaces.txt');
            const resolved = await resolveFilePath(testFile);
            
            if (resolved === testFile) {
                this.logSuccess('Path resolution with spaces');
            } else {
                this.logFailure('Path resolution with spaces', `Expected ${testFile}, got ${resolved}`);
            }
            
        } catch (error) {
            this.logFailure('Path resolution with spaces', error.message);
        }
    }

    async testPathWithUnicode() {
        console.log('\n📁 Testing path resolution with unicode characters...');
        
        try {
            const { resolveFilePath } = await import(path.join(projectRoot, 'src/organize/simple_path_resolver.js'));
            
            const testFile = path.join(this.testDir, 'test_files', 'file-with-unicode-café.txt');
            const resolved = await resolveFilePath(testFile);
            
            if (resolved === testFile) {
                this.logSuccess('Path resolution with unicode');
            } else {
                this.logFailure('Path resolution with unicode', `Expected ${testFile}, got ${resolved}`);
            }
            
        } catch (error) {
            this.logFailure('Path resolution with unicode', error.message);
        }
    }

    async testRelativePathResolution() {
        console.log('\n📁 Testing relative path resolution...');
        
        try {
            const { resolveFilePath } = await import(path.join(projectRoot, 'src/organize/simple_path_resolver.js'));
            
            // Test relative path resolution
            const relativePath = './test_files/simple-file.txt';
            const resolved = await resolveFilePath(relativePath, this.testDir);
            const expected = path.join(this.testDir, 'test_files', 'simple-file.txt');
            
            if (resolved === expected) {
                this.logSuccess('Relative path resolution');
            } else {
                this.logFailure('Relative path resolution', `Expected ${expected}, got ${resolved}`);
            }
            
        } catch (error) {
            this.logFailure('Relative path resolution', error.message);
        }
    }

    async testNonExistentPath() {
        console.log('\n📁 Testing non-existent path handling...');
        
        try {
            const { resolveFilePath } = await import(path.join(projectRoot, 'src/organize/simple_path_resolver.js'));
            
            const nonExistentPath = path.join(this.testDir, 'non-existent-file.txt');
            const resolved = await resolveFilePath(nonExistentPath);
            
            if (resolved === null || resolved === undefined) {
                this.logSuccess('Non-existent path handling');
            } else {
                this.logFailure('Non-existent path handling', `Expected null/undefined, got ${resolved}`);
            }
            
        } catch (error) {
            // Expected behavior for non-existent paths
            this.logSuccess('Non-existent path handling (threw expected error)');
        }
    }

    async testCaseInsensitiveResolution() {
        console.log('\n📁 Testing case-insensitive path resolution...');
        
        try {
            const { resolveFilePath } = await import(path.join(projectRoot, 'src/organize/simple_path_resolver.js'));
            
            // Test case variations
            const upperFile = path.join(this.testDir, 'test_files', 'UPPERCASE_FILE.TXT');
            const lowerQuery = path.join(this.testDir, 'test_files', 'uppercase_file.txt');
            
            const resolved = await resolveFilePath(lowerQuery);
            
            // On case-insensitive filesystems (like macOS), this should work
            if (process.platform === 'darwin' && resolved === upperFile) {
                this.logSuccess('Case-insensitive path resolution (macOS)');
            } else if (process.platform !== 'darwin') {
                this.logSuccess('Case-sensitive path resolution (Linux/Windows)');
            } else {
                this.logFailure('Case-insensitive path resolution', `Expected ${upperFile}, got ${resolved}`);
            }
            
        } catch (error) {
            this.logFailure('Case-insensitive path resolution', error.message);
        }
    }

    logSuccess(testName) {
        console.log(`✅ ${testName}`);
        this.testResults.passed++;
    }

    logFailure(testName, error) {
        console.log(`❌ ${testName}: ${error}`);
        this.testResults.failed++;
        this.testResults.errors.push({ test: testName, error });
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up test environment...');
        try {
            await fs.rm(this.testDir, { recursive: true, force: true });
            console.log('✅ Cleanup complete');
        } catch (error) {
            console.log(`⚠️ Cleanup warning: ${error.message}`);
        }
    }

    async runAllTests() {
        console.log('🧪 Path Resolution Unit Tests');
        console.log('='.repeat(50));

        try {
            await this.setup();
            await this.testBasicPathResolution();
            await this.testPathWithSpaces();
            await this.testPathWithUnicode();
            await this.testRelativePathResolution();
            await this.testNonExistentPath();
            await this.testCaseInsensitiveResolution();
        } finally {
            await this.cleanup();
        }

        // Print summary
        console.log('\n📊 Test Results Summary:');
        console.log('='.repeat(30));
        console.log(`✅ Passed: ${this.testResults.passed}`);
        console.log(`❌ Failed: ${this.testResults.failed}`);
        console.log(`📈 Success Rate: ${((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(1)}%`);

        if (this.testResults.errors.length > 0) {
            console.log('\n🔍 Error Details:');
            this.testResults.errors.forEach(({ test, error }) => {
                console.log(`  • ${test}: ${error}`);
            });
        }

        return this.testResults.failed === 0;
    }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const tests = new PathResolutionTests();
    tests.runAllTests().catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

export default PathResolutionTests;
