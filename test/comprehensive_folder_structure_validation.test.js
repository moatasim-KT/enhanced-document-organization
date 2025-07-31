/**
 * Comprehensive Folder Structure Validation Test
 * Tests all MCP tools with the new document folder architecture
 * Ensures tools correctly identify and process document folders
 * Validates atomic folder operations maintain data integrity
 * Verifies no tool separates documents from their associated images
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Import all required modules
import { DocumentFolderManager } from '../src/organize/document_folder_manager.js';
import { DocumentSearchEngine } from '../src/organize/document_search_engine.js';
import { ContentConsolidationEngine } from '../src/organize/content_consolidation_engine.js';
import { ContentAnalyzer } from '../src/organize/content_analyzer.js';
import { CategoryManager } from '../src/organize/category_manager.js';
import BatchProcessor from '../src/organize/batch_processor.js';

describe('Comprehensive Folder Structure Validation', () => {
    let testDir;
    let syncHub;
    let documentFolderManager;
    let documentSearchEngine;
    let contentConsolidationEngine;
    let contentAnalyzer;
    let categoryManager;
    let batchProcessor;

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
        },
        {
            category: 'Research Papers',
            name: 'NLP-Research-2024',
            content: '# Natural Language Processing Research 2024\n\n## Abstract\n\nThis paper explores recent advances in NLP.\n\n![Architecture](images/transformer-arch.png)\n\n## Methodology\n\nWe used transformer-based models.',
            images: ['transformer-arch.png']
        }
    ];

    beforeAll(async () => {
        // Create temporary test directory
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'folder-validation-test-'));
        syncHub = path.join(testDir, 'sync_hub');

        // Initialize all managers
        documentFolderManager = new DocumentFolderManager(syncHub);
        documentSearchEngine = new DocumentSearchEngine(documentFolderManager);
        contentConsolidationEngine = new ContentConsolidationEngine(documentFolderManager);
        contentAnalyzer = new ContentAnalyzer(syncHub);
        categoryManager = new CategoryManager(syncHub);
        batchProcessor = new BatchProcessor(syncHub);

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
        expect(folderContents).toContain('main.md');
        expect(folderContents).toContain('images');
    }

    describe('Document Folder Manager Validation', () => {
        it('should correctly identify document folders', async () => {
            const docFolders = await documentFolderManager.findDocumentFolders(syncHub, true);
            expect(docFolders).toHaveLength(testDocuments.length);

            for (const folderPath of docFolders) {
                await verifyDocumentFolderIntegrity(folderPath);
            }
        });

        it('should create document folders with proper structure', async () => {
            const newDocName = 'Test-Document';
            const category = 'Development';
            const content = '# Test Document\n\nThis is a test document.\n\n![Test Image](images/test.png)';

            const result = await documentFolderManager.createDocumentFolder(newDocName, category, content);
            expect(result.success).toBe(true);

            const docFolderPath = path.join(syncHub, category, newDocName);
            await verifyDocumentFolderIntegrity(docFolderPath);
        });

        it('should move document folders atomically', async () => {
            const sourcePath = path.join(syncHub, 'Development', 'React-Guide');
            const targetPath = path.join(syncHub, 'AI & ML', 'React-Guide');

            // Verify source exists and has proper structure
            await verifyDocumentFolderIntegrity(sourcePath);

            const result = await documentFolderManager.moveDocumentFolder(sourcePath, targetPath);
            expect(result.success).toBe(true);

            // Verify source no longer exists
            expect(await fs.access(sourcePath).then(() => true).catch(() => false)).toBe(false);

            // Verify target exists with proper structure
            await verifyDocumentFolderIntegrity(targetPath);
        });

        it('should delete document folders completely', async () => {
            const docFolderPath = path.join(syncHub, 'Development', 'React-Guide');

            // Verify it exists first
            await verifyDocumentFolderIntegrity(docFolderPath);

            const result = await documentFolderManager.deleteDocumentFolder(docFolderPath);
            expect(result.success).toBe(true);

            // Verify complete removal
            expect(await fs.access(docFolderPath).then(() => true).catch(() => false)).toBe(false);
        });
    });

    describe('Document Search Engine Validation', () => {
        it('should search within document folders correctly', async () => {
            const results = await documentSearchEngine.searchDocuments('React development');

            expect(results.success).toBe(true);
            expect(results.results).toHaveLength(1);

            const result = results.results[0];
            expect(result.documentFolder.name).toBe('React-Guide');
            expect(result.documentFolder.category).toBe('Development');

            // Verify it found the document folder, not individual files
            expect(result.documentFolder.folderPath).toContain('React-Guide');
            await verifyDocumentFolderIntegrity(result.documentFolder.folderPath);
        });

        it('should search across all categories', async () => {
            const results = await documentSearchEngine.searchDocuments('learning');

            expect(results.success).toBe(true);
            expect(results.results.length).toBeGreaterThan(0);

            // Verify all results are document folders
            for (const result of results.results) {
                await verifyDocumentFolderIntegrity(result.documentFolder.folderPath);
            }
        });

        it('should search within specific categories', async () => {
            const results = await documentSearchEngine.searchInCategory('JavaScript', 'Development');

            expect(results.success).toBe(true);
            expect(results.results).toHaveLength(1);
            expect(results.results[0].documentFolder.name).toBe('JavaScript-Basics');

            await verifyDocumentFolderIntegrity(results.results[0].documentFolder.folderPath);
        });
    });

    describe('Content Consolidation Engine Validation', () => {
        it('should consolidate document folders while preserving structure', async () => {
            const developmentDocs = [
                path.join(syncHub, 'Development', 'React-Guide'),
                path.join(syncHub, 'Development', 'JavaScript-Basics')
            ];

            const result = await contentConsolidationEngine.simpleMerge(developmentDocs, 'Web Development Guide');

            expect(result.success).toBe(true);
            expect(result.consolidatedFolder).toBeTruthy();

            // Verify consolidated folder has proper structure
            await verifyDocumentFolderIntegrity(result.consolidatedFolder);

            // Verify images were consolidated
            const imagesFolder = path.join(result.consolidatedFolder, 'images');
            const imageFiles = await fs.readdir(imagesFolder);
            expect(imageFiles.length).toBeGreaterThan(0);

            // Verify original folders still exist (non-destructive consolidation)
            for (const docPath of developmentDocs) {
                await verifyDocumentFolderIntegrity(docPath);
            }
        });

        it('should handle image consolidation correctly', async () => {
            const docFolders = [
                path.join(syncHub, 'AI & ML', 'Machine-Learning-Intro'),
                path.join(syncHub, 'Research Papers', 'NLP-Research-2024')
            ];

            const result = await contentConsolidationEngine.comprehensiveMerge(docFolders, 'AI Research Compilation');

            expect(result.success).toBe(true);

            // Verify consolidated images
            const consolidatedImagesPath = path.join(result.consolidatedFolder, 'images');
            const consolidatedImages = await fs.readdir(consolidatedImagesPath);
            expect(consolidatedImages.length).toBeGreaterThan(0);

            // Verify image references were updated in content
            const mainFile = await documentFolderManager.getMainDocumentFile(result.consolidatedFolder);
            const content = await fs.readFile(mainFile, 'utf8');
            expect(content).toContain('images/');
        });
    });

    describe('Content Analyzer Validation', () => {
        it('should analyze document folders correctly', async () => {
            const result = await contentAnalyzer.analyzeContent();

            expect(result.success).toBe(true);
            expect(result.analysis.totalDocuments).toBe(testDocuments.length);

            // Verify it counted document folders, not individual files
            expect(result.analysis.documentsByCategory).toBeDefined();
            expect(result.analysis.documentsByCategory['Development']).toBe(2);
            expect(result.analysis.documentsByCategory['AI & ML']).toBe(1);
            expect(result.analysis.documentsByCategory['Research Papers']).toBe(1);
        });

        it('should find duplicates within document folders', async () => {
            // Create a duplicate document
            const duplicateContent = testDocuments[0].content;
            const duplicatePath = path.join(syncHub, 'Development', 'React-Guide-Copy');
            const imagesPath = path.join(duplicatePath, 'images');

            await fs.mkdir(imagesPath, { recursive: true });
            await fs.writeFile(path.join(duplicatePath, 'main.md'), duplicateContent);
            await fs.writeFile(path.join(imagesPath, 'test.png'), 'test image');

            const result = await contentAnalyzer.findDuplicates();

            expect(result.success).toBe(true);
            expect(result.duplicates.length).toBeGreaterThan(0);

            // Verify duplicates reference document folders
            for (const duplicate of result.duplicates) {
                for (const docPath of duplicate.documents) {
                    const parentDir = path.dirname(docPath);
                    await verifyDocumentFolderIntegrity(parentDir);
                }
            }
        });
    });

    describe('Category Manager Validation', () => {
        it('should list categories with document folder counts', async () => {
            const result = await categoryManager.listCategories();

            expect(result.success).toBe(true);
            expect(result.categories).toBeDefined();

            // Verify counts reflect document folders, not individual files
            const devCategory = result.categories.find(cat => cat.name === 'Development');
            expect(devCategory).toBeDefined();
            expect(devCategory.documentCount).toBe(2);

            const aiCategory = result.categories.find(cat => cat.name === 'AI & ML');
            expect(aiCategory).toBeDefined();
            expect(aiCategory.documentCount).toBe(1);
        });

        it('should suggest categories based on document folder content', async () => {
            const result = await categoryManager.suggestCategories();

            expect(result.success).toBe(true);
            expect(result.suggestions).toBeDefined();
            expect(Array.isArray(result.suggestions)).toBe(true);

            // Verify suggestions are based on document folder analysis
            expect(result.suggestions.length).toBeGreaterThan(0);
        });

        it('should add custom categories for document folders', async () => {
            const newCategory = 'Custom Category';
            const result = await categoryManager.addCustomCategory(newCategory, 'A custom category for testing');

            expect(result.success).toBe(true);

            // Verify category directory was created
            const categoryPath = path.join(syncHub, newCategory);
            expect(await fs.access(categoryPath).then(() => true).catch(() => false)).toBe(true);
        });
    });

    describe('Batch Processor Validation', () => {
        it('should process document folders in batches', async () => {
            const operation = async (docFolderPath) => {
                await verifyDocumentFolderIntegrity(docFolderPath);
                return { processed: true, path: docFolderPath };
            };

            const docFolders = await documentFolderManager.findDocumentFolders(syncHub, true);
            const result = await batchProcessor.processBatch(docFolders, operation, { batchSize: 2 });

            expect(result.success).toBe(true);
            expect(result.processed).toBe(docFolders.length);
            expect(result.results).toHaveLength(docFolders.length);

            // Verify all results are from document folders
            for (const batchResult of result.results) {
                expect(batchResult.processed).toBe(true);
                expect(batchResult.path).toBeTruthy();
            }
        });
    });

    describe('Atomic Operations Validation', () => {
        it('should maintain data integrity during folder operations', async () => {
            const docFolderPath = path.join(syncHub, 'Development', 'React-Guide');

            // Get initial state
            const initialImages = await fs.readdir(path.join(docFolderPath, 'images'));
            const initialContent = await fs.readFile(path.join(docFolderPath, 'main.md'), 'utf8');

            // Perform move operation
            const newPath = path.join(syncHub, 'Web Content', 'React-Guide');
            const moveResult = await documentFolderManager.moveDocumentFolder(docFolderPath, newPath);

            expect(moveResult.success).toBe(true);

            // Verify integrity maintained
            await verifyDocumentFolderIntegrity(newPath);

            const finalImages = await fs.readdir(path.join(newPath, 'images'));
            const finalContent = await fs.readFile(path.join(newPath, 'main.md'), 'utf8');

            expect(finalImages).toEqual(initialImages);
            expect(finalContent).toBe(initialContent);
        });

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

            // Search should skip corrupted folders
            const searchResult = await documentSearchEngine.searchDocuments('corrupted');
            expect(searchResult.success).toBe(true);
            // Should not find the corrupted folder
        });

        it('should validate folder structure before operations', async () => {
            const nonExistentPath = path.join(syncHub, 'NonExistent', 'Document');

            const moveResult = await documentFolderManager.moveDocumentFolder(nonExistentPath, path.join(syncHub, 'Development', 'Moved'));
            expect(moveResult.success).toBe(false);
            expect(moveResult.error).toBeTruthy();

            const deleteResult = await documentFolderManager.deleteDocumentFolder(nonExistentPath);
            expect(deleteResult.success).toBe(false);
            expect(deleteResult.error).toBeTruthy();
        });
    });

    describe('Integration with MCP Tools', () => {
        it('should work correctly with search_documents tool pattern', async () => {
            // Simulate MCP tool call pattern
            const toolArgs = {
                query: 'React development',
                category: 'Development',
                limit: 10
            };

            const result = await documentSearchEngine.searchInCategory(toolArgs.query, toolArgs.category);

            expect(result.success).toBe(true);
            expect(result.results.length).toBeLessThanOrEqual(toolArgs.limit);

            // Verify results are properly formatted for MCP response
            for (const searchResult of result.results) {
                expect(searchResult.documentFolder).toBeDefined();
                expect(searchResult.documentFolder.folderPath).toBeTruthy();
                expect(searchResult.preview).toBeTruthy();

                await verifyDocumentFolderIntegrity(searchResult.documentFolder.folderPath);
            }
        });

        it('should work correctly with consolidate_content tool pattern', async () => {
            // Simulate MCP tool call pattern
            const toolArgs = {
                documents: ['Development/React-Guide', 'Development/JavaScript-Basics'],
                topic: 'Frontend Development',
                strategy: 'simple_merge'
            };

            const docPaths = toolArgs.documents.map(doc => path.join(syncHub, doc));
            const result = await contentConsolidationEngine.simpleMerge(docPaths, toolArgs.topic);

            expect(result.success).toBe(true);
            expect(result.consolidatedFolder).toBeTruthy();

            // Verify consolidated result maintains folder structure
            await verifyDocumentFolderIntegrity(result.consolidatedFolder);

            // Verify response format suitable for MCP
            expect(result.mergedContent).toBeTruthy();
            expect(result.sourceDocuments).toEqual(docPaths);
        });
    });
});