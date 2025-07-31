#!/usr/bin/env node

/**
 * Content Consolidation Engine
 * Handles actual content merging with multiple strategies
 * Replaces link-only consolidation with real content merging
 */

import { promises as fs } from 'fs';
import path from 'path';
import { createErrorHandler, ErrorTypes, EnhancedError } from './error_handler.js';

export class ContentConsolidationEngine {
    constructor(documentFolderManager, options = {}) {
        this.documentFolderManager = documentFolderManager;
        this.projectRoot = options.projectRoot;
        this.syncHubPath = options.syncHubPath;
        this.dryRun = options.dryRun || false;

        // Initialize error handler
        this.errorHandler = createErrorHandler('ContentConsolidationEngine', {
            projectRoot: this.projectRoot,
            enableConsoleLogging: process.env.NODE_ENV !== 'production'
        });
    }

    /**
     * Consolidate content using specified strategy
     */
    async consolidateContent(documentFolders, topic, strategy = 'simple_merge') {
        return await this.errorHandler.wrapAsync(async () => {
            await this.errorHandler.logInfo(`Starting content consolidation`, {
                topic,
                strategy,
                documentCount: documentFolders.length
            });

            // Validate inputs
            if (!documentFolders || !Array.isArray(documentFolders) || documentFolders.length === 0) {
                throw this.errorHandler.createContextualError(
                    'No document folders provided for consolidation',
                    ErrorTypes.VALIDATION_ERROR,
                    { operation: 'consolidateContent', topic, strategy }
                );
            }

            if (!topic || typeof topic !== 'string') {
                throw this.errorHandler.createContextualError(
                    'Invalid or missing topic for consolidation',
                    ErrorTypes.VALIDATION_ERROR,
                    { operation: 'consolidateContent', strategy, documentCount: documentFolders.length }
                );
            }

            // Extract content from document folders
            const contentSections = await this.extractContentSections(documentFolders);

            if (contentSections.length === 0) {
                throw this.errorHandler.createContextualError(
                    'No content could be extracted from document folders',
                    ErrorTypes.CONTENT_PROCESSING_ERROR,
                    { operation: 'consolidateContent', topic, strategy, documentCount: documentFolders.length }
                );
            }

            // Apply consolidation strategy
            let mergedContent;
            switch (strategy) {
                case 'simple_merge':
                    mergedContent = await this.simpleMerge(contentSections, topic);
                    break;
                case 'structured_consolidation':
                    mergedContent = await this.structuredConsolidation(contentSections, topic);
                    break;
                case 'comprehensive_merge':
                    mergedContent = await this.comprehensiveMerge(contentSections, topic);
                    break;
                default:
                    await this.errorHandler.logWarn(`Unknown strategy '${strategy}', using simple_merge`, { topic });
                    mergedContent = await this.simpleMerge(contentSections, topic);
            }

            // Create consolidated document folder
            const consolidatedFolder = await this.createConsolidatedDocument(mergedContent, topic, documentFolders);

            // Consolidate images
            const imageMap = await this.consolidateImages(documentFolders, consolidatedFolder);

            // Update image references in content
            const finalContent = this.updateImageReferences(mergedContent, imageMap);

            // Write final content to main document
            if (!this.dryRun) {
                const mainDocPath = path.join(consolidatedFolder, 'main.md');
                await fs.writeFile(mainDocPath, finalContent, 'utf8');
            }

            await this.errorHandler.logInfo('Content consolidation completed successfully', {
                topic,
                strategy,
                consolidatedFolder,
                imageCount: Object.keys(imageMap).length
            });

            return {
                success: true,
                consolidatedFolder,
                strategy,
                sourceDocuments: documentFolders.map(folder => path.basename(folder)),
                mergedContent: finalContent,
                imagesMerged: Object.keys(imageMap).length,
                metadata: {
                    totalSections: contentSections.length,
                    processingTime: Date.now()
                }
            };

        }, {
            operation: 'consolidateContent',
            topic,
            strategy
        });
    }

