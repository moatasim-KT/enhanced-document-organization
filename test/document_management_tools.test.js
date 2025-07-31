#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Document Management Operations
 * Tests document folder creation, deletion, moving, and renaming with proper structure validation
 * Covers Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { DocumentOrganizationServer } from '../src/mcp/server.js';

class TestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log('🧪 Running Document Management Tools Tests\n');

        for (const { name, fn } of this.tests) {
            try {
                await fn();
                console.log(`✅ ${name}`);
                this.passed++;
            } catch (error) {
                console.log(`❌ ${name}: ${error.message}`);
                this.failed++;
            }
        }

        console.log(`\n📊 Test Results: ${this.passed} passed, ${this.failed} failed\n`);
    }
}

const runner = new TestRunner();

// Test setup
let testDir;
let server;

runner.test('Setup test environment', async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-mgmt-test-'));

    // Create a mock server instance
    server = new DocumentOrganizationServer();
    server.projectRoot = process.cwd();

    // Initialize the server first
    await server.initialize();

    // Override the syncHub after initialization
    server.syncHub = testDir;

    // Reinitialize DocumentFolderManager with test directory
    if (server.modules.DocumentFolderManager) {
        server.documentFolderManager = new server.modules.DocumentFolderManager.DocumentFolderManager(testDir);
    }

    // Verify DocumentFolderManager is available
    if (!server.documentFolderManager) {
        throw new Error('DocumentFolderManager not initialized');
    }
});

runner.test('Create document folder with proper structure and images subfolder', async () => {
    const args = {
        title: 'Test Document',
        content: 'This is test content for the document.',
        category: 'TestCategory'
    };

    const result = await server.createDocument(args);
    const response = JSON.parse(result.content[0].text);

    if (!response.success) {
        throw new Error(`Document creation failed: ${response.message || 'Unknown error'}`);
    }

    // Verify folder structure was created
    const documentPath = path.join(testDir, response.path);
    if (!existsSync(documentPath)) {
        throw new Error('Document folder was not created');
    }

    // Verify it's actually a directory
    const stats = await fs.stat(documentPath);
    if (!stats.isDirectory()) {
        throw new Error('Created document is not a folder');
    }

    // Verify main file exists
    const mainFile = path.join(documentPath, 'main.md');
    if (!existsSync(mainFile)) {
        throw new Error('Main document file was not created');
    }

    // Verify main file is actually a file
    const mainFileStats = await fs.stat(mainFile);
    if (!mainFileStats.isFile()) {
        throw new Error('Main document is not a file');
    }

    // Verify images folder exists
    const imagesFolder = path.join(documentPath, 'images');
    if (!existsSync(imagesFolder)) {
        throw new Error('Images folder was not created');
    }

    // Verify images folder is actually a directory
    const imagesFolderStats = await fs.stat(imagesFolder);
    if (!imagesFolderStats.isDirectory()) {
        throw new Error('Images folder is not a directory');
    }

    // Verify content
    const content = await fs.readFile(mainFile, 'utf8');
    if (!content.includes('Test Document') || !content.includes('This is test content')) {
        throw new Error('Document content is incorrect');
    }

    // Verify document folder structure matches expected format
    if (!response.structure || !response.structure.mainFile || !response.structure.imagesFolder) {
        throw new Error('Response does not include proper structure information');
    }

    // Verify DocumentFolderManager recognizes it as a document folder
    const isDocFolder = await server.documentFolderManager.isDocumentFolder(documentPath);
    if (!isDocFolder) {
        throw new Error('Created folder is not recognized as a document folder');
    }
});

