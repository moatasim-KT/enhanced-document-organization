#!/usr/bin/env node

/**
 * Test Category Tools with Folder-Based Document Structure
 * Tests the updated category and suggestion tools to ensure they work with document folders
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DocumentOrganizationServer } from '../src/mcp/server.js';
import { DocumentFolderManager } from '../src/organize/document_folder_manager.js';
import { CategoryManager } from '../src/organize/category_manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CategoryToolsTest {
    constructor() {
        this.testDir = path.join(__dirname, 'test_data', 'category_tools_test');
        this.syncHub = path.join(this.testDir, 'Sync_Hub_Test');
        this.projectRoot = path.resolve(__dirname, '..');
        this.server = null;
        this.documentFolderManager = null;
        this.categoryManager = null;
    }

    async setup() {
        console.log('Setting up category tools test environment...');

        // Clean up any existing test data
        await this.cleanup();

        // Create test directory structure
        await fs.mkdir(this.testDir, { recursive: true });
        await fs.mkdir(this.syncHub, { recursive: true });

        // Create test categories with document folders
        await this.createTestCategories();

        // Initialize components
        this.documentFolderManager = new DocumentFolderManager(this.syncHub);
        this.categoryManager = new CategoryManager({
            projectRoot: this.projectRoot,
            syncHub: this.syncHub,
            configPath: path.join(this.projectRoot, 'config', 'organize_config.conf')
        });
        await this.categoryManager.initialize();

        // Initialize server
        this.server = new DocumentOrganizationServer();
        this.server.projectRoot = this.projectRoot;
        this.server.syncHub = this.syncHub;
        this.server.documentFolderManager = this.documentFolderManager;

        console.log('Test environment setup complete');
    }

    async createTestCategories() {
        const categories = [
            {
                name: 'AI & ML',
                documents: [
                    {
                        name: 'Machine Learning Basics',
                        content: '# Machine Learning Basics\n\nThis document covers the fundamentals of machine learning algorithms and neural networks.'
                    },
                    {
                        name: 'Deep Learning Guide',
                        content: '# Deep Learning Guide\n\nAn introduction to deep learning with TensorFlow and PyTorch frameworks.'
                    }
                ]
            },
            {
                name: 'Development',
                documents: [
                    {
                        name: 'API Design Patterns',
                        content: '# API Design Patterns\n\nBest practices for designing RESTful APIs and GraphQL endpoints.'
                    },
                    {
                        name: 'JavaScript Functions',
                        content: '# JavaScript Functions\n\n```javascript\nfunction example() {\n  return "Hello World";\n}\n```'
                    }
                ]
            },
            {
                name: 'Notes & Drafts',
                documents: [
                    {
                        name: 'Meeting Notes',
                        content: '# Meeting Notes\n\nTODO: Review project requirements\nIdea: Implement new feature'
                    },
                    {
                        name: 'Random Thoughts',
                        content: '# Random Thoughts\n\nDraft ideas for the upcoming presentation.'
                    }
                ]
            }
        ];

        for (const category of categories) {
            const categoryPath = path.join(this.syncHub, category.name);
            await fs.mkdir(categoryPath, { recursive: true });

            for (const doc of category.documents) {
                // Create document folder
                const docFolderPath = path.join(categoryPath, doc.name);
                await fs.mkdir(docFolderPath, { recursive: true });

                // Create main document file
                const mainFilePath = path.join(docFolderPath, 'main.md');
                await fs.writeFile(mainFilePath, doc.content, 'utf-8');

                // Create images subfolder
                const imagesPath = path.join(docFolderPath, 'images');
                await fs.mkdir(imagesPath, { recursive: true });
            }
        }
    }

    async testListCategories() {
        console.log('\n=== Testing list_categories tool ===');

        try {
            const result = await this.server.listCategories();
            const data = JSON.parse(result.content[0].text);

            console.log('Categories found:', data.total_categories);
            console.log('Total document folders:', data.total_document_folders);

            // Verify categories exist
            const expectedCategories = ['AI & ML', 'Development', 'Notes & Drafts'];
            for (const expectedCat of expectedCategories) {
                const category = data.categories.find(cat => cat.name === expectedCat);
                if (category) {
                    console.log(`✓ Category "${expectedCat}": ${category.document_folder_count} document folders`);
                    if (category.document_folder_count !== 2) {
                        throw new Error(`Expected 2 document folders in ${expectedCat}, got ${category.document_folder_count}`);
                    }
                } else {
                    throw new Error(`Category "${expectedCat}" not found`);
                }
            }

            console.log('✓ list_categories test passed');
            return true;
        } catch (error) {
            console.error('✗ list_categories test failed:', error.message);
            return false;
        }
    }

    async testSuggestCategories() {
        console.log('\n=== Testing suggest_categories tool ===');

        try {
            // Create some poorly categorized content
            const miscPath = path.join(this.syncHub, 'Miscellaneous');
            await fs.mkdir(miscPath, { recursive: true });

            // Create document folders with content that doesn't fit existing categories
            const poorlyMatchedDocs = [
                {
                    name: 'Finance Report',
                    content: '# Finance Report\n\nQuarterly financial analysis and budget planning for the upcoming fiscal year. This report covers revenue projections, expense analysis, and strategic financial planning initiatives for the next quarter. We will examine market trends, investment opportunities, and risk assessment strategies to ensure optimal financial performance and sustainable growth.'
                },
                {
                    name: 'Investment Strategy',
                    content: '# Investment Strategy\n\nPortfolio diversification and risk management strategies for long-term growth. This comprehensive guide outlines various investment approaches, asset allocation methodologies, and market analysis techniques. We explore different investment vehicles, risk tolerance assessment, and strategic planning for building a robust investment portfolio.'
                },
                {
                    name: 'Budget Planning',
                    content: '# Budget Planning\n\nDetailed budget allocation and expense tracking for project management. This document provides frameworks for financial planning, cost estimation, and resource allocation across different project phases. We cover budgeting methodologies, expense categorization, and financial monitoring systems for effective project management.'
                }
            ];

            for (const doc of poorlyMatchedDocs) {
                const docFolderPath = path.join(miscPath, doc.name);
                await fs.mkdir(docFolderPath, { recursive: true });

                const mainFilePath = path.join(docFolderPath, 'main.md');
                await fs.writeFile(mainFilePath, doc.content, 'utf-8');

                const imagesPath = path.join(docFolderPath, 'images');
                await fs.mkdir(imagesPath, { recursive: true });
            }

            // Debug: Check if folders were created correctly
            const miscEntries = await fs.readdir(miscPath, { withFileTypes: true });
            console.log('Created folders in Miscellaneous:', miscEntries.filter(e => e.isDirectory()).map(e => e.name));

            // Debug: Test DocumentFolderManager directly
            const foundFolders = await this.documentFolderManager.findDocumentFolders(miscPath, true);
            console.log('DocumentFolderManager found folders:', foundFolders.map(f => path.basename(f)));

            // Debug: Test each folder individually
            const { ContentAnalyzer } = await import('../src/organize/content_analyzer.js');
            const analyzer = new ContentAnalyzer();

            for (const folderPath of foundFolders) {
                const mainFile = await this.documentFolderManager.getMainDocumentFile(folderPath);
                console.log(`Folder ${path.basename(folderPath)}: main file = ${mainFile ? path.basename(mainFile) : 'NOT FOUND'}`);

                if (mainFile) {
                    try {
                        const analysis = await analyzer.analyzeContent(mainFile);
                        console.log(`  Analysis result: ${analysis ? 'SUCCESS' : 'NULL'}`);
                        if (analysis) {
                            console.log(`  Topics: ${analysis.topics.join(', ')}`);
                        }
                    } catch (error) {
                        console.log(`  Analysis error: ${error.message}`);
                    }
                }
            }

            // Test category suggestion
            const result = await this.server.suggestCategories({ directory: 'Miscellaneous' });
            const data = JSON.parse(result.content[0].text);

            console.log('Document folders analyzed:', data.document_folders_analyzed);
            console.log('Poorly categorized:', data.poorly_categorized);
            console.log('Suggestion available:', data.suggestion_available);
            console.log('Analyzed folders:', data.analyzed_folders);

            if (data.document_folders_analyzed !== 3) {
                throw new Error(`Expected 3 document folders analyzed, got ${data.document_folders_analyzed}`);
            }

            if (data.analyzed_folders.length !== 3) {
                throw new Error(`Expected 3 analyzed folders, got ${data.analyzed_folders.length}`);
            }

            // Verify folder analysis includes folder names
            const expectedFolders = ['Finance Report', 'Investment Strategy', 'Budget Planning'];
            for (const expectedFolder of expectedFolders) {
                const found = data.analyzed_folders.find(folder => folder.folder_name === expectedFolder);
                if (!found) {
                    throw new Error(`Expected folder "${expectedFolder}" not found in analysis`);
                }
            }

            console.log('✓ suggest_categories test passed');
            return true;
        } catch (error) {
            console.error('✗ suggest_categories test failed:', error.message);
            return false;
        }
    }

    async testAddCustomCategory() {
        console.log('\n=== Testing add_custom_category tool ===');

        try {
            const categoryData = {
                name: 'Finance',
                icon: '💰',
                description: 'Financial documents and reports',
                keywords: ['finance', 'budget', 'investment', 'money'],
                file_patterns: ['*finance*', '*budget*', '*investment*'],
                priority: 8
            };

            const result = await this.server.addCustomCategory(categoryData);
            const data = JSON.parse(result.content[0].text);

            if (!data.success) {
                throw new Error('Failed to add custom category');
            }

            console.log('✓ Custom category added:', data.category_added.name);

            // Verify category folder was created
            const categoryPath = path.join(this.syncHub, 'Finance');
            const categoryExists = await fs.access(categoryPath).then(() => true).catch(() => false);

            if (!categoryExists) {
                throw new Error('Category folder was not created');
            }

            // Verify category info file was created
            const infoFilePath = path.join(categoryPath, '_category_info.md');
            const infoExists = await fs.access(infoFilePath).then(() => true).catch(() => false);

            if (!infoExists) {
                throw new Error('Category info file was not created');
            }

            console.log('✓ add_custom_category test passed');
            return true;
        } catch (error) {
            console.error('✗ add_custom_category test failed:', error.message);
            return false;
        }
    }

    async testCategoryManagerFolderIntegration() {
        console.log('\n=== Testing CategoryManager folder integration ===');

        try {
            // Test document folder counting
            const stats = await this.categoryManager.countDocumentFoldersInCategory(path.join(this.syncHub, 'AI & ML'));

            if (stats.documentFolderCount !== 2) {
                throw new Error(`Expected 2 document folders in AI & ML, got ${stats.documentFolderCount}`);
            }

            console.log('✓ Document folder counting works correctly');

            // Test isDocumentFolder method
            const testFolderPath = path.join(this.syncHub, 'AI & ML', 'Machine Learning Basics');
            const isDocFolder = await this.categoryManager.isDocumentFolder(testFolderPath);

            if (!isDocFolder) {
                throw new Error('Failed to identify document folder');
            }

            console.log('✓ Document folder identification works correctly');

            // Test category stats update
            await this.categoryManager.updateCategoryStats();
            const categoryStats = this.categoryManager.getCategoryStats();

            const aiMlStats = categoryStats.find(stat => stat.name === 'AI & ML');
            if (!aiMlStats || aiMlStats.documentFolderCount !== 2) {
                throw new Error('Category stats not updated correctly');
            }

            console.log('✓ Category stats update works correctly');
            console.log('✓ CategoryManager folder integration test passed');
            return true;
        } catch (error) {
            console.error('✗ CategoryManager folder integration test failed:', error.message);
            return false;
        }
    }

    async runAllTests() {
        console.log('Starting Category Tools Folder Structure Tests...\n');

        const tests = [
            this.testListCategories.bind(this),
            this.testSuggestCategories.bind(this),
            this.testAddCustomCategory.bind(this),
            this.testCategoryManagerFolderIntegration.bind(this)
        ];

        let passed = 0;
        let failed = 0;

        for (const test of tests) {
            try {
                const result = await test();
                if (result) {
                    passed++;
                } else {
                    failed++;
                }
            } catch (error) {
                console.error('Test execution error:', error.message);
                failed++;
            }
        }

        console.log('\n=== Test Results ===');
        console.log(`✓ Passed: ${passed}`);
        console.log(`✗ Failed: ${failed}`);
        console.log(`Total: ${passed + failed}`);

        return failed === 0;
    }

    async cleanup() {
        try {
            await fs.rm(this.testDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const test = new CategoryToolsTest();

    try {
        await test.setup();
        const success = await test.runAllTests();
        await test.cleanup();

        process.exit(success ? 0 : 1);
    } catch (error) {
        console.error('Test setup/execution failed:', error);
        await test.cleanup();
        process.exit(1);
    }
}

export { CategoryToolsTest };