    /**
     * Extract content sections from document folders
     */
    async extractContentSections(documentFolders) {
        return await this.errorHandler.wrapAsync(async () => {
            const sections = [];

            for (const folderPath of documentFolders) {
                try {
                    // Get main document file from folder
                    const mainFile = await this.documentFolderManager.getMainDocumentFile(folderPath);
                    if (!mainFile) {
                        await this.errorHandler.logWarn('No main document found in folder', { folderPath });
                        continue;
                    }

                    // Read content
                    const content = await fs.readFile(mainFile, 'utf8');
                    const folderName = path.basename(folderPath);

                    sections.push({
                        folderPath,
                        folderName,
                        mainFile,
                        content: content.trim(),
                        wordCount: content.split(/\s+/).length,
                        metadata: {
                            created: (await fs.stat(mainFile)).birthtime,
                            modified: (await fs.stat(mainFile)).mtime,
                            size: content.length
                        }
                    });

                } catch (error) {
                    await this.errorHandler.logWarn('Failed to extract content from folder', {
                        folderPath,
                        error: error.message
                    });
                }
            }

            await this.errorHandler.logInfo('Content extraction completed', {
                totalFolders: documentFolders.length,
                successfulExtractions: sections.length
            });

            return sections;
        }, {
            operation: 'extractContentSections',
            folderCount: documentFolders.length
        });
    }

    /**
     * Simple merge strategy - concatenates content with proper formatting
     */
    async simpleMerge(contentSections, topic) {
        await this.errorHandler.logDebug('Applying simple merge strategy', {
            topic,
            sectionCount: contentSections.length
        });

        let merged = this.createDocumentHeader(topic, contentSections, 'simple_merge');

        // Add table of contents
        merged += '\n## Table of Contents\n\n';
        contentSections.forEach((section, index) => {
            const title = this.extractTitle(section.content) || section.folderName;
            merged += `${index + 1}. [${title}](#${this.slugify(title)})\n`;
        });
        merged += '\n---\n\n';

        // Add each section with proper formatting
        contentSections.forEach((section, index) => {
            const title = this.extractTitle(section.content) || section.folderName;
            const cleanContent = this.removeTitle(section.content);

            merged += `## ${title}\n\n`;
            merged += `*Source: ${section.folderName}*\n\n`;
            merged += `${cleanContent}\n\n`;

            if (index < contentSections.length - 1) {
                merged += '---\n\n';
            }
        });

        // Add metadata section
        merged += this.createMetadataSection(contentSections);

        return merged;
    }

    /**
     * Structured consolidation strategy - organizes content by sections
     */
    async structuredConsolidation(contentSections, topic) {
        await this.errorHandler.logDebug('Applying structured consolidation strategy', {
            topic,
            sectionCount: contentSections.length
        });

        let merged = this.createDocumentHeader(topic, contentSections, 'structured_consolidation');

        // Analyze content structure across all sections
        const structuredContent = this.analyzeContentStructure(contentSections);

        // Create overview section
        merged += '\n## Overview\n\n';
        merged += `This document consolidates information about ${topic} from ${contentSections.length} sources. `;
        merged += `The content has been organized thematically for better understanding.\n\n`;

        // Add main content organized by themes
        if (structuredContent.themes.size > 0) {
            merged += '## Main Content\n\n';

            for (const [theme, themeContent] of structuredContent.themes) {
                merged += `### ${this.formatThemeTitle(theme)}\n\n`;

                themeContent.forEach(content => {
                    merged += `${content.text}\n\n`;
                    if (content.source) {
                        merged += `*Source: ${content.source}*\n\n`;
                    }
                });

                merged += '---\n\n';
            }
        }

        // Add code examples if found
        if (structuredContent.codeBlocks.length > 0) {
            merged += '## Code Examples\n\n';
            structuredContent.codeBlocks.forEach((code, index) => {
                merged += `### Example ${index + 1}\n\n`;
                merged += `${code.block}\n\n`;
                if (code.source) {
                    merged += `*Source: ${code.source}*\n\n`;
                }
            });
        }

        // Add references and links
        if (structuredContent.links.length > 0) {
            merged += '## References and Links\n\n';
            structuredContent.links.forEach(link => {
                merged += `- ${link.text}\n`;
            });
            merged += '\n';
        }

        // Add metadata section
        merged += this.createMetadataSection(contentSections);

        return merged;
    }