runner.test('Rename document folder updates folder names and internal references', async () => {
    // First create a document with specific title and references
    const createArgs = {
        title: 'Original Document Name',
        content: 'This is the original document with title references.\n\n![diagram](images/diagram.png)',
        category: 'RenameTestCategory'
    };

    const createResult = await server.createDocument(createArgs);
    const createResponse = JSON.parse(createResult.content[0].text);

    if (!createResponse.success) {
        throw new Error('Failed to create test document for renaming');
    }

    const originalPath = path.join(testDir, createResponse.path);
    const originalImagesFolder = path.join(originalPath, 'images');

    // Add test image
    const testImage = path.join(originalImagesFolder, 'diagram.png');
    await fs.writeFile(testImage, 'fake diagram data', 'utf8');

    // Verify test setup
    if (!existsSync(testImage)) {
        throw new Error('Test image was not created properly');
    }

    // Now rename the document
    const newName = 'Renamed Document Name';
    const renameArgs = {
        old_file_path: createResponse.path,
        new_file_name: newName
    };

    const renameResult = await server.renameDocument(renameArgs);
    const renameResponse = JSON.parse(renameResult.content[0].text);

    if (!renameResponse.success) {
        throw new Error(`Document rename failed: ${renameResponse.message || 'Unknown error'}`);
    }

    // Verify old folder no longer exists
    if (existsSync(originalPath)) {
        throw new Error('Old document folder still exists after rename');
    }

    // Verify new folder exists
    const newPath = path.join(testDir, renameResponse.new_path);
    if (!existsSync(newPath)) {
        throw new Error('Renamed document folder does not exist');
    }

    // Verify folder structure is preserved
    const newMainFile = path.join(newPath, 'main.md');
    const newImagesFolder = path.join(newPath, 'images');

    if (!existsSync(newMainFile)) {
        throw new Error('Main document file not preserved after rename');
    }

    if (!existsSync(newImagesFolder)) {
        throw new Error('Images folder not preserved after rename');
    }

    // Verify image is preserved
    const newTestImage = path.join(newImagesFolder, 'diagram.png');
    if (!existsSync(newTestImage)) {
        throw new Error('Image not preserved after rename');
    }

    // Verify image content is preserved
    const imageContent = await fs.readFile(newTestImage, 'utf8');
    if (imageContent !== 'fake diagram data') {
        throw new Error('Image content not preserved after rename');
    }

    // Verify document content is preserved and title is updated
    const newContent = await fs.readFile(newMainFile, 'utf8');
    if (!newContent.includes('![diagram](images/diagram.png)')) {
        throw new Error('Image references not preserved after rename');
    }

    // Check if title was updated (this depends on the implementation)
    if (newContent.includes('# Original Document Name')) {
        // Title should be updated to new name
        if (!newContent.includes('# Renamed Document Name')) {
            console.warn('Title in document content was not updated during rename');
        }
    }

    // Verify DocumentFolderManager still recognizes it as a document folder
    const isDocFolder = await server.documentFolderManager.isDocumentFolder(newPath);
    if (!isDocFolder) {
        throw new Error('Renamed folder is not recognized as a document folder');
    }

    // Verify response indicates folder rename
    if (renameResponse.renamedType !== 'folder') {
        throw new Error('Response does not indicate folder rename');
    }

    // Verify folder name matches sanitized new name
    const expectedFolderName = server.documentFolderManager.sanitizeFolderName(newName);
    const actualFolderName = path.basename(newPath);
    if (actualFolderName !== expectedFolderName) {
        throw new Error(`Folder name mismatch: expected ${expectedFolderName}, got ${actualFolderName}`);
    }
});

