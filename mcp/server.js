#!/usr/bin/env node

/**
 * Enhanced Document Organization MCP Server
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

// Configuration
const SYNC_DIRS = [
  '/Users/moatasimfarooque/Downloads/Data_Science/Sync_iCloud',
  '/Users/moatasimfarooque/Downloads/Data_Science/Sync_GoogleDrive',
  '/Users/moatasimfarooque/Library/Mobile Documents/iCloud~md~obsidian/Documents/Sync',
  '/Users/moatasimfarooque/Library/CloudStorage/GoogleDrive-moatasim23android@gmail.com/My Drive/Sync'
];

const SCRIPT_DIR = '/Users/moatasimfarooque/Downloads/Programming/CascadeProjects/Drive_sync';
const PRIMARY_SYNC_DIR = SYNC_DIRS[0]; // Use iCloud as primary

class DocumentOrganizationMCP {
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

    this.setupHandlers();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_documents',
            description: 'Search through organized documents by content, category, or filename',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query (can be content, filename, or category)'
                },
                category: {
                  type: 'string',
                  description: 'Specific category to search in (optional)',
                  enum: [
                    'AI_ML', 'Physics', 'Neuroscience', 'Mathematics', 'Computer_Science', 'Biology',
                    'Agents', 'LLMs', 'Computer_Vision', 'NLP', 'Neural_Networks', 'Transformers',
                    'Reinforcement_Learning', 'MLOps', 'Tools_Frameworks', 'APIs', 'Kubernetes',
                    'Git', 'Documentation', 'Databases', 'Frontend', 'Backend', 'DevOps',
                    'Articles', 'Tutorials', 'Guides', 'News', 'Netclips', 'Daily_Notes',
                    'Literature_Notes', 'Meeting_Notes', 'Ideas', 'Untitled', 'Projects', 'Data'
                  ]
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return (default: 10)',
                  default: 10
                }
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
                file_path: {
                  type: 'string',
                  description: 'Relative path to the document from sync directory'
                }
              },
              required: ['file_path']
            }
          },
          {
            name: 'organize_documents',
            description: 'Run the enhanced document organization system',
            inputSchema: {
              type: 'object',
              properties: {
                dry_run: {
                  type: 'boolean',
                  description: 'Whether to run in dry-run mode (no changes made)',
                  default: false
                },
                force: {
                  type: 'boolean',
                  description: 'Force organization even if there are sync inconsistencies',
                  default: false
                }
              }
            }
          },
          {
            name: 'sync_documents',
            description: 'Synchronize documents across all sync locations',
            inputSchema: {
              type: 'object',
              properties: {
                force: {
                  type: 'boolean',
                  description: 'Force sync even during quiet hours',
                  default: false
                }
              }
            }
          },
          {
            name: 'get_organization_stats',
            description: 'Get statistics about document organization and sync status',
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
            name: 'create_document',
            description: 'Create a new document in the appropriate category',
            inputSchema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Title of the document'
                },
                content: {
                  type: 'string',
                  description: 'Content of the document in markdown format'
                },
                category: {
                  type: 'string',
                  description: 'Category to place the document in (optional - will auto-categorize if not specified)'
                },
                auto_organize: {
                  type: 'boolean',
                  description: 'Whether to run auto-organization after creating the document',
                  default: true
                }
              },
              required: ['title', 'content']
            }
          }
        ]
      };
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = [];
      
      try {
        // Get all markdown files from primary sync directory
        const files = await this.getAllMarkdownFiles(PRIMARY_SYNC_DIR);
        
        for (const file of files) {
          const relativePath = path.relative(PRIMARY_SYNC_DIR, file);
          const category = this.getCategoryFromPath(relativePath);
          
          resources.push({
            uri: `file://${relativePath}`,
            name: path.basename(file, '.md'),
            description: `Document in ${category} category`,
            mimeType: 'text/markdown'
          });
        }
      } catch (error) {
        console.error('Error listing resources:', error);
      }

      return { resources };
    });

    // Read specific resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const filePath = request.params.uri.replace('file://', '');
      const fullPath = path.join(PRIMARY_SYNC_DIR, filePath);

      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        return {
          contents: [
            {
              uri: request.params.uri,
              mimeType: 'text/markdown',
              text: content
            }
          ]
        };
      } catch (error) {
        throw new Error(`Failed to read document: ${error.message}`);
      }
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'search_documents':
          return await this.searchDocuments(args.query, args.category, args.limit);

        case 'get_document_content':
          return await this.getDocumentContent(args.file_path);

        case 'organize_documents':
          return await this.organizeDocuments(args.dry_run, args.force);

        case 'sync_documents':
          return await this.syncDocuments(args.force);

        case 'get_organization_stats':
          return await this.getOrganizationStats();

        case 'list_categories':
          return await this.listCategories();

        case 'create_document':
          return await this.createDocument(args.title, args.content, args.category, args.auto_organize);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async getAllMarkdownFiles(dir) {
    const files = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const subFiles = await this.getAllMarkdownFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error);
    }
    
    return files;
  }

  getCategoryFromPath(filePath) {
    const parts = filePath.split(path.sep);
    if (parts.length > 1) {
      return parts[0].replace(/^[🎯🤖💻🌐📝📚🔬📊🗄️]\s*/, '');
    }
    return 'Uncategorized';
  }

  async searchDocuments(query, category = null, limit = 10) {
    const results = [];
    const searchTerm = query.toLowerCase();
    
    try {
      const files = await this.getAllMarkdownFiles(PRIMARY_SYNC_DIR);
      
      for (const file of files) {
        const relativePath = path.relative(PRIMARY_SYNC_DIR, file);
        const fileCategory = this.getCategoryFromPath(relativePath);
        
        // Filter by category if specified
        if (category && !fileCategory.toLowerCase().includes(category.toLowerCase())) {
          continue;
        }
        
        const fileName = path.basename(file, '.md');
        const content = await fs.readFile(file, 'utf-8');
        
        // Search in filename and content
        if (fileName.toLowerCase().includes(searchTerm) || 
            content.toLowerCase().includes(searchTerm)) {
          
          // Get content preview
          const preview = content.substring(0, 200).replace(/\n/g, ' ');
          
          results.push({
            file_path: relativePath,
            title: fileName,
            category: fileCategory,
            preview: preview,
            score: this.calculateRelevanceScore(searchTerm, fileName, content)
          });
        }
        
        if (results.length >= limit) break;
      }
      
      // Sort by relevance score
      results.sort((a, b) => b.score - a.score);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              query: query,
              category: category,
              results: results.slice(0, limit),
              total_found: results.length
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  calculateRelevanceScore(searchTerm, fileName, content) {
    let score = 0;
    
    // Higher score for title matches
    if (fileName.toLowerCase().includes(searchTerm)) {
      score += 10;
    }
    
    // Score based on content matches
    const contentLower = content.toLowerCase();
    const matches = (contentLower.match(new RegExp(searchTerm, 'g')) || []).length;
    score += matches;
    
    return score;
  }

  async getDocumentContent(filePath) {
    const fullPath = path.join(PRIMARY_SYNC_DIR, filePath);
    
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const stats = await fs.stat(fullPath);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              file_path: filePath,
              content: content,
              size: stats.size,
              modified: stats.mtime,
              category: this.getCategoryFromPath(filePath)
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get document content: ${error.message}`);
    }
  }

  async organizeDocuments(dryRun = false, force = false) {
    try {
      const command = dryRun ? 'dry-run' : 'run';
      const options = force ? '--force' : '';
      
      const result = execSync(
        `cd ${SCRIPT_DIR} && ./organize/organize_module.sh ${command} ${options}`,
        { encoding: 'utf-8', timeout: 300000 } // 5 minute timeout
      );
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              operation: dryRun ? 'dry_run' : 'organize',
              success: true,
              output: result,
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Organization failed: ${error.message}`);
    }
  }

  async syncDocuments(force = false) {
    try {
      const command = force ? 'sync --force' : 'sync';
      
      const result = execSync(
        `cd ${SCRIPT_DIR} && ./sync/sync_module.sh ${command}`,
        { encoding: 'utf-8', timeout: 600000 } // 10 minute timeout
      );
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              operation: 'sync',
              success: true,
              output: result,
              timestamp: new Date().toISOString()
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
      const result = execSync(
        `cd ${SCRIPT_DIR} && ./organize/organize_module.sh status`,
        { encoding: 'utf-8' }
      );
      
      // Get file counts by category
      const categories = await this.listCategories();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              system_status: result,
              categories: JSON.parse(categories.content[0].text),
              sync_locations: SYNC_DIRS,
              timestamp: new Date().toISOString()
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
      const categories = {};
      const files = await this.getAllMarkdownFiles(PRIMARY_SYNC_DIR);
      
      for (const file of files) {
        const relativePath = path.relative(PRIMARY_SYNC_DIR, file);
        const category = this.getCategoryFromPath(relativePath);
        
        if (!categories[category]) {
          categories[category] = {
            count: 0,
            files: []
          };
        }
        
        categories[category].count++;
        categories[category].files.push(path.basename(file, '.md'));
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              total_categories: Object.keys(categories).length,
              total_files: files.length,
              categories: categories
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to list categories: ${error.message}`);
    }
  }

  async createDocument(title, content, category = null, autoOrganize = true) {
    try {
      // Sanitize filename
      const filename = title.replace(/[^a-zA-Z0-9\s-_]/g, '').replace(/\s+/g, '_') + '.md';
      
      // Determine target directory
      let targetDir = PRIMARY_SYNC_DIR;
      if (category) {
        // Find the appropriate category directory
        const categoryDirs = [
          '📚 Research Papers', '🤖 AI & ML', '💻 Development',
          '🌐 Web Content', '📝 Notes & Drafts', '🔬 Projects',
          '📊 Data', '🗄️ Archives'
        ];
        
        for (const dir of categoryDirs) {
          const fullDirPath = path.join(PRIMARY_SYNC_DIR, dir);
          try {
            const subdirs = await fs.readdir(fullDirPath);
            if (subdirs.includes(category)) {
              targetDir = path.join(fullDirPath, category);
              break;
            }
          } catch (e) {
            // Directory doesn't exist, continue
          }
        }
      }
      
      const filePath = path.join(targetDir, filename);
      
      // Create the file
      await fs.writeFile(filePath, content, 'utf-8');
      
      let result = {
        file_created: path.relative(PRIMARY_SYNC_DIR, filePath),
        title: title,
        category: category || 'auto-detect',
        auto_organize: autoOrganize
      };
      
      // Run auto-organization if requested
      if (autoOrganize) {
        try {
          const organizeResult = execSync(
            `cd ${SCRIPT_DIR} && ./organize/organize_module.sh run`,
            { encoding: 'utf-8', timeout: 300000 }
          );
          result.organization_result = organizeResult;
        } catch (e) {
          result.organization_error = e.message;
        }
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to create document: ${error.message}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Enhanced Document Organization MCP Server running on stdio');
  }
}

// Start the server
const server = new DocumentOrganizationMCP();
server.run().catch(console.error);
