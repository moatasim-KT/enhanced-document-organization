#!/usr/bin/env node

/**
 * Simplified Enhanced Document Organization MCP Server
 * Provides AI assistants access to organized documents through Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

class DocumentOrganizationServer {
  constructor() {
    this.server = new Server(
      {
        name: 'enhanced-document-organization',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.projectRoot = process.env.PROJECT_ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
    this.syncHub = process.env.SYNC_HUB || path.join(process.env.HOME, 'Sync_Hub_New');

    this.setupToolHandlers();
    this.setupResourceHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_documents',
          description: 'Search through organized documents by content, category, or filename',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              category: { type: 'string', description: 'Specific category to search in' },
              limit: { type: 'number', description: 'Maximum results to return', default: 10 }
            },
            required: ['query']
          }
        },
        {
          name: 'get_document_content',
          description: 'Get the full content of a specific document',
          inputSchema: {
            type: 'object',
            properties: {
              file_path: { type: 'string', description: 'Relative path to the document' }
            },
            required: ['file_path']
          }
        },
        {
          name: 'create_document',
          description: 'Create a new document with automatic categorization',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Document title' },
              content: { type: 'string', description: 'Document content in markdown' },
              category: { type: 'string', description: 'Category (optional, auto-detected if not provided)' }
            },
            required: ['title', 'content']
          }
        },
        {
          name: 'organize_documents',
          description: 'Run the document organization system',
          inputSchema: {
            type: 'object',
            properties: {
              dry_run: { type: 'boolean', description: 'Preview changes without applying them', default: false }
            }
          }
        },
        {
          name: 'sync_documents',
          description: 'Synchronize documents across cloud services',
          inputSchema: {
            type: 'object',
            properties: {
              service: { type: 'string', description: 'Specific service to sync (icloud, gdrive, or all)', default: 'all' }
            }
          }
        },
        {
          name: 'get_organization_stats',
          description: 'Get statistics about document organization',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'list_categories',
          description: 'List all available document categories with file counts',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'get_system_status',
          description: 'Get system status and health information',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'analyze_content',
          description: 'Analyze content for duplicates and consolidation opportunities',
          inputSchema: {
            type: 'object',
            properties: {
              file_paths: { type: 'array', items: { type: 'string' }, description: 'Array of file paths to analyze' },
              similarity_threshold: { type: 'number', description: 'Similarity threshold (0-1)', default: 0.8 }
            },
            required: ['file_paths']
          }
        },
        {
          name: 'find_duplicates',
          description: 'Find duplicate content across files',
          inputSchema: {
            type: 'object',
            properties: {
              directory: { type: 'string', description: 'Directory to search for duplicates' },
              similarity_threshold: { type: 'number', description: 'Similarity threshold (0-1)', default: 0.8 }
            },
            required: ['directory']
          }
        },
        {
          name: 'consolidate_content',
          description: 'Consolidate similar content into unified documents',
          inputSchema: {
            type: 'object',
            properties: {
              topic: { type: 'string', description: 'Topic to consolidate' },
              file_paths: { type: 'array', items: { type: 'string' }, description: 'Files to consolidate' },
              strategy: { type: 'string', description: 'Consolidation strategy', enum: ['simple_merge', 'structured_consolidation', 'comprehensive_merge'], default: 'comprehensive_merge' },
              enhance_with_ai: { type: 'boolean', description: 'Use AI to enhance content', default: false }
            },
            required: ['topic', 'file_paths']
          }
        },
        {
          name: 'suggest_categories',
          description: 'Suggest new categories based on content analysis',
          inputSchema: {
            type: 'object',
            properties: {
              directory: { type: 'string', description: 'Directory to analyze for category suggestions' }
            },
            required: ['directory']
          }
        },
        {
          name: 'add_custom_category',
          description: 'Add a custom category to the system',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Category name' },
              icon: { type: 'string', description: 'Category icon/emoji' },
              description: { type: 'string', description: 'Category description' },
              keywords: { type: 'array', items: { type: 'string' }, description: 'Category keywords' },
              file_patterns: { type: 'array', items: { type: 'string' }, description: 'File patterns' },
              priority: { type: 'number', description: 'Category priority (1-10)', default: 5 }
            },
            required: ['name']
          }
        },
        {
          name: 'enhance_content',
          description: 'Enhance content using AI for better flow and readability',
          inputSchema: {
            type: 'object',
            properties: {
              content: { type: 'string', description: 'Content to enhance' },
              topic: { type: 'string', description: 'Content topic/subject' },
              enhancement_type: { type: 'string', description: 'Type of enhancement', enum: ['flow', 'structure', 'clarity', 'comprehensive'], default: 'comprehensive' }
            },
            required: ['content']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_documents':
            return await this.searchDocuments(args);
          case 'get_document_content':
            return await this.getDocumentContent(args);
          case 'create_document':
            return await this.createDocument(args);
          case 'organize_documents':
            return await this.organizeDocuments(args);
          case 'sync_documents':
            return await this.syncDocuments(args);
          case 'get_organization_stats':
            return await this.getOrganizationStats();
          case 'list_categories':
            return await this.listCategories();
          case 'get_system_status':
            return await this.getSystemStatus();
          case 'analyze_content':
            return await this.analyzeContent(args);
          case 'find_duplicates':
            return await this.findDuplicates(args);
          case 'consolidate_content':
            return await this.consolidateContent(args);
          case 'suggest_categories':
            return await this.suggestCategories(args);
          case 'add_custom_category':
            return await this.addCustomCategory(args);
          case 'enhance_content':
            return await this.enhanceContent(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  setupResourceHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: []
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => ({
      contents: [
        {
          uri: request.params.uri,
          mimeType: 'text/plain',
          text: `Resource not found: ${request.params.uri}`
        }
      ]
    }));
  }

  async searchDocuments(args) {
    const { query, category, limit = 10 } = args;

    try {
      // Use grep to search for content
      let searchPath = this.syncHub;
      if (category) {
        searchPath = path.join(this.syncHub, category);
      }

      const grepCommand = `find "${searchPath}" -type f -name "*.md" -o -name "*.txt" -o -name "*.doc*" | head -${limit} | xargs grep -l -i "${query}" 2>/dev/null || true`;
      const results = execSync(grepCommand, { encoding: 'utf8' }).trim();

      const files = results ? results.split('\n').filter(Boolean) : [];
      const searchResults = [];

      for (const file of files.slice(0, limit)) {
        try {
          const relativePath = path.relative(this.syncHub, file);
          const stats = await fs.stat(file);
          const content = await fs.readFile(file, 'utf8');
          const preview = content.substring(0, 200) + (content.length > 200 ? '...' : '');

          searchResults.push({
            path: relativePath,
            name: path.basename(file),
            category: path.dirname(relativePath),
            size: stats.size,
            modified: stats.mtime.toISOString(),
            preview
          });
        } catch (error) {
          console.error(`Error processing file ${file}:`, error);
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              query,
              total_results: searchResults.length,
              results: searchResults
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  async getDocumentContent(args) {
    const { file_path } = args;

    try {
      const fullPath = path.join(this.syncHub, file_path);
      const content = await fs.readFile(fullPath, 'utf8');
      const stats = await fs.stat(fullPath);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              path: file_path,
              name: path.basename(file_path),
              size: stats.size,
              modified: stats.mtime.toISOString(),
              content
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to read document: ${error.message}`);
    }
  }

  async createDocument(args) {
    const { title, content, category } = args;

    try {
      // Determine category if not provided
      let targetCategory = category;
      if (!targetCategory) {
        // Simple category detection based on content
        const contentLower = `${title} ${content}`.toLowerCase();
        if (contentLower.includes('ai') || contentLower.includes('machine learning') || contentLower.includes('neural')) {
          targetCategory = '🤖 AI & ML';
        } else if (contentLower.includes('research') || contentLower.includes('paper') || contentLower.includes('study')) {
          targetCategory = '📚 Research Papers';
        } else if (contentLower.includes('code') || contentLower.includes('programming') || contentLower.includes('api')) {
          targetCategory = '💻 Development';
        } else if (contentLower.includes('article') || contentLower.includes('tutorial') || contentLower.includes('guide')) {
          targetCategory = '🌐 Web Content';
        } else {
          targetCategory = '📝 Notes & Drafts';
        }
      }

      // Create category directory if it doesn't exist
      const categoryPath = path.join(this.syncHub, targetCategory);
      await fs.mkdir(categoryPath, { recursive: true });

      // Create file
      const fileName = `${title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.md`;
      const filePath = path.join(categoryPath, fileName);

      const fileContent = `# ${title}\n\n${content}\n\n---\n*Created: ${new Date().toISOString()}*\n`;
      await fs.writeFile(filePath, fileContent);

      const relativePath = path.relative(this.syncHub, filePath);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              path: relativePath,
              category: targetCategory,
              message: `Document created successfully in ${targetCategory}`
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to create document: ${error.message}`);
    }
  }

  async organizeDocuments(args) {
    const { dry_run = false } = args;

    try {
      const command = `cd "${this.projectRoot}" && ./organize/organize_module.sh ${dry_run ? 'dry-run' : 'run'}`;
      const output = execSync(command, { encoding: 'utf8' });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              dry_run,
              output: output.trim()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Organization failed: ${error.message}`);
    }
  }

  async syncDocuments(args) {
    const { service = 'all' } = args;

    try {
      const command = `cd "${this.projectRoot}" && ./src/sync/sync_module.sh ${service}`;
      const output = execSync(command, { encoding: 'utf8' });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              service,
              output: output.trim()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Sync failed: ${error.message}`);
    }
  }

  async getOrganizationStats() {
    try {
      const categories = ['🤖 AI & ML', '📚 Research Papers', '🌐 Web Content', '📝 Notes & Drafts', '💻 Development'];
      const stats = {};

      for (const category of categories) {
        const categoryPath = path.join(this.syncHub, category);
        try {
          const files = await fs.readdir(categoryPath);
          stats[category] = files.filter(f => !f.startsWith('.')).length;
        } catch (error) {
          stats[category] = 0;
        }
      }

      // Count uncategorized files
      try {
        const allFiles = await fs.readdir(this.syncHub);
        const uncategorized = allFiles.filter(f =>
          !f.startsWith('.') &&
          !categories.includes(f) &&
          (f.endsWith('.md') || f.endsWith('.txt') || f.endsWith('.doc') || f.endsWith('.docx'))
        );
        stats['Uncategorized'] = uncategorized.length;
      } catch (error) {
        stats['Uncategorized'] = 0;
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sync_hub: this.syncHub,
              categories: stats,
              total_files: Object.values(stats).reduce((a, b) => a + b, 0),
              last_updated: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get stats: ${error.message}`);
    }
  }

  async listCategories() {
    try {
      const categories = ['🤖 AI & ML', '📚 Research Papers', '🌐 Web Content', '📝 Notes & Drafts', '💻 Development'];
      const categoryInfo = [];

      for (const category of categories) {
        const categoryPath = path.join(this.syncHub, category);
        try {
          const files = await fs.readdir(categoryPath);
          const fileCount = files.filter(f => !f.startsWith('.')).length;
          categoryInfo.push({
            name: category,
            path: category,
            file_count: fileCount,
            exists: true
          });
        } catch (error) {
          categoryInfo.push({
            name: category,
            path: category,
            file_count: 0,
            exists: false
          });
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              categories: categoryInfo,
              total_categories: categoryInfo.length
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to list categories: ${error.message}`);
    }
  }

  async getSystemStatus() {
    try {
      const command = `cd "${this.projectRoot}" && ./drive_sync.sh status`;
      const output = execSync(command, { encoding: 'utf8' });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              system_status: 'running',
              status_output: output.trim(),
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get system status: ${error.message}`);
    }
  }

  // New Advanced Content Analysis Methods

  async analyzeContent(args) {
    try {
      const { file_paths, similarity_threshold = 0.8 } = args;

      // Import the ContentAnalyzer dynamically
      const { ContentAnalyzer } = await import(path.join(this.projectRoot, 'organize', 'content_analyzer.js'));
      const analyzer = new ContentAnalyzer({ similarityThreshold: similarity_threshold });

      const results = new Map();

      for (const filePath of file_paths) {
        const fullPath = path.resolve(filePath);
        const analysis = await analyzer.analyzeContent(fullPath);
        if (analysis) {
          results.set(filePath, analysis);
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              analysis_results: Object.fromEntries(results),
              files_analyzed: file_paths.length,
              successful_analyses: results.size,
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Content analysis failed: ${error.message}`);
    }
  }

  async findDuplicates(args) {
    try {
      const { directory, similarity_threshold = 0.8 } = args;

      // Get all files in directory
      const files = [];
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && !entry.name.startsWith('.')) {
          files.push(path.join(directory, entry.name));
        }
      }

      // Import and use ContentAnalyzer
      const { ContentAnalyzer } = await import(path.join(this.projectRoot, 'organize', 'content_analyzer.js'));
      const analyzer = new ContentAnalyzer({ similarityThreshold: similarity_threshold });

      const duplicates = await analyzer.findDuplicates(files);
      const duplicateGroups = Array.from(duplicates.entries()).map(([key, group]) => ({
        key,
        type: group.type,
        similarity: group.similarity,
        files: group.files.map(f => f.filePath),
        recommended_action: group.recommendedAction
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              duplicate_groups: duplicateGroups,
              total_files_scanned: files.length,
              duplicate_groups_found: duplicateGroups.length,
              exact_duplicates: duplicateGroups.filter(g => g.type === 'exact').length,
              similar_content: duplicateGroups.filter(g => g.type === 'similar').length,
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Duplicate detection failed: ${error.message}`);
    }
  }

  async consolidateContent(args) {
    try {
      const { topic, file_paths, strategy = 'comprehensive_merge', enhance_with_ai = false } = args;

      // Import ContentConsolidator
      const { ContentConsolidator } = await import(path.join(this.projectRoot, 'organize', 'content_consolidator.js'));
      const consolidator = new ContentConsolidator({
        projectRoot: this.projectRoot,
        enhanceContent: enhance_with_ai,
        aiService: enhance_with_ai ? 'local' : 'none'
      });

      // Create consolidation candidate object
      const consolidationCandidate = {
        topic,
        files: file_paths.map(filePath => ({
          filePath,
          analysis: { metadata: { suggestedTitle: path.basename(filePath, path.extname(filePath)) } }
        })),
        recommendedTitle: `${topic} - Consolidated`,
        consolidationStrategy: strategy
      };

      const result = await consolidator.consolidateDocuments(consolidationCandidate);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              consolidation_result: {
                success: result.success,
                target_folder: result.targetFolder,
                consolidated_document: result.consolidatedDocument,
                original_files: result.originalFiles,
                strategy_used: result.consolidationStrategy
              },
              topic,
              files_consolidated: file_paths.length,
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Content consolidation failed: ${error.message}`);
    }
  }

  async suggestCategories(args) {
    try {
      const { directory } = args;

      // Import CategoryManager
      const { CategoryManager } = await import(path.join(this.projectRoot, 'src', 'organize', 'category_manager.js'));
      const manager = new CategoryManager({
        configPath: path.join(this.projectRoot, 'organize_config.conf'),
        projectRoot: this.projectRoot
      });
      await manager.initialize();

      // Import ContentAnalyzer
      const { ContentAnalyzer } = await import(path.join(this.projectRoot, 'organize', 'content_analyzer.js'));
      const analyzer = new ContentAnalyzer();

      // Analyze files for poorly matched content
      const allFiles = [];
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && !entry.name.startsWith('.')) {
          const filePath = path.join(directory, entry.name);
          const analysis = await analyzer.analyzeContent(filePath);
          if (analysis) {
            const match = manager.findBestCategoryMatch(analysis);
            allFiles.push({ filePath, analysis, match });
          }
        }
      }

      const poorlyMatched = allFiles.filter(f => f.match.confidence < 0.5);

      let suggestion = null;
      if (poorlyMatched.length >= 3) {
        suggestion = await manager.suggestCategory(poorlyMatched[0].analysis, poorlyMatched);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              category_suggestion: suggestion,
              files_analyzed: allFiles.length,
              poorly_categorized: poorlyMatched.length,
              suggestion_available: suggestion !== null,
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Category suggestion failed: ${error.message}`);
    }
  }

  async addCustomCategory(args) {
    try {
      const { name, icon = '📁', description = '', keywords = [], file_patterns = [], priority = 5 } = args;

      // Import CategoryManager
      const { CategoryManager } = await import(path.join(this.projectRoot, 'src', 'organize', 'category_manager.js'));
      const manager = new CategoryManager({
        configPath: path.join(this.projectRoot, 'organize_config.conf'),
        projectRoot: this.projectRoot
      });
      await manager.initialize();

      const categoryData = {
        name,
        icon,
        description,
        keywords,
        filePatterns: file_patterns,
        priority
      };

      const newCategory = await manager.addCustomCategory(categoryData);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              category_added: newCategory,
              success: true,
              message: `Custom category "${name}" added successfully`,
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to add custom category: ${error.message}`);
    }
  }

  async enhanceContent(args) {
    try {
      const { content, topic = 'General', enhancement_type = 'comprehensive' } = args;

      // Import ContentConsolidator for AI enhancement
      const { ContentConsolidator } = await import(path.join(this.projectRoot, 'organize', 'content_consolidator.js'));
      const consolidator = new ContentConsolidator({
        projectRoot: this.projectRoot,
        enhanceContent: true,
        aiService: 'local'
      });

      const enhancedContent = await consolidator.enhanceContentWithAI(content, topic);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              original_content: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
              enhanced_content: enhancedContent,
              topic,
              enhancement_type,
              success: enhancedContent !== content,
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Content enhancement failed: ${error.message}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Enhanced Document Organization MCP Server running on stdio');
  }
}

const server = new DocumentOrganizationServer();
server.run().catch(console.error);
