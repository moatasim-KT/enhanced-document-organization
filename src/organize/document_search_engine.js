#!/usr/bin/env node

/**
 * Document Search Engine
 * Provides folder-aware document search functionality using JavaScript file system traversal
 * 
 * This class replaces shell command-based search with native JavaScript implementation
 * that understands the folder-based document structure.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { createErrorHandler, ErrorTypes, EnhancedError } from './error_handler.js';
import { SimplePathResolver, PathUtils } from './simple_path_resolver.js';

/**
 * Document Search Engine Class
 * Handles search operations with folder-aware document traversal
 */
export class DocumentSearchEngine {
    constructor(documentFolderManager, options = {}) {
        this.documentFolderManager = documentFolderManager;
        this.pathResolver = new SimplePathResolver();
        this.options = {
            maxPreviewLength: 200,
            contextLines: 2,
            highlightMarker: '**',
            ...options
        };

        // Initialize error handler
        this.errorHandler = createErrorHandler('DocumentSearchEngine', {
            enableConsoleLogging: process.env.NODE_ENV !== 'production'
        });

        // Bind logging methods
        this.logError = this.errorHandler.logError.bind(this.errorHandler);
        this.logWarn = this.errorHandler.logWarn.bind(this.errorHandler);
        this.logInfo = this.errorHandler.logInfo.bind(this.errorHandler);
        this.logDebug = this.errorHandler.logDebug.bind(this.errorHandler);
    }

    /**
     * Search documents with folder-aware traversal
     */
    async searchDocuments(query, options = {}) {
        return await this.errorHandler.wrapAsync(async () => {
            // Validate query
            if (!query || typeof query !== 'string' || query.trim().length === 0) {
                throw new EnhancedError(
                    'Search query is required and must be a non-empty string',
                    ErrorTypes.VALIDATION_ERROR,
                    {
                        operation: 'searchDocuments',
                        query,
                        queryType: typeof query
                    }
                );
            }

            const {
                category = null,
                limit = 10,
                useRegex = false,
                caseSensitive = false
            } = options;

            await this.logInfo('Starting document search', {
                query,
                category,
                limit,
                useRegex,
                caseSensitive
            });

            // Determine search path
            let searchPath = this.documentFolderManager.syncHubPath;
            if (category) {
                searchPath = PathUtils.isAbsolute(category)
                    ? category
                    : this.pathResolver.joinPaths(this.documentFolderManager.syncHubPath, category);

                // Verify category exists
                if (!this.pathResolver.directoryExistsSync(searchPath)) {
                    await this.logWarn(`Search category does not exist: ${category}`, {
                        category,
                        searchPath
                    });
                    return {
                        query,
                        category,
                        total_results: 0,
                        results: [],
                        warning: `Category '${category}' does not exist`
                    };
                }
            }

            // Find all document folders in search path
            const documentFolders = await this.documentFolderManager.findDocumentFolders(searchPath, true);

            await this.logDebug('Found document folders', {
                searchPath,
                folderCount: documentFolders.length
            });

            // Search within each document folder
            const searchResults = [];
            const processingErrors = [];

            for (const folderPath of documentFolders) {
                try {
                    const result = await this.searchInDocumentFolder(folderPath, query, {
                        useRegex,
                        caseSensitive
                    });

                    if (result) {
                        searchResults.push(result);

                        // Stop if we've reached the limit
                        if (searchResults.length >= limit) {
                            break;
                        }
                    }
                } catch (error) {
                    const errorMsg = `Error searching in folder ${folderPath}`;
                    await this.logError(errorMsg, { folderPath }, error);
                    processingErrors.push({
                        folder: folderPath,
                        error: error.message
                    });
                }
            }

            // Rank results by relevance
            const rankedResults = this.rankSearchResults(searchResults, query);

            const response = {
                query,
                total_results: rankedResults.length,
                results: rankedResults.slice(0, limit),
                search_metadata: {
                    folders_searched: documentFolders.length,
                    search_path: searchPath,
                    use_regex: useRegex,
                    case_sensitive: caseSensitive
                },
                ...(category && { category }),
                ...(processingErrors.length > 0 && { processing_errors: processingErrors })
            };

            await this.logInfo('Search completed', {
                query,
                totalResults: rankedResults.length,
                foldersSearched: documentFolders.length
            });

            return response;
        }, {
            operation: 'searchDocuments',
            query,
            options
        });
    }

