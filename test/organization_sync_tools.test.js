#!/usr/bin/env node

/**
 * Test Organization and Sync Tools with Folder-Based Structure
 * Tests the updated organize_documents, get_organization_stats, and sync_documents tools
 */

import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DocumentOrganizationServer } from '../src/mcp/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Test configuration
const testConfig = {
    testDir: path.join(__dirname, 'test_data', 'organization_sync_test'),
    syncHub: path.join(__dirname, 'test_data', 'organization_sync_test', 'Sync_Hub_Test'),
    timeout: 30000
};

/**
 * Test utilities
 */
class OrganizationSyncTestSuite {
    constructor() {
        this.server = null;
        this.testResults = {
            passed: 0,
            failed: 0,
            errors: []
        };
    }

    async setup() {
        console.log('🔧 Setting up organization and sync tools test environment...');

        // Clean up any existing test directory
        if (existsSync(testConfig.testDir)) {
            await fs.rm(testConfig.testDir, { recursive: true, force: true });
        }

        // Create test directory structure
        await fs.mkdir(testConfig.testDir, { recursive: true });
        await fs.mkdir(testConfig.syncHub, { recursive: true });

        // Create test configuration
        const configDir = path.join(testConfig.testDir, 'config');
        await fs.mkdir(configDir, { recursive: true });

        const configContent = `SYNC_HUB="${testConfig.syncHub}"
LOG_LEVEL="INFO"
LOG_TO_CONSOLE="true"
LOG_TO_FILE="false"`;

        await fs.writeFile(path.join(configDir, 'config.env'), configContent);

        // Create test loose files that need organization
        await this.createTestLooseFiles();

        // Create some existing document folders
        await this.createTestDocumentFolders();

        // Initialize server
        this.server = new DocumentOrganizationServer();
        this.server.projectRoot = testConfig.testDir;
        this.server.syncHub = testConfig.syncHub;

        await this.server.initialize();

        console.log('✅ Test environment setup complete');
    }

    async createTestLooseFiles() {
        // Create loose files in root that need organization
        const looseFiles = [
            {
                name: 'machine_learning_notes.md',
                content: '# Machine Learning Notes\n\nThis document contains notes about neural networks and deep learning algorithms.'
            },
            {
                name: 'research_paper_draft.md',
                content: '# Research Paper Draft\n\n## Abstract\n\nThis paper presents a methodology for analyzing data patterns.\n\n## Conclusion\n\nThe results show significant improvements.'
            },
            {
                name: 'api_documentation.md',
                content: '# API Documentation\n\n```javascript\nfunction getData() {\n  return fetch("/api/data");\n}\n```'
            },
            {
                name: 'web_tutorial.md',
                content: '# Web Development Tutorial\n\nThis tutorial covers HTML, CSS, and JavaScript basics for building websites.'
            },
            {
                name: 'random_notes.md',
                content: '# Random Notes\n\nJust some random thoughts and ideas I had today.'
            }
        ];

        for (const file of looseFiles) {
            await fs.writeFile(path.join(testConfig.syncHub, file.name), file.content);
        }

        // Create loose files in category directories (should be organized into document folders)
        const categories = ['AI & ML', 'Development'];
        for (const category of categories) {
            const categoryPath = path.join(testConfig.syncHub, category);
            await fs.mkdir(categoryPath, { recursive: true });

            await fs.writeFile(
                path.join(categoryPath, 'loose_file_in_category.md'),
                `# Loose File in ${category}\n\nThis file should be organized into a document folder.`
            );
        }
    }

