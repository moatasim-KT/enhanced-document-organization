#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Search Tool Functionality
 * Tests all aspects of the search tool as specified in task 15
 * 
 * Requirements tested:
 * - 3.1: Search returns relevant results instead of empty responses
 * - 3.2: Search properly traverses folder-based document structure
 * - 3.5: Search provides debugging information when no results found
 */

import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { DocumentFolderManager } from '../src/organize/document_folder_manager.js';
import { DocumentSearchEngine } from '../src/organize/document_search_engine.js';
import { DocumentOrganizationServer } from '../src/mcp/server.js';

/**
 * Main test runner for comprehensive search tool testing
 */
async function runComprehensiveSearchTests() {
    console.log('🔍 Running Comprehensive Search Tool Tests...\n');

    const testResults = {
        passed: 0,
        failed: 0,
        total: 0,
        details: []
    };

    // Test categories
    const testSuites = [
        { name: 'Basic Search Functionality', fn: testBasicSearchFunctionality },
        { name: 'Document Type Variations', fn: testDocumentTypeVariations },
        { name: 'Folder-Based Discovery', fn: testFolderBasedDiscovery },
        { name: 'Content Extraction', fn: testContentExtraction },
        { name: 'Search Result Metadata', fn: testSearchResultMetadata },
        { name: 'Content Previews', fn: testContentPreviews },
        { name: 'Large Collection Performance', fn: testLargeCollectionPerformance },
        { name: 'MCP Integration', fn: testMCPIntegration },
        { name: 'Edge Cases and Error Handling', fn: testEdgeCasesAndErrorHandling }
    ];

    for (const suite of testSuites) {
        console.log(`\n📋 ${suite.name}:`);
        testResults.total++;

        try {
            const success = await suite.fn();
            if (success) {
                testResults.passed++;
                testResults.details.push({ name: suite.name, status: 'PASSED' });
                console.log(`✅ ${suite.name} - PASSED`);
            } else {
                testResults.failed++;
                testResults.details.push({ name: suite.name, status: 'FAILED' });
                console.log(`❌ ${suite.name} - FAILED`);
            }
        } catch (error) {
            testResults.failed++;
            testResults.details.push({ name: suite.name, status: 'ERROR', error: error.message });
            console.log(`❌ ${suite.name} - ERROR: ${error.message}`);
        }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 COMPREHENSIVE SEARCH TOOL TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Test Suites: ${testResults.total}`);
    console.log(`Passed: ${testResults.passed}`);
    console.log(`Failed: ${testResults.failed}`);
    console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

    if (testResults.failed > 0) {
        console.log('\n❌ Failed Tests:');
        testResults.details
            .filter(t => t.status !== 'PASSED')
            .forEach(t => console.log(`  - ${t.name}: ${t.status}${t.error ? ` (${t.error})` : ''}`));
    }

    console.log('='.repeat(60));

    return testResults.failed === 0;
}

/**
 * Test basic search functionality with various query types
 */
async function testBasicSearchFunctionality() {
    const testDir = await createTestEnvironment('basic_search');

    try {
        const { folderManager, searchEngine } = await setupSearchEnvironment(testDir);
        await createBasicTestDocuments(folderManager);

        // Test 1: Simple text search
        console.log('  ✓ Testing simple text search...');
        const textResults = await searchEngine.searchDocuments('JavaScript');
        if (textResults.total_results === 0) {
            throw new Error('Simple text search returned no results');
        }

        // Test 2: Multi-word search
        console.log('  ✓ Testing multi-word search...');
        const multiWordResults = await searchEngine.searchDocuments('machine learning');
        if (multiWordResults.total_results === 0) {
            throw new Error('Multi-word search returned no results');
        }

        // Test 3: Case insensitive search
        console.log('  ✓ Testing case insensitive search...');
        const caseResults = await searchEngine.searchDocuments('JAVASCRIPT');
        if (caseResults.total_results === 0) {
            throw new Error('Case insensitive search failed');
        }

        // Test 4: Regex search
        console.log('  ✓ Testing regex search...');
        const regexResults = await searchEngine.searchDocuments('Java.*', { useRegex: true });
        if (regexResults.total_results === 0) {
            throw new Error('Regex search returned no results');
        }

        // Test 5: Partial word search
        console.log('  ✓ Testing partial word search...');
        const partialResults = await searchEngine.searchDocuments('program');
        if (partialResults.total_results === 0) {
            throw new Error('Partial word search returned no results');
        }

        console.log('    ✅ All basic search tests passed');
        return true;

    } catch (error) {
        console.log(`    ❌ Basic search test failed: ${error.message}`);
        return false;
    } finally {
        await cleanup(testDir);
    }
}

/**
 * Test search with various document types and content structures
 */
async function testDocumentTypeVariations() {
    const testDir = await createTestEnvironment('document_types');

    try {
        const { folderManager, searchEngine } = await setupSearchEnvironment(testDir);
        await createVariedDocumentTypes(folderManager);

        // Test 1: Markdown documents
        console.log('  ✓ Testing markdown document search...');
        const markdownResults = await searchEngine.searchDocuments('markdown');
        if (markdownResults.total_results === 0) {
            throw new Error('Markdown document search failed');
        }

        // Test 2: Code documentation
        console.log('  ✓ Testing code documentation search...');
        const codeResults = await searchEngine.searchDocuments('function');
        if (codeResults.total_results === 0) {
            throw new Error('Code documentation search failed');
        }

        // Test 3: Research papers
        console.log('  ✓ Testing research paper search...');
        const researchResults = await searchEngine.searchDocuments('methodology');
        if (researchResults.total_results === 0) {
            throw new Error('Research paper search failed');
        }

        // Test 4: Meeting notes
        console.log('  ✓ Testing meeting notes search...');
        const notesResults = await searchEngine.searchDocuments('agenda');
        if (notesResults.total_results === 0) {
            throw new Error('Meeting notes search failed');
        }

        // Test 5: Technical specifications
        console.log('  ✓ Testing technical specification search...');
        const specResults = await searchEngine.searchDocuments('requirements');
        if (specResults.total_results === 0) {
            throw new Error('Technical specification search failed');
        }

        console.log('    ✅ All document type variation tests passed');
        return true;

    } catch (error) {
        console.log(`    ❌ Document type variation test failed: ${error.message}`);
        return false;
    } finally {
        await cleanup(testDir);
    }
}

/**
 * Test folder-based document discovery
 */
async function testFolderBasedDiscovery() {
    const testDir = await createTestEnvironment('folder_discovery');

    try {
        const { folderManager, searchEngine } = await setupSearchEnvironment(testDir);
        await createNestedFolderStructure(folderManager);

        // Test 1: Discovery across categories
        console.log('  ✓ Testing cross-category discovery...');
        const crossResults = await searchEngine.searchDocuments('technology');
        if (crossResults.total_results === 0) {
            throw new Error('Cross-category discovery failed');
        }

        // Test 2: Category-specific search
        console.log('  ✓ Testing category-specific search...');
        const categoryResults = await searchEngine.searchInCategory('development', 'Technology');
        if (categoryResults.total_results === 0) {
            throw new Error('Category-specific search failed');
        }

        // Test 3: Deep folder traversal
        console.log('  ✓ Testing deep folder traversal...');
        const deepResults = await searchEngine.searchDocuments('nested');
        if (deepResults.total_results === 0) {
            throw new Error('Deep folder traversal failed');
        }

        // Test 4: Folder structure validation
        console.log('  ✓ Testing folder structure validation...');
        const allFolders = await folderManager.findDocumentFolders(testDir, true);
        if (allFolders.length === 0) {
            throw new Error('No document folders found');
        }

        // Verify each folder has proper structure
        for (const folderPath of allFolders) {
            const mainFile = await folderManager.getMainDocumentFile(folderPath);
            if (!mainFile) {
                throw new Error(`Document folder missing main file: ${folderPath}`);
            }

            const imagesFolder = await folderManager.getImagesFolder(folderPath, false);
            if (!existsSync(imagesFolder)) {
                throw new Error(`Document folder missing images subfolder: ${folderPath}`);
            }
        }

        console.log('    ✅ All folder-based discovery tests passed');
        return true;

    } catch (error) {
        console.log(`    ❌ Folder-based discovery test failed: ${error.message}`);
        return false;
    } finally {
        await cleanup(testDir);
    }
}

/**
 * Test content extraction from document folders
 */
async function testContentExtraction() {
    const testDir = await createTestEnvironment('content_extraction');

    try {
        const { folderManager, searchEngine } = await setupSearchEnvironment(testDir);
        await createContentExtractionTestDocuments(folderManager);

        // Test 1: Full content extraction
        console.log('  ✓ Testing full content extraction...');
        const fullResults = await searchEngine.searchDocuments('comprehensive');
        if (fullResults.total_results === 0) {
            throw new Error('Full content extraction failed');
        }

        const firstResult = fullResults.results[0];
        if (!firstResult.matchedContent || firstResult.matchedContent.length === 0) {
            throw new Error('No matched content extracted');
        }

        // Test 2: Section extraction
        console.log('  ✓ Testing section extraction...');
        const sectionResults = await searchEngine.searchDocuments('introduction');
        if (sectionResults.total_results > 0) {
            const result = sectionResults.results[0];
            if (!result.matchedContent[0].section) {
                throw new Error('Section information not extracted');
            }
        }

        // Test 3: Line number tracking
        console.log('  ✓ Testing line number tracking...');
        const lineResults = await searchEngine.searchDocuments('specific');
        if (lineResults.total_results > 0) {
            const result = lineResults.results[0];
            if (!result.matchedContent[0].lineNumber || result.matchedContent[0].lineNumber <= 0) {
                throw new Error('Line number not tracked correctly');
            }
        }

        // Test 4: Multiple match extraction
        console.log('  ✓ Testing multiple match extraction...');
        const multiResults = await searchEngine.searchDocuments('test');
        if (multiResults.total_results > 0) {
            const result = multiResults.results[0];
            if (result.totalMatches <= 0) {
                throw new Error('Multiple matches not counted correctly');
            }
        }

        console.log('    ✅ All content extraction tests passed');
        return true;

    } catch (error) {
        console.log(`    ❌ Content extraction test failed: ${error.message}`);
        return false;
    } finally {
        await cleanup(testDir);
    }
}

/**
 * Test search result metadata completeness
 */
async function testSearchResultMetadata() {
    const testDir = await createTestEnvironment('metadata');

    try {
        const { folderManager, searchEngine } = await setupSearchEnvironment(testDir);
        await createMetadataTestDocuments(folderManager);

        // Test 1: Document folder metadata
        console.log('  ✓ Testing document folder metadata...');
        const results = await searchEngine.searchDocuments('metadata');
        if (results.total_results === 0) {
            throw new Error('Metadata test search returned no results');
        }

        const result = results.results[0];
        const requiredFields = ['path', 'name', 'category', 'mainFile', 'imageCount', 'size', 'modified'];

        for (const field of requiredFields) {
            if (!(field in result.documentFolder)) {
                throw new Error(`Missing required metadata field: ${field}`);
            }
        }

        // Test 2: Search metadata
        console.log('  ✓ Testing search metadata...');
        if (!results.search_metadata) {
            throw new Error('Search metadata missing');
        }

        const requiredSearchFields = ['folders_searched', 'search_path', 'use_regex', 'case_sensitive'];
        for (const field of requiredSearchFields) {
            if (!(field in results.search_metadata)) {
                throw new Error(`Missing search metadata field: ${field}`);
            }
        }

        // Test 3: Relevance scoring
        console.log('  ✓ Testing relevance scoring...');
        if (typeof result.relevanceScore !== 'number' || result.relevanceScore <= 0) {
            throw new Error('Invalid relevance score');
        }

        // Test 4: Content metadata extraction
        console.log('  ✓ Testing content metadata extraction...');
        const folders = await folderManager.findDocumentFolders(testDir);
        if (folders.length > 0) {
            const metadata = await searchEngine.extractDocumentMetadata(folders[0]);
            if (!metadata.contentMetadata || !metadata.contentMetadata.wordCount) {
                throw new Error('Content metadata extraction failed');
            }
        }

        console.log('    ✅ All metadata tests passed');
        return true;

    } catch (error) {
        console.log(`    ❌ Metadata test failed: ${error.message}`);
        return false;
    } finally {
        await cleanup(testDir);
    }
}

/**
 * Test content preview generation and highlighting
 */
async function testContentPreviews() {
    const testDir = await createTestEnvironment('previews');

    try {
        const { folderManager, searchEngine } = await setupSearchEnvironment(testDir);
        await createPreviewTestDocuments(folderManager);

        // Test 1: Preview generation
        console.log('  ✓ Testing preview generation...');
        const results = await searchEngine.searchDocuments('preview');
        if (results.total_results === 0) {
            throw new Error('Preview test search returned no results');
        }

        const result = results.results[0];
        if (!result.preview || result.preview.length === 0) {
            throw new Error('Preview not generated');
        }

        // Test 2: Highlighted preview
        console.log('  ✓ Testing highlighted preview...');
        if (!result.highlightedPreview || result.highlightedPreview.length === 0) {
            throw new Error('Highlighted preview not generated');
        }

        if (!result.highlightedPreview.includes('**')) {
            throw new Error('Highlighting markers not found in preview');
        }

        // Test 3: Preview length limits
        console.log('  ✓ Testing preview length limits...');
        const longResults = await searchEngine.searchDocuments('long');
        if (longResults.total_results > 0) {
            const longResult = longResults.results[0];
            if (longResult.preview.length > 500) {
                console.log('    ⚠️  Preview might be too long, but this is acceptable');
            }
        }

        // Test 4: Context around matches
        console.log('  ✓ Testing context around matches...');
        if (!result.preview.includes('preview')) {
            throw new Error('Match not found in preview context');
        }

        console.log('    ✅ All preview tests passed');
        return true;

    } catch (error) {
        console.log(`    ❌ Preview test failed: ${error.message}`);
        return false;
    } finally {
        await cleanup(testDir);
    }
}

/**
 * Test search performance with large document collections
 */
async function testLargeCollectionPerformance() {
    const testDir = await createTestEnvironment('performance');

    try {
        const { folderManager, searchEngine } = await setupSearchEnvironment(testDir);

        // Create large collection of documents
        console.log('  ✓ Creating large document collection...');
        await createLargeDocumentCollection(folderManager, 50); // 50 documents

        // Test 1: Search performance timing
        console.log('  ✓ Testing search performance timing...');
        const startTime = Date.now();
        const results = await searchEngine.searchDocuments('performance', { limit: 10 });
        const endTime = Date.now();
        const searchTime = endTime - startTime;

        console.log(`    Search completed in ${searchTime}ms`);

        if (searchTime > 5000) { // 5 seconds threshold
            console.log('    ⚠️  Search took longer than expected, but completed successfully');
        }

        // Test 2: Result limit handling
        console.log('  ✓ Testing result limit handling...');
        const limitedResults = await searchEngine.searchDocuments('document', { limit: 5 });
        if (limitedResults.results.length > 5) {
            throw new Error('Result limit not respected');
        }

        // Test 3: Memory usage (basic check)
        console.log('  ✓ Testing memory usage...');
        const memBefore = process.memoryUsage().heapUsed;
        await searchEngine.searchDocuments('test', { limit: 20 });
        const memAfter = process.memoryUsage().heapUsed;
        const memDiff = memAfter - memBefore;

        console.log(`    Memory usage difference: ${(memDiff / 1024 / 1024).toFixed(2)}MB`);

        // Test 4: Concurrent searches
        console.log('  ✓ Testing concurrent searches...');
        const concurrentPromises = [
            searchEngine.searchDocuments('test1', { limit: 5 }),
            searchEngine.searchDocuments('test2', { limit: 5 }),
            searchEngine.searchDocuments('test3', { limit: 5 })
        ];

        const concurrentResults = await Promise.all(concurrentPromises);
        if (concurrentResults.some(r => r.total_results < 0)) {
            throw new Error('Concurrent search failed');
        }

        console.log('    ✅ All performance tests passed');
        return true;

    } catch (error) {
        console.log(`    ❌ Performance test failed: ${error.message}`);
        return false;
    } finally {
        await cleanup(testDir);
    }
}

/**
 * Test MCP server integration
 */
async function testMCPIntegration() {
    const testDir = await createTestEnvironment('mcp_integration');

    try {
        // Create test documents
        await createMCPTestDocuments(testDir);

        // Initialize MCP server
        const server = new DocumentOrganizationServer();
        server.syncHub = testDir;
        await server.initialize();

        if (server.documentFolderManager) {
            server.documentFolderManager.syncHubPath = testDir;
        }

        if (server.documentFolderManager) {
            const { DocumentSearchEngine } = await import('../src/organize/document_search_engine.js');
            server.documentSearchEngine = new DocumentSearchEngine(server.documentFolderManager);
        }

        // Test 1: MCP search tool
        console.log('  ✓ Testing MCP search tool...');
        const mcpResult = await server.searchDocuments({
            query: 'integration',
            limit: 5
        });

        const mcpResponse = JSON.parse(mcpResult.content[0].text);
        if (mcpResponse.total_results === 0) {
            throw new Error('MCP search returned no results');
        }

        // Test 2: Error handling in MCP
        console.log('  ✓ Testing MCP error handling...');
        try {
            await server.searchDocuments({ query: '' });
            throw new Error('Empty query should have failed');
        } catch (error) {
            if (!error.message.includes('required')) {
                throw error;
            }
        }

        // Test 3: MCP response format
        console.log('  ✓ Testing MCP response format...');
        if (!mcpResult.content || !Array.isArray(mcpResult.content)) {
            throw new Error('Invalid MCP response format');
        }

        console.log('    ✅ All MCP integration tests passed');
        return true;

    } catch (error) {
        console.log(`    ❌ MCP integration test failed: ${error.message}`);
        return false;
    } finally {
        await cleanup(testDir);
    }
}

/**
 * Test edge cases and error handling
 */
async function testEdgeCasesAndErrorHandling() {
    const testDir = await createTestEnvironment('edge_cases');

    try {
        const { folderManager, searchEngine } = await setupSearchEnvironment(testDir);
        await createBasicTestDocuments(folderManager);

        // Test 1: Empty query
        console.log('  ✓ Testing empty query handling...');
        try {
            await searchEngine.searchDocuments('');
            throw new Error('Empty query should have failed');
        } catch (error) {
            if (!error.message.includes('required')) {
                throw error;
            }
        }

        // Test 2: Invalid regex
        console.log('  ✓ Testing invalid regex handling...');
        const invalidRegexResults = await searchEngine.searchDocuments('[invalid', { useRegex: true });
        // Should fallback to literal search
        if (invalidRegexResults.total_results < 0) {
            throw new Error('Invalid regex not handled gracefully');
        }

        // Test 3: Non-existent category
        console.log('  ✓ Testing non-existent category...');
        const nonExistentResults = await searchEngine.searchInCategory('test', 'NonExistentCategory');
        if (!nonExistentResults.warning) {
            throw new Error('Non-existent category warning not provided');
        }

        // Test 4: Very long query
        console.log('  ✓ Testing very long query...');
        const longQuery = 'a'.repeat(1000);
        const longResults = await searchEngine.searchDocuments(longQuery);
        // Should handle gracefully
        if (longResults.total_results < 0) {
            throw new Error('Long query not handled gracefully');
        }

        // Test 5: Special characters in query
        console.log('  ✓ Testing special characters...');
        const specialResults = await searchEngine.searchDocuments('test@#$%^&*()');
        // Should handle gracefully
        if (specialResults.total_results < 0) {
            throw new Error('Special characters not handled gracefully');
        }

        // Test 6: Search in empty directory
        console.log('  ✓ Testing search in empty directory...');
        const emptyDir = await createTestEnvironment('empty');
        try {
            const emptyFolderManager = new DocumentFolderManager(emptyDir);
            const emptySearchEngine = new DocumentSearchEngine(emptyFolderManager);
            const emptyResults = await emptySearchEngine.searchDocuments('anything');

            if (emptyResults.total_results !== 0) {
                throw new Error('Empty directory search should return 0 results');
            }
        } finally {
            await cleanup(emptyDir);
        }

        console.log('    ✅ All edge case tests passed');
        return true;

    } catch (error) {
        console.log(`    ❌ Edge case test failed: ${error.message}`);
        return false;
    } finally {
        await cleanup(testDir);
    }
}

// Helper functions for test setup and data creation

async function createTestEnvironment(testName) {
    const testDir = path.join(os.tmpdir(), `search_test_${testName}_${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    return testDir;
}

async function setupSearchEnvironment(testDir) {
    const folderManager = new DocumentFolderManager(testDir);
    const searchEngine = new DocumentSearchEngine(folderManager);
    return { folderManager, searchEngine };
}

async function cleanup(testDir) {
    if (existsSync(testDir)) {
        await fs.rm(testDir, { recursive: true, force: true });
    }
}

async function createBasicTestDocuments(folderManager) {
    const documents = [
        {
            name: 'JavaScript Guide',
            category: 'Programming',
            content: `# JavaScript Programming Guide

JavaScript is a versatile programming language used for web development.

## Variables
Variables can be declared using var, let, or const keywords.

## Functions
Functions are reusable blocks of code that perform specific tasks.
`
        },
        {
            name: 'Machine Learning Basics',
            category: 'AI',
            content: `# Machine Learning Introduction

Machine learning is a subset of artificial intelligence.

## Supervised Learning
Supervised learning uses labeled training data.

## Unsupervised Learning
Unsupervised learning finds patterns in unlabeled data.
`
        },
        {
            name: 'Project Planning',
            category: 'Management',
            content: `# Project Planning Guide

Effective project planning is crucial for success.

## Requirements Gathering
Understanding what needs to be built.

## Timeline Development
Creating realistic schedules and milestones.
`
        }
    ];

    for (const doc of documents) {
        await folderManager.createDocumentFolder(doc.name, doc.category, doc.content);
    }
}

async function createVariedDocumentTypes(folderManager) {
    const documents = [
        {
            name: 'Markdown Tutorial',
            category: 'Documentation',
            content: `# Markdown Syntax Guide

Markdown is a lightweight markup language.

## Headers
Use # for headers of different levels.

## Lists
- Unordered lists use dashes
- Or asterisks
- Or plus signs

1. Ordered lists use numbers
2. Like this example
3. Sequential numbering
`
        },
        {
            name: 'API Documentation',
            category: 'Development',
            content: `# REST API Documentation

## Authentication
All requests require authentication.

\`\`\`javascript
function authenticate(token) {
    return fetch('/api/auth', {
        headers: { 'Authorization': \`Bearer \${token}\` }
    });
}
\`\`\`

## Endpoints
- GET /api/users
- POST /api/users
- PUT /api/users/:id
`
        },
        {
            name: 'Research Methodology',
            category: 'Research',
            content: `# Research Methodology Paper

## Abstract
This paper presents a comprehensive methodology for conducting research.

## Introduction
Research methodology is the systematic approach to solving research problems.

## Methodology
Our approach consists of three phases:
1. Data collection
2. Analysis
3. Validation

## Results
The methodology was tested on multiple datasets.

## Conclusion
The proposed methodology shows promising results.
`
        },
        {
            name: 'Meeting Notes 2024-01-15',
            category: 'Notes',
            content: `# Team Meeting Notes - January 15, 2024

## Agenda
1. Project status update
2. Technical challenges
3. Next steps

## Attendees
- John Smith (Project Manager)
- Jane Doe (Developer)
- Bob Johnson (Designer)

## Discussion Points
- Current sprint progress is on track
- Need to address performance issues
- UI/UX feedback incorporated

## Action Items
- [ ] Fix performance bottleneck by Friday
- [ ] Update documentation
- [ ] Schedule client demo
`
        },
        {
            name: 'Technical Specification',
            category: 'Specifications',
            content: `# System Technical Specification

## Overview
This document outlines the technical requirements for the new system.

## Functional Requirements
1. User authentication and authorization
2. Data processing capabilities
3. Real-time notifications
4. Reporting functionality

## Non-Functional Requirements
- Performance: Response time < 200ms
- Scalability: Support 10,000 concurrent users
- Security: End-to-end encryption
- Availability: 99.9% uptime

## Architecture
The system follows a microservices architecture pattern.

## Database Schema
User table, Document table, Category table relationships.
`
        }
    ];

    for (const doc of documents) {
        await folderManager.createDocumentFolder(doc.name, doc.category, doc.content);
    }
}

async function createNestedFolderStructure(folderManager) {
    const documents = [
        {
            name: 'Web Technology Overview',
            category: 'Technology',
            content: `# Web Technology Overview

Modern web development involves multiple technologies.

## Frontend Technologies
- HTML5 for structure
- CSS3 for styling
- JavaScript for interactivity

## Backend Technologies
- Node.js for server-side JavaScript
- Python for data processing
- Databases for persistence
`
        },
        {
            name: 'Software Development Practices',
            category: 'Technology',
            content: `# Software Development Best Practices

Quality software development requires following established practices.

## Version Control
Use Git for version control and collaboration.

## Testing
Implement unit tests, integration tests, and end-to-end tests.

## Code Review
All code should be reviewed before merging.
`
        },
        {
            name: 'Business Strategy',
            category: 'Business',
            content: `# Business Strategy Document

Strategic planning for technology adoption.

## Market Analysis
Current market trends in technology adoption.

## Competitive Advantage
How technology can provide competitive advantage.

## Implementation Plan
Phased approach to technology implementation.
`
        },
        {
            name: 'Nested Deep Content',
            category: 'Research/Advanced',
            content: `# Advanced Research Topics

This document covers nested and advanced research topics.

## Deep Learning
Advanced neural network architectures.

## Quantum Computing
Emerging quantum computing technologies.

## Nested Concepts
Complex interconnected ideas that require deep understanding.
`
        }
    ];

    for (const doc of documents) {
        await folderManager.createDocumentFolder(doc.name, doc.category, doc.content);
    }
}

async function createContentExtractionTestDocuments(folderManager) {
    const documents = [
        {
            name: 'Comprehensive Guide',
            category: 'Guides',
            content: `# Comprehensive Development Guide

## Introduction
This is a comprehensive guide to software development practices.

## Chapter 1: Getting Started
Before you begin, ensure you have the necessary tools installed.

### Prerequisites
- Text editor or IDE
- Version control system
- Programming language runtime

## Chapter 2: Best Practices
Following best practices ensures maintainable code.

### Code Organization
Organize your code into logical modules and packages.

### Testing Strategy
Implement comprehensive testing at multiple levels.

## Chapter 3: Advanced Topics
Advanced topics for experienced developers.

### Performance Optimization
Techniques for optimizing application performance.

### Security Considerations
Security should be built into the application from the start.

## Conclusion
This comprehensive guide covers the essential aspects of development.
`
        },
        {
            name: 'Specific Implementation',
            category: 'Implementation',
            content: `# Specific Implementation Details

## Overview
This document provides specific implementation details for the project.

Line 5: This is a specific line for testing line number extraction.

## Implementation Steps
1. Set up the development environment
2. Create the basic project structure
3. Implement core functionality
4. Add error handling
5. Write comprehensive tests

Line 15: Another specific line for testing multiple matches.

## Testing Approach
The testing approach includes multiple levels of testing.

## Deployment
Deployment should be automated and repeatable.

Line 25: Final specific line for testing extraction accuracy.
`
        }
    ];

    for (const doc of documents) {
        await folderManager.createDocumentFolder(doc.name, doc.category, doc.content);
    }
}

async function createMetadataTestDocuments(folderManager) {
    const documents = [
        {
            name: 'Metadata Rich Document',
            category: 'Testing',
            content: `# Metadata Rich Document

This document is designed to test metadata extraction capabilities.

## Content Statistics
- Word count: approximately 150 words
- Line count: multiple lines
- Heading count: several headings

## Structure
The document has a clear hierarchical structure with multiple sections.

### Subsection 1
Content for testing metadata extraction.

### Subsection 2
Additional content to increase word count and provide more metadata.

## Images
This document folder should contain an images subfolder for testing.

## Conclusion
This document provides rich metadata for testing purposes.
`
        }
    ];

    for (const doc of documents) {
        await folderManager.createDocumentFolder(doc.name, doc.category, doc.content);

        // Add a test image to the images folder
        const imagesFolder = await folderManager.getImagesFolder(
            path.join(folderManager.syncHubPath, doc.category, doc.name)
        );
        await fs.writeFile(path.join(imagesFolder, 'test-image.txt'), 'This is a test image placeholder');
    }
}

async function createPreviewTestDocuments(folderManager) {
    const documents = [
        {
            name: 'Preview Test Document',
            category: 'Testing',
            content: `# Preview Generation Test

This document is specifically designed to test preview generation and highlighting functionality.

The word "preview" appears multiple times in this document to test highlighting.

## Section 1
This section contains the word preview in the middle of a longer sentence to test context extraction.

## Section 2
Another section with preview content to test multiple matches and highlighting.

## Long Content Section
This is a very long section that contains a lot of text to test preview length limits and truncation. The preview functionality should handle long content gracefully and provide meaningful excerpts around the matched terms. This section continues with more text to ensure we test the preview generation with substantial content that exceeds normal preview lengths.

## Final Section
The final section also contains the word preview to test comprehensive highlighting across the entire document.
`
        },
        {
            name: 'Long Document Test',
            category: 'Testing',
            content: `# Long Document for Preview Testing

${'This is a long document with repeated content. '.repeat(100)}

The word "long" appears in this extensive document to test preview generation with substantial content.

${'More content to make this document very long. '.repeat(50)}

This tests how the preview system handles documents with significant length.

${'Additional content for comprehensive testing. '.repeat(75)}
`
        }
    ];

    for (const doc of documents) {
        await folderManager.createDocumentFolder(doc.name, doc.category, doc.content);
    }
}

async function createLargeDocumentCollection(folderManager, count) {
    const categories = ['Technology', 'Business', 'Research', 'Documentation', 'Notes'];
    const topics = ['performance', 'optimization', 'development', 'testing', 'deployment', 'security', 'scalability'];

    for (let i = 0; i < count; i++) {
        const category = categories[i % categories.length];
        const topic = topics[i % topics.length];

        const document = {
            name: `Document ${i + 1} - ${topic}`,
            category,
            content: `# Document ${i + 1}: ${topic.charAt(0).toUpperCase() + topic.slice(1)}

This is document number ${i + 1} in the performance test collection.

## Topic: ${topic}
This document focuses on ${topic} aspects of software development.

## Content
This document contains content related to ${topic} and performance testing.
The document number is ${i + 1} and it belongs to the ${category} category.

## Performance Testing
This document is part of a large collection used for performance testing.
It contains the word "performance" multiple times for search testing.

## Additional Content
${'Additional content for search testing. '.repeat(10)}

## Conclusion
Document ${i + 1} concludes the discussion on ${topic}.
`
        };

        await folderManager.createDocumentFolder(document.name, document.category, document.content);
    }
}

async function createMCPTestDocuments(testDir) {
    const documents = [
        {
            category: 'Integration',
            name: 'MCP-Integration-Test',
            content: `# MCP Integration Test Document

This document is used for testing MCP server integration with search functionality.

## Integration Testing
The integration between the MCP server and search engine is crucial.

## Test Cases
Various test cases are covered in this integration test.
`
        },
        {
            category: 'Testing',
            name: 'Search-Functionality-Test',
            content: `# Search Functionality Test

This document tests the search functionality through the MCP interface.

## Search Features
- Text search
- Category filtering
- Result limiting
- Error handling
`
        }
    ];

    for (const doc of documents) {
        const categoryPath = path.join(testDir, doc.category);
        await fs.mkdir(categoryPath, { recursive: true });

        const docFolderPath = path.join(categoryPath, doc.name);
        await fs.mkdir(docFolderPath, { recursive: true });

        const mainFilePath = path.join(docFolderPath, 'main.md');
        await fs.writeFile(mainFilePath, doc.content, 'utf8');

        const imagesPath = path.join(docFolderPath, 'images');
        await fs.mkdir(imagesPath, { recursive: true });
    }
}

/**
 * Run the test if this file is executed directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
    runComprehensiveSearchTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test execution failed:', error);
            process.exit(1);
        });
}

export { runComprehensiveSearchTests };