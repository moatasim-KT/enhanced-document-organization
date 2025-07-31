#!/usr/bin/env node

/**
 * Test suite for DocumentFolderManager
 * Tests the core functionality of folder-based document operations
 */

import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { DocumentFolderManager } from '../src/organize/document_folder_manager.js';

/**
 * Simple test runner
 */
class TestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, testFn) {
        this.tests.push({ name, testFn });
    }

    async run() {
        console.log('🧪 Running DocumentFolderManager Tests\n');

        for (const { name, testFn } of this.tests) {
            try {
                await testFn();
                console.log(`✅ ${name}`);
                this.passed++;
            } catch (error) {
                console.log(`❌ ${name}`);
                console.log(`   Error: ${error.message}`);
                this.failed++;
            }
        }

        console.log(`\n📊 Test Results: ${this.passed} passed, ${this.failed} failed`);
        return this.failed === 0;
    }
}

/**
 * Test helper functions
 */
async function createTempDir() {
    const tempDir = path.join(os.tmpdir(), `doc-folder-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
}

async function cleanupTempDir(tempDir) {
    if (existsSync(tempDir)) {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

/**
 * Run tests
 */
async function runTests() {
    const runner = new TestRunner();
    let tempDir;
    let manager;

    // Setup
    runner.test('Setup test environment', async () => {
        tempDir = await createTempDir();
        manager = new DocumentFolderManager(tempDir);
        assert(manager instanceof DocumentFolderManager, 'Manager should be instance of DocumentFolderManager');
    });

    // Test folder creation
    runner.test('Create document folder', async () => {
        const folderPath = await manager.createDocumentFolder('Test Document', 'TestCategory', '# Test Content\n\nThis is a test.');

        assert(existsSync(folderPath), 'Document folder should exist');
        assert(existsSync(path.join(folderPath, 'main.md')), 'Main document file should exist');
        assert(existsSync(path.join(folderPath, 'images')), 'Images subfolder should exist');

        const content = await fs.readFile(path.join(folderPath, 'main.md'), 'utf8');
        assert(content.includes('Test Content'), 'Main file should contain the provided content');
    });

    // Test folder detection
    runner.test('Detect document folder', async () => {
        const folderPath = path.join(tempDir, 'TestCategory', 'Test-Document');
        const isDocFolder = await manager.isDocumentFolder(folderPath);
        assert(isDocFolder, 'Should detect valid document folder');

        const nonDocFolder = await manager.isDocumentFolder(tempDir);
        assert(!nonDocFolder, 'Should not detect non-document folder as document folder');
    });

    // Test main file detection
    runner.test('Find main document file', async () => {
        const folderPath = path.join(tempDir, 'TestCategory', 'Test-Document');
        const mainFile = await manager.getMainDocumentFile(folderPath);

        assert(mainFile !== null, 'Should find main document file');
        assert(mainFile.endsWith('main.md'), 'Should find the correct main file');
        assert(existsSync(mainFile), 'Main file should exist');
    });

    // Test content operations
    runner.test('Get and update document content', async () => {
        const folderPath = path.join(tempDir, 'TestCategory', 'Test-Document');

        const originalContent = await manager.getDocumentContent(folderPath);
        assert(originalContent.includes('Test Content'), 'Should get original content');

        const newContent = '# Updated Content\n\nThis content has been updated.';
        await manager.updateDocumentContent(folderPath, newContent);

        const updatedContent = await manager.getDocumentContent(folderPath);
        assert(updatedContent.includes('Updated Content'), 'Should get updated content');
    });

    // Test folder listing
    runner.test('List document folders', async () => {
        const categoryPath = path.join(tempDir, 'TestCategory');
        const folders = await manager.listDocumentFolders(categoryPath);

        assert(folders.length === 1, 'Should find one document folder');
        assert(folders[0].includes('Test-Document'), 'Should find the test document folder');
    });

    // Test recursive finding
    runner.test('Find document folders recursively', async () => {
        // Create another document in a different category
        await manager.createDocumentFolder('Another Document', 'AnotherCategory', '# Another test');

        const allFolders = await manager.findDocumentFolders(tempDir, true);
        assert(allFolders.length === 2, 'Should find both document folders');
    });

    // Test metadata
    runner.test('Get document folder metadata', async () => {
        const folderPath = path.join(tempDir, 'TestCategory', 'Test-Document');
        const metadata = await manager.getDocumentFolderMetadata(folderPath);

        assert(metadata.name === 'Test-Document', 'Should have correct name');
        assert(metadata.category === 'TestCategory', 'Should have correct category');
        assert(metadata.mainFile.endsWith('main.md'), 'Should have correct main file');
        assert(typeof metadata.metadata.created === 'object', 'Should have creation date');
    });

    // Test folder moving
    runner.test('Move document folder', async () => {
        const sourcePath = path.join(tempDir, 'TestCategory', 'Test-Document');
        const targetPath = path.join(tempDir, 'TestCategory', 'Moved-Document');

        await manager.moveDocumentFolder(sourcePath, targetPath);

        assert(!existsSync(sourcePath), 'Source folder should not exist after move');
        assert(existsSync(targetPath), 'Target folder should exist after move');
        assert(existsSync(path.join(targetPath, 'main.md')), 'Main file should exist in target');
        assert(existsSync(path.join(targetPath, 'images')), 'Images folder should exist in target');
    });

    // Test folder deletion
    runner.test('Delete document folder', async () => {
        const folderPath = path.join(tempDir, 'TestCategory', 'Moved-Document');

        await manager.deleteDocumentFolder(folderPath);

        assert(!existsSync(folderPath), 'Document folder should not exist after deletion');
    });

    // Test error handling
    runner.test('Handle non-existent folder', async () => {
        const nonExistentPath = path.join(tempDir, 'NonExistent');

        try {
            await manager.getDocumentContent(nonExistentPath);
            assert(false, 'Should throw error for non-existent folder');
        } catch (error) {
            assert(error.message.includes('No main document file found'), 'Should throw appropriate error');
        }
    });

    // Cleanup
    runner.test('Cleanup test environment', async () => {
        await cleanupTempDir(tempDir);
        assert(!existsSync(tempDir), 'Temp directory should be cleaned up');
    });

    const success = await runner.run();
    process.exit(success ? 0 : 1);
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runTests().catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

export { runTests };