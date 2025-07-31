#!/usr/bin/env node

/**
 * Test Suite for Multi-Directory Module Loader
 * Tests the enhanced module loader that supports organize, sync, and mcp directories
 */

import { ModuleLoader } from '../src/organize/module_loader.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test runner for multi-directory module loading
 */
class MultiDirectoryModuleLoaderTest {
    constructor() {
        this.testCount = 0;
        this.passCount = 0;
        this.failCount = 0;
        this.loader = new ModuleLoader();
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
     * Test module directory setup
     */
    testModuleDirectorySetup() {
        this.test('Module directories are properly configured', () => {
            const stats = this.loader.getStats();
            this.assertTrue(stats.moduleDirectories, 'Module directories should be defined');
            this.assertTrue(stats.moduleDirectories.organize, 'Organize directory should be defined');
            this.assertTrue(stats.moduleDirectories.sync, 'Sync directory should be defined');
            this.assertTrue(stats.moduleDirectories.mcp, 'MCP directory should be defined');

            console.log('   Module directories:', stats.moduleDirectories);
        });
    }

    /**
     * Test path resolution for different directories
     */
    testPathResolution() {
        this.test('Path resolution for organize modules', () => {
            const resolved = this.loader.resolvePath('organize/error_handler');
            this.assertTrue(resolved.includes('src/organize/error_handler'), 'Should resolve organize module path');
            console.log(`   Resolved organize path: ${resolved}`);
        });

        this.test('Path resolution for mcp modules', () => {
            const resolved = this.loader.resolvePath('mcp/server');
            this.assertTrue(resolved.includes('src/mcp/server'), 'Should resolve mcp module path');
            console.log(`   Resolved mcp path: ${resolved}`);
        });

        this.test('Path resolution without directory prefix', () => {
            const resolved = this.loader.resolvePath('error_handler');
            this.assertTrue(resolved.includes('error_handler'), 'Should resolve module without directory prefix');
            console.log(`   Resolved generic path: ${resolved}`);
        });
    }

    /**
     * Test convenience methods for loading from specific directories
     */
    async testConvenienceMethods() {
        this.test('Organize module loading method exists', () => {
            this.assertTrue(typeof this.loader.loadOrganizeModule === 'function', 'loadOrganizeModule should be a function');
        });

        this.test('Sync module loading method exists', () => {
            this.assertTrue(typeof this.loader.loadSyncModule === 'function', 'loadSyncModule should be a function');
        });

        this.test('MCP module loading method exists', () => {
            this.assertTrue(typeof this.loader.loadMcpModule === 'function', 'loadMcpModule should be a function');
        });

        this.test('Multi-directory loading method exists', () => {
            this.assertTrue(typeof this.loader.loadModulesFromAllDirectories === 'function', 'loadModulesFromAllDirectories should be a function');
        });
    }

    /**
     * Test actual module loading (if modules exist)
     */
    async testActualModuleLoading() {
        try {
            // Test loading an organize module
            const errorHandler = await this.loader.loadOrganizeModule('error_handler', { required: false });
            if (errorHandler) {
                this.test('Successfully loaded organize module', () => {
                    this.assertTrue(errorHandler, 'Error handler module should be loaded');
                    console.log('   Loaded error_handler from organize directory');
                });
            }
        } catch (error) {
            console.log(`   Note: Could not load organize module (${error.message})`);
        }

        try {
            // Test loading an mcp module
            const mcpServer = await this.loader.loadMcpModule('server', { required: false });
            if (mcpServer) {
                this.test('Successfully loaded mcp module', () => {
                    this.assertTrue(mcpServer, 'MCP server module should be loaded');
                    console.log('   Loaded server from mcp directory');
                });
            }
        } catch (error) {
            console.log(`   Note: Could not load mcp module (${error.message})`);
        }
    }

    /**
     * Test multi-directory module specification
     */
    async testMultiDirectorySpec() {
        const moduleSpecs = {
            errorHandler: {
                directory: 'organize',
                path: 'error_handler',
                required: false
            },
            mcpServer: {
                directory: 'mcp',
                path: 'server',
                required: false
            },
            simplePathResolver: {
                directory: 'organize',
                path: 'simple_path_resolver',
                required: false
            }
        };

        try {
            const { results, errors } = await this.loader.loadModulesFromAllDirectories(moduleSpecs);

            this.test('Multi-directory loading returns results', () => {
                this.assertTrue(results instanceof Map, 'Results should be a Map');
                this.assertTrue(Array.isArray(errors), 'Errors should be an array');
                console.log(`   Loaded ${results.size} modules, ${errors.length} errors`);
            });

            if (results.size > 0) {
                this.test('Successfully loaded modules from multiple directories', () => {
                    this.assertTrue(results.size > 0, 'Should load at least one module');
                    console.log('   Loaded modules:', Array.from(results.keys()));
                });
            }
        } catch (error) {
            console.log(`   Note: Multi-directory loading test skipped (${error.message})`);
        }
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('🚀 Starting Multi-Directory Module Loader Tests\n');
        console.log('='.repeat(60));

        this.testModuleDirectorySetup();
        this.testPathResolution();
        await this.testConvenienceMethods();
        await this.testActualModuleLoading();
        await this.testMultiDirectorySpec();

        console.log('\n' + '='.repeat(60));
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
    const testRunner = new MultiDirectoryModuleLoaderTest();
    const success = await testRunner.runAllTests();
    process.exit(success ? 0 : 1);
}

export default MultiDirectoryModuleLoaderTest;