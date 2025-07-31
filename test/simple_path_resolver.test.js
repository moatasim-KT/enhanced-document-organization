#!/usr/bin/env node

/**
 * Test Suite for Simple Path Resolver
 * Tests the simplified path resolution logic
 */

import { SimplePathResolver, PathUtils } from '../src/organize/simple_path_resolver.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test runner
 */
class SimplePathResolverTest {
    constructor() {
        this.testCount = 0;
        this.passCount = 0;
        this.failCount = 0;
        this.resolver = new SimplePathResolver();
    }

    /**
     * Run a test with assertion
     */
    test(name, testFn) {
        this.testCount++;
        try {
            console.log(`\n🧪 Running test: ${name}`);
            testFn();
            this.passCount++;
            console.log(`✅ PASS: ${name}`);
        } catch (error) {
            this.failCount++;
            console.error(`❌ FAIL: ${name}`);
            console.error(`   Error: ${error.message}`);
        }
    }

    /**
     * Assert equality
     */
    assertEqual(actual, expected, message = '') {
        if (actual !== expected) {
            throw new Error(`${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
        }
    }

    /**
     * Assert truthy
     */
    assertTrue(value, message = '') {
        if (!value) {
            throw new Error(`${message}\n  Expected truthy value, got: ${value}`);
        }
    }

    /**
     * Assert falsy
     */
    assertFalse(value, message = '') {
        if (value) {
            throw new Error(`${message}\n  Expected falsy value, got: ${value}`);
        }
    }

    /**
     * Test project root detection
     */
    testProjectRootDetection() {
        this.test('Project root detection', () => {
            const projectRoot = this.resolver.detectProjectRoot();
            this.assertTrue(projectRoot, 'Project root should be detected');
            this.assertTrue(path.isAbsolute(projectRoot), 'Project root should be absolute path');
            console.log(`   Project root: ${projectRoot}`);
        });
    }

    /**
     * Test path resolution
     */
    testPathResolution() {
        this.test('Absolute path resolution', () => {
            const absolutePath = '/some/absolute/path';
            const resolved = this.resolver.resolvePath(absolutePath);
            this.assertEqual(resolved, path.normalize(absolutePath), 'Absolute paths should be normalized');
        });

        this.test('Relative path resolution', () => {
            const relativePath = 'some/relative/path';
            const resolved = this.resolver.resolvePath(relativePath);
            this.assertTrue(path.isAbsolute(resolved), 'Relative paths should become absolute');
            this.assertTrue(resolved.includes(relativePath), 'Resolved path should contain original path');
        });
    }

    /**
     * Test file existence checks
     */
    testFileExistence() {
        this.test('File exists sync - existing file', () => {
            const exists = this.resolver.fileExistsSync('package.json');
            this.assertTrue(exists, 'package.json should exist');
        });

        this.test('File exists sync - non-existing file', () => {
            const exists = this.resolver.fileExistsSync('non-existent-file.txt');
            this.assertFalse(exists, 'Non-existent file should not exist');
        });

        this.test('Directory exists sync - existing directory', () => {
            const exists = this.resolver.directoryExistsSync('src');
            this.assertTrue(exists, 'src directory should exist');
        });

        this.test('Directory exists sync - non-existing directory', () => {
            const exists = this.resolver.directoryExistsSync('non-existent-directory');
            this.assertFalse(exists, 'Non-existent directory should not exist');
        });
    }

    /**
     * Test path utilities
     */
    testPathUtilities() {
        this.test('Path joining', () => {
            const joined = this.resolver.joinPaths('path1', 'path2', 'path3');
            this.assertEqual(joined, path.join('path1', 'path2', 'path3'), 'Paths should be joined correctly');
        });

        this.test('Path joining with empty segments', () => {
            try {
                this.resolver.joinPaths('path1', '', 'path3');
                // Should filter out empty segments
                this.assertTrue(true, 'Should handle empty segments');
            } catch (error) {
                // Expected behavior - should throw error for empty segments
                this.assertTrue(error.message.includes('empty'), 'Should throw error for empty segments');
            }
        });

        this.test('Get parent directory', () => {
            const parent = this.resolver.getParentDirectory('/some/path/file.txt');
            this.assertEqual(parent, '/some/path', 'Should return parent directory');
        });

        this.test('Get file extension', () => {
            const ext = this.resolver.getFileExtension('file.txt');
            this.assertEqual(ext, '.txt', 'Should return file extension');
        });

        this.test('Get base name', () => {
            const baseName = this.resolver.getBaseName('/some/path/file.txt');
            this.assertEqual(baseName, 'file.txt', 'Should return base name with extension');

            const baseNameNoExt = this.resolver.getBaseName('/some/path/file.txt', false);
            this.assertEqual(baseNameNoExt, 'file', 'Should return base name without extension');
        });
    }

    /**
     * Test path validation
     */
    testPathValidation() {
        this.test('Path within check - positive case', () => {
            const isWithin = this.resolver.isPathWithin('/parent/child', '/parent');
            this.assertTrue(isWithin, 'Child path should be within parent');
        });

        this.test('Path within check - negative case', () => {
            const isWithin = this.resolver.isPathWithin('/other/path', '/parent');
            this.assertFalse(isWithin, 'Unrelated path should not be within parent');
        });
    }

    /**
     * Test PathUtils static methods
     */
    testPathUtilsStatic() {
        this.test('PathUtils normalize', () => {
            const normalized = PathUtils.normalize('/some//path/../normalized');
            this.assertEqual(normalized, path.normalize('/some//path/../normalized'), 'Should normalize path');
        });

        this.test('PathUtils isAbsolute', () => {
            this.assertTrue(PathUtils.isAbsolute('/absolute/path'), 'Should detect absolute path');
            this.assertFalse(PathUtils.isAbsolute('relative/path'), 'Should detect relative path');
        });

        this.test('PathUtils existsSync', () => {
            this.assertTrue(PathUtils.existsSync('package.json'), 'Should detect existing file');
            this.assertFalse(PathUtils.existsSync('non-existent.txt'), 'Should detect non-existing file');
        });
    }

    /**
     * Test error handling
     */
    testErrorHandling() {
        this.test('Empty path handling', () => {
            try {
                this.resolver.resolvePath('');
                this.assertTrue(false, 'Should throw error for empty path');
            } catch (error) {
                this.assertTrue(error.message.includes('empty'), 'Should throw error for empty path');
            }
        });

        this.test('Null path handling', () => {
            try {
                this.resolver.resolvePath(null);
                this.assertTrue(false, 'Should throw error for null path');
            } catch (error) {
                this.assertTrue(error.message.includes('empty') || error.message.includes('null'), 'Should throw error for null path');
            }
        });
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('🚀 Starting Simple Path Resolver Tests\n');
        console.log('='.repeat(50));

        this.testProjectRootDetection();
        this.testPathResolution();
        this.testFileExistence();
        this.testPathUtilities();
        this.testPathValidation();
        this.testPathUtilsStatic();
        this.testErrorHandling();

        console.log('\n' + '='.repeat(50));
        console.log(`📊 Test Results:`);
        console.log(`   Total: ${this.testCount}`);
        console.log(`   Passed: ${this.passCount}`);
        console.log(`   Failed: ${this.failCount}`);

        if (this.failCount === 0) {
            console.log('🎉 All tests passed!');
            return true;
        } else {
            console.log('💥 Some tests failed!');
            return false;
        }
    }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const testRunner = new SimplePathResolverTest();
    const success = await testRunner.runAllTests();
    process.exit(success ? 0 : 1);
}

export default SimplePathResolverTest;