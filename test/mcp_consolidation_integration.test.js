#!/usr/bin/env node

/**
 * Integration test for MCP consolidate_content tool
 * Tests the updated consolidate_content tool with ContentConsolidationEngine
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DocumentOrganizationServer } from '../src/mcp/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MCPConsolidationTest {
    constructor() {
        this.testDir = path.join(__dirname, 'test_data', 'mcp_consolidation_test');
        this.syncHub = path.join(this.testDir, 'sync_hub');
        this.server = null;
    }

    async setup() {
        console.log('Setting up MCP consolidation test environment...');

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
        await this.createTestDocumentFolder('JavaScript-Basics', 'Development', `# JavaScript Basics

JavaScript is a programming language that enables interactive web pages.

## Variables

Variables store data values:
- let
- const
- var

## Functions

Functions are reusable blocks of code.`);

        await this.createTestDocumentFolder('React-Guide', 'Development', `# React Guide

React is a JavaScript library for building user interfaces.

## Components

Components are the building blocks of React applications.

## State Management

State allows components to manage their data.`);

        // Create MCP server instance
        this.server = new DocumentOrganizationServer();

        // Override sync hub path for testing BEFORE initialization
        this.server.syncHub = this.syncHub;
        this.server.projectRoot = path.resolve(__dirname, '..');

        // Initialize the server
        await this.server.initialize();

        // Override again after initialization to ensure it sticks
        this.server.syncHub = this.syncHub;
        if (this.server.documentFolderManager) {
            this.server.documentFolderManager.syncHubPath = this.syncHub;
        }

        console.log('MCP consolidation test environment setup complete');
    }

    async createTestDocumentFolder(folderName, category, content) {
        const categoryPath = path.join(this.syncHub, category);
        const folderPath = path.join(categoryPath, folderName);
        const imagesPath = path.join(folderPath, 'images');

        await fs.mkdir(folderPath, { recursive: true });
        await fs.mkdir(imagesPath, { recursive: true });
        await fs.writeFile(path.join(folderPath, 'main.md'), content, 'utf8');
    }

    async testConsolidateContentTool() {
        console.log('\nTesting consolidate_content MCP tool...');

        const args = {
            topic: 'Web Development Fundamentals',
            file_paths: [
                'Development/JavaScript-Basics/main.md',
                'Development/React-Guide/main.md'
            ],
            strategy: 'simple_merge',
            dry_run: false
        };

        try {
            const result = await this.server.consolidateContent(args);

            // Parse the JSON response
            const responseText = result.content[0].text;
            const response = JSON.parse(responseText);

            console.log('MCP Response:', JSON.stringify(response, null, 2));

            // Check if this is an error response
            if (response.success === false) {
                throw new Error('Consolidation failed: ' + response.message);
            }

            // Verify the consolidation was successful
            if (!response.consolidation_result || !response.consolidation_result.success) {
                throw new Error('Consolidation failed: ' + (response.consolidation_result?.message || 'Unknown error'));
            }

            // Verify the consolidated document was created
            const consolidatedDoc = response.consolidation_result.consolidated_document;
            if (!consolidatedDoc) {
                throw new Error('No consolidated document path returned');
            }

            // Check if the consolidated document exists and has content
            try {
                const content = await fs.readFile(consolidatedDoc, 'utf8');
                if (!content.includes('Web Development Fundamentals')) {
                    throw new Error('Consolidated document missing expected topic');
                }
                if (!content.includes('JavaScript Basics') || !content.includes('React Guide')) {
                    throw new Error('Consolidated document missing source content');
                }
                console.log('✅ Consolidated document created successfully');
            } catch (error) {
                throw new Error(`Failed to read consolidated document: ${error.message}`);
            }

            // Verify batch processing summary
            const summary = response.batch_processing_summary;
            if (summary.files_requested !== 2 || summary.folders_consolidated !== 2) {
                throw new Error('Batch processing summary incorrect');
            }

            console.log('✅ MCP consolidate_content tool test passed');
            return true;

        } catch (error) {
            console.error('❌ MCP consolidate_content tool test failed:', error.message);
            return false;
        }
    }

    async testDryRunMode() {
        console.log('\nTesting dry run mode...');

        const args = {
            topic: 'Dry Run Test',
            file_paths: [
                'Development/JavaScript-Basics/main.md'
            ],
            strategy: 'simple_merge',
            dry_run: true
        };

        try {
            const result = await this.server.consolidateContent(args);
            const responseText = result.content[0].text;
            const response = JSON.parse(responseText);

            // Check if this is an error response
            if (response.success === false) {
                throw new Error('Dry run failed: ' + response.message);
            }

            if (!response.consolidation_result || !response.consolidation_result.success) {
                throw new Error('Dry run failed: ' + JSON.stringify(response));
            }

            if (!response.consolidation_result.dry_run) {
                throw new Error('Dry run flag not set in response');
            }

            console.log('✅ Dry run mode test passed');
            return true;

        } catch (error) {
            console.error('❌ Dry run mode test failed:', error.message);
            return false;
        }
    }

    async testErrorHandling() {
        console.log('\nTesting error handling...');

        const args = {
            topic: 'Error Test',
            file_paths: [
                'NonExistent/File1.md',
                'NonExistent/File2.md'
            ],
            strategy: 'simple_merge',
            dry_run: false
        };

        try {
            const result = await this.server.consolidateContent(args);
            const responseText = result.content[0].text;
            const response = JSON.parse(responseText);

            // Should fail gracefully with informative error message
            if (response.success !== false && response.consolidation_result?.success) {
                throw new Error('Should have failed with non-existent files');
            }

            // Check for unresolved files in either response format
            const unresolvedFiles = response.unresolved_files || response.consolidation_result?.unresolved_files;
            if (!unresolvedFiles || unresolvedFiles.length === 0) {
                throw new Error('Should report unresolved files');
            }

            console.log('✅ Error handling test passed');
            return true;

        } catch (error) {
            console.error('❌ Error handling test failed:', error.message);
            return false;
        }
    }

    async cleanup() {
        console.log('\nCleaning up MCP consolidation test environment...');
        try {
            await fs.rm(this.testDir, { recursive: true, force: true });
        } catch (error) {
            console.warn('Cleanup warning:', error.message);
        }
    }

    async run() {
        console.log('🧪 Starting MCP Consolidation Integration Tests\n');

        let passed = 0;
        let failed = 0;

        try {
            await this.setup();

            // Test consolidate_content tool
            if (await this.testConsolidateContentTool()) {
                passed++;
            } else {
                failed++;
            }

            // Test dry run mode
            if (await this.testDryRunMode()) {
                passed++;
            } else {
                failed++;
            }

            // Test error handling
            if (await this.testErrorHandling()) {
                passed++;
            } else {
                failed++;
            }

        } finally {
            await this.cleanup();
        }

        console.log('\n📊 Integration Test Results:');
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

        if (failed > 0) {
            console.log('\n❌ Some integration tests failed');
            process.exit(1);
        } else {
            console.log('\n🎉 All integration tests passed!');
        }
    }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const test = new MCPConsolidationTest();
    test.run().catch(error => {
        console.error('Integration test runner failed:', error);
        process.exit(1);
    });
}

export { MCPConsolidationTest };