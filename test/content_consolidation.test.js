#!/usr/bin/env node

/**
 * Vitest-compatible test suite for Content Consolidation
 * Tests all consolidation strategies with various document types and edge cases
 * Covers requirements 1.1, 1.2, 1.3, 1.4, 1.5 from the spec
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ContentConsolidationEngine } from '../src/organize/content_consolidation_engine.js';
import { DocumentFolderManager } from '../src/organize/document_folder_manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Content Consolidation Engine', () => {
    let testDir;
    let syncHub;
    let documentFolderManager;
    let engine;

    beforeAll(async () => {
        testDir = path.join(__dirname, 'test_data', 'consolidation_vitest');
        syncHub = path.join(testDir, 'sync_hub');

        // Clean up any existing test data
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore if directory doesn't exist
        }

        // Create test directory structure
        await fs.mkdir(testDir, { recursive: true });
        await fs.mkdir(syncHub, { recursive: true });

        // Create test documents
        await createTestDocuments();

        // Initialize components
        documentFolderManager = new DocumentFolderManager(syncHub);
        engine = new ContentConsolidationEngine(documentFolderManager, {
            syncHubPath: syncHub,
            dryRun: false
        });
    });

    afterAll(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (error) {
            console.warn('Cleanup warning:', error.message);
        }
    });

    async function createTestDocuments() {
        // Technical documentation with code blocks
        await createTestDocumentFolder('API-Documentation', 'Development', `# API Documentation

This document describes the REST API endpoints.

## Authentication

All API requests require authentication:

\`\`\`javascript
const token = 'your-api-token';
const headers = {
    'Authorization': \`Bearer \${token}\`,
    'Content-Type': 'application/json'
};
\`\`\`

## Endpoints

### GET /users
Returns a list of users.

![API Flow](images/api-flow.png)
`);

        // Tutorial with step-by-step instructions
        await createTestDocumentFolder('Getting-Started-Guide', 'Development', `# Getting Started Guide

Welcome to our platform! This guide will help you get started.

## Prerequisites

Before you begin, ensure you have:
- Node.js installed
- A text editor
- Basic JavaScript knowledge

## Step 1: Installation

Install the required packages:

\`\`\`bash
npm install express
npm install mongoose
\`\`\`

## Step 2: Configuration

Create a config file with your settings.

![Setup Screenshot](images/setup.png)
`);

        // Research paper with citations and references
        await createTestDocumentFolder('Machine-Learning-Research', 'Research', `# Machine Learning in Healthcare

## Abstract

This paper explores the applications of machine learning in healthcare diagnostics.

## Introduction

Machine learning has revolutionized many industries, particularly healthcare.

## Methodology

We used supervised learning algorithms including:
- Support Vector Machines
- Random Forest
- Neural Networks

## Results

Our experiments showed significant improvements in diagnostic accuracy.

![Results Chart](images/results.png)
`);

        // Simple note with minimal structure
        await createTestDocumentFolder('Quick-Notes', 'Notes', `# Quick Notes

Just some random thoughts and ideas:

- Need to implement user authentication
- Consider using Redis for caching
- Update documentation
- Fix the bug in the payment system

Remember to check the logs tomorrow.
`);

        // Empty document (edge case)
        await createTestDocumentFolder('Empty-Document', 'Notes', '');

        // Document with only title (edge case)
        await createTestDocumentFolder('Title-Only', 'Notes', '# Title Only Document');

        // Document with special characters and formatting
        await createTestDocumentFolder('Special-Characters', 'Notes', `# Special Characters & Formatting

This document contains various special characters and formatting:

## Unicode Characters
- Emoji: 🚀 🎉 ✅ ❌
- Symbols: © ® ™ § ¶
- Accents: café, naïve, résumé

## Code with Special Characters
\`\`\`python
def process_data(data):
    # Handle special cases: <>&"'
    return data.replace("&", "&amp;").replace("<", "&lt;")
\`\`\`

## Tables
| Name | Age | City |
|------|-----|------|
| John | 25  | NYC  |
| Jane | 30  | LA   |

![Special Chart](images/special.png)
`);
    }

    async function createTestDocumentFolder(folderName, category, content) {
        const categoryPath = path.join(syncHub, category);
        const folderPath = path.join(categoryPath, folderName);
        const imagesPath = path.join(folderPath, 'images');

        await fs.mkdir(folderPath, { recursive: true });
        await fs.mkdir(imagesPath, { recursive: true });
        await fs.writeFile(path.join(folderPath, 'main.md'), content, 'utf8');

        // Create test image files with unique names
        const imageName = `${folderName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-image.png`;
        await fs.writeFile(path.join(imagesPath, imageName), `fake image data for ${folderName}`, 'utf8');
    }

    describe('Simple Merge Strategy', () => {
        it('should consolidate documents with simple merge strategy', async () => {
            const documentFolders = [
                path.join(syncHub, 'Development', 'API-Documentation'),
                path.join(syncHub, 'Development', 'Getting-Started-Guide')
            ];

            const result = await engine.consolidateContent(documentFolders, 'Development Guide', 'simple_merge');

            expect(result.success).toBe(true);
            expect(result.strategy).toBe('simple_merge');
            expect(result.sourceDocuments).toHaveLength(2);

            // Verify consolidated document exists
            const consolidatedDoc = path.join(result.consolidatedFolder, 'main.md');
            const content = await fs.readFile(consolidatedDoc, 'utf8');

            expect(content).toContain('Development Guide - Consolidated Document');
            expect(content).toContain('Table of Contents');
            expect(content).toContain('API Documentation');
            expect(content).toContain('Getting Started Guide');
            expect(content).toContain('Document Metadata');

            // Verify code blocks are preserved
            expect(content).toContain('```javascript');
            expect(content).toContain('```bash');
        });
    });

    describe('Structured Consolidation Strategy', () => {
        it('should consolidate documents with structured consolidation strategy', async () => {
            const documentFolders = [
                path.join(syncHub, 'Research', 'Machine-Learning-Research'),
                path.join(syncHub, 'Development', 'API-Documentation')
            ];

            const result = await engine.consolidateContent(documentFolders, 'Research and Development', 'structured_consolidation');

            expect(result.success).toBe(true);
            expect(result.strategy).toBe('structured_consolidation');

            const consolidatedDoc = path.join(result.consolidatedFolder, 'main.md');
            const content = await fs.readFile(consolidatedDoc, 'utf8');

            expect(content).toContain('Research and Development - Consolidated Document');
            expect(content).toContain('Overview');
            expect(content).toContain('Main Content');
        });
    });

    describe('Comprehensive Merge Strategy', () => {
        it('should consolidate documents with comprehensive merge strategy', async () => {
            const documentFolders = [
                path.join(syncHub, 'Development', 'API-Documentation'),
                path.join(syncHub, 'Research', 'Machine-Learning-Research'),
                path.join(syncHub, 'Notes', 'Quick-Notes')
            ];

            const result = await engine.consolidateContent(documentFolders, 'Complete Guide', 'comprehensive_merge');

            expect(result.success).toBe(true);
            expect(result.strategy).toBe('comprehensive_merge');

            const consolidatedDoc = path.join(result.consolidatedFolder, 'main.md');
            const content = await fs.readFile(consolidatedDoc, 'utf8');

            expect(content).toContain('Complete Guide - Consolidated Document');
            expect(content).toContain('Executive Summary');
            expect(content).toContain('Table of Contents');
            expect(content).toContain('Document Metadata');
        });
    });

    describe('Content Merging with Various Document Types', () => {
        it('should handle diverse document types correctly', async () => {
            const documentFolders = [
                path.join(syncHub, 'Development', 'API-Documentation'),  // Technical doc with code
                path.join(syncHub, 'Research', 'Machine-Learning-Research'),  // Academic paper
                path.join(syncHub, 'Notes', 'Special-Characters'),  // Special formatting
                path.join(syncHub, 'Notes', 'Quick-Notes')  // Simple notes
            ];

            const result = await engine.consolidateContent(documentFolders, 'Mixed Content Types', 'simple_merge');

            expect(result.success).toBe(true);

            const consolidatedDoc = path.join(result.consolidatedFolder, 'main.md');
            const content = await fs.readFile(consolidatedDoc, 'utf8');

            // Verify different content types are preserved
            expect(content).toContain('```javascript');
            expect(content).toContain('```python');
            expect(content).toContain('🚀'); // Emoji
            expect(content).toContain('©'); // Special character
            expect(content).toContain('| Name | Age | City |'); // Table
        });
    });

    describe('Image Consolidation', () => {
        it('should consolidate images and update references', async () => {
            const documentFolders = [
                path.join(syncHub, 'Development', 'API-Documentation'),
                path.join(syncHub, 'Research', 'Machine-Learning-Research')
            ];

            const result = await engine.consolidateContent(documentFolders, 'Image Test', 'simple_merge');

            expect(result.success).toBe(true);
            expect(result.imagesMerged).toBeGreaterThan(0);

            // Verify images folder exists and contains images
            const imagesFolder = path.join(result.consolidatedFolder, 'images');
            const imageFiles = await fs.readdir(imagesFolder);

            expect(imageFiles.length).toBeGreaterThan(0);

            // Verify image references are preserved in content
            const consolidatedDoc = path.join(result.consolidatedFolder, 'main.md');
            const content = await fs.readFile(consolidatedDoc, 'utf8');

            const imageReferences = content.match(/!\[.*?\]\(images\/.*?\)/g) || [];
            expect(imageReferences.length).toBeGreaterThan(0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty documents gracefully', async () => {
            const documentFolders = [
                path.join(syncHub, 'Notes', 'Empty-Document'),
                path.join(syncHub, 'Notes', 'Title-Only'),
                path.join(syncHub, 'Notes', 'Quick-Notes')
            ];

            const result = await engine.consolidateContent(documentFolders, 'Edge Cases Test', 'simple_merge');

            expect(result.success).toBe(true);

            const consolidatedDoc = path.join(result.consolidatedFolder, 'main.md');
            const content = await fs.readFile(consolidatedDoc, 'utf8');

            expect(content).toContain('Edge Cases Test - Consolidated Document');
            expect(content).toContain('Quick Notes'); // Non-empty content should be included
            expect(content).toContain('Title Only Document'); // Title-only document should be handled
        });

        it('should handle missing images gracefully', async () => {
            // Create a document folder without images
            const testFolder = path.join(syncHub, 'Testing', 'No-Images');
            await fs.mkdir(testFolder, { recursive: true });
            await fs.writeFile(path.join(testFolder, 'main.md'), `# Document Without Images

This document has no images folder.

![Missing Image](images/missing.png)
`, 'utf8');

            const documentFolders = [
                testFolder,
                path.join(syncHub, 'Notes', 'Quick-Notes')
            ];

            const result = await engine.consolidateContent(documentFolders, 'Missing Images Test', 'simple_merge');

            expect(result.success).toBe(true);

            const consolidatedDoc = path.join(result.consolidatedFolder, 'main.md');
            const content = await fs.readFile(consolidatedDoc, 'utf8');

            expect(content).toContain('Missing Images Test - Consolidated Document');
            // Image references should be preserved even if images don't exist
            expect(content).toContain('![Missing Image](images/missing.png)');
        });
    });

    describe('Dry Run Mode', () => {
        it('should not create actual files in dry run mode', async () => {
            const dryRunEngine = new ContentConsolidationEngine(documentFolderManager, {
                syncHubPath: syncHub,
                dryRun: true
            });

            const documentFolders = [
                path.join(syncHub, 'Notes', 'Quick-Notes'),
                path.join(syncHub, 'Notes', 'Title-Only')
            ];

            const result = await dryRunEngine.consolidateContent(documentFolders, 'Dry Run Test', 'simple_merge');

            expect(result.success).toBe(true);

            // Verify no actual files were created
            await expect(fs.access(result.consolidatedFolder)).rejects.toThrow();

            // Should still return merged content
            expect(result.mergedContent).toBeDefined();
            expect(result.mergedContent.length).toBeGreaterThan(0);
        });
    });

    describe('Error Handling', () => {
        it('should handle empty document folders array', async () => {
            await expect(
                engine.consolidateContent([], 'Empty Array Test', 'simple_merge')
            ).rejects.toThrow('No document folders provided');
        });

        it('should handle empty topic', async () => {
            await expect(
                engine.consolidateContent(['valid-folder'], '', 'simple_merge')
            ).rejects.toThrow('Invalid or missing topic');
        });

        it('should handle non-existent folders gracefully', async () => {
            await expect(
                engine.consolidateContent([
                    path.join(syncHub, 'NonExistent', 'Folder1'),
                    path.join(syncHub, 'NonExistent', 'Folder2')
                ], 'Non-existent Test', 'simple_merge')
            ).rejects.toThrow('No content could be extracted');
        });
    });

    describe('Large Document Consolidation', () => {
        it('should handle consolidation of multiple large documents', async () => {
            const documentFolders = [
                path.join(syncHub, 'Development', 'API-Documentation'),
                path.join(syncHub, 'Development', 'Getting-Started-Guide'),
                path.join(syncHub, 'Research', 'Machine-Learning-Research'),
                path.join(syncHub, 'Notes', 'Special-Characters')
            ];

            const result = await engine.consolidateContent(documentFolders, 'Large Consolidation Test', 'comprehensive_merge');

            expect(result.success).toBe(true);
            expect(result.sourceDocuments).toHaveLength(4);

            const consolidatedDoc = path.join(result.consolidatedFolder, 'main.md');
            const content = await fs.readFile(consolidatedDoc, 'utf8');

            // Verify large consolidation produces comprehensive output
            expect(content.length).toBeGreaterThan(2000);

            // Should include content from all sources
            expect(content).toContain('API Documentation');
            expect(content).toContain('Getting Started Guide');
            expect(content).toContain('Machine Learning in Healthcare');
            expect(content).toContain('Special Characters');

            // Should have proper metadata
            expect(result.metadata).toBeDefined();
            expect(result.metadata.totalSections).toBeGreaterThanOrEqual(4);
        });
    });
});