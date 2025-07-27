#!/usr/bin/env node

/**
 * Content Consolidator Module
 * Handles content merging, AI enhancement, and gap filling
 */

import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export class ContentConsolidator {
    constructor(options = {}) {
        this.aiService = options.aiService || 'local'; // 'local', 'openai', 'anthropic'
        this.projectRoot = options.projectRoot;
        this.syncHubPath = options.syncHubPath; // Configurable sync hub path
        this.outputFormat = options.outputFormat || 'markdown';
        this.preserveReferences = options.preserveReferences !== false;
        this.enhanceContent = options.enhanceContent !== false;
    }

    /**
     * Consolidate multiple documents into a single, enhanced document
     */
    async consolidateDocuments(consolidationCandidate) {
        const { topic, files, consolidationStrategy } = consolidationCandidate;

        console.log(`[INFO] Consolidating ${files.length} documents for topic: ${topic}`);

        // Create folder structure
        const folderName = this.sanitizeFolderName(consolidationCandidate.recommendedTitle);
        const targetFolder = await this.createConsolidatedFolder(folderName, files[0].analysis);

        // Extract and merge content
        const mergedContent = await this.mergeContent(files, consolidationStrategy);

        // Enhance content with AI if enabled
        let enhancedContent = mergedContent;
        if (this.enhanceContent) {
            enhancedContent = await this.enhanceContentWithAI(mergedContent, topic);
        }

        // Create the consolidated document
        const consolidatedDoc = await this.createConsolidatedDocument(
            enhancedContent,
            consolidationCandidate,
            targetFolder
        );

        // Move reference materials
        await this.moveReferenceMaterials(files, targetFolder);

        return {
            success: true,
            targetFolder,
            consolidatedDocument: consolidatedDoc,
            originalFiles: files.map(f => f.filePath),
            consolidationStrategy
        };
    }

    /**
     * Create folder structure for consolidated content
     */
    async createConsolidatedFolder(folderName, sampleAnalysis) {
        const category = this.determineCategory(sampleAnalysis);
        
        // Use configurable syncHubPath instead of hardcoded path
        if (!this.syncHubPath) {
            throw new Error('syncHubPath is required but not provided in ContentConsolidator options');
        }
        
        const categoryPath = path.join(this.syncHubPath, category);
        const folderPath = path.join(categoryPath, folderName);

        // Create main folder
        await fs.mkdir(folderPath, { recursive: true });

        // Create subfolders
        await fs.mkdir(path.join(folderPath, 'assets'), { recursive: true });
        await fs.mkdir(path.join(folderPath, 'references'), { recursive: true });

        return folderPath;
    }

    /**
     * Merge content from multiple files
     */
    async mergeContent(files, strategy) {
        const contents = [];

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
                console.warn(`Failed to read ${file.filePath}: ${error.message}`);
            }
        }

        switch (strategy) {
            case 'comprehensive_merge':
                return this.comprehensiveMerge(contents);
            case 'structured_consolidation':
                return this.structuredConsolidation(contents);
            case 'simple_merge':
            default:
                return this.simpleMerge(contents);
        }
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
            let textOnly = c.content
                .replace(/```[\s\S]*?```/g, '')
                .replace(/!\[.*\]\(.+\)/g, '');
            textContent.push({ text: textOnly, metadata: c.metadata });
        });

        // Merge text content
        merged += '\n## Overview\n\n';
        textContent.forEach((tc, index) => {
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
            images.forEach((img, index) => {
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
        const prompt = this.createEnhancementPrompt(content, topic);

        try {
            const enhancedContent = await this.callAIService(prompt);
            return enhancedContent || content; // Fallback to original if AI fails
        } catch (error) {
            console.warn(`AI enhancement failed: ${error.message}`);
            return content;
        }
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
        try {
            // Example using curl to call Ollama API
            const response = execSync(`curl -s -X POST http://localhost:11434/api/generate -d '${JSON.stringify({
                model: "llama2",
                prompt: prompt,
                stream: false
            })}'`, { encoding: 'utf-8' });

            const result = JSON.parse(response);
            return result.response;
        } catch (error) {
            throw new Error(`Local AI service error: ${error.message}`);
        }
    }

    /**
     * Call MCP service for AI enhancement
     */
    async callMCPService(prompt) {
        // This would integrate with the MCP server
        // For now, return null to indicate no enhancement
        return null;
    }

    /**
     * Create consolidated document with metadata
     */
    async createConsolidatedDocument(content, consolidationCandidate, targetFolder) {
        const { recommendedTitle, files } = consolidationCandidate;

        const metadata = this.createDocumentMetadata(consolidationCandidate);
        const fullContent = metadata + content;

        const docPath = path.join(targetFolder, 'main.md');
        await fs.writeFile(docPath, fullContent, 'utf-8');

        console.log(`[INFO] Created consolidated document: ${docPath}`);
        return docPath;
    }

    /**
     * Move reference materials to the references folder
     */
    async moveReferenceMaterials(files, targetFolder) {
        const referencesFolder = path.join(targetFolder, 'references');

        for (const file of files) {
            try {
                const fileName = path.basename(file.filePath);
                const targetPath = path.join(referencesFolder, fileName);

                // Copy original file to references
                await fs.copyFile(file.filePath, targetPath);
                console.log(`[INFO] Moved reference: ${fileName}`);
            } catch (error) {
                console.warn(`Failed to move reference ${file.filePath}: ${error.message}`);
            }
        }
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
        const { recommendedTitle, files, topic, avgSimilarity } = consolidationCandidate;

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
