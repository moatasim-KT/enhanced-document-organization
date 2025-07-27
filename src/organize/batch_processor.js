#!/usr/bin/env node

/**
 * Batch Processor for Content Analysis
 * Handles batch processing of files with proper error handling and module loading
 */

import { ModuleLoader, PathResolver } from './module_loader.js';
import { promises as fs } from 'fs';
import path from 'path';
import { createErrorHandler, ErrorTypes, EnhancedError } from './error_handler.js';

class BatchProcessor {
    constructor(options = {}) {
        this.projectRoot = options.projectRoot || PathResolver.resolveProjectRoot();
        this.moduleLoader = new ModuleLoader({
            baseDir: path.join(this.projectRoot, 'src', 'organize'),
            retryAttempts: 3,
            retryDelay: 1000
        });
        this.initialized = false;
        this.modules = {};

        // Initialize error handler
        this.errorHandler = createErrorHandler('BatchProcessor', {
            projectRoot: this.projectRoot,
            enableConsoleLogging: process.env.NODE_ENV !== 'production'
        });
    }

    /**
     * Initialize required modules
     */
    async initialize() {
        if (this.initialized) return;

        return await this.errorHandler.wrapAsync(async () => {
            await this.errorHandler.logInfo('Initializing BatchProcessor modules');

            const moduleSpecs = [
                {
                    name: 'ContentAnalyzer',
                    path: './content_analyzer.js',
                    required: true
                },
                {
                    name: 'ContentConsolidator',
                    path: './content_consolidator.js',
                    required: false
                },
                {
                    name: 'CategoryManager',
                    path: './category_manager.js',
                    required: false
                }
            ];

            const { results, errors } = await this.moduleLoader.importModules(moduleSpecs);

            // Store loaded modules
            for (const [name, module] of results) {
                this.modules[name] = module;
            }

            // Handle module loading errors
            if (errors.length > 0) {
                const criticalErrors = errors.filter(e =>
                    moduleSpecs.find(spec => spec.name === e.name)?.required
                );

                if (criticalErrors.length > 0) {
                    throw new EnhancedError(
                        'Critical modules failed to load',
                        ErrorTypes.MODULE_IMPORT_FAILURE,
                        {
                            operation: 'initialize',
                            criticalErrors,
                            allErrors: errors
                        }
                    );
                }

                await this.errorHandler.logWarn('Some optional modules failed to load', {
                    errors: errors.map(e => ({ name: e.name, error: e.error }))
                });
            }

            this.initialized = true;

            await this.errorHandler.logInfo('BatchProcessor initialization completed', {
                loadedModules: Object.keys(this.modules),
                failedModules: errors.map(e => e.name)
            });

        }, {
            operation: 'initialize'
        });
    }

    /**
     * Process files for duplicate detection
     */
    async findDuplicates(fileList, options = {}) {
        await this.initialize();

        return await this.errorHandler.wrapAsync(async () => {
            if (!this.modules.ContentAnalyzer) {
                throw new EnhancedError(
                    'ContentAnalyzer module not available for duplicate detection',
                    ErrorTypes.MODULE_IMPORT_FAILURE,
                    { operation: 'findDuplicates', availableModules: Object.keys(this.modules) }
                );
            }

            await this.errorHandler.logInfo('Starting duplicate detection analysis', {
                fileCount: fileList.length,
                similarityThreshold: options.similarityThreshold || 0.8
            });

            const analyzer = new this.modules.ContentAnalyzer.ContentAnalyzer({
                similarityThreshold: options.similarityThreshold || 0.8,
                minContentLength: options.minContentLength || 50
            });

            const duplicates = await analyzer.findDuplicates(fileList);

            await this.errorHandler.logInfo('Duplicate detection completed', {
                duplicateGroups: duplicates.size,
                processedFiles: fileList.length
            });

            return duplicates;

        }, {
            operation: 'findDuplicates',
            fileCount: fileList.length
        });
    }