    /**
     * Search within a specific document folder
     */
    async searchInDocumentFolder(folderPath, query, options = {}) {
        return await this.errorHandler.wrapAsync(async () => {
            const { useRegex = false, caseSensitive = false } = options;

            // Get main document file
            const mainFilePath = await this.documentFolderManager.getMainDocumentFile(folderPath);
            if (!mainFilePath) {
                return null;
            }

            // Read document content
            const content = await fs.readFile(mainFilePath, 'utf8');

            // Search for matches
            const matches = this.findMatches(content, query, { useRegex, caseSensitive });

            if (matches.length === 0) {
                return null;
            }

            // Get document metadata
            const metadata = await this.documentFolderManager.getDocumentFolderMetadata(folderPath);

            // Calculate relevance score
            const relevanceScore = this.calculateRelevanceScore(content, query, matches);

            // Create preview with highlighted matches
            const preview = this.createPreview(content, matches[0]);
            const highlightedPreview = this.highlightMatches(preview, query, { useRegex, caseSensitive });

            // Get relative path from sync hub
            const relativePath = path.relative(this.documentFolderManager.syncHubPath, folderPath);

            return {
                documentFolder: {
                    path: relativePath,
                    name: metadata.name,
                    category: metadata.category,
                    mainFile: path.relative(this.documentFolderManager.syncHubPath, mainFilePath),
                    imageCount: metadata.metadata.imageCount,
                    size: metadata.metadata.size,
                    modified: metadata.metadata.modified.toISOString()
                },
                relevanceScore,
                matchedContent: matches.map(match => ({
                    section: this.extractSection(content, match.index),
                    excerpt: match.excerpt,
                    lineNumber: match.lineNumber
                })),
                preview,
                highlightedPreview,
                totalMatches: matches.length
            };
        }, {
            operation: 'searchInDocumentFolder',
            folderPath,
            query
        });
    }

    /**
     * Find all matches of query in content
     */
    findMatches(content, query, options = {}) {
        const { useRegex = false, caseSensitive = false } = options;
        const matches = [];

        try {
            let searchRegex;

            if (useRegex) {
                const flags = caseSensitive ? 'g' : 'gi';
                searchRegex = new RegExp(query, flags);
            } else {
                // Escape special regex characters for literal search
                const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const flags = caseSensitive ? 'g' : 'gi';
                searchRegex = new RegExp(escapedQuery, flags);
            }

            const lines = content.split('\n');
            let match;
            let globalIndex = 0;

            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                const line = lines[lineIndex];
                const lineStartIndex = globalIndex;

                // Reset regex for each line
                searchRegex.lastIndex = 0;

                while ((match = searchRegex.exec(line)) !== null) {
                    const matchIndex = lineStartIndex + match.index;
                    const contextStart = Math.max(0, match.index - 50);
                    const contextEnd = Math.min(line.length, match.index + match[0].length + 50);
                    const excerpt = line.substring(contextStart, contextEnd);

                    matches.push({
                        index: matchIndex,
                        length: match[0].length,
                        lineNumber: lineIndex + 1,
                        excerpt,
                        matchText: match[0]
                    });

                    // Prevent infinite loop for zero-length matches
                    if (match[0].length === 0) {
                        searchRegex.lastIndex++;
                    }
                }

                globalIndex += line.length + 1; // +1 for newline character
            }

        } catch (error) {
            // If regex is invalid, fall back to simple string search
            if (useRegex) {
                return this.findMatches(content, query, { useRegex: false, caseSensitive });
            }
            throw error;
        }