    /**
     * Comprehensive merge strategy - intelligent content organization with deduplication
     */
    async comprehensiveMerge(contentSections, topic) {
        await this.errorHandler.logDebug('Applying comprehensive merge strategy', {
            topic,
            sectionCount: contentSections.length
        });

        let merged = this.createDocumentHeader(topic, contentSections, 'comprehensive_merge');

        // Perform comprehensive content analysis
        const analysis = await this.performComprehensiveAnalysis(contentSections);

        // Create executive summary
        merged += '\n## Executive Summary\n\n';
        merged += `This comprehensive document about ${topic} synthesizes information from ${contentSections.length} sources. `;
        merged += `Key topics covered include: ${Array.from(analysis.keyTopics).slice(0, 5).join(', ')}.`;
        if (analysis.duplicateContent.length > 0) {
            merged += ` Duplicate content has been identified and consolidated.`;
        }
        merged += '\n\n';

        // Add table of contents
        merged += '## Table of Contents\n\n';
        analysis.organizedSections.forEach((section, index) => {
            merged += `${index + 1}. [${section.title}](#${this.slugify(section.title)})\n`;
        });
        merged += '\n---\n\n';

        // Add organized content sections
        analysis.organizedSections.forEach(section => {
            merged += `## ${section.title}\n\n`;

            section.content.forEach(content => {
                merged += `${content.text}\n\n`;

                // Add source attribution for non-duplicate content
                if (content.sources && content.sources.length > 0) {
                    if (content.sources.length === 1) {
                        merged += `*Source: ${content.sources[0]}*\n\n`;
                    } else {
                        merged += `*Sources: ${content.sources.join(', ')}*\n\n`;
                    }
                }
            });

            merged += '---\n\n';
        });

        // Add appendices if there's additional content
        if (analysis.appendices.length > 0) {
            merged += '## Appendices\n\n';
            analysis.appendices.forEach((appendix, index) => {
                merged += `### Appendix ${String.fromCharCode(65 + index)}: ${appendix.title}\n\n`;
                merged += `${appendix.content}\n\n`;
            });
        }

        // Add metadata section with analysis details
        merged += this.createMetadataSection(contentSections, analysis);

        return merged;
    }