    /**
     * Process files for consolidation candidates
     */
    async findConsolidationCandidates(fileList, options = {}) {
        await this.initialize();

        if (!this.modules.ContentAnalyzer) {
            throw new Error('ContentAnalyzer module not available');
        }

        try {
            const analyzer = new this.modules.ContentAnalyzer.ContentAnalyzer({
                similarityThreshold: options.similarityThreshold || 0.8,
                minContentLength: options.minContentLength || 50
            });

            console.log(`[BatchProcessor] Analyzing ${fileList.length} files for consolidation...`);
            const candidates = await analyzer.findConsolidationCandidates(fileList);

            console.log(`[BatchProcessor] Found ${candidates.size} consolidation opportunities`);
            return candidates;

        } catch (error) {
            console.error('[BatchProcessor] Consolidation analysis failed:', error.message);
            throw error;
        }
    }

    /**
     * Categorize files in batch
     */
    async categorizeFiles(fileList, options = {}) {
        await this.initialize();

        return await this.errorHandler.wrapAsync(async () => {
            if (!this.modules.ContentAnalyzer || !this.modules.CategoryManager) {
                await this.errorHandler.logWarn('Required modules not available, using fallback categorization', {
                    availableModules: Object.keys(this.modules),
                    requiredModules: ['ContentAnalyzer', 'CategoryManager']
                });
                return this.fallbackCategorization(fileList);
            }

            await this.errorHandler.logInfo('Starting batch file categorization', {
                fileCount: fileList.length,
                configPath: options.configPath
            });

            const analyzer = new this.modules.ContentAnalyzer.ContentAnalyzer();
            const categoryManager = new this.modules.CategoryManager.CategoryManager({
                configPath: options.configPath,
                projectRoot: this.projectRoot
            });

            await categoryManager.initialize();

            const results = [];
            const errors = [];

            for (const filePath of fileList) {
                try {
                    const analysis = await analyzer.analyzeContent(filePath);
                    if (analysis) {
                        const match = categoryManager.findBestCategoryMatch(analysis);
                        results.push({
                            filePath,
                            category: match.category.name,
                            confidence: match.confidence
                        });
                    } else {
                        results.push({
                            filePath,
                            category: 'Notes & Drafts',
                            confidence: 0
                        });
                    }
                } catch (error) {
                    const errorInfo = await this.errorHandler.handleError(error, {
                        operation: 'categorizeFile',
                        filePath
                    });

                    errors.push({
                        filePath,
                        error: error.message
                    });

                    results.push({
                        filePath,
                        category: 'Notes & Drafts',
                        confidence: 0,
                        error: error.message
                    });
                }
            }

            await this.errorHandler.logInfo('Batch categorization completed', {
                processedFiles: results.length,
                errorCount: errors.length,
                successRate: ((results.length - errors.length) / results.length * 100).toFixed(1) + '%'
            });

            if (errors.length > 0) {
                await this.errorHandler.logWarn('Some files failed categorization', {
                    errorCount: errors.length,
                    errors: errors.slice(0, 5) // Log first 5 errors
                });
            }

            return results;

        }, {
            operation: 'categorizeFiles',
            fileCount: fileList.length
        }, {
            maxRetries: 1 // Limited retries for batch operations
        });
    }

    /**
     * Fallback categorization using simple rules
     */
    fallbackCategorization(fileList) {
        this.errorHandler.logInfo('Using fallback categorization method', {
            fileCount: fileList.length,
            reason: 'Required modules not available'
        });

        return fileList.map(filePath => {
            try {
                const filename = path.basename(filePath).toLowerCase();
                const content = this.readFileSync(filePath);
                const combined = `${filename} ${content}`.toLowerCase();

                let category = 'Notes & Drafts';

                if (combined.includes('ai') || combined.includes('ml') || combined.includes('machine learning')) {
                    category = 'AI & ML';
                } else if (combined.includes('research') || combined.includes('paper') || filename.endsWith('.pdf')) {
                    category = 'Research Papers';
                } else if (combined.includes('web') || combined.includes('article') || combined.includes('tutorial')) {
                    category = 'Web Content';
                } else if (combined.includes('code') || combined.includes('api') || combined.includes('development')) {
                    category = 'Development';
                }

                return {
                    filePath,
                    category,
                    confidence: 0.5
                };
            } catch (error) {
                this.errorHandler.logError('Fallback categorization failed for file', {
                    filePath,
                    error: error.message
                });

                return {
                    filePath,
                    category: 'Notes & Drafts',
                    confidence: 0,
                    error: error.message
                };
            }
        });
    }

