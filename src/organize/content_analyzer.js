#!/usr/bin/env node

/**
 * Content Analyzer Module
 * Handles duplicate detection, similarity analysis, and content comparison
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export class ContentAnalyzer {
    constructor(options = {}) {
        this.similarityThreshold = options.similarityThreshold || 0.8;
        this.minContentLength = options.minContentLength || 100;
        this.contentCache = new Map();
        this.analysisResults = new Map();
    }

    /**
     * Analyze content for duplicates and similarities
     * Enhanced to understand document folder structure
     */
    async analyzeContent(filePath) {
        const content = await this.readFile(filePath);
        if (!content || content.length < this.minContentLength) {
            return null;
        }

        const analysis = {
            filePath,
            contentHash: this.generateContentHash(content),
            wordCount: this.getWordCount(content),
            contentType: this.detectContentType(content),
            topics: this.extractTopics(content),
            structure: this.analyzeStructure(content),
            metadata: this.extractMetadata(content, filePath)
        };

        // Check if this file is part of a document folder structure
        const parentDir = path.dirname(filePath);
        const fileName = path.basename(filePath);
        const parentDirName = path.basename(parentDir);

        // Detect if this is likely a main document file in a document folder
        const isLikelyMainFile = this.isLikelyMainDocumentFile(fileName, parentDirName);
        if (isLikelyMainFile) {
            analysis.isMainDocumentFile = true;
            analysis.documentFolderName = parentDirName;

            // Check for images folder
            const imagesFolder = path.join(parentDir, 'images');
            try {
                const imagesStat = await fs.stat(imagesFolder);
                if (imagesStat.isDirectory()) {
                    const imageFiles = await fs.readdir(imagesFolder);
                    analysis.hasImagesFolder = true;
                    analysis.imageCount = imageFiles.filter(f => !f.startsWith('.')).length;
                }
            } catch (error) {
                analysis.hasImagesFolder = false;
                analysis.imageCount = 0;
            }
        } else {
            analysis.isMainDocumentFile = false;
            analysis.hasImagesFolder = false;
            analysis.imageCount = 0;
        }

        this.contentCache.set(filePath, analysis);
        return analysis;
    }

    /**
     * Check if a file is likely a main document file in a document folder
     */
    isLikelyMainDocumentFile(fileName, parentDirName) {
        const baseName = path.basename(fileName, path.extname(fileName)).toLowerCase();
        const parentName = parentDirName.toLowerCase();

        // Standard main file names
        const mainFileNames = ['main', 'document', 'index', 'readme'];
        if (mainFileNames.includes(baseName)) {
            return true;
        }

        // File name matches parent directory name
        if (baseName === parentName || baseName.replace(/[-_]/g, '') === parentName.replace(/[-_]/g, '')) {
            return true;
        }

        return false;
    }

    /**
     * Analyze a document folder as a complete unit
     */
    async analyzeDocumentFolder(folderPath, mainFilePath) {
        const analysis = await this.analyzeContent(mainFilePath);
        if (!analysis) {
            return null;
        }

        // Enhance with folder-specific information
        analysis.documentFolderPath = folderPath;
        analysis.isDocumentFolder = true;

        // Analyze images folder if it exists
        const imagesFolder = path.join(folderPath, 'images');
        try {
            const imagesStat = await fs.stat(imagesFolder);
            if (imagesStat.isDirectory()) {
                const imageFiles = await fs.readdir(imagesFolder);
                const validImages = imageFiles.filter(f => !f.startsWith('.') && this.isImageFile(f));

                analysis.hasImagesFolder = true;
                analysis.imageCount = validImages.length;
                analysis.imageFiles = validImages;

                // Analyze image references in content
                const content = await this.readFile(mainFilePath);
                analysis.imageReferences = this.extractImageReferences(content);
                analysis.hasOrphanedImages = validImages.length > analysis.imageReferences.length;
            }
        } catch (error) {
            analysis.hasImagesFolder = false;
            analysis.imageCount = 0;
            analysis.imageFiles = [];
            analysis.imageReferences = [];
            analysis.hasOrphanedImages = false;
        }

        return analysis;
    }

    /**
     * Check if a file is an image file
     */
    isImageFile(fileName) {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp'];
        const ext = path.extname(fileName).toLowerCase();
        return imageExtensions.includes(ext);
    }

    /**
     * Extract image references from markdown content
     */
    extractImageReferences(content) {
        const imageRefs = [];

        // Match markdown image syntax: ![alt](path)
        const markdownImages = content.match(/!\[.*?\]\([^)]+\)/g) || [];
        markdownImages.forEach(match => {
            const pathMatch = match.match(/!\[.*?\]\(([^)]+)\)/);
            if (pathMatch) {
                imageRefs.push(pathMatch[1]);
            }
        });

        // Match HTML img tags
        const htmlImages = content.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi) || [];
        htmlImages.forEach(match => {
            const srcMatch = match.match(/src=["']([^"']+)["']/i);
            if (srcMatch) {
                imageRefs.push(srcMatch[1]);
            }
        });

        return imageRefs;
    }

    /**
     * Find duplicate content across files
     * Enhanced to handle document folders
     */
    async findDuplicates(fileList) {
        const duplicates = new Map();
        const analyzed = new Map();

        // Analyze all files
        for (const filePath of fileList) {
            try {
                const analysis = await this.analyzeContent(filePath);
                if (analysis) {
                    analyzed.set(filePath, analysis);
                }
            } catch (error) {
                console.warn(`Failed to analyze ${filePath}: ${error.message}`);
            }
        }

        // Find exact duplicates (same hash)
        const hashGroups = new Map();
        for (const [filePath, analysis] of analyzed) {
            const hash = analysis.contentHash;
            if (!hashGroups.has(hash)) {
                hashGroups.set(hash, []);
            }
            hashGroups.get(hash).push({ filePath, analysis });
        }

        // Group exact duplicates
        for (const [hash, files] of hashGroups) {
            if (files.length > 1) {
                // Determine recommended action based on document folder status
                let recommendedAction = 'merge_or_delete';
                const hasDocumentFolders = files.some(f => f.analysis.isMainDocumentFile);
                const hasImages = files.some(f => f.analysis.imageCount > 0);

                if (hasDocumentFolders && hasImages) {
                    recommendedAction = 'merge_document_folders_preserve_images';
                } else if (hasDocumentFolders) {
                    recommendedAction = 'merge_document_folders';
                }

                duplicates.set(`exact_${hash}`, {
                    type: 'exact',
                    similarity: 1.0,
                    files: files,
                    recommendedAction,
                    involvesDocumentFolders: hasDocumentFolders,
                    involvesImages: hasImages
                });
            }
        }

        // Find similar content
        const analyzedArray = Array.from(analyzed.values());
        for (let i = 0; i < analyzedArray.length; i++) {
            for (let j = i + 1; j < analyzedArray.length; j++) {
                const similarity = this.calculateSimilarity(analyzedArray[i], analyzedArray[j]);
                if (similarity >= this.similarityThreshold) {
                    const key = `similar_${i}_${j}`;

                    // Determine recommended action based on document folder status
                    let recommendedAction = similarity > 0.95 ? 'merge' : 'consolidate';
                    const hasDocumentFolders = analyzedArray[i].isMainDocumentFile || analyzedArray[j].isMainDocumentFile;
                    const hasImages = (analyzedArray[i].imageCount || 0) > 0 || (analyzedArray[j].imageCount || 0) > 0;

                    if (hasDocumentFolders && similarity > 0.95) {
                        recommendedAction = hasImages ? 'merge_document_folders_preserve_images' : 'merge_document_folders';
                    } else if (hasDocumentFolders) {
                        recommendedAction = 'consolidate_document_folders';
                    }

                    duplicates.set(key, {
                        type: 'similar',
                        similarity,
                        files: [
                            { filePath: analyzedArray[i].filePath, analysis: analyzedArray[i] },
                            { filePath: analyzedArray[j].filePath, analysis: analyzedArray[j] }
                        ],
                        recommendedAction,
                        involvesDocumentFolders: hasDocumentFolders,
                        involvesImages: hasImages
                    });
                }
            }
        }

        return duplicates;
    }

    /**
     * Find content that can be consolidated
     */
    async findConsolidationCandidates(fileList) {
        const candidates = new Map();
        const analyzed = new Map();

        // Analyze all files
        for (const filePath of fileList) {
            try {
                const analysis = await this.analyzeContent(filePath);
                if (analysis) {
                    analyzed.set(filePath, analysis);
                }
            } catch (error) {
                console.warn(`Failed to analyze ${filePath}: ${error.message}`);
            }
        }

        // Group by similar topics
        const topicGroups = new Map();
        for (const [filePath, analysis] of analyzed) {
            for (const topic of analysis.topics) {
                if (!topicGroups.has(topic)) {
                    topicGroups.set(topic, []);
                }
                topicGroups.get(topic).push({ filePath, analysis });
            }
        }

        // Find consolidation opportunities
        for (const [topic, files] of topicGroups) {
            if (files.length >= 2) {
                const avgSimilarity = this.calculateGroupSimilarity(files);
                if (avgSimilarity >= 0.6) {
                    candidates.set(topic, {
                        topic,
                        files,
                        avgSimilarity,
                        totalWordCount: files.reduce((sum, f) => sum + f.analysis.wordCount, 0),
                        recommendedTitle: this.generateConsolidatedTitle(topic, files),
                        consolidationStrategy: this.determineConsolidationStrategy(files)
                    });
                }
            }
        }

        return candidates;
    }

    /**
     * Generate content hash for duplicate detection
     */
    generateContentHash(content) {
        // Normalize content for better duplicate detection
        const normalized = content
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s]/g, '')
            .trim();

        return crypto.createHash('sha256').update(normalized).digest('hex');
    }

    /**
     * Calculate similarity between two content analyses
     */
    calculateSimilarity(analysis1, analysis2) {
        // Multiple similarity metrics
        const topicSimilarity = this.calculateTopicSimilarity(analysis1.topics, analysis2.topics);
        const structureSimilarity = this.calculateStructureSimilarity(analysis1.structure, analysis2.structure);
        const contentSimilarity = this.calculateContentSimilarity(analysis1, analysis2);

        // Weighted average
        return (topicSimilarity * 0.4 + structureSimilarity * 0.2 + contentSimilarity * 0.4);
    }

    /**
     * Calculate topic similarity using Jaccard similarity
     */
    calculateTopicSimilarity(topics1, topics2) {
        const set1 = new Set(topics1);
        const set2 = new Set(topics2);
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        return union.size === 0 ? 0 : intersection.size / union.size;
    }

    /**
     * Calculate structure similarity
     */
    calculateStructureSimilarity(struct1, struct2) {
        const headingsSim = this.calculateArraySimilarity(struct1.headings, struct2.headings);
        const formatSim = struct1.format === struct2.format ? 1 : 0;

        return (headingsSim * 0.7 + formatSim * 0.3);
    }

    /**
     * Calculate content similarity using basic text analysis
     */
    calculateContentSimilarity(analysis1, analysis2) {
        // Word count similarity
        const wordCountSim = 1 - Math.abs(analysis1.wordCount - analysis2.wordCount) /
            Math.max(analysis1.wordCount, analysis2.wordCount);

        // Content type similarity
        const typeSim = analysis1.contentType === analysis2.contentType ? 1 : 0;

        return (wordCountSim * 0.6 + typeSim * 0.4);
    }

    /**
     * Extract topics from content
     */
    extractTopics(content) {
        const topics = new Set();

        // Extract from headings
        const headingMatches = content.match(/^#+\s+(.+)$/gm) || [];
        headingMatches.forEach(heading => {
            const clean = heading.replace(/^#+\s+/, '').toLowerCase();
            const words = clean.split(/\s+/).filter(w => w.length > 3);
            words.forEach(word => topics.add(word));
        });

        // Extract key terms (simple approach)
        const words = content.toLowerCase().match(/\b\w{4,}\b/g) || [];
        const wordFreq = new Map();
        words.forEach(word => {
            wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
        });

        // Get top frequent words as topics
        const sortedWords = Array.from(wordFreq.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word]) => word);

        sortedWords.forEach(word => topics.add(word));

        return Array.from(topics);
    }

    /**
     * Analyze document structure
     */
    analyzeStructure(content) {
        const headings = [];
        const headingMatches = content.match(/^#+\s+(.+)$/gm) || [];
        headingMatches.forEach(heading => {
            const level = heading.match(/^#+/)[0].length;
            const text = heading.replace(/^#+\s+/, '');
            headings.push({ level, text });
        });

        return {
            headings: headings.map(h => h.text),
            headingLevels: headings.map(h => h.level),
            format: this.detectFormat(content),
            hasCodeBlocks: /```/.test(content),
            hasLinks: /\[.+\]\(.+\)/.test(content),
            hasImages: /!\[.*\]\(.+\)/.test(content),
            hasTables: /\|.*\|/.test(content)
        };
    }

    /**
     * Detect content type
     */
    detectContentType(content) {
        if (/```/.test(content)) return 'technical';
        if (/^#+\s+/.test(content)) return 'article';
        if (/^\s*[-*+]\s+/m.test(content)) return 'notes';
        if (/\|.*\|/.test(content)) return 'data';
        return 'document';
    }

    /**
     * Detect document format
     */
    detectFormat(content) {
        if (/^#+\s+/.test(content)) return 'markdown';
        if (/<\/?[a-z][\s\S]*>/i.test(content)) return 'html';
        return 'text';
    }

    /**
     * Extract metadata from content and filename
     */
    extractMetadata(content, filePath) {
        const filename = path.basename(filePath, path.extname(filePath));
        const title = this.extractTitle(content) || this.generateTitleFromFilename(filename);
        const dateCreated = this.extractDate(content);
        const author = this.extractAuthor(content);

        return {
            originalFilename: filename,
            suggestedTitle: title,
            dateCreated,
            author,
            fileExtension: path.extname(filePath),
            fileSize: 0 // Will be filled by calling code
        };
    }

    /**
     * Extract title from content
     */
    extractTitle(content) {
        // Try to find title in various formats
        const patterns = [
            /^#\s+(.+)$/m,           // # Title
            /^title:\s*(.+)$/mi,     // title: Title (YAML frontmatter)
            /^(.+)\n=+$/m,           // Title\n====
            /^(.+)\n-+$/m            // Title\n----
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }

        return null;
    }

    /**
     * Generate title from filename
     */
    generateTitleFromFilename(filename) {
        return filename
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase())
            .trim();
    }

    /**
     * Extract date from content
     */
    extractDate(content) {
        const datePattern = /(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4})/;
        const match = content.match(datePattern);
        return match ? match[1] : null;
    }

    /**
     * Extract author from content
     */
    extractAuthor(content) {
        const authorPatterns = [
            /author:\s*(.+)$/mi,
            /by\s+(.+)$/mi,
            /written\s+by\s+(.+)$/mi
        ];

        for (const pattern of authorPatterns) {
            const match = content.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }

        return null;
    }

    /**
     * Utility functions
     */
    async readFile(filePath) {
        try {
            return await fs.readFile(filePath, 'utf-8');
        } catch (error) {
            console.warn(`Could not read file ${filePath}: ${error.message}`);
            return null;
        }
    }

    getWordCount(content) {
        return content.split(/\s+/).filter(word => word.length > 0).length;
    }

    calculateArraySimilarity(arr1, arr2) {
        const set1 = new Set(arr1);
        const set2 = new Set(arr2);
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        return union.size === 0 ? 0 : intersection.size / union.size;
    }

    calculateGroupSimilarity(files) {
        if (files.length < 2) return 0;

        let totalSimilarity = 0;
        let comparisons = 0;

        for (let i = 0; i < files.length; i++) {
            for (let j = i + 1; j < files.length; j++) {
                totalSimilarity += this.calculateSimilarity(files[i].analysis, files[j].analysis);
                comparisons++;
            }
        }

        return comparisons > 0 ? totalSimilarity / comparisons : 0;
    }

    generateConsolidatedTitle(topic, files) {
        const titles = files.map(f => f.analysis.metadata.suggestedTitle);
        const commonWords = this.findCommonWords(titles);

        if (commonWords.length > 0) {
            return commonWords.slice(0, 3).join(' ') + ' - Consolidated';
        }

        return `${topic.charAt(0).toUpperCase() + topic.slice(1)} - Consolidated`;
    }

    findCommonWords(titles) {
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

    determineConsolidationStrategy(files) {
        const avgWordCount = files.reduce((sum, f) => sum + f.analysis.wordCount, 0) / files.length;
        const hasCode = files.some(f => f.analysis.structure.hasCodeBlocks);
        const hasImages = files.some(f => f.analysis.structure.hasImages);

        if (avgWordCount > 2000) return 'comprehensive_merge';
        if (hasCode || hasImages) return 'structured_consolidation';
        return 'simple_merge';
    }
}

// Export for use in other modules
export default ContentAnalyzer;
