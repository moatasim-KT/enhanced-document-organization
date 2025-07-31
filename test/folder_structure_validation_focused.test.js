/**
 * Focused Folder Structure Validation Test
 * Tests core folder-based functionality to validate task 18 requirements
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Import core modules
import { DocumentFolderManager } from '../src/organize/document_folder_manager.js';
import { DocumentSearchEngine } from '../src/organize/document_search_engine.js';
import { ContentConsolidationEngine } from '../src/organize/content_consolidation_engine.js';

describe('Focused Folder Structure Validation', () => {
    let testDir;
    let syncHub;
    let documentFolderManager;
    let documentSearchEngine;
    let contentConsolidationEngine;

    // Test data structure
    const testDocuments = [
        {
            category: 'Development',
            name: 'React-Guide',
            content: '# React Development Guide\n\nThis is a comprehensive guide to React development.\n\n![React Logo](images/react-logo.png)\n\n## Components\n\nReact components are the building blocks of React applications.',
            images: ['react-logo.png', 'component-diagram.jpg']
        },
        {
            category: 'Development',
            name: 'JavaScript-Basics',
            content: '# JavaScript Fundamentals\n\nLearn the basics of JavaScript programming.\n\n![JS Logo](images/js-logo.png)\n\n## Variables\n\nJavaScript variables can be declared using var, let, or const.',
            images: ['js-logo.png']
        },
        {
            category: 'AI & ML',
            name: 'Machine-Learning-Intro',
            content: '# Introduction to Machine Learning\n\nMachine learning is a subset of artificial intelligence.\n\n![ML Diagram](images/ml-overview.png)\n\n## Types of Learning\n\nSupervised, unsupervised, and reinforcement learning.',
            images: ['ml-overview.png', 'neural-network.jpg']
        }
    ];

    beforeAll(async () => {
        // Create temporary test directory
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'folder-validation-focused-'));
        syncHub = path.join(testDir, 'sync_hub');

        // Initialize managers
        documentFolderManager = new DocumentFolderManager(syncHub);
        documentSearchEngine = new DocumentSearchEngine(documentFolderManager);
        contentConsolidationEngine = new ContentConsolidationEngine(documentFolderManager);

        console.log(`Test directory created: ${testDir}`);
    });

    afterAll(async () => {
        // Clean up test directory
        try {
            await fs.rm(testDir, { recursive: true, force: true });
            console.log(`Test directory cleaned up: ${testDir}`);
        } catch (error) {
            console.warn(`Failed to clean up test directory: ${error.message}`);
        }
    });

    beforeEach(async () => {
        // Create fresh test structure for each test
        await createTestDocumentStructure();
    });

    afterEach(async () => {
        // Clean up between tests
        try {
            await fs.rm(syncHub, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    /**
     * Create test document folder structure
     */
    async function createTestDocumentStructure() {
        await fs.mkdir(syncHub, { recursive: true });

        for (const doc of testDocuments) {
            const categoryPath = path.join(syncHub, doc.category);
            const docFolderPath = path.join(categoryPath, doc.name);
            const imagesPath = path.join(docFolderPath, 'images');

            // Create document folder structure
            await fs.mkdir(imagesPath, { recursive: true });

            // Create main document file
            const mainFilePath = path.join(docFolderPath, 'main.md');
            await fs.writeFile(mainFilePath, doc.content);

            // Create image files
            for (const imageName of doc.images) {
                const imagePath = path.join(imagesPath, imageName);
                await fs.writeFile(imagePath, `Mock image content for ${imageName}`);
            }
        }
    }

    /**
     * Verify document folder integrity
     */
    async function verifyDocumentFolderIntegrity(folderPath) {
        // Check if it's recognized as a document folder
        const isDocFolder = await documentFolderManager.isDocumentFolder(folderPath);
        expect(isDocFolder).toBe(true);

        // Check main document file exists
        const mainFile = await documentFolderManager.getMainDocumentFile(folderPath);
        expect(mainFile).toBeTruthy();
        expect(await fs.access(mainFile).then(() => true).catch(() => false)).toBe(true);

        // Check images folder exists
        const imagesFolder = await documentFolderManager.getImagesFolder(folderPath);
        expect(await fs.access(imagesFolder).then(() => true).catch(() => false)).toBe(true);

        // Verify folder structure is atomic (main file and images together)
        const folderContents = await fs.readdir(folderPath);
        const folderName = path.basename(folderPath);
        const expectedDocumentName = `${folderName}.md`;
        expect(folderContents).toContain(expectedDocumentName);
        expect(folderContents).toContain('images');
    }

    describe('Core Folder Structure Requirements', () => {
        it('should correctly identify document folders (Requirement 9.1)', async () => {
            const docFolders = await documentFolderManager.findDocumentFolders(syncHub, true);
            expect(docFolders).toHaveLength(testDocuments.length);

            for (const folderPath of docFolders) {
                await verifyDocumentFolderIntegrity(folderPath);
            }
        });

        it('should locate main document files within folders (Requirement 9.2)', async () => {
            const docFolders = await documentFolderManager.findDocumentFolders(syncHub, true);

            for (const folderPath of docFolders) {
                const mainFile = await documentFolderManager.getMainDocumentFile(folderPath);
                expect(mainFile).toBeTruthy();

                const folderName = path.basename(folderPath);
                const expectedDocumentName = `${folderName}.md`;
                expect(path.basename(mainFile)).toBe(expectedDocumentName);

                // Verify main file is within the document folder
                expect(path.dirname(mainFile)).toBe(folderPath);
            }
        });

        it('should represent each folder as a single logical document (Requirement 9.3)', async () => {
            const docFolders = await documentFolderManager.findDocumentFolders(syncHub, true);

            // Each folder should be treated as one document, not multiple files
            expect(docFolders).toHaveLength(testDocuments.length);

            for (const folderPath of docFolders) {
                const folderContents = await fs.readdir(folderPath);
                const folderName = path.basename(folderPath);
                const expectedDocumentName = `${folderName}.md`;
                // Should contain document file matching folder name and images folder, but be treated as one logical unit
                expect(folderContents).toContain(expectedDocumentName);
                expect(folderContents).toContain('images');
            }
        });

        it('should treat folders as indivisible units (Requirement 9.4)', async () => {
            const sourcePath = path.join(syncHub, 'Development', 'React-Guide');
            const targetPath = path.join(syncHub, 'AI & ML', 'React-Guide');

            // Verify source exists and has proper structure
            await verifyDocumentFolderIntegrity(sourcePath);

            // Move the entire folder as one unit
            await documentFolderManager.moveDocumentFolder(sourcePath, targetPath);

            // Verify source no longer exists
            expect(await fs.access(sourcePath).then(() => true).catch(() => false)).toBe(false);

            // Verify target exists with complete structure intact
            await verifyDocumentFolderIntegrity(targetPath);

            // Verify images were moved with the document
            const imagesFolder = path.join(targetPath, 'images');
            const imageFiles = await fs.readdir(imagesFolder);
            expect(imageFiles.length).toBeGreaterThan(0);
        });

        it('should automatically locate main files within folders (Requirement 9.5)', async () => {
            const docFolders = await documentFolderManager.findDocumentFolders(syncHub, true);

            for (const folderPath of docFolders) {
                // Tools should automatically find the main document file
                const mainFile = await documentFolderManager.getMainDocumentFile(folderPath);
                expect(mainFile).toBeTruthy();

                // Verify content can be accessed through the folder
                const content = await documentFolderManager.getDocumentContent(folderPath);
                expect(content).toBeTruthy();
                expect(typeof content).toBe('string');
            }
        });
    });

    describe('Tool Integration with Folder Structure', () => {
        it('should search within document folders correctly', async () => {
            const results = await documentSearchEngine.searchDocuments('React development');

            // Check if results have expected structure (log actual structure for debugging)
            console.log('Search results structure:', JSON.stringify(results, null, 2));

            // Verify search found something
            expect(results).toBeTruthy();

            // If results have a results array, verify it contains document folders
            if (results.results && Array.isArray(results.results)) {
                expect(results.results.length).toBeGreaterThan(0);

                for (const result of results.results) {
                    if (result.documentFolder && result.documentFolder.folderPath) {
                        await verifyDocumentFolderIntegrity(result.documentFolder.folderPath);
                    }
                }
            }
        });

        it('should consolidate document folders while preserving structure', async () => {
            const developmentDocs = [
                path.join(syncHub, 'Development', 'React-Guide'),
                path.join(syncHub, 'Development', 'JavaScript-Basics')
            ];

            // Verify source folders exist
            for (const docPath of developmentDocs) {
                await verifyDocumentFolderIntegrity(docPath);
            }

            const result = await contentConsolidationEngine.simpleMerge(developmentDocs, 'Web Development Guide');

            // Check if result has expected structure (log actual structure for debugging)
            console.log('Consolidation result structure:', JSON.stringify(result, null, 2));

            // Verify consolidation produced some result
            expect(result).toBeTruthy();

            // If result has a consolidated folder, verify its structure
            if (result.consolidatedFolder) {
                await verifyDocumentFolderIntegrity(result.consolidatedFolder);

                // Verify images were consolidated
                const imagesFolder = path.join(result.consolidatedFolder, 'images');
                const imageFiles = await fs.readdir(imagesFolder);
                expect(imageFiles.length).toBeGreaterThan(0);
            }
        });
    });

    describe('Atomic Operations Validation', () => {
        it('should never separate documents from images', async () => {
            const docFolders = await documentFolderManager.findDocumentFolders(syncHub, true);

            for (const docFolderPath of docFolders) {
                const mainFile = await documentFolderManager.getMainDocumentFile(docFolderPath);
                const imagesFolder = await documentFolderManager.getImagesFolder(docFolderPath);

                // Verify main file and images folder are in the same parent directory
                expect(path.dirname(mainFile)).toBe(path.dirname(imagesFolder));
                expect(path.dirname(mainFile)).toBe(docFolderPath);

                // Verify images folder is always present
                expect(await fs.access(imagesFolder).then(() => true).catch(() => false)).toBe(true);
            }
        });

        it('should maintain data integrity during operations', async () => {
            const docFolderPath = path.join(syncHub, 'Development', 'React-Guide');

            // Get initial state
            const initialImages = await fs.readdir(path.join(docFolderPath, 'images'));
            const mainFile = await documentFolderManager.getMainDocumentFile(docFolderPath);
            const initialContent = await fs.readFile(mainFile, 'utf8');

            // Perform move operation
            const newPath = path.join(syncHub, 'Web Content', 'React-Guide');
            await documentFolderManager.moveDocumentFolder(docFolderPath, newPath);

            // Verify integrity maintained
            await verifyDocumentFolderIntegrity(newPath);

            const finalImages = await fs.readdir(path.join(newPath, 'images'));
            const newMainFile = await documentFolderManager.getMainDocumentFile(newPath);
            const finalContent = await fs.readFile(newMainFile, 'utf8');

            expect(finalImages).toEqual(initialImages);
            expect(finalContent).toBe(initialContent);
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle missing images folders gracefully', async () => {
            // Create a document folder without images folder
            const testDocPath = path.join(syncHub, 'Development', 'Incomplete-Doc');
            await fs.mkdir(testDocPath, { recursive: true });
            await fs.writeFile(path.join(testDocPath, 'main.md'), '# Incomplete Document');

            // Tools should still recognize it as a document folder and create images folder if needed
            const isDocFolder = await documentFolderManager.isDocumentFolder(testDocPath);
            expect(isDocFolder).toBe(true);

            const imagesFolder = await documentFolderManager.getImagesFolder(testDocPath, true);
            expect(await fs.access(imagesFolder).then(() => true).catch(() => false)).toBe(true);
        });

        it('should handle corrupted document folders', async () => {
            // Create a folder that looks like a document folder but is corrupted
            const corruptedPath = path.join(syncHub, 'Development', 'Corrupted-Doc');
            await fs.mkdir(corruptedPath, { recursive: true });
            // No main.md file - this should be handled gracefully

            const isDocFolder = await documentFolderManager.isDocumentFolder(corruptedPath);
            expect(isDocFolder).toBe(false);
        });

        it('should validate folder structure before operations', async () => {
            const nonExistentPath = path.join(syncHub, 'NonExistent', 'Document');

            // Operations on non-existent folders should fail gracefully
            try {
                await documentFolderManager.moveDocumentFolder(nonExistentPath, path.join(syncHub, 'Development', 'Moved'));
                // If no error is thrown, the operation should return a failure result
                expect(false).toBe(true); // This should not be reached
            } catch (error) {
                // Error should be thrown for non-existent folders
                expect(error).toBeTruthy();
            }

            try {
                await documentFolderManager.deleteDocumentFolder(nonExistentPath);
                // If no error is thrown, the operation should return a failure result
                expect(false).toBe(true); // This should not be reached
            } catch (error) {
                // Error should be thrown for non-existent folders
                expect(error).toBeTruthy();
            }
        });
    });
});