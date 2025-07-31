#!/usr/bin/env node

/**
 * Integration test for MCP server search_documents tool
 * Tests the complete integration with DocumentSearchEngine
 */

import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { DocumentOrganizationServer } from '../src/mcp/server.js';

/**
 * Test MCP server search integration
 */
async function testMCPSearchIntegration() {
    console.log('🔍 Testing MCP Server Search Integration...');

    // Create temporary test directory
    const testDir = path.join(os.tmpdir(), `mcp_search_test_${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    try {
        // Create test documents in folder structure
        await createTestDocumentFolders(testDir);

        // Initialize MCP server with test directory
        const server = new DocumentOrganizationServer();

        // Override the sync hub before initialization
        server.syncHub = testDir;

        // Initialize the server
        await server.initialize();

        // Ensure the document folder manager uses the test directory
        if (server.documentFolderManager) {
            server.documentFolderManager.syncHubPath = testDir;
        }

        // Reinitialize the search engine with the correct folder manager
        if (server.documentFolderManager) {
            const { DocumentSearchEngine } = await import('../src/organize/document_search_engine.js');
            server.documentSearchEngine = new DocumentSearchEngine(server.documentFolderManager);
        }

        // Test 1: Basic search
        console.log('  ✓ Testing basic search through MCP...');
        const basicSearchArgs = {
            query: 'JavaScript',
            limit: 5
        };

        const basicResult = await server.searchDocuments(basicSearchArgs);
        const basicResponse = JSON.parse(basicResult.content[0].text);

        if (basicResponse.total_results === 0) {
            throw new Error('Basic MCP search returned no results');
        }

        console.log(`    Found ${basicResponse.total_results} results for "JavaScript"`);

        // Test 2: Category search
        console.log('  ✓ Testing category search through MCP...');
        const categorySearchArgs = {
            query: 'programming',
            category: 'Technology',
            limit: 3
        };

        const categoryResult = await server.searchDocuments(categorySearchArgs);
        const categoryResponse = JSON.parse(categoryResult.content[0].text);

        console.log(`    Found ${categoryResponse.total_results} results in Technology category`);

        // Test 3: Regex search
        console.log('  ✓ Testing regex search through MCP...');
        const regexSearchArgs = {
            query: 'Java.*',
            use_regex: true,
            limit: 3
        };

        const regexResult = await server.searchDocuments(regexSearchArgs);
        const regexResponse = JSON.parse(regexResult.content[0].text);

        console.log(`    Found ${regexResponse.total_results} results with regex "Java.*"`);

        // Test 4: Invalid query handling
        console.log('  ✓ Testing invalid query handling...');
        const invalidSearchArgs = {
            query: '',
            limit: 5
        };

        try {
            const invalidResult = await server.searchDocuments(invalidSearchArgs);
            const invalidResponse = JSON.parse(invalidResult.content[0].text);

            if (!invalidResponse.error) {
                throw new Error('Invalid query should have returned an error');
            }

            console.log('    ✓ Invalid query properly handled');
        } catch (error) {
            if (error.message.includes('required')) {
                console.log('    ✓ Invalid query properly rejected');
            } else {
                throw error;
            }
        }

        // Test 5: Non-existent category
        console.log('  ✓ Testing non-existent category...');
        const nonExistentArgs = {
            query: 'test',
            category: 'NonExistentCategory'
        };

        const nonExistentResult = await server.searchDocuments(nonExistentArgs);
        const nonExistentResponse = JSON.parse(nonExistentResult.content[0].text);

        if (!nonExistentResponse.warning && nonExistentResponse.total_results !== 0) {
            throw new Error('Non-existent category not handled properly');
        }

        console.log('    ✓ Non-existent category handled correctly');

        // Test 6: Verify result structure
        console.log('  ✓ Testing result structure...');
        if (basicResponse.results && basicResponse.results.length > 0) {
            const firstResult = basicResponse.results[0];
            const requiredFields = ['documentFolder', 'relevanceScore', 'preview', 'highlightedPreview'];

            for (const field of requiredFields) {
                if (!(field in firstResult)) {
                    throw new Error(`Missing required field in result: ${field}`);
                }
            }

            console.log('    ✓ Result structure is correct');
        }

        console.log('✅ All MCP Search Integration tests passed!');
        return true;

    } catch (error) {
        console.error('❌ MCP Search Integration test failed:', error.message);
        console.error('Stack trace:', error.stack);
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
async function createTestDocumentFolders(testDir) {
    const testDocuments = [
        {
            category: 'Technology',
            name: 'JavaScript-Basics',
            content: `# JavaScript Basics

JavaScript is a programming language that enables interactive web pages.

## Variables
Variables in JavaScript can be declared using var, let, or const.

## Functions
Functions are reusable blocks of code.
`
        },
        {
            category: 'Technology',
            name: 'Python-Guide',
            content: `# Python Programming Guide

Python is a high-level programming language.

## Getting Started
Python is great for beginners.

## Data Types
Python supports various data types.
`
        },
        {
            category: 'Technology',
            name: 'Web-Development',
            content: `# Web Development Overview

Web development involves creating websites using various technologies.

## Frontend
- HTML
- CSS
- JavaScript

## Backend
- Node.js
- Python
- Java
`
        },
        {
            category: 'Business',
            name: 'Project-Management',
            content: `# Project Management

Effective project management is crucial for success.

## Planning
Proper planning prevents poor performance.
`
        }
    ];

    for (const doc of testDocuments) {
        // Create category directory
        const categoryPath = path.join(testDir, doc.category);
        await fs.mkdir(categoryPath, { recursive: true });

        // Create document folder
        const docFolderPath = path.join(categoryPath, doc.name);
        await fs.mkdir(docFolderPath, { recursive: true });

        // Create main document file
        const mainFilePath = path.join(docFolderPath, 'main.md');
        await fs.writeFile(mainFilePath, doc.content, 'utf8');

        // Create images subfolder
        const imagesPath = path.join(docFolderPath, 'images');
        await fs.mkdir(imagesPath, { recursive: true });
    }

    console.log(`    Created ${testDocuments.length} test document folders`);
}

/**
 * Run the test if this file is executed directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
    testMCPSearchIntegration()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test execution failed:', error);
            process.exit(1);
        });
}

export { testMCPSearchIntegration };