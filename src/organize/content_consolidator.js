#!/usr/bin/env node

/**
 * Content Consolidator Module
 * Handles content merging, AI enhancement, and gap filling
 */

import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createErrorHandler, ErrorTypes, EnhancedError } from './error_handler.js';

export class ContentConsolidator {
    constructor(options = {}) {
        this.aiService = options.aiService || 'local'; // 'local', 'openai', 'anthropic'
        this.projectRoot = options.projectRoot;
        this.syncHubPath = options.syncHubPath; // Configurable sync hub path
        this.outputFormat = options.outputFormat || 'markdown';
        this.preserveReferences = options.preserveReferences !== false;
        this.enhanceContent = options.enhanceContent !== false;
        this.dryRun = options.dryRun || false; // Dry run mode

        // Initialize error handler
        this.errorHandler = createErrorHandler('ContentConsolidator', {
            projectRoot: this.projectRoot,
            enableConsoleLogging: process.env.NODE_ENV !== 'production'
        });
    }

    /**
     * Consolidate multiple documents into a single, enhanced document
     */
    async consolidateDocuments(consolidationCandidate) {
        return await this.errorHandler.wrapAsync(async () => {
            // Validate inputs with comprehensive error context
            if (!consolidationCandidate) {
                throw this.errorHandler.createContextualError(
                    'No consolidation candidate provided',
                    ErrorTypes.VALIDATION_ERROR,
                    { operation: 'consolidateDocuments', input: 'consolidationCandidate' }
                );
            }

            const { topic, files, consolidationStrategy } = consolidationCandidate;

            if (!topic || typeof topic !== 'string') {
                throw this.errorHandler.createContextualError(
                    'Invalid or missing topic for consolidation',
                    ErrorTypes.VALIDATION_ERROR,
                    { operation: 'consolidateDocuments', topic, topicType: typeof topic }
                );
            }

            if (!files || !Array.isArray(files) || files.length === 0) {
                throw this.errorHandler.createContextualError(
                    'No files provided for consolidation',
                    ErrorTypes.VALIDATION_ERROR,
                    {
                        operation: 'consolidateDocuments',
                        topic,
                        filesProvided: !!files,
                        filesType: typeof files,
                        filesLength: Array.isArray(files) ? files.length : 'N/A'
                    }
                );
            }

            // Validate sync hub path
            if (!this.syncHubPath || this.syncHubPath.trim() === '') {
                throw this.errorHandler.createContextualError(
                    'Sync hub path not configured',
                    ErrorTypes.CONFIGURATION_ERROR,
                    { operation: 'consolidateDocuments', topic, syncHubPath: this.syncHubPath }
                );
            }

            await this.errorHandler.logInfo(`Starting consolidation of ${files.length} documents`, {
                topic,
                fileCount: files.length,
                strategy: consolidationStrategy,
                operation: 'consolidateDocuments'
            });

            if (!this.syncHubPath) {
                throw new EnhancedError(
                    'syncHubPath is required but not provided',
                    ErrorTypes.CONFIGURATION_ERROR,
                    { operation: 'consolidateDocuments', topic }
                );
            }

            // Validate file accessibility before processing
            const validFiles = [];
            for (const file of files) {
                try {
                    await fs.access(file.filePath || file, fs.constants.R_OK);
                    validFiles.push(file);
                } catch (error) {
                    await this.errorHandler.logWarn('File not accessible, skipping', {
                        filePath: file.filePath || file,
                        error: error.message,
                        operation: 'consolidateDocuments'
                    });
                }
            }

            if (validFiles.length === 0) {
                throw this.errorHandler.createContextualError(
                    'No accessible files found for consolidation',
                    ErrorTypes.FILE_NOT_FOUND,
                    { operation: 'consolidateDocuments', topic, originalFileCount: files.length }
                );
            }

            // Create folder structure with error handling (or simulate in dry-run)
            const folderName = this.sanitizeFolderName(consolidationCandidate.recommendedTitle || topic);
            const targetFolder = await this.createConsolidatedFolder(folderName, validFiles[0].analysis);

            // Extract and merge content with comprehensive error handling
            const mergedContent = await this.mergeContent(validFiles, consolidationStrategy);

            // Enhance content with AI if enabled (skip in dry-run to save time)
            let enhancedContent = mergedContent;
            if (this.enhanceContent && !this.dryRun) {
                try {
                    enhancedContent = await this.enhanceContentWithAI(mergedContent, topic);
                } catch (error) {
                    await this.errorHandler.logWarn('AI enhancement failed, using merged content', {
                        topic,
                        error: error.message,
                        operation: 'consolidateDocuments'
                    });
                    // Continue with unenhanced content
                }
            } else if (this.enhanceContent && this.dryRun) {
                await this.errorHandler.logInfo('DRY RUN: Skipping AI enhancement to save time', { topic });
            }

            // Create the consolidated document (or simulate in dry-run)
            const consolidatedDoc = await this.createConsolidatedDocument(
                enhancedContent,
                consolidationCandidate,
                targetFolder
            );

            // Move reference materials with error handling (or simulate in dry-run)
            await this.moveReferenceMaterials(validFiles, targetFolder);

            await this.errorHandler.logInfo('Document consolidation completed successfully', {
                topic,
                targetFolder,
                consolidatedDocument: consolidatedDoc
            });

            return {
                success: true,
                targetFolder,
                consolidatedDocument: consolidatedDoc,
                originalFiles: files.map(f => path.basename(f.filePath)),
                consolidationStrategy
            };
        }, {
            operation: 'consolidateDocuments',
            topic: consolidationCandidate?.topic || 'unknown'
        });
    }

