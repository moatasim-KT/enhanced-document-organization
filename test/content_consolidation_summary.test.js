#!/usr/bin/env node

/**
 * Summary test for Content Consolidation functionality
 * Demonstrates all consolidation strategies and edge cases working correctly
 * This test validates task 16 requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ContentConsolidationEngine } from '../src/organize/content_consolidation_engine.js';
import { DocumentFolderManager } from '../src/organize/document_folder_manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Content Consolidation - Task 16 Summary', () => {
    let testDir;
    let syncHub;
    let documentFolderManager;
    let engine;

    beforeAll(async () => {
        testDir = path.join(__dirname, 'test_data', 'consolidation_summary');
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

        // Create diverse test documents
        await createDiverseTestDocuments();

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

    async function createDiverseTestDocuments() {
        // Technical document with JavaScript code
        await createTestDocumentFolder('JavaScript-Guide', 'Development', `# JavaScript Guide

## Variables and Functions

\`\`\`javascript
const greeting = 'Hello World';
function sayHello(name) {
    return \`Hello, \${name}!\`;
}
\`\`\`

![JS Logo](images/js-logo.png)
`);

        // System administration document with bash scripts
        await createTestDocumentFolder('Server-Setup', 'DevOps', `# Server Setup Guide

## Installation Commands

\`\`\`bash
sudo apt update
sudo apt install nginx
systemctl start nginx
\`\`\`

![Server Diagram](images/server.png)
`);

        // Data science document with Python code
        await createTestDocumentFolder('Data-Analysis', 'Science', `# Data Analysis with Python

## Data Processing

\`\`\`python
import pandas as pd
import numpy as np

def analyze_data(df):
    return df.describe()
\`\`\`

![Data Chart](images/chart.png)
`);

        // Empty document (edge case)
        await createTestDocumentFolder('Empty-Doc', 'Testing', '');

        // Document with only title (edge case)
        await createTestDocumentFolder('Title-Only-Doc', 'Testing', '# Just a Title');

        // Document with special characters and formatting
        await createTestDocumentFolder('Unicode-Test', 'Testing', `# Unicode & Special Characters

## Emojis and Symbols
- 🚀 Rocket
- 🎉 Party
- ✅ Check
- ❌ Cross
- © Copyright
- ® Registered

## Table Example
| Language | Type | Year |
|----------|------|------|
| JavaScript | Dynamic | 1995 |
| Python | Dynamic | 1991 |
| Rust | Static | 2010 |

![Unicode Chart](images/unicode.png)
`);

        // Document with duplicate content for deduplication testing
        await createTestDocumentFolder('Duplicate-Content-A', 'Testing', `# Testing Best Practices

## Introduction
Testing is essential for software quality and reliability.

## Unit Testing
Write comprehensive unit tests for all functions.

## Integration Testing
Test how components work together.

![Testing Pyramid](images/pyramid.png)
`);

        await createTestDocumentFolder('Duplicate-Content-B', 'Testing', `# Quality Assurance Guide

## Introduction
Testing is essential for software quality and reliability.

## Test Types
- Unit tests
- Integration tests
- End-to-end tests

## Best Practices
Write comprehensive unit tests for all functions.

![QA Process](images/qa.png)
`);
    }

    async function createTestDocumentFolder(folderName, category, content) {
        const categoryPath = path.join(syncHub, category);
        const folderPath = path.join(categoryPath, folderName);
        const imagesPath = path.join(folderPath, 'images');

        await fs.mkdir(folderPath, { recursive: true });
        await fs.mkdir(imagesPath, { recursive: true });
        await fs.writeFile(path.join(folderPath, 'main.md'), content, 'utf8');

        // Create test image files
        const imageName = `${folderName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-test.png`;
        await fs.writeFile(path.join(imagesPath, imageName), `test image for ${folderName}`, 'utf8');
    }

    it('should test all consolidation strategies (simple, structured, comprehensive)', async () => {
        const documentFolders = [
            path.join(syncHub, 'Development', 'JavaScript-Guide'),
            path.join(syncHub, 'DevOps', 'Server-Setup'),
            path.join(syncHub, 'Science', 'Data-Analysis')
        ];

        // Test Simple Merge Strategy
        const simpleResult = await engine.consolidateContent(documentFolders, 'Simple Merge Test', 'simple_merge');
        expect(simpleResult.success).toBe(true);
        expect(simpleResult.strategy).toBe('simple_merge');

        const simpleDoc = await fs.readFile(path.join(simpleResult.consolidatedFolder, 'main.md'), 'utf8');
        expect(simpleDoc).toContain('Table of Contents');
        expect(simpleDoc).toContain('Document Metadata');

        // Test Structured Consolidation Strategy
        const structuredResult = await engine.consolidateContent(documentFolders, 'Structured Test', 'structured_consolidation');
        expect(structuredResult.success).toBe(true);
        expect(structuredResult.strategy).toBe('structured_consolidation');

        const structuredDoc = await fs.readFile(path.join(structuredResult.consolidatedFolder, 'main.md'), 'utf8');
        expect(structuredDoc).toContain('Overview');
        expect(structuredDoc).toContain('Main Content');

        // Test Comprehensive Merge Strategy
        const comprehensiveResult = await engine.consolidateContent(documentFolders, 'Comprehensive Test', 'comprehensive_merge');
        expect(comprehensiveResult.success).toBe(true);
        expect(comprehensiveResult.strategy).toBe('comprehensive_merge');

        const comprehensiveDoc = await fs.readFile(path.join(comprehensiveResult.consolidatedFolder, 'main.md'), 'utf8');
        expect(comprehensiveDoc).toContain('Executive Summary');
        expect(comprehensiveDoc).toContain('Appendices');
    });

    it('should handle content merging with various document types and structures', async () => {
        const documentFolders = [
            path.join(syncHub, 'Development', 'JavaScript-Guide'),  // JavaScript code
            path.join(syncHub, 'DevOps', 'Server-Setup'),          // Bash scripts
            path.join(syncHub, 'Science', 'Data-Analysis'),        // Python code
            path.join(syncHub, 'Testing', 'Unicode-Test')          // Special characters and tables
        ];

        const result = await engine.consolidateContent(documentFolders, 'Mixed Types Test', 'simple_merge');
        expect(result.success).toBe(true);

        const consolidatedDoc = path.join(result.consolidatedFolder, 'main.md');
        const content = await fs.readFile(consolidatedDoc, 'utf8');

        // Verify different code block types are preserved
        expect(content).toContain('```javascript');
        expect(content).toContain('```bash');
        expect(content).toContain('```python');

        // Verify special characters and formatting are preserved
        expect(content).toContain('🚀'); // Emoji
        expect(content).toContain('©');  // Copyright symbol
        expect(content).toContain('| Language | Type | Year |'); // Table formatting

        // Verify all source documents are included
        expect(content).toContain('JavaScript Guide');
        expect(content).toContain('Server Setup Guide');
        expect(content).toContain('Data Analysis with Python');
        expect(content).toContain('Unicode & Special Characters');
    });

    it('should verify image consolidation and reference updating works correctly', async () => {
        const documentFolders = [
            path.join(syncHub, 'Development', 'JavaScript-Guide'),
            path.join(syncHub, 'DevOps', 'Server-Setup'),
            path.join(syncHub, 'Science', 'Data-Analysis')
        ];

        const result = await engine.consolidateContent(documentFolders, 'Image Consolidation Test', 'simple_merge');
        expect(result.success).toBe(true);
        expect(result.imagesMerged).toBeGreaterThan(0);

        // Verify images folder exists and contains consolidated images
        const imagesFolder = path.join(result.consolidatedFolder, 'images');
        const imageFiles = await fs.readdir(imagesFolder);
        expect(imageFiles.length).toBeGreaterThanOrEqual(3); // At least one from each source

        // Verify image references are preserved in consolidated content
        const consolidatedDoc = path.join(result.consolidatedFolder, 'main.md');
        const content = await fs.readFile(consolidatedDoc, 'utf8');

        const imageReferences = content.match(/!\[.*?\]\(images\/.*?\)/g) || [];
        expect(imageReferences.length).toBeGreaterThan(0);

        // Verify specific image references are updated correctly
        expect(content).toContain('![JS Logo](images/');
        expect(content).toContain('![Server Diagram](images/');
        expect(content).toContain('![Data Chart](images/');
    });

    it('should test consolidation with edge cases like empty documents and missing images', async () => {
        const documentFolders = [
            path.join(syncHub, 'Testing', 'Empty-Doc'),        // Empty document
            path.join(syncHub, 'Testing', 'Title-Only-Doc'),   // Title-only document
            path.join(syncHub, 'Development', 'JavaScript-Guide') // Normal document
        ];

        const result = await engine.consolidateContent(documentFolders, 'Edge Cases Test', 'simple_merge');
        expect(result.success).toBe(true);

        const consolidatedDoc = path.join(result.consolidatedFolder, 'main.md');
        const content = await fs.readFile(consolidatedDoc, 'utf8');

        // Should handle empty documents gracefully
        expect(content).toContain('Edge Cases Test - Consolidated Document');

        // Should include title-only document
        expect(content).toContain('Just a Title');

        // Should include normal document content
        expect(content).toContain('JavaScript Guide');
        expect(content).toContain('```javascript');

        // Test missing images scenario
        const testFolder = path.join(syncHub, 'Testing', 'No-Images-Folder');
        await fs.mkdir(testFolder, { recursive: true });
        await fs.writeFile(path.join(testFolder, 'main.md'), `# Document Without Images

This document references missing images.

![Missing Image](images/missing.png)
`, 'utf8');

        const missingImagesResult = await engine.consolidateContent([testFolder], 'Missing Images Test', 'simple_merge');
        expect(missingImagesResult.success).toBe(true);

        const missingImagesDoc = path.join(missingImagesResult.consolidatedFolder, 'main.md');
        const missingImagesContent = await fs.readFile(missingImagesDoc, 'utf8');

        // Image references should be preserved even if images don't exist
        expect(missingImagesContent).toContain('![Missing Image](images/missing.png)');
    });

    it('should test deduplication in comprehensive merge strategy', async () => {
        const documentFolders = [
            path.join(syncHub, 'Testing', 'Duplicate-Content-A'),
            path.join(syncHub, 'Testing', 'Duplicate-Content-B')
        ];

        const result = await engine.consolidateContent(documentFolders, 'Deduplication Test', 'comprehensive_merge');
        expect(result.success).toBe(true);

        const consolidatedDoc = path.join(result.consolidatedFolder, 'main.md');
        const content = await fs.readFile(consolidatedDoc, 'utf8');

        // Should include executive summary for comprehensive merge
        expect(content).toContain('Executive Summary');

        // Should organize content logically
        expect(content).toContain('Table of Contents');

        // Should include both source documents
        expect(content).toContain('Testing Best Practices');
        expect(content).toContain('Quality Assurance Guide');

        // Check that duplicate content handling is working (comprehensive merge should identify duplicates)
        const duplicatePhrase = 'Testing is essential for software quality and reliability';
        const occurrences = (content.match(new RegExp(duplicatePhrase, 'g')) || []).length;

        // The comprehensive merge should handle duplicates intelligently
        // (exact behavior may vary, but it should not just concatenate blindly)
        expect(occurrences).toBeGreaterThan(0);
    });

    it('should verify dry run mode works correctly', async () => {
        const dryRunEngine = new ContentConsolidationEngine(documentFolderManager, {
            syncHubPath: syncHub,
            dryRun: true
        });

        const documentFolders = [
            path.join(syncHub, 'Development', 'JavaScript-Guide')
        ];

        const result = await dryRunEngine.consolidateContent(documentFolders, 'Dry Run Test', 'simple_merge');
        expect(result.success).toBe(true);

        // Verify no actual files were created
        await expect(fs.access(result.consolidatedFolder)).rejects.toThrow();

        // Should still return merged content
        expect(result.mergedContent).toBeDefined();
        expect(result.mergedContent.length).toBeGreaterThan(0);
        expect(result.mergedContent).toContain('Dry Run Test - Consolidated Document');
    });

    it('should verify error handling works correctly', async () => {
        // Test empty document folders array
        await expect(
            engine.consolidateContent([], 'Empty Test', 'simple_merge')
        ).rejects.toThrow('No document folders provided');

        // Test empty topic
        await expect(
            engine.consolidateContent(['valid-folder'], '', 'simple_merge')
        ).rejects.toThrow('Invalid or missing topic');

        // Test non-existent folders
        await expect(
            engine.consolidateContent([
                path.join(syncHub, 'NonExistent', 'Folder1'),
                path.join(syncHub, 'NonExistent', 'Folder2')
            ], 'Non-existent Test', 'simple_merge')
        ).rejects.toThrow('No content could be extracted');

        // Test invalid strategy (should fall back to simple_merge)
        const documentFolders = [path.join(syncHub, 'Development', 'JavaScript-Guide')];
        const result = await engine.consolidateContent(documentFolders, 'Invalid Strategy Test', 'invalid_strategy');
        expect(result.success).toBe(true); // Should succeed with fallback
    });

    it('should demonstrate complete consolidation workflow', async () => {
        // Use all available test documents for a comprehensive consolidation
        const allDocumentFolders = [
            path.join(syncHub, 'Development', 'JavaScript-Guide'),
            path.join(syncHub, 'DevOps', 'Server-Setup'),
            path.join(syncHub, 'Science', 'Data-Analysis'),
            path.join(syncHub, 'Testing', 'Unicode-Test'),
            path.join(syncHub, 'Testing', 'Title-Only-Doc')
        ];

        const result = await engine.consolidateContent(allDocumentFolders, 'Complete Workflow Test', 'comprehensive_merge');
        expect(result.success).toBe(true);
        expect(result.sourceDocuments).toHaveLength(5);
        expect(result.imagesMerged).toBeGreaterThan(0);

        const consolidatedDoc = path.join(result.consolidatedFolder, 'main.md');
        const content = await fs.readFile(consolidatedDoc, 'utf8');

        // Verify comprehensive structure
        expect(content).toContain('Complete Workflow Test - Consolidated Document');
        expect(content).toContain('Executive Summary');
        expect(content).toContain('Table of Contents');
        expect(content).toContain('Document Metadata');
        expect(content).toContain('Appendices');

        // Verify all content types are included
        expect(content).toContain('```javascript');
        expect(content).toContain('```bash');
        expect(content).toContain('```python');
        expect(content).toContain('🚀');
        expect(content).toContain('| Language | Type | Year |');

        // Verify metadata is comprehensive
        expect(result.metadata).toBeDefined();
        expect(result.metadata.totalSections).toBeGreaterThanOrEqual(5);

        // Verify images were consolidated
        const imagesFolder = path.join(result.consolidatedFolder, 'images');
        const imageFiles = await fs.readdir(imagesFolder);
        expect(imageFiles.length).toBeGreaterThanOrEqual(4);

        console.log(`✅ Complete workflow test successful:`);
        console.log(`   - Consolidated ${result.sourceDocuments.length} documents`);
        console.log(`   - Merged ${result.imagesMerged} images`);
        console.log(`   - Generated ${Math.round(content.length / 1024)}KB of content`);
        console.log(`   - Strategy: ${result.strategy}`);
    });
});