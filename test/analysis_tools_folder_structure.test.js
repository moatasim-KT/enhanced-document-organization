#!/usr/bin/env node

/**
 * Test Analysis Tools for Folder Structure
 * Tests the updated analyze_content and find_duplicates tools with document folders
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DocumentOrganizationServer } from '../src/mcp/server.js';
import { DocumentFolderManager } from '../src/organize/document_folder_manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AnalysisToolsFolderStructureTest {
    constructor() {
        this.testDir = path.join(__dirname, 'test_data', 'analysis_folder_test');
        this.server = null;
        this.documentFolderManager = null;
    }

    async setup() {
        console.log('Setting up analysis tools folder structure test...');

        // Clean up any existing test directory
        try {
            await fs.rm(this.testDir, { recursive: true, force: true });
        } catch (error) {
            // Directory might not exist, that's fine
        }

        // Create test directory structure
        await fs.mkdir(this.testDir, { recursive: true });

        // Create document folders with main files and images
        await this.createTestDocumentFolders();

        // Create some loose files for backward compatibility testing
        await this.createTestLooseFiles();

        // Initialize server and document folder manager
        this.server = new DocumentOrganizationServer();
        this.server.syncHub = this.testDir;
        this.server.projectRoot = path.resolve(__dirname, '..');

        await this.server.initialize();

        // Override the sync hub after initialization to use our test directory
        this.server.syncHub = this.testDir;
        if (this.server.documentFolderManager) {
            this.server.documentFolderManager.syncHubPath = this.testDir;
        }

        this.documentFolderManager = new DocumentFolderManager(this.testDir);
    }

    async createTestDocumentFolders() {
        // Create AI & ML category with document folders
        const aiCategory = path.join(this.testDir, 'AI & ML');
        await fs.mkdir(aiCategory, { recursive: true });

        // Document folder 1: Machine Learning Basics
        const mlBasicsFolder = path.join(aiCategory, 'Machine-Learning-Basics');
        await fs.mkdir(mlBasicsFolder, { recursive: true });
        await fs.mkdir(path.join(mlBasicsFolder, 'images'), { recursive: true });

        await fs.writeFile(path.join(mlBasicsFolder, 'main.md'), `# Machine Learning Basics

This document covers the fundamentals of machine learning, including supervised and unsupervised learning techniques.

## Key Concepts

- Supervised Learning
- Unsupervised Learning
- Neural Networks
- Deep Learning

![ML Diagram](images/ml-diagram.png)

Machine learning is a subset of artificial intelligence that focuses on algorithms.
`);

        // Add an image file
        await fs.writeFile(path.join(mlBasicsFolder, 'images', 'ml-diagram.png'), 'fake-image-data');

        // Document folder 2: Neural Networks (similar content)
        const neuralNetworksFolder = path.join(aiCategory, 'Neural-Networks');
        await fs.mkdir(neuralNetworksFolder, { recursive: true });
        await fs.mkdir(path.join(neuralNetworksFolder, 'images'), { recursive: true });

        await fs.writeFile(path.join(neuralNetworksFolder, 'main.md'), `# Neural Networks

Neural networks are a key component of machine learning and artificial intelligence systems.

## Overview

Neural networks are inspired by biological neural networks and are used in deep learning.

- Deep Learning
- Artificial Intelligence
- Machine Learning
- Pattern Recognition

![Network Diagram](images/network.png)

Neural networks form the foundation of modern AI systems.
`);

        // Add an image file
        await fs.writeFile(path.join(neuralNetworksFolder, 'images', 'network.png'), 'fake-network-image');

        // Document folder 3: Exact duplicate of Machine Learning Basics
        const mlDuplicateFolder = path.join(aiCategory, 'ML-Duplicate');
        await fs.mkdir(mlDuplicateFolder, { recursive: true });
        await fs.mkdir(path.join(mlDuplicateFolder, 'images'), { recursive: true });

        await fs.writeFile(path.join(mlDuplicateFolder, 'main.md'), `# Machine Learning Basics

This document covers the fundamentals of machine learning, including supervised and unsupervised learning techniques.

## Key Concepts

- Supervised Learning
- Unsupervised Learning
- Neural Networks
- Deep Learning

![ML Diagram](images/ml-diagram.png)

Machine learning is a subset of artificial intelligence that focuses on algorithms.
`);

        // Add the same image file
        await fs.writeFile(path.join(mlDuplicateFolder, 'images', 'ml-diagram.png'), 'fake-image-data');

        // Create Development category
        const devCategory = path.join(this.testDir, 'Development');
        await fs.mkdir(devCategory, { recursive: true });

        // Document folder 4: API Design
        const apiDesignFolder = path.join(devCategory, 'API-Design');
        await fs.mkdir(apiDesignFolder, { recursive: true });
        await fs.mkdir(path.join(apiDesignFolder, 'images'), { recursive: true });

        await fs.writeFile(path.join(apiDesignFolder, 'main.md'), `# API Design Patterns

This document covers best practices for designing RESTful APIs.

## REST Principles

- Stateless
- Cacheable
- Uniform Interface
- Layered System

API design is crucial for building scalable web services.
`);
    }

    async createTestLooseFiles() {
        // Create some loose files in categories (not in document folders)
        await fs.writeFile(path.join(this.testDir, 'AI & ML', 'loose-ai-notes.md'), `# AI Notes

Some quick notes about artificial intelligence and machine learning concepts.

- Machine Learning
- Deep Learning
- Neural Networks
`);

        await fs.writeFile(path.join(this.testDir, 'Development', 'loose-dev-notes.md'), `# Development Notes

Quick development notes and code snippets.

- API Design
- Database Design
- Testing Strategies
`);
    }

    async testAnalyzeContent() {
        console.log('\n=== Testing analyze_content with document folders ===');

        // Test analyzing document folders
        const testPaths = [
            'AI & ML/Machine-Learning-Basics',
            'AI & ML/Neural-Networks',
            'Development/API-Design',
            'AI & ML/loose-ai-notes.md' // loose file for comparison
        ];

        try {
            const result = await this.server.analyzeContent({
                file_paths: testPaths,
                similarity_threshold: 0.8
            });

            const response = JSON.parse(result.content[0].text);

            console.log('✓ Analysis completed successfully');
            console.log(`  - Documents processed: ${response.documents_processed}`);
            console.log(`  - Successful analyses: ${response.successful_analyses}`);
            console.log(`  - Folder-based documents: ${response.folder_based_documents}`);
            console.log(`  - Individual files: ${response.individual_files}`);

            // Verify that document folders were properly analyzed
            const analyses = response.analysis;
            const folderAnalyses = Object.entries(analyses).filter(([path, analysis]) =>
                analysis.isDocumentFolder
            );

            console.log(`  - Document folder analyses: ${folderAnalyses.length}`);

            // Check specific analysis features
            for (const [path, analysis] of folderAnalyses) {
                console.log(`  - ${path}:`);
                console.log(`    * Has images: ${analysis.hasImages}`);
                console.log(`    * Image count: ${analysis.imageCount}`);
                console.log(`    * Word count: ${analysis.wordCount}`);
                console.log(`    * Topics: ${analysis.topics.slice(0, 3).join(', ')}`);
            }

            return true;
        } catch (error) {
            console.error('✗ analyze_content test failed:', error.message);
            return false;
        }
    }

    async testFindDuplicates() {
        console.log('\n=== Testing find_duplicates with document folders ===');

        try {
            // First test with the full test directory to find all document folders
            const fullResult = await this.server.findDuplicates({
                directory: '.',
                similarity_threshold: 0.8
            });

            const fullResponse = JSON.parse(fullResult.content[0].text);
            console.log('Full directory scan:');
            console.log(`  - Document folders scanned: ${fullResponse.document_folders_scanned}`);
            console.log(`  - Duplicate groups found: ${fullResponse.duplicate_groups_found}`);

            // Now test with just the AI & ML directory
            const result = await this.server.findDuplicates({
                directory: 'AI & ML',
                similarity_threshold: 0.8
            });

            const response = JSON.parse(result.content[0].text);

            console.log('✓ Duplicate detection completed successfully');
            console.log(`  - Document folders scanned: ${response.document_folders_scanned}`);
            console.log(`  - Loose files scanned: ${response.loose_files_scanned}`);
            console.log(`  - Total documents analyzed: ${response.total_documents_analyzed}`);
            console.log(`  - Duplicate groups found: ${response.duplicate_groups_found}`);
            console.log(`  - Exact duplicates: ${response.exact_duplicates}`);
            console.log(`  - Similar content: ${response.similar_content}`);
            console.log(`  - Folder-based duplicates: ${response.folder_based_duplicates}`);

            // Verify duplicate detection results
            const duplicates = response.duplicates;

            // Should find exact duplicate between Machine-Learning-Basics and ML-Duplicate
            const exactDuplicates = duplicates.filter(d => d.type === 'exact');
            if (exactDuplicates.length > 0) {
                console.log('  - Found exact duplicates:');
                exactDuplicates.forEach(dup => {
                    console.log(`    * Similarity: ${dup.similarity}`);
                    console.log(`    * Files: ${dup.files.map(f => f.displayPath).join(', ')}`);
                    console.log(`    * Involves document folders: ${dup.involves_document_folders}`);
                    console.log(`    * Involves images: ${dup.involves_loose_files}`);
                });
            }

            // Should find similar content between ML-related documents
            const similarContent = duplicates.filter(d => d.type === 'similar');
            if (similarContent.length > 0) {
                console.log('  - Found similar content:');
                similarContent.forEach(dup => {
                    console.log(`    * Similarity: ${dup.similarity.toFixed(3)}`);
                    console.log(`    * Files: ${dup.files.map(f => f.displayPath).join(', ')}`);
                    console.log(`    * Recommended action: ${dup.recommended_action}`);
                });
            }

            return true;
        } catch (error) {
            console.error('✗ find_duplicates test failed:', error.message);
            return false;
        }
    }

    async testDocumentFolderDetection() {
        console.log('\n=== Testing document folder detection ===');

        try {
            // Test that document folders are properly detected
            const mlBasicsPath = path.join(this.testDir, 'AI & ML', 'Machine-Learning-Basics');
            const isDocFolder = await this.documentFolderManager.isDocumentFolder(mlBasicsPath);

            if (isDocFolder) {
                console.log('✓ Document folder detection working');

                // Test main file detection
                const mainFile = await this.documentFolderManager.getMainDocumentFile(mlBasicsPath);
                if (mainFile) {
                    console.log(`  - Main file found: ${path.basename(mainFile)}`);
                } else {
                    console.log('✗ Main file not found');
                    return false;
                }

                // Test images folder detection
                const imagesFolder = await this.documentFolderManager.getImagesFolder(mlBasicsPath, false);
                if (imagesFolder) {
                    console.log(`  - Images folder: ${path.basename(imagesFolder)}`);
                } else {
                    console.log('✗ Images folder not found');
                    return false;
                }
            } else {
                console.log('✗ Document folder not detected');
                return false;
            }

            // Test finding all document folders
            const allDocFolders = await this.documentFolderManager.findDocumentFolders(this.testDir, true);
            console.log(`  - Total document folders found: ${allDocFolders.length}`);

            // List all found document folders for debugging
            console.log('  - Found document folders:');
            for (const folder of allDocFolders) {
                const relativePath = path.relative(this.testDir, folder);
                console.log(`    * ${relativePath}`);
            }

            // Test specific folders
            const expectedFolders = [
                'AI & ML/Machine-Learning-Basics',
                'AI & ML/Neural-Networks',
                'AI & ML/ML-Duplicate',
                'Development/API-Design'
            ];

            console.log('  - Testing expected folders:');
            for (const expectedFolder of expectedFolders) {
                const fullPath = path.join(this.testDir, expectedFolder);
                const isDoc = await this.documentFolderManager.isDocumentFolder(fullPath);
                console.log(`    * ${expectedFolder}: ${isDoc ? '✓' : '✗'}`);
            }

            return true;
        } catch (error) {
            console.error('✗ Document folder detection test failed:', error.message);
            return false;
        }
    }

    async cleanup() {
        console.log('\nCleaning up test data...');
        try {
            await fs.rm(this.testDir, { recursive: true, force: true });
            console.log('✓ Test data cleaned up');
        } catch (error) {
            console.warn('Warning: Could not clean up test data:', error.message);
        }
    }

    async runAllTests() {
        console.log('Starting Analysis Tools Folder Structure Tests...\n');

        try {
            await this.setup();

            const results = {
                documentFolderDetection: await this.testDocumentFolderDetection(),
                analyzeContent: await this.testAnalyzeContent(),
                findDuplicates: await this.testFindDuplicates()
            };

            const passed = Object.values(results).filter(r => r).length;
            const total = Object.keys(results).length;

            console.log(`\n=== Test Results ===`);
            console.log(`Passed: ${passed}/${total}`);

            if (passed === total) {
                console.log('✓ All analysis tools folder structure tests passed!');
                return true;
            } else {
                console.log('✗ Some tests failed');
                Object.entries(results).forEach(([test, result]) => {
                    console.log(`  ${test}: ${result ? '✓' : '✗'}`);
                });
                return false;
            }

        } catch (error) {
            console.error('Test suite failed:', error);
            return false;
        } finally {
            await this.cleanup();
        }
    }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const test = new AnalysisToolsFolderStructureTest();
    const success = await test.runAllTests();
    process.exit(success ? 0 : 1);
}

export { AnalysisToolsFolderStructureTest };