    /**
     * Create folder structure for consolidated content
     */
    async createConsolidatedFolder(folderName, sampleAnalysis) {
        return await this.errorHandler.wrapAsync(async () => {
            const category = this.determineCategory(sampleAnalysis);
            // Remove emoji from category name for folder creation
            const folderNameNoEmoji = category.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').replace(/\s+/g, ' ').trim();
            const sanitizedFolderName = this.sanitizeFolderName(folderName);
            // Ensure syncHubPath is absolute
            const absoluteSyncHubPath = path.isAbsolute(this.syncHubPath)
                ? this.syncHubPath
                : path.resolve(this.syncHubPath);
            const categoryPath = path.join(absoluteSyncHubPath, folderNameNoEmoji);
            const folderPath = path.join(categoryPath, sanitizedFolderName);

            if (this.dryRun) {
                await this.errorHandler.logInfo('DRY RUN: Would create consolidated folder structure', {
                    folderName: sanitizedFolderName,
                    category,
                    folderPath,
                    subfolders: ['assets', 'references']
                });
                return folderPath;
            }

            await this.errorHandler.logDebug('Creating consolidated folder structure', {
                folderName: sanitizedFolderName,
                category,
                folderPath
            });

            // Create main folder
            await fs.mkdir(folderPath, { recursive: true });

            // Create subfolders
            await fs.mkdir(path.join(folderPath, 'assets'), { recursive: true });
            await fs.mkdir(path.join(folderPath, 'references'), { recursive: true });

            await this.errorHandler.logInfo('Consolidated folder structure created', {
                folderPath,
                category
            });

            return folderPath;
        }, {
            operation: 'createConsolidatedFolder',
            folderName,
            category: this.determineCategory(sampleAnalysis)
        });
    }