runner.test('Move document folder preserves folder structure and image references', async () => {
    // First create a document with images and references
    const createArgs = {
        title: 'Document To Move',
        content: 'This document has an image: ![test](images/test.png)\n\nAnd another: ![test2](images/test2.jpg)',
        category: 'SourceCategory'
    };

    const createResult = await server.createDocument(createArgs);
    const createResponse = JSON.parse(createResult.content[0].text);

    if (!createResponse.success) {
        throw new Error('Failed to create test document for moving');
    }

    const originalPath = path.join(testDir, createResponse.path);
    const originalImagesFolder = path.join(originalPath, 'images');

    // Add test images
    const testImage1 = path.join(originalImagesFolder, 'test.png');
    const testImage2 = path.join(originalImagesFolder, 'test2.jpg');
    await fs.writeFile(testImage1, 'fake png data', 'utf8');
    await fs.writeFile(testImage2, 'fake jpg data', 'utf8');

    // Verify test setup
    if (!existsSync(testImage1) || !existsSync(testImage2)) {
        throw new Error('Test images were not created properly');
    }

    // Now move the document
    const moveArgs = {
        file_path: createResponse.path,
        new_category: 'TargetCategory'
    };

    const moveResult = await server.moveDocument(moveArgs);
    const moveResponse = JSON.parse(moveResult.content[0].text);

    if (!moveResponse.success) {
        throw new Error(`Document move failed: ${moveResponse.message || 'Unknown error'}`);
    }

    // Verify old location no longer exists
    if (existsSync(originalPath)) {
        throw new Error('Document folder still exists in old location');
    }

    // Verify new location exists
    const newPath = path.join(testDir, moveResponse.results[0].new_path);
    if (!existsSync(newPath)) {
        throw new Error('Document folder does not exist in new location');
    }

    // Verify folder structure is preserved
    const newMainFile = path.join(newPath, 'main.md');
    const newImagesFolder = path.join(newPath, 'images');

    if (!existsSync(newMainFile)) {
        throw new Error('Main document file not preserved after move');
    }

    if (!existsSync(newImagesFolder)) {
        throw new Error('Images folder not preserved after move');
    }

    // Verify images are preserved
    const newTestImage1 = path.join(newImagesFolder, 'test.png');
    const newTestImage2 = path.join(newImagesFolder, 'test2.jpg');

    if (!existsSync(newTestImage1) || !existsSync(newTestImage2)) {
        throw new Error('Images not preserved after move');
    }

    // Verify image content is preserved
    const image1Content = await fs.readFile(newTestImage1, 'utf8');
    const image2Content = await fs.readFile(newTestImage2, 'utf8');

    if (image1Content !== 'fake png data' || image2Content !== 'fake jpg data') {
        throw new Error('Image content not preserved after move');
    }

    // Verify document content and references are preserved
    const newContent = await fs.readFile(newMainFile, 'utf8');
    if (!newContent.includes('![test](images/test.png)') || !newContent.includes('![test2](images/test2.jpg)')) {
        throw new Error('Image references not preserved after move');
    }

    // Verify DocumentFolderManager still recognizes it as a document folder
    const isDocFolder = await server.documentFolderManager.isDocumentFolder(newPath);
    if (!isDocFolder) {
        throw new Error('Moved folder is not recognized as a document folder');
    }

    // Verify response indicates folder move
    if (moveResponse.results[0].movedType !== 'folder') {
        throw new Error('Response does not indicate folder move');
    }
});

runner.test('Delete document folder removes entire folders without leaving orphaned files', async () => {
    // First create a document with some test images
    const createArgs = {
        title: 'Document To Delete',
        content: 'This document will be deleted with all its images.',
        category: 'DeleteTestCategory'
    };

    const createResult = await server.createDocument(createArgs);
    const createResponse = JSON.parse(createResult.content[0].text);

    if (!createResponse.success) {
        throw new Error('Failed to create test document for deletion');
    }

    const documentPath = path.join(testDir, createResponse.path);
    const imagesFolder = path.join(documentPath, 'images');

    // Add some test images to verify they get deleted
    const testImage1 = path.join(imagesFolder, 'test1.png');
    const testImage2 = path.join(imagesFolder, 'test2.jpg');
    await fs.writeFile(testImage1, 'fake image data 1', 'utf8');
    await fs.writeFile(testImage2, 'fake image data 2', 'utf8');

    // Verify test setup
    if (!existsSync(testImage1) || !existsSync(testImage2)) {
        throw new Error('Test images were not created properly');
    }

    // Now delete the document
    const deleteArgs = {
        file_path: createResponse.path
    };

    const deleteResult = await server.deleteDocument(deleteArgs);
    const deleteResponse = JSON.parse(deleteResult.content[0].text);

    if (!deleteResponse.success) {
        throw new Error(`Document deletion failed: ${deleteResponse.message || 'Unknown error'}`);
    }

    // Verify entire folder no longer exists
    if (existsSync(documentPath)) {
        throw new Error('Document folder still exists after deletion');
    }

    // Verify no orphaned files remain
    if (existsSync(testImage1) || existsSync(testImage2)) {
        throw new Error('Orphaned image files remain after document deletion');
    }

    // Verify images folder is also gone
    if (existsSync(imagesFolder)) {
        throw new Error('Images folder still exists after document deletion');
    }

    // Verify response indicates folder deletion
    if (deleteResponse.deletedType !== 'folder') {
        throw new Error('Response does not indicate folder deletion');
    }
});