    /**
     * Safely read file content
     */
    readFileSync(filePath) {
        try {
            return require('fs').readFileSync(filePath, 'utf8').substring(0, 1000);
        } catch (error) {
            return '';
        }
    }

    /**
     * Consolidate content using batch processing
     */
    async consolidateContent(consolidationCandidate, options = {}) {
        await this.initialize();

        if (!this.modules.ContentConsolidator) {
            throw new Error('ContentConsolidator module not available');
        }

        try {
            const consolidator = new this.modules.ContentConsolidator.ContentConsolidator({
                projectRoot: this.projectRoot,
                syncHubPath: options.syncHubPath,
                aiService: options.aiService || 'none',
                enhanceContent: options.enhanceContent || false
            });

            console.log(`[BatchProcessor] Consolidating content for topic: ${consolidationCandidate.topic}`);
            const result = await consolidator.consolidateDocuments(consolidationCandidate);

            return result;

        } catch (error) {
            console.error('[BatchProcessor] Content consolidation failed:', error.message);
            throw error;
        }
    }

    /**
     * Get processing statistics
     */
    getStats() {
        return {
            initialized: this.initialized,
            availableModules: Object.keys(this.modules),
            moduleLoaderStats: this.moduleLoader.getStats()
        };
    }
}

/**
 * Command-line interface for batch processing
 */
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command) {
        console.error('Usage: node batch_processor.js <command> [options]');
        console.error('Commands: duplicates, consolidation, categorize');
        process.exit(1);
    }

    try {
        const processor = new BatchProcessor({
            projectRoot: process.env.PROJECT_ROOT
        });

        switch (command) {
            case 'duplicates':
                await handleDuplicates(processor, args.slice(1));
                break;
            case 'consolidation':
                await handleConsolidation(processor, args.slice(1));
                break;
            case 'categorize':
                await handleCategorization(processor, args.slice(1));
                break;
            default:
                console.error(`Unknown command: ${command}`);
                process.exit(1);
        }
    } catch (error) {
        console.error('Batch processing failed:', error.message);
        process.exit(1);
    }
}

async function handleDuplicates(processor, _args) {
    const fileListJson = process.env.FILE_LIST_JSON;
    const outputFile = process.env.DUPLICATES_FOUND;

    if (!fileListJson || !outputFile) {
        throw new Error('FILE_LIST_JSON and DUPLICATES_FOUND environment variables required');
    }

    const fileList = JSON.parse(fileListJson);
    const duplicates = await processor.findDuplicates(fileList, {
        similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.8
    });

    // Convert Map to array for JSON serialization
    const duplicatesArray = Array.from(duplicates.entries()).map(([key, value]) => [key, value]);
    await fs.writeFile(outputFile, JSON.stringify(duplicatesArray, null, 2));

    console.log(`Duplicates analysis complete. Results written to ${outputFile}`);
}

async function handleConsolidation(processor, _args) {
    const fileListJson = process.env.FILE_LIST_JSON;
    const outputFile = process.env.CONSOLIDATION_CANDIDATES;

    if (!fileListJson || !outputFile) {
        throw new Error('FILE_LIST_JSON and CONSOLIDATION_CANDIDATES environment variables required');
    }

    const fileList = JSON.parse(fileListJson);
    const candidates = await processor.findConsolidationCandidates(fileList, {
        similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.8
    });

    // Convert Map to array for JSON serialization
    const candidatesArray = Array.from(candidates.entries()).map(([key, value]) => [key, value]);
    await fs.writeFile(outputFile, JSON.stringify(candidatesArray, null, 2));

    console.log(`Consolidation analysis complete. Results written to ${outputFile}`);
}

async function handleCategorization(processor, _args) {
    const fileListJson = process.env.FILE_LIST_JSON;

    if (!fileListJson) {
        throw new Error('FILE_LIST_JSON environment variable required');
    }

    const fileList = JSON.parse(fileListJson);
    const results = await processor.categorizeFiles(fileList, {
        configPath: process.env.CONFIG_PATH
    });

    // Output results as JSON
    console.log(JSON.stringify(results, null, 2));
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default BatchProcessor;