    /**
     * Merge content from multiple files
     */
    async mergeContent(files, strategy) {
        return await this.errorHandler.wrapAsync(async () => {
            const contents = [];
            const failedFiles = [];

            await this.errorHandler.logDebug('Starting content merge', {
                fileCount: files.length,
                strategy
            });

            for (const file of files) {
                try {
                    const content = await fs.readFile(file.filePath, 'utf-8');
                    const processedContent = this.preprocessContent(content, file.analysis);
                    contents.push({
                        content: processedContent,
                        metadata: file.analysis.metadata,
                        topics: file.analysis.topics,
                        structure: file.analysis.structure
                    });
                } catch (error) {
                    const errorInfo = await this.errorHandler.handleError(error, {
                        operation: 'readFileForMerge',
                        filePath: file.filePath
                    });
                    failedFiles.push({
                        filePath: file.filePath,
                        error: error.message
                    });
                }
            }

            if (contents.length === 0) {
                throw new EnhancedError(
                    'No files could be read for content merging',
                    ErrorTypes.CONTENT_PROCESSING_ERROR,
                    { operation: 'mergeContent', failedFiles }
                );
            }

            if (failedFiles.length > 0) {
                await this.errorHandler.logWarn(`Failed to read ${failedFiles.length} files during merge`, {
                    failedFiles,
                    successfulFiles: contents.length
                });
            }

            let mergedContent;
            switch (strategy) {
                case 'comprehensive_merge':
                    mergedContent = this.comprehensiveMerge(contents);
                    break;
                case 'structured_consolidation':
                    mergedContent = this.structuredConsolidation(contents);
                    break;
                case 'simple_merge':
                default:
                    mergedContent = this.simpleMerge(contents);
            }

            await this.errorHandler.logInfo('Content merge completed', {
                strategy,
                processedFiles: contents.length,
                failedFiles: failedFiles.length
            });

            return mergedContent;
        }, {
            operation: 'mergeContent',
            strategy,
            fileCount: files.length
        });
    }

    /**
     * Comprehensive merge with intelligent content organization
     */
    comprehensiveMerge(contents) {
        const sections = new Map();
        const allTopics = new Set();

        // Extract all unique topics
        contents.forEach(c => c.topics.forEach(topic => allTopics.add(topic)));

        // Organize content by topics
        for (const topic of allTopics) {
            const relatedContent = contents.filter(c => c.topics.includes(topic));
            if (relatedContent.length > 0) {
                sections.set(topic, this.mergeTopicContent(relatedContent, topic));
            }
        }

        // Build consolidated document
        let merged = this.createDocumentHeader(contents);
        merged += '\n## Table of Contents\n\n';

        for (const [topic, content] of sections) {
            const sectionTitle = this.formatSectionTitle(topic);
            merged += `- [${sectionTitle}](#${this.slugify(sectionTitle)})\n`;
        }

        merged += '\n';

        for (const [topic, content] of sections) {
            const sectionTitle = this.formatSectionTitle(topic);
            merged += `\n## ${sectionTitle}\n\n${content}\n`;
        }

        merged += this.createReferencesSection(contents);

        return merged;
    }

    /**
     * Structured consolidation preserving document organization
     */
    structuredConsolidation(contents) {
        let merged = this.createDocumentHeader(contents);

        // Group by content type and structure
        const codeBlocks = [];
        const images = [];
        const textContent = [];

        contents.forEach((c, index) => {
            // Extract code blocks
            const codeMatches = c.content.match(/```[\s\S]*?```/g) || [];
            codeBlocks.push(...codeMatches.map(code => ({ code, source: index })));

            // Extract images
            const imageMatches = c.content.match(/!\[.*\]\(.+\)/g) || [];
            images.push(...imageMatches.map(img => ({ img, source: index })));

            // Extract text content (without code and images)
            const textOnly = c.content
                .replace(/```[\s\S]*?```/g, '')
                .replace(/!\[.*\]\(.+\)/g, '');
            textContent.push({ text: textOnly, metadata: c.metadata });
        });

        // Merge text content
        merged += '\n## Overview\n\n';
        textContent.forEach((tc, _index) => {
            if (tc.text.trim()) {
                merged += `### From ${tc.metadata.suggestedTitle}\n\n${tc.text.trim()}\n\n`;
            }
        });

        // Add code examples if any
        if (codeBlocks.length > 0) {
            merged += '\n## Code Examples\n\n';
            codeBlocks.forEach((cb, index) => {
                merged += `### Example ${index + 1}\n\n${cb.code}\n\n`;
            });
        }

        // Add images if any
        if (images.length > 0) {
            merged += '\n## Visual References\n\n';
            images.forEach((img, _index) => {
                merged += `${img.img}\n\n`;
            });
        }

        merged += this.createReferencesSection(contents);

        return merged;
    }

