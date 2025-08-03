#!/usr/bin/env node

/**
 * Content Consolidation Unit Tests
 * Consolidated from multiple content consolidation test files
 * Tests all content consolidation functionality in the organize module
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

class ContentConsolidationTests {
    constructor() {
        this.testResults = {
            passed: 0,
            failed: 0,
            errors: []
        };
        this.testDir = path.join(os.tmpdir(), 'content_consolidation_test');
    }

    async setup() {
        console.log('🔧 Setting up content consolidation test environment...');
        
        // Clean up any existing test directory
        try {
            await fs.rm(this.testDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore if directory doesn't exist
        }

        // Create test directory structure
        await fs.mkdir(this.testDir, { recursive: true });
        await fs.mkdir(path.join(this.testDir, 'test_docs'), { recursive: true });
        
        // Create test documents with similar content
        const testDocs = [
            {
                name: 'ml-guide-part1.md',
                content: `# Machine Learning Guide - Part 1

## Introduction
Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions without being explicitly programmed.

## Key Concepts
- Supervised Learning
- Unsupervised Learning
- Reinforcement Learning

## Applications
ML is used in various fields including healthcare, finance, and technology.`
            },
            {
                name: 'ml-guide-part2.md',
                content: `# Machine Learning Guide - Part 2

## Advanced Topics
This document covers advanced machine learning concepts and techniques.

## Deep Learning
Neural networks with multiple layers that can learn complex patterns.

## Applications
Machine learning applications continue to grow in healthcare, autonomous vehicles, and natural language processing.`
            },
            {
                name: 'ai-overview.md',
                content: `# Artificial Intelligence Overview

## What is AI?
Artificial Intelligence encompasses machine learning, natural language processing, and computer vision.

## Machine Learning
A key component of AI that allows systems to learn from data.

## Future of AI
AI will continue to transform industries and create new opportunities.`
            }
        ];

        for (const doc of testDocs) {
            await fs.writeFile(
                path.join(this.testDir, 'test_docs', doc.name),
                doc.content
            );
        }

        console.log('✅ Test environment setup complete');
    }

    async testBasicConsolidation() {
        console.log('\n📄 Testing basic content consolidation...');
        
        try {
            // Import the content consolidation module
            const { ContentConsolidator } = await import(path.join(projectRoot, 'src/organize/content_consolidator.js'));
            
            const consolidator = new ContentConsolidator({
                strategy: 'simple_merge',
                outputFormat: 'markdown'
            });

            const files = [
                path.join(this.testDir, 'test_docs', 'ml-guide-part1.md'),
                path.join(this.testDir, 'test_docs', 'ml-guide-part2.md')
            ];

            const result = await consolidator.consolidate(files, 'Machine Learning');
            
            if (result && result.content && result.content.includes('Machine Learning')) {
                this.logSuccess('Basic content consolidation');
            } else {
                this.logFailure('Basic content consolidation', 'Consolidation failed or missing content');
            }
            
        } catch (error) {
            this.logFailure('Basic content consolidation', error.message);
        }
    }

    async testComprehensiveMerge() {
        console.log('\n📄 Testing comprehensive merge strategy...');
        
        try {
            const { ContentConsolidator } = await import(path.join(projectRoot, 'src/organize/content_consolidator.js'));
            
            const consolidator = new ContentConsolidator({
                strategy: 'comprehensive_merge',
                outputFormat: 'markdown',
                enhanceWithAi: false
            });

            const files = [
                path.join(this.testDir, 'test_docs', 'ml-guide-part1.md'),
                path.join(this.testDir, 'test_docs', 'ml-guide-part2.md'),
                path.join(this.testDir, 'test_docs', 'ai-overview.md')
            ];

            const result = await consolidator.consolidate(files, 'AI and Machine Learning');
            
            if (result && result.content && result.metadata) {
                this.logSuccess('Comprehensive merge strategy');
            } else {
                this.logFailure('Comprehensive merge strategy', 'Merge failed or missing metadata');
            }
            
        } catch (error) {
            this.logFailure('Comprehensive merge strategy', error.message);
        }
    }

    async testStructuredConsolidation() {
        console.log('\n📄 Testing structured consolidation...');
        
        try {
            const { ContentConsolidator } = await import(path.join(projectRoot, 'src/organize/content_consolidator.js'));
            
            const consolidator = new ContentConsolidator({
                strategy: 'structured_consolidation',
                outputFormat: 'markdown'
            });

            const files = [
                path.join(this.testDir, 'test_docs', 'ml-guide-part1.md'),
                path.join(this.testDir, 'test_docs', 'ml-guide-part2.md')
            ];

            const result = await consolidator.consolidate(files, 'Machine Learning Guide');
            
            if (result && result.content && result.structure) {
                this.logSuccess('Structured consolidation');
            } else {
                this.logFailure('Structured consolidation', 'Structure analysis failed');
            }
            
        } catch (error) {
            this.logFailure('Structured consolidation', error.message);
        }
    }

    async testDryRunMode() {
        console.log('\n📄 Testing dry-run mode...');
        
        try {
            const { ContentConsolidator } = await import(path.join(projectRoot, 'src/organize/content_consolidator.js'));
            
            const consolidator = new ContentConsolidator({
                strategy: 'simple_merge',
                dryRun: true
            });

            const files = [
                path.join(this.testDir, 'test_docs', 'ml-guide-part1.md'),
                path.join(this.testDir, 'test_docs', 'ml-guide-part2.md')
            ];

            const result = await consolidator.consolidate(files, 'Test Topic');
            
            if (result && result.dryRun === true) {
                this.logSuccess('Dry-run mode');
            } else {
                this.logFailure('Dry-run mode', 'Dry-run flag not properly set');
            }
            
        } catch (error) {
            this.logFailure('Dry-run mode', error.message);
        }
    }

    async testBatchProcessing() {
        console.log('\n📄 Testing batch processing...');
        
        try {
            const { BatchProcessor } = await import(path.join(projectRoot, 'src/organize/batch_processor.js'));
            
            const processor = new BatchProcessor({
                maxConcurrency: 2,
                batchSize: 10
            });

            const files = [
                path.join(this.testDir, 'test_docs', 'ml-guide-part1.md'),
                path.join(this.testDir, 'test_docs', 'ml-guide-part2.md'),
                path.join(this.testDir, 'test_docs', 'ai-overview.md')
            ];

            const result = await processor.processFiles(files, 'consolidation');
            
            if (result && result.processed && result.processed.length > 0) {
                this.logSuccess('Batch processing');
            } else {
                this.logFailure('Batch processing', 'No files processed');
            }
            
        } catch (error) {
            this.logFailure('Batch processing', error.message);
        }
    }

    async testErrorHandling() {
        console.log('\n📄 Testing error handling...');
        
        try {
            const { ContentConsolidator } = await import(path.join(projectRoot, 'src/organize/content_consolidator.js'));
            
            const consolidator = new ContentConsolidator({
                strategy: 'simple_merge'
            });

            // Test with non-existent files
            const files = [
                path.join(this.testDir, 'non-existent-file.md'),
                path.join(this.testDir, 'another-missing-file.md')
            ];

            const result = await consolidator.consolidate(files, 'Test Topic');
            
            // Should handle errors gracefully
            if (result && result.errors && result.errors.length > 0) {
                this.logSuccess('Error handling (graceful failure)');
            } else {
                this.logFailure('Error handling', 'Expected graceful error handling');
            }
            
        } catch (error) {
            // Expected behavior for error handling test
            this.logSuccess('Error handling (threw expected error)');
        }
    }

    logSuccess(testName) {
        console.log(`✅ ${testName}`);
        this.testResults.passed++;
    }

    logFailure(testName, error) {
        console.log(`❌ ${testName}: ${error}`);
        this.testResults.failed++;
        this.testResults.errors.push({ test: testName, error });
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up test environment...');
        try {
            await fs.rm(this.testDir, { recursive: true, force: true });
            console.log('✅ Cleanup complete');
        } catch (error) {
            console.log(`⚠️ Cleanup warning: ${error.message}`);
        }
    }

    async runAllTests() {
        console.log('🧪 Content Consolidation Unit Tests');
        console.log('='.repeat(50));

        try {
            await this.setup();
            await this.testBasicConsolidation();
            await this.testComprehensiveMerge();
            await this.testStructuredConsolidation();
            await this.testDryRunMode();
            await this.testBatchProcessing();
            await this.testErrorHandling();
        } finally {
            await this.cleanup();
        }

        // Print summary
        console.log('\n📊 Test Results Summary:');
        console.log('='.repeat(30));
        console.log(`✅ Passed: ${this.testResults.passed}`);
        console.log(`❌ Failed: ${this.testResults.failed}`);
        console.log(`📈 Success Rate: ${((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(1)}%`);

        if (this.testResults.errors.length > 0) {
            console.log('\n🔍 Error Details:');
            this.testResults.errors.forEach(({ test, error }) => {
                console.log(`  • ${test}: ${error}`);
            });
        }

        return this.testResults.failed === 0;
    }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const tests = new ContentConsolidationTests();
    tests.runAllTests().catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

export default ContentConsolidationTests;