        return matches;
    }

    /**
     * Calculate relevance score for search results
     */
    calculateRelevanceScore(content, query, matches) {
        let score = 0;

        // Base score from number of matches
        score += matches.length * 10;

        // Bonus for matches in title/headers (lines starting with #)
        const lines = content.split('\n');
        for (const match of matches) {
            const lineIndex = match.lineNumber - 1;
            if (lineIndex < lines.length) {
                const line = lines[lineIndex].trim();
                if (line.startsWith('#')) {
                    score += 50; // Header match bonus
                }
                if (lineIndex < 5) {
                    score += 20; // Early in document bonus
                }
            }
        }

        // Bonus for exact word matches
        const queryWords = query.toLowerCase().split(/\s+/);
        const contentWords = content.toLowerCase().split(/\s+/);
        for (const queryWord of queryWords) {
            if (contentWords.includes(queryWord)) {
                score += 15;
            }
        }

        // Penalty for very long documents (diluted relevance)
        if (content.length > 10000) {
            score *= 0.8;
        }

        return Math.round(score);
    }

    /**
     * Create a preview of content around the first match
     */
    createPreview(content, firstMatch) {
        if (!firstMatch) {
            return content.substring(0, this.options.maxPreviewLength) +
                (content.length > this.options.maxPreviewLength ? '...' : '');
        }

        const start = Math.max(0, firstMatch.index - 100);
        const end = Math.min(content.length, firstMatch.index + firstMatch.length + 100);

        let preview = content.substring(start, end);

        if (start > 0) {
            preview = '...' + preview;
        }
        if (end < content.length) {
            preview = preview + '...';
        }

        return preview;
    }

    /**
     * Highlight matches in preview text
     */
    highlightMatches(text, query, options = {}) {
        const { useRegex = false, caseSensitive = false } = options;

        try {
            let searchRegex;

            if (useRegex) {
                const flags = caseSensitive ? 'g' : 'gi';
                searchRegex = new RegExp(query, flags);
            } else {
                const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const flags = caseSensitive ? 'g' : 'gi';
                searchRegex = new RegExp(escapedQuery, flags);
            }

            return text.replace(searchRegex, (match) => {
                return `${this.options.highlightMarker}${match}${this.options.highlightMarker}`;
            });

        } catch (error) {
            // If highlighting fails, return original text
            return text;
        }
    }

    /**
     * Extract section heading for a match
     */
    extractSection(content, matchIndex) {
        const lines = content.split('\n');
        let currentLineIndex = 0;
        let charCount = 0;

        // Find which line the match is on
        for (let i = 0; i < lines.length; i++) {
            if (charCount + lines[i].length >= matchIndex) {
                currentLineIndex = i;
                break;
            }
            charCount += lines[i].length + 1; // +1 for newline
        }

        // Check if the current line is a heading
        const currentLine = lines[currentLineIndex].trim();
        if (currentLine.startsWith('#')) {
            return currentLine.replace(/^#+\s*/, '');
        }

        // Look backwards for the most recent heading
        for (let i = currentLineIndex - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('#')) {
                return line.replace(/^#+\s*/, '');
            }
        }

        return 'Document';
    }

    /**
     * Rank search results by relevance score
     */
    rankSearchResults(results, query) {
        return results.sort((a, b) => {
            // Primary sort by relevance score
            if (b.relevanceScore !== a.relevanceScore) {
                return b.relevanceScore - a.relevanceScore;
            }

            // Secondary sort by number of matches
            if (b.totalMatches !== a.totalMatches) {
                return b.totalMatches - a.totalMatches;
            }

            // Tertiary sort by modification date (newer first)
            return new Date(b.documentFolder.modified) - new Date(a.documentFolder.modified);
        });
    }

    /**
     * Search in a specific category
     */
    async searchInCategory(query, category, options = {}) {
        return await this.searchDocuments(query, { ...options, category });
    }

    /**
     * Extract document metadata for indexing
     */
    async extractDocumentMetadata(folderPath) {
        return await this.errorHandler.wrapAsync(async () => {
            const metadata = await this.documentFolderManager.getDocumentFolderMetadata(folderPath);
            const content = await this.documentFolderManager.getDocumentContent(folderPath);

            // Extract additional metadata from content
            const lines = content.split('\n');
            const headings = lines.filter(line => line.trim().startsWith('#'));
            const wordCount = content.split(/\s+/).length;

            return {
                ...metadata,
                contentMetadata: {
                    wordCount,
                    lineCount: lines.length,
                    headingCount: headings.length,
                    headings: headings.slice(0, 5), // First 5 headings
                    firstLine: lines[0] || '',
                    lastModified: metadata.metadata.modified
                }
            };
        }, {
            operation: 'extractDocumentMetadata',
            folderPath
        });
    }

    /**
     * Parse search query for advanced features
     */
    parseSearchQuery(query) {
        // Simple query parsing - can be extended for advanced features
        const parsed = {
            originalQuery: query,
            terms: query.toLowerCase().split(/\s+/).filter(term => term.length > 0),
            isRegex: false,
            caseSensitive: false
        };

        // Check for regex indicators
        if (query.includes('*') || query.includes('?') || query.includes('[') || query.includes('^')) {
            parsed.isRegex = true;
        }

        return parsed;
    }

    /**
     * Format search results for display
     */
    formatSearchResults(results) {
        return results.map(result => ({
            path: result.documentFolder.path,
            name: result.documentFolder.name,
            category: result.documentFolder.category,
            preview: result.highlightedPreview,
            relevance: result.relevanceScore,
            matches: result.totalMatches,
            modified: result.documentFolder.modified,
            size: result.documentFolder.size,
            imageCount: result.documentFolder.imageCount
        }));
    }
}

/**
 * Factory function to create DocumentSearchEngine instance
 */
export function createDocumentSearchEngine(documentFolderManager, options = {}) {
    return new DocumentSearchEngine(documentFolderManager, options);
}

export default DocumentSearchEngine;