    /**
     * Simple merge by concatenation with headers
     */
    simpleMerge(contents) {
        let merged = this.createDocumentHeader(contents);

        contents.forEach((c, index) => {
            const title = c.metadata.suggestedTitle || `Document ${index + 1}`;
            merged += `\n## ${title}\n\n${c.content}\n\n---\n\n`;
        });

        merged += this.createReferencesSection(contents);

        return merged;
    }

    /**
     * Enhance content using AI
     */
    async enhanceContentWithAI(content, topic) {
        return await this.errorHandler.wrapAsync(async () => {
            await this.errorHandler.logDebug('Starting AI content enhancement', {
                topic,
                contentLength: content.length,
                aiService: this.aiService
            });

            const prompt = this.createEnhancementPrompt(content, topic);

            try {
                const enhancedContent = await this.callAIService(prompt);

                if (enhancedContent && enhancedContent !== content) {
                    await this.errorHandler.logInfo('AI content enhancement completed', {
                        topic,
                        originalLength: content.length,
                        enhancedLength: enhancedContent.length
                    });
                    return enhancedContent;
                } else {
                    await this.errorHandler.logWarn('AI enhancement returned no improvement', { topic });
                    return content;
                }
            } catch (error) {
                const errorInfo = await this.errorHandler.handleError(error, {
                    operation: 'aiEnhancement',
                    topic,
                    aiService: this.aiService
                });

                // Return original content as fallback
                await this.errorHandler.logWarn('Using original content due to AI enhancement failure', {
                    topic,
                    fallbackReason: error.message
                });
                return content;
            }
        }, {
            operation: 'enhanceContentWithAI',
            topic,
            aiService: this.aiService
        }, {
            maxRetries: 2,
            retryDelay: 2000
        });
    }

    /**
     * Create AI enhancement prompt
     */
    createEnhancementPrompt(content, topic) {
        return `Please enhance and improve the following consolidated document about "${topic}":

CONTENT TO ENHANCE:
${content}

INSTRUCTIONS:
1. Improve the flow and readability of the content
2. Fill in any logical gaps between sections
3. Add smooth transitions between different parts
4. Ensure consistent terminology and style
5. Improve headings and structure
6. Add a brief introduction if missing
7. Ensure the content feels cohesive, not like separate documents merged together
8. Maintain all technical accuracy and factual information
9. Preserve all code blocks, links, and references exactly as they are
10. Keep the overall length similar to the original

Please return only the enhanced content in markdown format, without any explanatory text.`;
    }

    /**
     * Call AI service for content enhancement
     */
    async callAIService(prompt) {
        switch (this.aiService) {
            case 'local':
                return await this.callLocalAI(prompt);
            case 'mcp':
                return await this.callMCPService(prompt);
            default:
                console.warn('No AI service configured for content enhancement');
                return null;
        }
    }

    /**
     * Call local AI service (e.g., Ollama)
     */
    async callLocalAI(prompt) {
        return await this.errorHandler.wrapAsync(async () => {
            await this.errorHandler.logDebug('Calling local AI service', {
                promptLength: prompt.length,
                service: 'ollama'
            });

            // Example using curl to call Ollama API
            const response = execSync(`curl -s -X POST http://localhost:11434/api/generate -d '${JSON.stringify({
                model: 'llama2',
                prompt: prompt,
                stream: false
            })}'`, {
                encoding: 'utf-8',
                timeout: 30000 // 30 second timeout
            });

            const result = JSON.parse(response);

            if (!result.response) {
                throw new EnhancedError(
                    'Local AI service returned empty response',
                    ErrorTypes.NETWORK_ERROR,
                    { operation: 'callLocalAI', service: 'ollama' }
                );
            }

            await this.errorHandler.logDebug('Local AI service call completed', {
                responseLength: result.response.length
            });

            return result.response;
        }, {
            operation: 'callLocalAI',
            service: 'ollama'
        }, {
            maxRetries: 2,
            retryDelay: 5000
        });
    }

