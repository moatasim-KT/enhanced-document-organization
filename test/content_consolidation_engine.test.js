#!/usr/bin/env node

/**
 * Test suite for ContentConsolidationEngine
 * Tests the new content consolidation functionality
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ContentConsolidationEngine } from '../src/organize/content_consolidation_engine.js';
import { DocumentFolderManager } from '../src/organize/document_folder_manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TestRunner {
    constructor() {
        this.testDir = path.join(__dirname, 'test_data', 'consolidation_test');
        this.syncHub = path.join(this.testDir, 'sync_hub');
        this.passed = 0;
        this.failed = 0;
        this.errors = [];
    }

    async setup() {
        console.log('Setting up test environment...');

        // Clean up any existing test data
        try {
            await fs.rm(this.testDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore if directory doesn't exist
        }

        // Create test directory structure
        await fs.mkdir(this.testDir, { recursive: true });
        await fs.mkdir(this.syncHub, { recursive: true });

        // Create test document folders
        await this.createTestDocumentFolder('AI-Basics', 'AI & ML', `# AI Basics

Artificial Intelligence is a field of computer science that aims to create intelligent machines.

## Key Concepts

- Machine Learning
- Neural Networks
- Deep Learning

## Applications

AI is used in many areas including:
- Healthcare
- Finance
- Transportation`);

        await this.createTestDocumentFolder('Machine-Learning-Guide', 'AI & ML', `# Machine Learning Guide

Machine Learning is a subset of AI that enables computers to learn without being explicitly programmed.

## Types of Learning

1. Supervised Learning
2. Unsupervised Learning
3. Reinforcement Learning

## Algorithms

Common ML algorithms include:
- Linear Regression
- Decision Trees
- Neural Networks`);

        await this.createTestDocumentFolder('Deep-Learning-Overview', 'AI & ML', `# Deep Learning Overview

Deep Learning uses neural networks with multiple layers to model and understand complex patterns.

## Neural Networks

Neural networks are inspired by the human brain and consist of interconnected nodes.

## Applications

Deep learning is particularly effective for:
- Image recognition
- Natural language processing
- Speech recognition`);

        console.log('Test environment setup complete');
    }

    async createTestDocumentFolder(folderName, category, content) {
        const categoryPath = path.join(this.syncHub, category);
        const folderPath = path.join(categoryPath, folderName);
        const imagesPath = path.join(folderPath, 'images');

        await fs.mkdir(folderPath, { recursive: true });
        await fs.mkdir(imagesPath, { recursive: true });
        await fs.writeFile(path.join(folderPath, 'main.md'), content, 'utf8');

        // Create a test image file with unique name based on folder
        const imageName = `${folderName.toLowerCase()}-image.png`;
        await fs.writeFile(path.join(imagesPath, imageName), 'fake image data', 'utf8');
    }

    async runTest(testName, testFunction) {
        try {
            console.log(`\nRunning test: ${testName}`);
            await testFunction();
            console.log(`✅ ${testName} - PASSED`);
            this.passed++;
        } catch (error) {
            console.error(`❌ ${testName} - FAILED: ${error.message}`);
            this.errors.push({ test: testName, error: error.message });
            this.failed++;
        }
    }

    async testSimpleMerge() {
        const documentFolderManager = new DocumentFolderManager(this.syncHub);
        const engine = new ContentConsolidationEngine(documentFolderManager, {
            syncHubPath: this.syncHub,
            dryRun: false
        });

        const documentFolders = [
            path.join(this.syncHub, 'AI & ML', 'AI-Basics'),
            path.join(this.syncHub, 'AI & ML', 'Machine-Learning-Guide')
        ];

        const result = await engine.consolidateContent(documentFolders, 'AI Fundamentals', 'simple_merge');

        if (!result.success) {
            throw new Error('Consolidation failed');
        }

        // Verify consolidated document exists
        const consolidatedDoc = path.join(result.consolidatedFolder, 'main.md');
        const content = await fs.readFile(consolidatedDoc, 'utf8');

        if (!content.includes('AI Fundamentals - Consolidated Document')) {
            throw new Error('Consolidated document missing expected header');
        }

        if (!content.includes('AI Basics') || !content.includes('Machine Learning Guide')) {
            throw new Error('Consolidated document missing source content');
        }

        if (!content.includes('Table of Contents')) {
            throw new Error('Simple merge should include table of contents');
        }
    }

    async testStructuredConsolidation() {
        const documentFolderManager = new DocumentFolderManager(this.syncHub);
        const engine = new ContentConsolidationEngine(documentFolderManager, {
            syncHubPath: this.syncHub,
            dryRun: false
        });

        const documentFolders = [
            path.join(this.syncHub, 'AI & ML', 'AI-Basics'),
            path.join(this.syncHub, 'AI & ML', 'Deep-Learning-Overview')
        ];

        const result = await engine.consolidateContent(documentFolders, 'AI and Deep Learning', 'structured_consolidation');

        if (!result.success) {
            throw new Error('Structured consolidation failed');
        }

        // Verify consolidated document exists
        const consolidatedDoc = path.join(result.consolidatedFolder, 'main.md');
        const content = await fs.readFile(consolidatedDoc, 'utf8');

        if (!content.includes('AI and Deep Learning - Consolidated Document')) {
            throw new Error('Consolidated document missing expected header');
        }

        if (!content.includes('Overview')) {
            throw new Error('Structured consolidation should include overview section');
        }

        if (!content.includes('Main Content')) {
            throw new Error('Structured consolidation should include main content section');
        }
    }

    async testComprehensiveMerge() {
        const documentFolderManager = new DocumentFolderManager(this.syncHub);
        const engine = new ContentConsolidationEngine(documentFolderManager, {
            syncHubPath: this.syncHub,
            dryRun: false
        });

        const documentFolders = [
            path.join(this.syncHub, 'AI & ML', 'AI-Basics'),
            path.join(this.syncHub, 'AI & ML', 'Machine-Learning-Guide'),
            path.join(this.syncHub, 'AI & ML', 'Deep-Learning-Overview')
        ];

        const result = await engine.consolidateContent(documentFolders, 'Complete AI Guide', 'comprehensive_merge');

        if (!result.success) {
            throw new Error('Comprehensive merge failed');
        }

        // Verify consolidated document exists
        const consolidatedDoc = path.join(result.consolidatedFolder, 'main.md');
        const content = await fs.readFile(consolidatedDoc, 'utf8');

        if (!content.includes('Complete AI Guide - Consolidated Document')) {
            throw new Error('Consolidated document missing expected header');
        }

        if (!content.includes('Executive Summary')) {
            throw new Error('Comprehensive merge should include executive summary');
        }

        if (!content.includes('Document Metadata')) {
            throw new Error('Comprehensive merge should include metadata section');
        }
    }

    async testImageConsolidation() {
        const documentFolderManager = new DocumentFolderManager(this.syncHub);
        const engine = new ContentConsolidationEngine(documentFolderManager, {
            syncHubPath: this.syncHub,
            dryRun: false
        });

        const documentFolders = [
            path.join(this.syncHub, 'AI & ML', 'AI-Basics'),
            path.join(this.syncHub, 'AI & ML', 'Machine-Learning-Guide')
        ];

        const result = await engine.consolidateContent(documentFolders, 'AI with Images', 'simple_merge');

        if (!result.success) {
            throw new Error('Image consolidation failed');
        }

        // Verify images folder exists in consolidated document
        const imagesFolder = path.join(result.consolidatedFolder, 'images');
        const imageFiles = await fs.readdir(imagesFolder);

        if (imageFiles.length === 0) {
            throw new Error('No images were consolidated');
        }

        // Should have consolidated images from both source folders (2 test images)
        if (imageFiles.length !== 2) {
            throw new Error(`Expected 2 images, but found ${imageFiles.length}: ${imageFiles.join(', ')}`);
        }
    }

    async testDryRun() {
        const documentFolderManager = new DocumentFolderManager(this.syncHub);
        const engine = new ContentConsolidationEngine(documentFolderManager, {
            syncHubPath: this.syncHub,
            dryRun: true
        });

        const documentFolders = [
            path.join(this.syncHub, 'AI & ML', 'AI-Basics')
        ];

        const result = await engine.consolidateContent(documentFolders, 'Dry Run Test', 'simple_merge');

        if (!result.success) {
            throw new Error('Dry run failed');
        }

        // Verify no actual files were created
        try {
            await fs.access(result.consolidatedFolder);
            throw new Error('Dry run should not create actual folders');
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
            // Expected - folder should not exist in dry run
        }
    }

    async testErrorHandling() {
        const documentFolderManager = new DocumentFolderManager(this.syncHub);
        const engine = new ContentConsolidationEngine(documentFolderManager, {
            syncHubPath: this.syncHub,
            dryRun: false
        });

        // Test with non-existent folders
        const documentFolders = [
            path.join(this.syncHub, 'NonExistent', 'Folder1'),
            path.join(this.syncHub, 'NonExistent', 'Folder2')
        ];

        try {
            const result = await engine.consolidateContent(documentFolders, 'Error Test', 'simple_merge');

            // Should handle gracefully and return success: false or empty content
            if (result.success && result.metadata.totalSections > 0) {
                throw new Error('Should not succeed with non-existent folders');
            }
        } catch (error) {
            // Expected to throw an error for non-existent folders
            if (!error.message.includes('content') && !error.message.includes('folder')) {
                throw error;
            }
        }
    }

    async cleanup() {
        console.log('\nCleaning up test environment...');
        try {
            await fs.rm(this.testDir, { recursive: true, force: true });
        } catch (error) {
            console.warn('Cleanup warning:', error.message);
        }
    }

    async run() {
        console.log('🧪 Starting ContentConsolidationEngine Tests\n');

        try {
            await this.setup();

            await this.runTest('Simple Merge Strategy', () => this.testSimpleMerge());
            await this.runTest('Structured Consolidation Strategy', () => this.testStructuredConsolidation());
            await this.runTest('Comprehensive Merge Strategy', () => this.testComprehensiveMerge());
            await this.runTest('Image Consolidation', () => this.testImageConsolidation());
            await this.runTest('Dry Run Mode', () => this.testDryRun());
            await this.runTest('Error Handling', () => this.testErrorHandling());

        } finally {
            await this.cleanup();
        }

        console.log('\n📊 Test Results:');
        console.log(`✅ Passed: ${this.passed}`);
        console.log(`❌ Failed: ${this.failed}`);
        console.log(`📈 Success Rate: ${Math.round((this.passed / (this.passed + this.failed)) * 100)}%`);

        if (this.failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.errors.forEach(({ test, error }) => {
                console.log(`  - ${test}: ${error}`);
            });
            process.exit(1);
        } else {
            console.log('\n🎉 All tests passed!');
        }
    }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const runner = new TestRunner();
    runner.run().catch(error => {
        console.error('Test runner failed:', error);
        process.exit(1);
    });
}

export { TestRunner };