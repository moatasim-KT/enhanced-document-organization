#!/usr/bin/env node

/**
 * Test suite for DocumentSearchEngine
 * Tests the folder-aware document search functionality
 */

import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { DocumentFolderManager } from '../src/organize/document_folder_manager.js';
import { DocumentSearchEngine } from '../src/organize/document_search_engine.js';

/**
 * Test DocumentSearchEngine functionality
 */
async function testDocumentSearchEngine() {
    console.log('🔍 Testing DocumentSearchEngine...');

    // Create temporary test directory
    const testDir = path.join(os.tmpdir(), `search_test_${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    try {
        // Initialize managers
        const folderManager = new DocumentFolderManager(testDir);
        const searchEngine = new DocumentSearchEngine(folderManager);

        // Create test document folders with content
        await createTestDocuments(folderManager);

        // Test 1: Basic search
        console.log('  ✓ Testing basic search...');
        const basicResults = await searchEngine.searchDocuments('JavaScript', { limit: 5 });

        if (basicResults.total_results === 0) {
            throw new Error('Basic search returned no results');
        }

        console.log(`    Found ${basicResults.total_results} results for "JavaScript"`);

        // Test 2: Category-specific search
        console.log('  ✓ Testing category search...');
        const categoryResults = await searchEngine.searchInCategory('programming', 'Technology');

        console.log(`    Found ${categoryResults.total_results} results in Technology category`);

        // Test 3: Regex search
        console.log('  ✓ Testing regex search...');
        const regexResults = await searchEngine.searchDocuments('Java.*', {
            useRegex: true,
            limit: 3
        });

        console.log(`    Found ${regexResults.total_results} results with regex "Java.*"`);

        // Test 4: Case sensitive search
        console.log('  ✓ Testing case sensitive search...');
        const caseResults = await searchEngine.searchDocuments('JAVASCRIPT', {
            caseSensitive: true,
            limit: 3
        });

        console.log(`    Found ${caseResults.total_results} results with case sensitive "JAVASCRIPT"`);

        // Test 5: Search with highlighting
        console.log('  ✓ Testing search result highlighting...');
        if (basicResults.results.length > 0) {
            const firstResult = basicResults.results[0];
            if (!firstResult.highlightedPreview.includes('**')) {
                console.warn('    Warning: No highlighting found in preview');
            } else {
                console.log('    ✓ Highlighting working correctly');
            }
        }

        // Test 6: Metadata extraction
        console.log('  ✓ Testing metadata extraction...');
        const testFolders = await folderManager.findDocumentFolders(testDir);
        if (testFolders.length > 0) {
            const metadata = await searchEngine.extractDocumentMetadata(testFolders[0]);
            if (!metadata.contentMetadata || !metadata.contentMetadata.wordCount) {
                throw new Error('Metadata extraction failed');
            }
            console.log(`    ✓ Extracted metadata: ${metadata.contentMetadata.wordCount} words`);
        }

        // Test 7: Empty query handling
        console.log('  ✓ Testing empty query handling...');
        try {
            await searchEngine.searchDocuments('');
            throw new Error('Empty query should have thrown an error');
        } catch (error) {
            if (error.message.includes('required')) {
                console.log('    ✓ Empty query properly rejected');
            } else {
                throw error;
            }
        }

        // Test 8: Non-existent category
        console.log('  ✓ Testing non-existent category...');
        const nonExistentResults = await searchEngine.searchInCategory('test', 'NonExistentCategory');
        if (nonExistentResults.warning && nonExistentResults.total_results === 0) {
            console.log('    ✓ Non-existent category handled correctly');
        } else {
            throw new Error('Non-existent category not handled properly');
        }

        console.log('✅ All DocumentSearchEngine tests passed!');
        return true;

    } catch (error) {
        console.error('❌ DocumentSearchEngine test failed:', error.message);
        return false;
    } finally {
        // Cleanup
        if (existsSync(testDir)) {
            await fs.rm(testDir, { recursive: true, force: true });
        }
    }
}

/**
 * Create test document folders with sample content
 */
async function createTestDocuments(folderManager) {
    const testDocuments = [
        {
            name: 'JavaScript Basics',
            category: 'Technology',
            content: `# JavaScript Basics

JavaScript is a programming language that enables interactive web pages. It is an essential part of web applications.

## Variables
Variables in JavaScript can be declared using var, let, or const.

## Functions
Functions are reusable blocks of code that perform specific tasks.
`
        },
        {
            name: 'Python Guide',
            category: 'Technology',
            content: `# Python Programming Guide

Python is a high-level programming language known for its simplicity and readability.

## Getting Started
Python is great for beginners and experts alike.

## Data Types
Python supports various data types including strings, numbers, and lists.
`
        },
        {
            name: 'Web Development',
            category: 'Technology',
            content: `# Web Development Overview

Web development involves creating websites and web applications using various technologies.

## Frontend Technologies
- HTML for structure
- CSS for styling  
- JavaScript for interactivity

## Backend Technologies
- Node.js
- Python
- Java
`
        },
        {
            name: 'Project Management',
            category: 'Business',
            content: `# Project Management Best Practices

Effective project management is crucial for successful software development.

## Planning Phase
Proper planning prevents poor performance.

## Execution
Following the plan while adapting to changes.
`
        },
        {
            name: 'Meeting Notes',
            category: 'Business',
            content: `# Team Meeting Notes

## Agenda
1. Project status update
2. Technical challenges
3. Next steps

## Discussion
The team discussed the JavaScript implementation and Python backend integration.
`
        }
    ];

    for (const doc of testDocuments) {
        await folderManager.createDocumentFolder(doc.name, doc.category, doc.content);
    }

    console.log(`    Created ${testDocuments.length} test document folders`);
}

/**
 * Run the test if this file is executed directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
    testDocumentSearchEngine()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test execution failed:', error);
            process.exit(1);
        });
}

export { testDocumentSearchEngine };