    /**
     * Call MCP service for AI enhancement
     */
    async callMCPService(_prompt) {
        // This would integrate with the MCP server
        // For now, return null to indicate no enhancement
        return null;
    }

    /**
     * Create consolidated document with metadata
     */
    async createConsolidatedDocument(content, consolidationCandidate, targetFolder) {
        const { recommendedTitle: _recommendedTitle, files: _files } = consolidationCandidate;

        const metadata = this.createDocumentMetadata(consolidationCandidate);
        const fullContent = metadata + content;

        const docPath = path.join(targetFolder, 'main.md');

        if (this.dryRun) {
            console.log(`[DRY RUN] Would create consolidated document: ${docPath}`);
            console.log(`[DRY RUN] Document would contain ${fullContent.length} characters`);
            console.log(`[DRY RUN] Document would include ${consolidationCandidate.files.length} source files`);
            return docPath;
        }

        await fs.writeFile(docPath, fullContent, 'utf-8');

        console.log(`[INFO] Created consolidated document: ${docPath}`);
        return docPath;
    }

    /**
     * Move reference materials to the references folder
     */
    async moveReferenceMaterials(files, targetFolder) {
        return await this.errorHandler.wrapAsync(async () => {
            const referencesFolder = path.join(targetFolder, 'references');
            const movedFiles = [];
            const failedFiles = [];

            if (this.dryRun) {
                await this.errorHandler.logInfo('DRY RUN: Would move reference materials', {
                    fileCount: files.length,
                    referencesFolder,
                    files: files.map(f => path.basename(f.filePath))
                });

                // Simulate successful moves for dry run
                for (const file of files) {
                    const fileName = path.basename(file.filePath);
                    movedFiles.push(fileName);
                }

                return {
                    movedFiles,
                    failedFiles: []
                };
            }

            await this.errorHandler.logDebug('Moving reference materials', {
                fileCount: files.length,
                referencesFolder
            });

            for (const file of files) {
                try {
                    const fileName = path.basename(file.filePath);
                    const targetPath = path.join(referencesFolder, fileName);

                    // Copy original file to references
                    await fs.copyFile(file.filePath, targetPath);
                    movedFiles.push(fileName);

                    await this.errorHandler.logDebug('Reference file moved', {
                        fileName,
                        sourcePath: file.filePath,
                        targetPath
                    });
                } catch (error) {
                    const errorInfo = await this.errorHandler.handleError(error, {
                        operation: 'moveReferenceFile',
                        filePath: file.filePath
                    });
                    failedFiles.push({
                        filePath: file.filePath,
                        error: error.message
                    });
                }
            }

            await this.errorHandler.logInfo('Reference materials processing completed', {
                movedFiles: movedFiles.length,
                failedFiles: failedFiles.length,
                movedFileNames: movedFiles
            });

            if (failedFiles.length > 0) {
                await this.errorHandler.logWarn('Some reference files could not be moved', {
                    failedFiles
                });
            }

            return {
                movedFiles,
                failedFiles
            };
        }, {
            operation: 'moveReferenceMaterials',
            targetFolder
        });
    }

    /**
     * Utility functions
     */
    sanitizeFolderName(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim('-')
            .substring(0, 50);
    }