    async createTestDocumentFolders() {
        // Create properly structured document folders
        const documentFolders = [
            {
                category: 'AI & ML',
                name: 'Neural-Networks-Guide',
                content: '# Neural Networks Guide\n\nComprehensive guide to neural networks.\n\n![diagram](images/network_diagram.png)'
            },
            {
                category: 'Research Papers',
                name: 'Data-Analysis-Study',
                content: '# Data Analysis Study\n\n## Methodology\n\nWe used statistical methods.\n\n![chart](images/results_chart.png)'
            }
        ];

        for (const docFolder of documentFolders) {
            const categoryPath = path.join(testConfig.syncHub, docFolder.category);
            await fs.mkdir(categoryPath, { recursive: true });

            const docFolderPath = path.join(categoryPath, docFolder.name);
            await fs.mkdir(docFolderPath, { recursive: true });

            // Create main document file
            await fs.writeFile(path.join(docFolderPath, 'main.md'), docFolder.content);

            // Create images subfolder with test image
            const imagesPath = path.join(docFolderPath, 'images');
            await fs.mkdir(imagesPath, { recursive: true });
            await fs.writeFile(path.join(imagesPath, 'test_image.png'), 'fake image data');
        }
    }

    async cleanup() {
        console.log('🧹 Cleaning up test environment...');
        if (existsSync(testConfig.testDir)) {
            await fs.rm(testConfig.testDir, { recursive: true, force: true });
        }
        console.log('✅ Cleanup complete');
    }

    logTest(testName, passed, error = null) {
        if (passed) {
            console.log(`✅ ${testName}`);
            this.testResults.passed++;
        } else {
            console.log(`❌ ${testName}`);
            if (error) {
                console.log(`   Error: ${error.message}`);
                this.testResults.errors.push({ test: testName, error: error.message });
            }
            this.testResults.failed++;
        }
    }

    async testOrganizeDocuments() {
        console.log('\n📁 Testing organize_documents with folder-based structure...');

        try {
            // Test dry run first
            const dryRunResult = await this.server.organizeDocuments({ dry_run: true });
            const dryRunData = JSON.parse(dryRunResult.content[0].text);

            this.logTest(
                'organize_documents dry run executes successfully',
                dryRunData.success === true && dryRunData.dry_run === true
            );

            this.logTest(
                'organize_documents dry run finds loose files',
                dryRunData.results.processed > 0
            );

            // Test actual organization
            const organizeResult = await this.server.organizeDocuments({ dry_run: false });
            const organizeData = JSON.parse(organizeResult.content[0].text);

            this.logTest(
                'organize_documents executes successfully',
                organizeData.success === true && organizeData.dry_run === false
            );

            this.logTest(
                'organize_documents processes files into document folders',
                organizeData.results.moved > 0
            );

            this.logTest(
                'organize_documents creates document folders in categories',
                Object.keys(organizeData.results.categories).length > 0
            );

            // Verify document folders were created properly
            const aiMlPath = path.join(testConfig.syncHub, 'AI & ML');
            const aiMlEntries = await fs.readdir(aiMlPath, { withFileTypes: true });
            const documentFolders = aiMlEntries.filter(entry => entry.isDirectory());

            this.logTest(
                'organize_documents creates proper document folder structure',
                documentFolders.length > 0
            );

            // Check that a document folder has proper structure
            if (documentFolders.length > 0) {
                const docFolderPath = path.join(aiMlPath, documentFolders[0].name);
                const hasMainFile = existsSync(path.join(docFolderPath, 'main.md'));
                const hasImagesFolder = existsSync(path.join(docFolderPath, 'images'));

                this.logTest(
                    'organized document folder has main.md file',
                    hasMainFile
                );

                this.logTest(
                    'organized document folder has images subfolder',
                    hasImagesFolder
                );
            }

        } catch (error) {
            this.logTest('organize_documents handles errors gracefully', false, error);
        }
    }