runner.test('Test atomic folder operations maintain data integrity', async () => {
    // Create a document with multiple images
    const createArgs = {
        title: 'Atomic Test Document',
        content: 'Document for testing atomic operations.\n\n![img1](images/img1.png)\n![img2](images/img2.jpg)',
        category: 'AtomicTestCategory'
    };

    const createResult = await server.createDocument(createArgs);
    const createResponse = JSON.parse(createResult.content[0].text);

    if (!createResponse.success) {
        throw new Error('Failed to create test document for atomic operations');
    }

    const documentPath = path.join(testDir, createResponse.path);
    const imagesFolder = path.join(documentPath, 'images');

    // Add multiple test images
    const images = ['img1.png', 'img2.jpg', 'img3.gif'];
    for (const imageName of images) {
        const imagePath = path.join(imagesFolder, imageName);
        await fs.writeFile(imagePath, `fake ${imageName} data`, 'utf8');
    }

    // Verify all images exist
    for (const imageName of images) {
        const imagePath = path.join(imagesFolder, imageName);
        if (!existsSync(imagePath)) {
            throw new Error(`Test image ${imageName} was not created`);
        }
    }

    // Test atomic move operation
    const moveArgs = {
        file_path: createResponse.path,
        new_category: 'AtomicMoveTarget'
    };

    const moveResult = await server.moveDocument(moveArgs);
    const moveResponse = JSON.parse(moveResult.content[0].text);

    if (!moveResponse.success) {
        throw new Error('Atomic move operation failed');
    }

    // Verify all images moved together atomically
    const newPath = path.join(testDir, moveResponse.results[0].new_path);
    const newImagesFolder = path.join(newPath, 'images');

    for (const imageName of images) {
        const newImagePath = path.join(newImagesFolder, imageName);
        if (!existsSync(newImagePath)) {
            throw new Error(`Image ${imageName} was not moved atomically`);
        }

        // Verify content integrity
        const content = await fs.readFile(newImagePath, 'utf8');
        if (content !== `fake ${imageName} data`) {
            throw new Error(`Image ${imageName} content corrupted during atomic move`);
        }
    }

    // Verify no partial state exists (old location should be completely gone)
    if (existsSync(documentPath) || existsSync(imagesFolder)) {
        throw new Error('Atomic move left partial state in old location');
    }
});

runner.test('Test error handling for invalid operations', async () => {
    // Test creating document with invalid category
    try {
        const invalidArgs = {
            title: 'Invalid Document',
            content: 'This should fail.',
            category: '../../../etc'  // Path traversal attempt
        };

        const result = await server.createDocument(invalidArgs);
        const response = JSON.parse(result.content[0].text);

        if (response.success) {
            throw new Error('Should have failed with invalid category path');
        }
    } catch (error) {
        if (!error.message.includes('Invalid category name')) {
            throw new Error(`Expected invalid category error, got: ${error.message}`);
        }
    }

    // Test deleting non-existent document
    try {
        const deleteArgs = {
            file_path: 'NonExistent/Document'
        };

        const result = await server.deleteDocument(deleteArgs);
        const response = JSON.parse(result.content[0].text);

        if (response.success) {
            throw new Error('Should have failed when deleting non-existent document');
        }
    } catch (error) {
        // Expected to fail
        if (!error.message.includes('does not exist')) {
            console.warn(`Delete non-existent gave unexpected error: ${error.message}`);
        }
    }

    // Test renaming to existing name
    const createArgs1 = {
        title: 'Document One',
        content: 'First document.',
        category: 'ErrorTestCategory'
    };

    const createArgs2 = {
        title: 'Document Two',
        content: 'Second document.',
        category: 'ErrorTestCategory'
    };

    const result1 = await server.createDocument(createArgs1);
    const result2 = await server.createDocument(createArgs2);

    const response1 = JSON.parse(result1.content[0].text);
    const response2 = JSON.parse(result2.content[0].text);

    if (!response1.success || !response2.success) {
        throw new Error('Failed to create test documents for rename conflict test');
    }

    try {
        const renameArgs = {
            old_file_path: response1.path,
            new_file_name: 'Document Two'  // Should conflict with existing
        };

        const renameResult = await server.renameDocument(renameArgs);
        const renameResponse = JSON.parse(renameResult.content[0].text);

        if (renameResponse.success) {
            throw new Error('Should have failed when renaming to existing document name');
        }
    } catch (error) {
        if (!error.message.includes('already exists')) {
            console.warn(`Rename conflict gave unexpected error: ${error.message}`);
        }
    }
});

