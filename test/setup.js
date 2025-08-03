#!/usr/bin/env node

/**
 * Test Setup and Configuration
 * Provides shared test utilities and configuration for the test suite
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const TEST_CONFIG = {
    // Test directories
    TEST_ROOT: __dirname,
    PROJECT_ROOT: path.resolve(__dirname, '..'),
    TEMP_DIR: path.join(os.tmpdir(), 'drive_sync_tests'),
    
    // Test timeouts
    DEFAULT_TIMEOUT: 30000,
    INTEGRATION_TIMEOUT: 60000,
    
    // Test data
    SAMPLE_FILES: {
        'simple.txt': 'Simple test content',
        'markdown.md': '# Test Document\n\nThis is a test markdown file.',
        'unicode-café.txt': 'Content with unicode characters: café, naïve, résumé',
        'spaces in name.txt': 'File with spaces in the name'
    }
};

export class TestEnvironment {
    constructor(testName) {
        this.testName = testName;
        this.testDir = path.join(TEST_CONFIG.TEMP_DIR, testName);
        this.cleanupTasks = [];
    }

    async setup() {
        // Clean up any existing test directory
        try {
            await fs.rm(this.testDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore if directory doesn't exist
        }

        // Create test directory
        await fs.mkdir(this.testDir, { recursive: true });
        
        return this.testDir;
    }

    async createTestFiles(files = TEST_CONFIG.SAMPLE_FILES) {
        const createdFiles = [];
        
        for (const [filename, content] of Object.entries(files)) {
            const filePath = path.join(this.testDir, filename);
            await fs.writeFile(filePath, content);
            createdFiles.push(filePath);
        }
        
        return createdFiles;
    }

    async createTestDirectory(dirName, files = {}) {
        const dirPath = path.join(this.testDir, dirName);
        await fs.mkdir(dirPath, { recursive: true });
        
        const createdFiles = [];
        for (const [filename, content] of Object.entries(files)) {
            const filePath = path.join(dirPath, filename);
            await fs.writeFile(filePath, content);
            createdFiles.push(filePath);
        }
        
        return { dirPath, files: createdFiles };
    }

    addCleanupTask(task) {
        this.cleanupTasks.push(task);
    }

    async cleanup() {
        // Run custom cleanup tasks
        for (const task of this.cleanupTasks) {
            try {
                await task();
            } catch (error) {
                console.warn(`Cleanup task failed: ${error.message}`);
            }
        }

        // Remove test directory
        try {
            await fs.rm(this.testDir, { recursive: true, force: true });
        } catch (error) {
            console.warn(`Failed to cleanup test directory: ${error.message}`);
        }
    }
}

export class TestReporter {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            skipped: 0,
            errors: [],
            startTime: Date.now()
        };
    }

    logSuccess(testName, details = '') {
        console.log(`✅ ${testName}${details ? ` - ${details}` : ''}`);
        this.results.passed++;
    }

    logFailure(testName, error, details = '') {
        console.log(`❌ ${testName}: ${error}${details ? ` - ${details}` : ''}`);
        this.results.failed++;
        this.results.errors.push({ test: testName, error, details });
    }

    logSkipped(testName, reason = '') {
        console.log(`⏭️ ${testName}${reason ? ` - ${reason}` : ''}`);
        this.results.skipped++;
    }

    logInfo(message) {
        console.log(`ℹ️ ${message}`);
    }

    logWarning(message) {
        console.log(`⚠️ ${message}`);
    }

    generateSummary() {
        const duration = Date.now() - this.results.startTime;
        const total = this.results.passed + this.results.failed + this.results.skipped;
        const successRate = total > 0 ? ((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1) : 0;

        console.log('\n📊 Test Results Summary:');
        console.log('='.repeat(40));
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`⏭️ Skipped: ${this.results.skipped}`);
        console.log(`📈 Success Rate: ${successRate}%`);
        console.log(`⏱️ Duration: ${(duration / 1000).toFixed(2)}s`);

        if (this.results.errors.length > 0) {
            console.log('\n🔍 Error Details:');
            this.results.errors.forEach(({ test, error, details }) => {
                console.log(`  • ${test}: ${error}${details ? ` (${details})` : ''}`);
            });
        }

        return this.results.failed === 0;
    }

    getResults() {
        return { ...this.results };
    }
}

export async function importModule(modulePath) {
    try {
        const fullPath = path.resolve(TEST_CONFIG.PROJECT_ROOT, modulePath);
        return await import(fullPath);
    } catch (error) {
        throw new Error(`Failed to import module ${modulePath}: ${error.message}`);
    }
}

export function createMockConfig(overrides = {}) {
    return {
        SYNC_HUB: path.join(TEST_CONFIG.TEMP_DIR, 'mock_sync_hub'),
        PROJECT_ROOT: TEST_CONFIG.PROJECT_ROOT,
        LOG_LEVEL: 'error', // Reduce noise during tests
        DRY_RUN: true,
        ...overrides
    };
}

// Global test cleanup on process exit
process.on('exit', async () => {
    try {
        await fs.rm(TEST_CONFIG.TEMP_DIR, { recursive: true, force: true });
    } catch (error) {
        // Ignore cleanup errors on exit
    }
});

export default {
    TEST_CONFIG,
    TestEnvironment,
    TestReporter,
    importModule,
    createMockConfig
};