    determineCategory(analysis) {
        // Use existing category determination logic
        const topics = analysis.topics.join(' ').toLowerCase();

        if (topics.includes('ai') || topics.includes('machine') || topics.includes('neural')) {
            return 'AI & ML';
        }
        if (topics.includes('research') || topics.includes('paper') || topics.includes('study')) {
            return 'Research Papers';
        }
        if (topics.includes('web') || topics.includes('article') || topics.includes('tutorial')) {
            return 'Web Content';
        }
        if (topics.includes('note') || topics.includes('idea') || topics.includes('draft')) {
            return 'Notes & Drafts';
        }
        if (topics.includes('code') || topics.includes('api') || topics.includes('development')) {
            return 'Development';
        }

        return 'Notes & Drafts'; // Default category
    }

    createDocumentHeader(contents) {
        const titles = contents.map(c => c.metadata.suggestedTitle).filter(Boolean);
        const mainTitle = this.generateMainTitle(titles);
        const date = new Date().toISOString().split('T')[0];

        return `# ${mainTitle}\n\n*Consolidated document created on ${date}*\n\n**Source documents:** ${titles.join(', ')}\n\n`;
    }

    generateMainTitle(titles) {
        if (titles.length === 0) return 'Consolidated Document';
        if (titles.length === 1) return titles[0];

        // Find common words in titles
        const commonWords = this.findCommonWordsInTitles(titles);
        if (commonWords.length > 0) {
            return commonWords.slice(0, 3).join(' ') + ' - Comprehensive Guide';
        }

        return 'Consolidated Content';
    }

    findCommonWordsInTitles(titles) {
        const wordSets = titles.map(title =>
            new Set(title.toLowerCase().split(/\s+/).filter(w => w.length > 3))
        );

        if (wordSets.length === 0) return [];

        let common = wordSets[0];
        for (let i = 1; i < wordSets.length; i++) {
            common = new Set([...common].filter(x => wordSets[i].has(x)));
        }

        return Array.from(common);
    }

    mergeTopicContent(contents, topic) {
        return contents
            .map(c => this.extractTopicContent(c.content, topic))
            .filter(Boolean)
            .join('\n\n');
    }

    extractTopicContent(content, topic) {
        // Simple extraction - find content around the topic
        const lines = content.split('\n');
        const relevantLines = [];
        let inRelevantSection = false;

        for (const line of lines) {
            if (line.toLowerCase().includes(topic.toLowerCase())) {
                inRelevantSection = true;
                relevantLines.push(line);
            } else if (inRelevantSection && line.startsWith('#')) {
                break; // End of section
            } else if (inRelevantSection) {
                relevantLines.push(line);
            }
        }

        return relevantLines.join('\n').trim();
    }

    formatSectionTitle(topic) {
        return topic.charAt(0).toUpperCase() + topic.slice(1).replace(/[-_]/g, ' ');
    }

    slugify(text) {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim('-');
    }

    createReferencesSection(contents) {
        const refs = contents
            .map((c, index) => `${index + 1}. ${c.metadata.suggestedTitle} (${c.metadata.originalFilename})`)
            .join('\n');

        return `\n## References\n\n${refs}\n`;
    }

    createDocumentMetadata(consolidationCandidate) {
        const { recommendedTitle, files, topic, avgSimilarity = 0.0 } = consolidationCandidate;

        return `---
title: "${recommendedTitle}"
topic: "${topic}"
created: "${new Date().toISOString()}"
source_files: ${files.length}
consolidation_similarity: ${avgSimilarity.toFixed(2)}
type: "consolidated"
---

`;
    }

    preprocessContent(content, analysis) {
        // Remove metadata headers if present
        let cleaned = content.replace(/^---[\s\S]*?---\n/, '');

        // Remove title if it's the same as filename
        const firstLine = cleaned.split('\n')[0];
        if (firstLine.startsWith('#') &&
            firstLine.toLowerCase().includes(analysis.metadata.originalFilename.toLowerCase())) {
            cleaned = cleaned.split('\n').slice(1).join('\n');
        }

        return cleaned.trim();
    }
}

export default ContentConsolidator;