    /**
     * Analyze content structure for structured consolidation
     */
    analyzeContentStructure(contentSections) {
        const structure = {
            themes: new Map(),
            codeBlocks: [],
            links: [],
            images: []
        };

        contentSections.forEach(section => {
            const content = section.content;
            const source = section.folderName;

            // Extract code blocks
            const codeMatches = content.match(/```[\s\S]*?```/g) || [];
            codeMatches.forEach(block => {
                structure.codeBlocks.push({ block, source });
            });

            // Extract links
            const linkMatches = content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
            linkMatches.forEach(link => {
                structure.links.push({ text: link, source });
            });

            // Extract images
            const imageMatches = content.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || [];
            imageMatches.forEach(image => {
                structure.images.push({ text: image, source });
            });

            // Identify themes by analyzing headings and content
            const headings = content.match(/^#+\s+(.+)$/gm) || [];
            headings.forEach(heading => {
                const theme = heading.replace(/^#+\s+/, '').toLowerCase();
                if (!structure.themes.has(theme)) {
                    structure.themes.set(theme, []);
                }

                // Extract content under this heading
                const headingIndex = content.indexOf(heading);
                const nextHeadingMatch = content.slice(headingIndex + heading.length).match(/^#+\s+/m);
                const endIndex = nextHeadingMatch ?
                    headingIndex + heading.length + nextHeadingMatch.index :
                    content.length;

                const themeContent = content.slice(headingIndex + heading.length, endIndex).trim();
                if (themeContent) {
                    structure.themes.get(theme).push({ text: themeContent, source });
                }
            });
        });

        return structure;
    }

    /**
     * Perform comprehensive analysis for comprehensive merge
     */
    async performComprehensiveAnalysis(contentSections) {
        const analysis = {
            keyTopics: new Set(),
            duplicateContent: [],
            organizedSections: [],
            appendices: []
        };

        // Extract key topics from all content
        contentSections.forEach(section => {
            const words = section.content.toLowerCase().match(/\b\w{4,}\b/g) || [];
            const wordFreq = {};

            words.forEach(word => {
                if (!this.isStopWord(word)) {
                    wordFreq[word] = (wordFreq[word] || 0) + 1;
                }
            });

            // Add most frequent words as key topics
            Object.entries(wordFreq)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .forEach(([word]) => analysis.keyTopics.add(word));
        });

        // Identify duplicate content
        analysis.duplicateContent = this.findDuplicateContent(contentSections);

        // Organize content into logical sections
        analysis.organizedSections = this.organizeContentSections(contentSections, analysis.duplicateContent);

        // Create appendices for supplementary content
        analysis.appendices = this.createAppendices(contentSections);

        return analysis;
    }

    /**
     * Find duplicate content across sections
     */
    findDuplicateContent(contentSections) {
        const duplicates = [];
        const sentences = new Map();

        contentSections.forEach((section, sectionIndex) => {
            const sectionSentences = section.content.split(/[.!?]+/).filter(s => s.trim().length > 20);

            sectionSentences.forEach(sentence => {
                const normalized = sentence.trim().toLowerCase();
                if (sentences.has(normalized)) {
                    duplicates.push({
                        sentence: sentence.trim(),
                        sources: [sentences.get(normalized), section.folderName]
                    });
                } else {
                    sentences.set(normalized, section.folderName);
                }
            });
        });

        return duplicates;
    }

    /**
     * Organize content into logical sections
     */
    organizeContentSections(contentSections, duplicateContent) {
        const sections = [];
        const duplicateTexts = new Set(duplicateContent.map(d => d.sentence.toLowerCase()));

        // Group content by similarity and themes
        const themes = new Map();

        contentSections.forEach(section => {
            const headings = section.content.match(/^#+\s+(.+)$/gm) || [];

            if (headings.length > 0) {
                headings.forEach(heading => {
                    const theme = heading.replace(/^#+\s+/, '');
                    if (!themes.has(theme)) {
                        themes.set(theme, []);
                    }

                    // Extract content for this theme, excluding duplicates
                    const content = this.extractThemeContent(section.content, heading, duplicateTexts);
                    if (content.trim()) {
                        themes.get(theme).push({
                            text: content,
                            sources: [section.folderName]
                        });
                    }
                });
            } else {
                // No headings, treat as general content
                const theme = 'General Information';
                if (!themes.has(theme)) {
                    themes.set(theme, []);
                }

                const content = this.removeDuplicateText(section.content, duplicateTexts);
                if (content.trim()) {
                    themes.get(theme).push({
                        text: content,
                        sources: [section.folderName]
                    });
                }
            }
        });

        // Convert themes to organized sections
        for (const [theme, content] of themes) {
            sections.push({
                title: theme,
                content: content
            });
        }

        return sections;
    }

    /**
     * Create appendices for supplementary content
     */
    createAppendices(contentSections) {
        const appendices = [];

        // Create source files appendix
        appendices.push({
            title: 'Source Files',
            content: contentSections.map((section, index) =>
                `${index + 1}. **${section.folderName}**\n   - Word count: ${section.wordCount}\n   - Last modified: ${section.metadata.modified.toISOString().split('T')[0]}`
            ).join('\n')
        });

        return appendices;
    }

    /**
     * Create consolidated document folder
     */
    async createConsolidatedDocument(mergedContent, topic, sourceDocuments) {
        return await this.errorHandler.wrapAsync(async () => {
            const folderName = this.sanitizeFolderName(`${topic}-consolidated`);
            const consolidatedFolder = path.join(this.syncHubPath, 'Consolidated', folderName);

            if (this.dryRun) {
                await this.errorHandler.logInfo('DRY RUN: Would create consolidated document folder', {
                    folderName,
                    consolidatedFolder,
                    contentLength: mergedContent.length
                });
                return consolidatedFolder;
            }

            // Create folder structure
            await fs.mkdir(consolidatedFolder, { recursive: true });
            await fs.mkdir(path.join(consolidatedFolder, 'images'), { recursive: true });

            await this.errorHandler.logInfo('Created consolidated document folder', {
                consolidatedFolder,
                sourceCount: sourceDocuments.length
            });

            return consolidatedFolder;
        }, {
            operation: 'createConsolidatedDocument',
            topic
        });
    }

    /**
     * Consolidate images from source folders
     */
    async consolidateImages(sourceFolders, targetFolder) {
        return await this.errorHandler.wrapAsync(async () => {
            const imageMap = {};
            const targetImagesFolder = path.join(targetFolder, 'images');

            for (const sourceFolder of sourceFolders) {
                try {
                    const sourceImagesFolder = path.join(sourceFolder, 'images');

                    // Check if source images folder exists
                    try {
                        await fs.access(sourceImagesFolder);
                    } catch {
                        continue; // No images folder in this source
                    }

                    const imageFiles = await fs.readdir(sourceImagesFolder);

                    for (const imageFile of imageFiles) {
                        const sourcePath = path.join(sourceImagesFolder, imageFile);
                        const targetPath = path.join(targetImagesFolder, imageFile);

                        if (!this.dryRun) {
                            await fs.copyFile(sourcePath, targetPath);
                        }

                        // Map old path to new path for reference updating
                        imageMap[`images/${imageFile}`] = `images/${imageFile}`;
                        imageMap[`./images/${imageFile}`] = `images/${imageFile}`;

                        await this.errorHandler.logDebug('Image consolidated', {
                            imageFile,
                            sourcePath,
                            targetPath
                        });
                    }
                } catch (error) {
                    await this.errorHandler.logWarn('Failed to consolidate images from folder', {
                        sourceFolder,
                        error: error.message
                    });
                }
            }

            await this.errorHandler.logInfo('Image consolidation completed', {
                imageCount: Object.keys(imageMap).length,
                targetFolder: targetImagesFolder
            });

            return imageMap;
        }, {
            operation: 'consolidateImages',
            sourceFolderCount: sourceFolders.length
        });
    }

    /**
     * Update image references in content
     */
    updateImageReferences(content, imageMap) {
        let updatedContent = content;

        for (const [oldPath, newPath] of Object.entries(imageMap)) {
            // Update markdown image references
            const oldImageRegex = new RegExp(`!\\[([^\\]]*)\\]\\(${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g');
            updatedContent = updatedContent.replace(oldImageRegex, `![$1](${newPath})`);
        }

        return updatedContent;
    }

    /**
     * Utility functions
     */
    createDocumentHeader(topic, contentSections, strategy) {
        const date = new Date().toISOString().split('T')[0];
        const sourceList = contentSections.map(s => s.folderName).join(', ');

        return `# ${topic} - Consolidated Document

*Created: ${date}*  
*Strategy: ${strategy}*  
*Sources: ${contentSections.length} documents*

**Source Documents:** ${sourceList}

`;
    }

    createMetadataSection(contentSections, analysis = null) {
        let metadata = '\n## Document Metadata\n\n';

        metadata += `- **Total Sources:** ${contentSections.length}\n`;
        metadata += `- **Total Word Count:** ${contentSections.reduce((sum, s) => sum + s.wordCount, 0)}\n`;
        metadata += `- **Consolidation Date:** ${new Date().toISOString().split('T')[0]}\n`;

        if (analysis) {
            metadata += `- **Key Topics:** ${Array.from(analysis.keyTopics).slice(0, 10).join(', ')}\n`;
            metadata += `- **Duplicate Content Removed:** ${analysis.duplicateContent.length} instances\n`;
        }

        metadata += '\n### Source Details\n\n';
        contentSections.forEach((section, index) => {
            metadata += `${index + 1}. **${section.folderName}**\n`;
            metadata += `   - Words: ${section.wordCount || 0}\n`;
            if (section.metadata && section.metadata.size) {
                metadata += `   - Size: ${(section.metadata.size / 1024).toFixed(1)} KB\n`;
            }
            if (section.metadata && section.metadata.modified) {
                metadata += `   - Modified: ${section.metadata.modified.toISOString().split('T')[0]}\n`;
            }
            metadata += '\n';
        });

        return metadata;
    }

    extractTitle(content) {
        if (!content || typeof content !== 'string') {
            return null;
        }
        const titleMatch = content.match(/^#\s+(.+)$/m);
        return titleMatch ? titleMatch[1].trim() : null;
    }

    removeTitle(content) {
        if (!content || typeof content !== 'string') {
            return '';
        }
        return content.replace(/^#\s+.+$/m, '').trim();
    }

    extractThemeContent(content, heading, duplicateTexts) {
        const headingIndex = content.indexOf(heading);
        const nextHeadingMatch = content.slice(headingIndex + heading.length).match(/^#+\s+/m);
        const endIndex = nextHeadingMatch ?
            headingIndex + heading.length + nextHeadingMatch.index :
            content.length;

        const themeContent = content.slice(headingIndex + heading.length, endIndex).trim();
        return this.removeDuplicateText(themeContent, duplicateTexts);
    }

    removeDuplicateText(content, duplicateTexts) {
        const sentences = content.split(/[.!?]+/);
        const filteredSentences = sentences.filter(sentence => {
            const normalized = sentence.trim().toLowerCase();
            return !duplicateTexts.has(normalized);
        });
        return filteredSentences.join('.').trim();
    }

    formatThemeTitle(theme) {
        return theme.charAt(0).toUpperCase() + theme.slice(1).replace(/[-_]/g, ' ');
    }

    slugify(text) {
        if (!text || typeof text !== 'string') {
            return 'untitled';
        }
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim('-');
    }

    sanitizeFolderName(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim('-')
            .substring(0, 50);
    }

    isStopWord(word) {
        const stopWords = new Set([
            'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above',
            'below', 'between', 'among', 'this', 'that', 'these', 'those', 'is', 'are', 'was',
            'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
            'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall'
        ]);
        return stopWords.has(word.toLowerCase());
    }
}

export default ContentConsolidationEngine;