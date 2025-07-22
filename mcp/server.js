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
        version: '1.1.0',
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
                    'AI & ML', 'Research Papers', 'Web Content', 'Notes & Drafts', 'Development',
                    'Archives/Duplicates', 'Archives/Legacy', 'Archives/Quarantine'
                  ]
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return (default: 10)',
                  default: 10
                },
                context: {
                  type: 'string',
                  description: 'Optional: Previous conversation context for improved relevance'
                }
              },
              required: ['query']
            }
          },
          {
            name: 'summarize_document',
            description: 'Generate a summary of a specific document',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'Relative path to the document from sync directory'
                },
                length: {
                  type: 'string',
                  description: 'Desired summary length (e.g., "short", "medium", "long")',
                  enum: ['short', 'medium', 'long'],
                  default: 'medium'
                }
              },
              required: ['file_path']
            }
          },
          {
            name: 'batch_create_documents',
            description: 'Create multiple new documents in the appropriate categories',
            inputSchema: {
              type: 'object',
              properties: {
                documents: {
                  type: 'array',
                  description: 'Array of document objects to create',
                  items: {
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
                      }
                    },
                    required: ['title', 'content']
                  }
                },
                auto_organize: {
                  type: 'boolean',
                  description: 'Whether to run auto-organization after creating the documents',
                  default: true
                }
              },
              required: ['documents']
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
            name: 'get_system_metrics',
            description: 'Get detailed system performance metrics, usage patterns, sync efficiency, and error tracking',
            inputSchema: {
              type: 'object',
              properties: {
                time_range: {
                  type: 'string',
                  description: 'Optional: Time range for metrics (e.g., "24h", "7d", "30d")',
                  enum: ['24h', '7d', '30d'],
                  default: '24h'
                }
              }
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
          },
          {
            name: 'deduplicate_documents',
            description: 'Search for and remove duplicate documents based on content',
            inputSchema: {
              type: 'object',
              properties: {
                directory: {
                  type: 'string',
                  description: 'The directory to scan for duplicate documents'
                }
              },
              required: ['directory']
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
          return await this.searchDocuments(args.query, args.category, args.limit, args.context);

        case 'summarize_document':
          return await this.summarizeDocument(args.file_path, args.length);

        case 'batch_create_documents':
          return await this.batchCreateDocuments(args.documents, args.auto_organize);

        case 'get_document_content':
          return await this.getDocumentContent(args.file_path);

        case 'organize_documents':
          return await this.organizeDocuments(args.dry_run, args.force);

        case 'sync_documents':
          return await this.syncDocuments(args.force);

        case 'get_organization_stats':
          return await this.getOrganizationStats();

        case 'get_system_metrics':
          return await this.getSystemMetrics(args.time_range);

        case 'list_categories':
          return await this.listCategories();

        case 'create_document':
          return await this.createDocument(args.title, args.content, args.category, args.auto_organize);

        case 'deduplicate_documents':
          return await this.deduplicateDocuments(args.directory);

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

  async deduplicateDocuments(directory) {
    try {
      const result = execSync(
        `node ${SCRIPT_DIR}/organize/deduplicate_module.js ${directory}`,
        { encoding: 'utf-8', timeout: 600000 } // 10 minute timeout
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              operation: 'deduplicate_documents',
              success: true,
              output: result,
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Deduplication failed: ${error.message}`);
    }
  }

  getCategoryFromPath(filePath) {
    const parts = filePath.split(path.sep);
    if (parts.length > 1) {
      return parts[0].replace(/^[🎯🤖💻🌐📝📚🔬📊🗄️]\s*/, '');
    }
    return 'Uncategorized';
  }

  async searchDocuments(query, category = null, limit = 10, context = null) {
    const results = [];
    const searchTerm = query.toLowerCase();
    const contextTerms = context ? context.toLowerCase().split(/\s+/) : [];
    
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
            score: this.calculateRelevanceScore(searchTerm, fileName, content, contextTerms)
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
              context: context,
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

  calculateRelevanceScore(searchTerm, fileName, content, contextTerms) {
    let score = 0;
    
    // Higher score for title matches
    if (fileName.toLowerCase().includes(searchTerm)) {
      score += 10;
    }
    
    // Score based on content matches
    const contentLower = content.toLowerCase();
    const matches = (contentLower.match(new RegExp(searchTerm, 'g')) || []).length;
    score += matches;

    // Score based on context terms
    for (const term of contextTerms) {
      if (fileName.toLowerCase().includes(term)) {
        score += 5; // Boost for context in title
      }
      score += (contentLower.match(new RegExp(term, 'g')) || []).length; // Boost for context in content
    }
    
    return score;
  }

  async summarizeDocument(filePath, length = 'medium') {
    const fullPath = path.join(PRIMARY_SYNC_DIR, filePath);
    
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      let summary = '';

      // Basic summarization logic
      const sentences = content.split(/(?<=[.!?])\s+/); // Split by sentence-ending punctuation
      
      if (length === 'short') {
        summary = sentences.slice(0, Math.min(3, sentences.length)).join(' ');
      } else if (length === 'medium') {
        summary = sentences.slice(0, Math.min(7, sentences.length)).join(' ');
      } else { // long
        summary = sentences.slice(0, Math.min(15, sentences.length)).join(' ');
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              file_path: filePath,
              summary: summary,
              length: length
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to summarize document: ${error.message}`);
    }
  }

  async batchCreateDocuments(documents, autoOrganize = true) {
    const results = [];
    for (const doc of documents) {
      try {
        const createResult = await this.createDocument(doc.title, doc.content, doc.category, autoOrganize);
        results.push({
          title: doc.title,
          status: 'success',
          details: createResult.content[0].text // Assuming createDocument returns content in this format
        });
      } catch (error) {
        results.push({
          title: doc.title,
          status: 'failed',
          error: error.message
        });
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            operation: 'batch_create_documents',
            total_documents: documents.length,
            results: results
          }, null, 2)
        }
      ]
    };
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

  async getSystemMetrics(timeRange = '24h') {
    try {
      // Collect real performance metrics
      const os = require('os');
      const { execSync } = require('child_process');

      const cpuInfo = os.cpus();
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();

      const cpuUsage = 'N/A'; // More complex to get real-time CPU usage in Node.js without external libs
      const memoryUsage = `${((totalMemory - freeMemory) / totalMemory * 100).toFixed(2)}%`;

      let diskUsage = 'N/A';
      try {
        const dfOutput = execSync('df -h /', { encoding: 'utf-8' });
        const lines = dfOutput.trim().split('\n');
        if (lines.length > 1) {
          const diskLine = lines[1].split(/\s+/);
          diskUsage = diskLine[4]; // e.g., 80%
        }
      } catch (e) {
        console.error('Error getting disk usage:', e.message);
      }

      const performanceMetrics = {
        cpu_usage: cpuUsage,
        memory_usage: memoryUsage,
        disk_usage: diskUsage,
        network_traffic: 'N/A' // Requires more advanced monitoring
      };

      // Usage patterns (read from metrics_data.json)
      let usagePatterns = {
        documents_organized_last_24h: 0,
        sync_operations_last_24h: 0,
        most_active_category: 'N/A'
      };
      const metricsDataFile = path.join(SCRIPT_DIR, '.gemini', 'metrics_data.json');
      try {
        const metricsData = await fs.readFile(metricsDataFile, 'utf-8');
        const data = JSON.parse(metricsData);
        usagePatterns = data;
      } catch (e) {
        console.error('Error reading metrics_data.json:', e.message);
      }

      // Sync efficiency monitoring (using circuit_breaker_state.json)
      let syncEfficiency = {};
      try {
        const circuitBreakerState = await fs.readFile(path.join(SCRIPT_DIR, 'circuit_breaker_state.json'), 'utf-8');
        const state = JSON.parse(circuitBreakerState);
        syncEfficiency = {
          circuit_breaker_status: state.status,
          last_trip_time: state.lastTripTime || 'N/A',
          failure_count: state.failureCount || 0
        };
      } catch (e) {
        syncEfficiency.circuit_breaker_status = 'Unknown (file not found or invalid)';
      }

      // Error tracking and alerting (reading .gemini/logs)
      let errorTracking = {
        errors: 0,
        warnings: 0,
        recent_errors: []
      };
      const geminiLogDir = path.join(SCRIPT_DIR, '.gemini', 'logs');
      try {
        const logFiles = await fs.readdir(geminiLogDir);
        for (const file of logFiles) {
          const filePath = path.join(geminiLogDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          errorTracking.errors += (content.match(/ERROR/g) || []).length;
          errorTracking.warnings += (content.match(/WARNING/g) || []).length;
          // Add a simple way to get recent errors (last 5 lines of error logs)
          if (file.includes('errors')) {
            const lines = content.split('\n').filter(line => line.trim() !== '');
            errorTracking.recent_errors.push(...lines.slice(-5));
          }
        }
      } catch (e) {
        errorTracking.status = 'Log directory not found or accessible';
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              time_range: timeRange,
              performance_metrics: performanceMetrics,
              usage_patterns: usagePatterns,
              sync_efficiency: syncEfficiency,
              error_tracking: errorTracking,
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get system metrics: ${error.message}`);
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
      
      let targetDir = PRIMARY_SYNC_DIR;
      if (category) {
        targetDir = path.join(PRIMARY_SYNC_DIR, category);
        await fs.mkdir(targetDir, { recursive: true });
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