    async testGetOrganizationStats() {
        console.log('\n📊 Testing get_organization_stats with folder-based counting...');

        try {
            const statsResult = await this.server.getOrganizationStats();
            const statsData = JSON.parse(statsResult.content[0].text);

            this.logTest(
                'get_organization_stats executes successfully',
                statsData.sync_hub && statsData.organization_type === 'folder-based'
            );

            this.logTest(
                'get_organization_stats counts document folders',
                statsData.summary.total_document_folders >= 0
            );

            this.logTest(
                'get_organization_stats provides category breakdown',
                statsData.categories && typeof statsData.categories === 'object'
            );

            this.logTest(
                'get_organization_stats counts images in document folders',
                typeof statsData.summary.total_images === 'number'
            );

            this.logTest(
                'get_organization_stats identifies loose files',
                typeof statsData.summary.total_loose_files === 'number'
            );

            // Verify category stats structure
            const hasValidCategoryStats = Object.values(statsData.categories).every(category =>
                typeof category === 'object' &&
                (typeof category.documentFolders === 'number' || typeof category.looseFiles === 'number')
            );

            this.logTest(
                'get_organization_stats provides valid category statistics',
                hasValidCategoryStats
            );

        } catch (error) {
            this.logTest('get_organization_stats handles errors gracefully', false, error);
        }
    }

    async testSyncDocuments() {
        console.log('\n🔄 Testing sync_documents with folder structure preservation...');

        try {
            // Test sync with 'status' service (safe test that won't actually sync)
            const syncResult = await this.server.syncDocuments({ service: 'status' });
            const syncData = JSON.parse(syncResult.content[0].text);

            this.logTest(
                'sync_documents executes without crashing',
                syncData.service === 'status'
            );

            this.logTest(
                'sync_documents validates document folder integrity',
                typeof syncData.results.documentFoldersFound === 'number'
            );

            this.logTest(
                'sync_documents preserves folder structure flag',
                syncData.folder_structure_preserved === true
            );

            this.logTest(
                'sync_documents provides comprehensive results',
                syncData.results &&
                Array.isArray(syncData.results.warnings) &&
                Array.isArray(syncData.results.errors)
            );

            // Test that document folders are still intact after sync attempt
            const documentFolders = await this.server.documentFolderManager.findDocumentFolders(testConfig.syncHub, true);

            this.logTest(
                'sync_documents maintains document folder integrity',
                documentFolders.length > 0
            );

            // Verify a document folder still has proper structure
            if (documentFolders.length > 0) {
                const mainFile = await this.server.documentFolderManager.getMainDocumentFile(documentFolders[0]);
                const imagesFolder = path.join(documentFolders[0], 'images');

                this.logTest(
                    'sync_documents preserves main document files',
                    mainFile !== null
                );

                this.logTest(
                    'sync_documents preserves images subfolders',
                    existsSync(imagesFolder) || existsSync(path.join(documentFolders[0], 'images'))
                );
            }

        } catch (error) {
            this.logTest('sync_documents handles errors gracefully', false, error);
        }
    }

    async runAllTests() {
        console.log('🚀 Starting Organization and Sync Tools Test Suite...\n');

        try {
            await this.setup();

            await this.testOrganizeDocuments();
            await this.testGetOrganizationStats();
            await this.testSyncDocuments();

        } catch (error) {
            console.error('❌ Test suite setup failed:', error.message);
            this.testResults.failed++;
            this.testResults.errors.push({ test: 'setup', error: error.message });
        } finally {
            await this.cleanup();
        }

        // Print results
        console.log('\n📋 Test Results Summary:');
        console.log(`✅ Passed: ${this.testResults.passed}`);
        console.log(`❌ Failed: ${this.testResults.failed}`);

        if (this.testResults.errors.length > 0) {
            console.log('\n🔍 Error Details:');
            this.testResults.errors.forEach(({ test, error }) => {
                console.log(`  ${test}: ${error}`);
            });
        }

        const success = this.testResults.failed === 0;
        console.log(`\n${success ? '🎉' : '💥'} Test suite ${success ? 'PASSED' : 'FAILED'}`);

        return success;
    }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const testSuite = new OrganizationSyncTestSuite();
    const success = await testSuite.runAllTests();
    process.exit(success ? 0 : 1);
}

export { OrganizationSyncTestSuite };