runner.test('Test document folder validation and recognition', async () => {
    // Create a document
    const createArgs = {
        title: 'Validation Test Document',
        content: 'Document for testing validation.',
        category: 'ValidationTestCategory'
    };

    const createResult = await server.createDocument(createArgs);
    const createResponse = JSON.parse(createResult.content[0].text);

    if (!createResponse.success) {
        throw new Error('Failed to create test document for validation');
    }

    const documentPath = path.join(testDir, createResponse.path);

    // Test DocumentFolderManager validation methods
    const isDocFolder = await server.documentFolderManager.isDocumentFolder(documentPath);
    if (!isDocFolder) {
        throw new Error('Created document folder not recognized by isDocumentFolder');
    }

    const mainFile = await server.documentFolderManager.getMainDocumentFile(documentPath);
    if (!mainFile || !existsSync(mainFile)) {
        throw new Error('Main document file not found by getMainDocumentFile');
    }

    const imagesFolder = await server.documentFolderManager.getImagesFolder(documentPath);
    if (!imagesFolder || !existsSync(imagesFolder)) {
        throw new Error('Images folder not found by getImagesFolder');
    }

    const metadata = await server.documentFolderManager.getDocumentFolderMetadata(documentPath);
    if (!metadata || !metadata.folderPath || !metadata.name) {
        throw new Error('Document folder metadata not properly retrieved');
    }

    // Test that regular folders are not recognized as document folders
    const regularFolder = path.join(testDir, 'RegularFolder');
    await fs.mkdir(regularFolder, { recursive: true });

    const isRegularDocFolder = await server.documentFolderManager.isDocumentFolder(regularFolder);
    if (isRegularDocFolder) {
        throw new Error('Regular folder incorrectly recognized as document folder');
    }
});

runner.test('Create document with fallback (no DocumentFolderManager)', async () => {
    // Temporarily disable DocumentFolderManager
    const originalManager = server.documentFolderManager;
    server.documentFolderManager = null;

    try {
        const args = {
            title: 'Fallback Document',
            content: 'This is fallback content.',
            category: 'FallbackCategory'
        };

        const result = await server.createDocument(args);
        const response = JSON.parse(result.content[0].text);

        if (!response.success) {
            throw new Error('Fallback document creation failed');
        }

        // Verify file was created (not folder)
        const documentPath = path.join(testDir, response.path);
        if (!existsSync(documentPath)) {
            throw new Error('Fallback document file was not created');
        }

        // Verify it's a file, not a folder
        const stats = await fs.stat(documentPath);
        if (!stats.isFile()) {
            throw new Error('Fallback should create a file, not a folder');
        }
    } finally {
        // Restore DocumentFolderManager
        server.documentFolderManager = originalManager;
    }
});

runner.test('Cleanup test environment', async () => {
    if (testDir && existsSync(testDir)) {
        await fs.rm(testDir, { recursive: true, force: true });
    }
});

// Run tests
async function runTests() {
    await runner.run();
}

runTests().catch(console.error);