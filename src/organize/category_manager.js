#!/usr/bin/env node

/**
 * Category Manager Module
 * Handles extensible category system with AI suggestions and user-defined categories
 */

import { promises as fs } from 'fs';
import path from 'path';

export class CategoryManager {
    constructor(options = {}) {
        this.configPath = options.configPath || path.join(this.projectRoot, 'config', 'organize_config.conf');
        this.projectRoot = options.projectRoot;
        this.categories = new Map();
        this.customCategories = new Map();
        this.categoryStats = new Map();
        this.initialized = false;
    }

    /**
     * Initialize category manager with configuration
     */
    async initialize() {
        if (this.initialized) return;

        await this.loadDefaultCategories();
        await this.loadCustomCategories();
        await this.updateCategoryStats();

        this.initialized = true;
    }

    /**
     * Load default categories
     */
    async loadDefaultCategories() {
        const defaultCategories = [
            {
                id: 'ai_ml',
                name: '🤖 AI & ML',
                icon: '🤖',
                description: 'Artificial Intelligence and Machine Learning content',
                keywords: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'neural', 'deep learning', 'tensorflow', 'pytorch', 'model', 'algorithm', 'data science'],
                filePatterns: ['*.ipynb', '*ai*', '*ml*', '*neural*', '*model*'],
                contentPatterns: [/machine\s+learning/i, /artificial\s+intelligence/i, /neural\s+network/i, /deep\s+learning/i],
                priority: 10,
                autoDetect: true,
                createdBy: 'system',
                createdAt: new Date().toISOString()
            },
            {
                id: 'research_papers',
                name: '📚 Research Papers',
                icon: '📚',
                description: 'Academic papers, studies, and research documents',
                keywords: ['research', 'paper', 'study', 'journal', 'arxiv', 'academic', 'publication', 'thesis', 'dissertation', 'analysis'],
                filePatterns: ['*.pdf', '*paper*', '*research*', '*study*', '*arxiv*'],
                contentPatterns: [/abstract/i, /methodology/i, /conclusion/i, /references/i, /citation/i],
                priority: 9,
                autoDetect: true,
                createdBy: 'system',
                createdAt: new Date().toISOString()
            },
            {
                id: 'web_content',
                name: '🌐 Web Content',
                icon: '🌐',
                description: 'Articles, tutorials, guides, and web resources',
                keywords: ['article', 'tutorial', 'guide', 'blog', 'web', 'how-to', 'walkthrough', 'tips', 'tricks', 'resource'],
                filePatterns: ['*.html', '*article*', '*tutorial*', '*guide*', '*blog*'],
                contentPatterns: [/tutorial/i, /guide/i, /how\s+to/i, /step\s+by\s+step/i],
                priority: 7,
                autoDetect: true,
                createdBy: 'system',
                createdAt: new Date().toISOString()
            },
            {
                id: 'notes_drafts',
                name: '📝 Notes & Drafts',
                icon: '📝',
                description: 'Personal notes, ideas, drafts, and meeting notes',
                keywords: ['note', 'notes', 'draft', 'idea', 'meeting', 'todo', 'brainstorm', 'thoughts', 'memo', 'reminder'],
                filePatterns: ['*note*', '*draft*', '*idea*', '*meeting*', '*todo*'],
                contentPatterns: [/note/i, /todo/i, /meeting/i, /draft/i, /idea/i],
                priority: 5,
                autoDetect: true,
                createdBy: 'system',
                createdAt: new Date().toISOString()
            },
            {
                id: 'development',
                name: '💻 Development',
                icon: '💻',
                description: 'Code, APIs, technical documentation, and development resources',
                keywords: ['code', 'api', 'development', 'programming', 'software', 'technical', 'documentation', 'framework', 'library', 'tool'],
                filePatterns: ['*.js', '*.py', '*.md', '*api*', '*code*', '*dev*'],
                contentPatterns: [/api/i, /code/i, /function/i, /class/i, /method/i, /```/],
                priority: 8,
                autoDetect: true,
                createdBy: 'system',
                createdAt: new Date().toISOString()
            }
        ];

        defaultCategories.forEach(category => {
            this.categories.set(category.id, category);
        });
    }

    /**
     * Load custom categories from configuration
     */
    async loadCustomCategories() {
        try {
            const configExists = await fs.access(this.configPath).then(() => true).catch(() => false);
            if (!configExists) {
                await this.saveCategoriesToConfig();
                return;
            }

            const configContent = await fs.readFile(this.configPath, 'utf-8');
            const customSection = this.extractCustomCategoriesFromConfig(configContent);

            if (customSection) {
                customSection.forEach(category => {
                    this.customCategories.set(category.id, category);
                    this.categories.set(category.id, category);
                });
            }
        } catch (error) {
            console.warn(`Failed to load custom categories: ${error.message}`);
        }
    }

    /**
     * Suggest new category based on content analysis
     */
    async suggestCategory(contentAnalysis, existingFiles = []) {
        const { topics, contentType, metadata } = contentAnalysis;

        // Check if content fits existing categories
        const bestMatch = this.findBestCategoryMatch(contentAnalysis);
        if (bestMatch.confidence > 0.7) {
            return null; // Existing category is good enough
        }

        // Analyze patterns in unmatched content
        const unmatchedContent = existingFiles.filter(f =>
            this.findBestCategoryMatch(f.analysis).confidence < 0.5
        );

        if (unmatchedContent.length < 3) {
            return null; // Not enough content to suggest new category
        }

        // Generate category suggestion
        const suggestion = this.generateCategorySuggestion(unmatchedContent);
        return suggestion;
    }

    /**
     * Add custom category
     */
    async addCustomCategory(categoryData) {
        const category = {
            id: this.generateCategoryId(categoryData.name),
            name: categoryData.name,
            icon: categoryData.icon || '📁',
            description: categoryData.description || '',
            keywords: categoryData.keywords || [],
            filePatterns: categoryData.filePatterns || [],
            contentPatterns: categoryData.contentPatterns || [],
            priority: categoryData.priority || 5,
            autoDetect: categoryData.autoDetect !== false,
            createdBy: 'user',
            createdAt: new Date().toISOString()
        };

        this.customCategories.set(category.id, category);
        this.categories.set(category.id, category);

        await this.saveCategoriesToConfig();
        await this.createCategoryFolder(category);

        console.log(`[INFO] Added custom category: ${category.name}`);
        return category;
    }

    /**
     * Find best matching category for content
     */
    findBestCategoryMatch(contentAnalysis) {
        let bestMatch = null;
        let bestScore = 0;

        for (const [id, category] of this.categories) {
            const score = this.calculateCategoryMatch(contentAnalysis, category);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = { categoryId: id, category, confidence: score };
            }
        }

        return bestMatch || { categoryId: 'notes_drafts', category: this.categories.get('notes_drafts'), confidence: 0 };
    }

    /**
     * Calculate how well content matches a category
     */
    calculateCategoryMatch(contentAnalysis, category) {
        let score = 0;
        const { topics, contentType, metadata, structure } = contentAnalysis;

        // Keyword matching
        const allText = [...topics, contentType, metadata.suggestedTitle || ''].join(' ').toLowerCase();
        const keywordMatches = category.keywords.filter(keyword =>
            allText.includes(keyword.toLowerCase())
        ).length;
        score += (keywordMatches / category.keywords.length) * 0.4;

        // File pattern matching
        const filename = metadata.originalFilename.toLowerCase();
        const patternMatches = category.filePatterns.filter(pattern => {
            const regex = new RegExp(pattern.replace('*', '.*'), 'i');
            return regex.test(filename);
        }).length;
        score += (patternMatches / Math.max(category.filePatterns.length, 1)) * 0.3;

        // Content pattern matching
        const content = contentAnalysis.content || '';
        const contentMatches = category.contentPatterns.filter(pattern =>
            pattern.test(content)
        ).length;
        score += (contentMatches / Math.max(category.contentPatterns.length, 1)) * 0.3;

        return Math.min(score, 1.0);
    }

    /**
     * Generate category suggestion based on content patterns
     */
    generateCategorySuggestion(unmatchedContent) {
        // Analyze common topics and patterns
        const topicFrequency = new Map();
        const commonKeywords = new Set();
        const commonPatterns = new Set();

        unmatchedContent.forEach(content => {
            content.analysis.topics.forEach(topic => {
                topicFrequency.set(topic, (topicFrequency.get(topic) || 0) + 1);
            });
        });

        // Find most frequent topics
        const topTopics = Array.from(topicFrequency.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([topic]) => topic);

        if (topTopics.length === 0) return null;

        const suggestedName = this.generateCategoryName(topTopics);
        const suggestedIcon = this.suggestCategoryIcon(topTopics);

        return {
            name: suggestedName,
            icon: suggestedIcon,
            description: `Auto-suggested category for ${topTopics.join(', ')} content`,
            keywords: topTopics,
            filePatterns: [`*${topTopics[0]}*`],
            contentPatterns: topTopics.map(topic => new RegExp(topic, 'i')),
            priority: 6,
            confidence: topicFrequency.get(topTopics[0]) / unmatchedContent.length,
            affectedFiles: unmatchedContent.length
        };
    }

    /**
     * Generate category name from topics
     */
    generateCategoryName(topics) {
        const mainTopic = topics[0];
        const formattedTopic = mainTopic.charAt(0).toUpperCase() + mainTopic.slice(1);
        return `📂 ${formattedTopic}`;
    }

    /**
     * Suggest appropriate icon for category
     */
    suggestCategoryIcon(topics) {
        const iconMap = {
            'finance': '💰',
            'health': '🏥',
            'travel': '✈️',
            'food': '🍽️',
            'sports': '⚽',
            'music': '🎵',
            'video': '🎬',
            'game': '🎮',
            'book': '📖',
            'photo': '📸',
            'design': '🎨',
            'business': '💼',
            'education': '🎓',
            'science': '🔬',
            'technology': '⚡',
            'communication': '💬',
            'project': '🚀',
            'tool': '🔧',
            'security': '🔒',
            'database': '🗄️'
        };

        for (const topic of topics) {
            if (iconMap[topic.toLowerCase()]) {
                return iconMap[topic.toLowerCase()];
            }
        }

        return '📂'; // Default icon
    }

    /**
     * Create category folder structure
     */
    async createCategoryFolder(category) {
        if (!this.projectRoot) return;

        const categoryPath = path.join(this.projectRoot, 'Sync_Hub_New', category.name);

        try {
            await fs.mkdir(categoryPath, { recursive: true });

            // Create category info file
            const infoContent = this.generateCategoryInfo(category);
            await fs.writeFile(path.join(categoryPath, '_category_info.md'), infoContent, 'utf-8');

            console.log(`[INFO] Created category folder: ${category.name}`);
        } catch (error) {
            console.warn(`Failed to create category folder: ${error.message}`);
        }
    }

    /**
     * Generate category information file
     */
    generateCategoryInfo(category) {
        return `# ${category.name}

${category.description}

## Category Details
- **ID**: ${category.id}
- **Icon**: ${category.icon}
- **Priority**: ${category.priority}
- **Auto-detect**: ${category.autoDetect}
- **Created by**: ${category.createdBy}
- **Created**: ${category.createdAt}

## Keywords
${category.keywords.map(k => `- ${k}`).join('\n')}

## File Patterns
${category.filePatterns.map(p => `- ${p}`).join('\n')}

---
*This file is automatically generated. Do not edit manually.*
`;
    }

    /**
     * Update category statistics
     */
    async updateCategoryStats() {
        if (!this.projectRoot) return;

        const syncHub = path.join(this.projectRoot, 'Sync_Hub_New');

        try {
            const entries = await fs.readdir(syncHub, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const categoryPath = path.join(syncHub, entry.name);
                    const files = await this.countFilesInCategory(categoryPath);

                    this.categoryStats.set(entry.name, {
                        name: entry.name,
                        fileCount: files.fileCount,
                        folderCount: files.folderCount,
                        totalSize: files.totalSize,
                        lastUpdated: new Date().toISOString()
                    });
                }
            }
        } catch (error) {
            console.warn(`Failed to update category stats: ${error.message}`);
        }
    }

    /**
     * Count files in category
     */
    async countFilesInCategory(categoryPath) {
        let fileCount = 0;
        let folderCount = 0;
        let totalSize = 0;

        try {
            const entries = await fs.readdir(categoryPath, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    folderCount++;
                    const subStats = await this.countFilesInCategory(path.join(categoryPath, entry.name));
                    fileCount += subStats.fileCount;
                    folderCount += subStats.folderCount;
                    totalSize += subStats.totalSize;
                } else {
                    fileCount++;
                    const filePath = path.join(categoryPath, entry.name);
                    const stats = await fs.stat(filePath);
                    totalSize += stats.size;
                }
            }
        } catch (error) {
            // Ignore errors for individual files
        }

        return { fileCount, folderCount, totalSize };
    }

    /**
     * Save categories to configuration file
     */
    async saveCategoriesToConfig() {
        try {
            let configContent = '';

            // Read existing config
            try {
                configContent = await fs.readFile(this.configPath, 'utf-8');
            } catch (error) {
                // File doesn't exist, create new
            }

            // Remove existing custom categories section
            configContent = configContent.replace(/# Custom Categories[\s\S]*?(?=\n#|\n$|$)/g, '');

            // Add custom categories section
            if (this.customCategories.size > 0) {
                configContent += '\n\n# Custom Categories\n';

                for (const [id, category] of this.customCategories) {
                    configContent += `\n[category.${id}]\n`;
                    configContent += `name = "${category.name}"\n`;
                    configContent += `icon = "${category.icon}"\n`;
                    configContent += `description = "${category.description}"\n`;
                    configContent += `keywords = ${JSON.stringify(category.keywords)}\n`;
                    configContent += `file_patterns = ${JSON.stringify(category.filePatterns)}\n`;
                    configContent += `priority = ${category.priority}\n`;
                    configContent += `auto_detect = ${category.autoDetect}\n`;
                    configContent += `created_by = "${category.createdBy}"\n`;
                    configContent += `created_at = "${category.createdAt}"\n`;
                }
            }

            await fs.writeFile(this.configPath, configContent, 'utf-8');
        } catch (error) {
            console.warn(`Failed to save categories to config: ${error.message}`);
        }
    }

    /**
     * Extract custom categories from config content
     */
    extractCustomCategoriesFromConfig(configContent) {
        const categories = [];
        const categoryPattern = /\[category\.(\w+)\]([\s\S]*?)(?=\n\[|\n#|$)/g;
        let match;

        while ((match = categoryPattern.exec(configContent)) !== null) {
            const [, id, content] = match;
            const category = this.parseCategory(id, content);
            if (category) {
                categories.push(category);
            }
        }

        return categories;
    }

    /**
     * Parse category from config content
     */
    parseCategory(id, content) {
        try {
            const lines = content.trim().split('\n');
            const category = { id };

            for (const line of lines) {
                const [key, ...valueParts] = line.split(' = ');
                const value = valueParts.join(' = ').replace(/^"|"$/g, '');

                switch (key.trim()) {
                    case 'name':
                        category.name = value;
                        break;
                    case 'icon':
                        category.icon = value;
                        break;
                    case 'description':
                        category.description = value;
                        break;
                    case 'keywords':
                        category.keywords = JSON.parse(value);
                        break;
                    case 'file_patterns':
                        category.filePatterns = JSON.parse(value);
                        break;
                    case 'priority':
                        category.priority = parseInt(value);
                        break;
                    case 'auto_detect':
                        category.autoDetect = value === 'true';
                        break;
                    case 'created_by':
                        category.createdBy = value;
                        break;
                    case 'created_at':
                        category.createdAt = value;
                        break;
                }
            }

            // Convert content patterns from strings to RegExp
            category.contentPatterns = category.keywords ?
                category.keywords.map(k => new RegExp(k, 'i')) : [];

            return category;
        } catch (error) {
            console.warn(`Failed to parse category ${id}: ${error.message}`);
            return null;
        }
    }

    /**
     * Utility functions
     */
    generateCategoryId(name) {
        return name
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '_')
            .replace(/-+/g, '_')
            .replace(/_+/g, '_')
            .trim('_');
    }

    getAllCategories() {
        return Array.from(this.categories.values());
    }

    getCategoryById(id) {
        return this.categories.get(id);
    }

    getCategoryStats() {
        return Array.from(this.categoryStats.values());
    }

    getCustomCategories() {
        return Array.from(this.customCategories.values());
    }
}

export default CategoryManager;
