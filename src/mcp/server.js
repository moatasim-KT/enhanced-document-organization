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
import os from 'os';
import { createErrorHandler, ErrorTypes, EnhancedError } from '../organize/error_handler.js';
import { ContentConsolidator } from '../organize/content_consolidator.js';
// Dynamic imports will be handled by ModuleLoader

export class DocumentOrganizationServer {
  constructor() {
    this.server = new Server(
      {
        name: 'enhanced-document-organization',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    // Initialize with fallback values
    this.projectRoot = this.detectProjectRoot();
    this.syncHub = path.join(os.homedir(), 'Sync_Hub_New'); // Default fallback
    this.configLoaded = false;
    this.modulesLoaded = false;
    this.modules = {};
    this.validationPassed = false;

    // Initialize enhanced error handler
    this.errorHandler = createErrorHandler('MCPServer', {
      projectRoot: this.projectRoot,
      enableConsoleLogging: process.env.NODE_ENV !== 'production'
    });

    // Bind legacy log methods for backward compatibility
    this.logError = this.errorHandler.logError.bind(this.errorHandler);
    this.logWarn = this.errorHandler.logWarn.bind(this.errorHandler);
    this.logInfo = this.errorHandler.logInfo.bind(this.errorHandler);
    this.logDebug = this.errorHandler.logDebug.bind(this.errorHandler);

    // Initialize paths and modules asynchronously
    this.initializePaths().then(async () => {
      await this.runStartupValidation();
      await this.loadModules();
      this.setupToolHandlers();
      this.setupResourceHandlers();
      await this.logInfo('MCP Server initialization completed successfully');
    }).catch(async (error) => {
      const errorInfo = await this.errorHandler.handleError(error, {
        operation: 'serverInitialization'
      });

      // Continue with fallback values if configuration fails
      this.setupToolHandlers();
      this.setupResourceHandlers();
      await this.logWarn('Server initialized with fallback configuration', {
        fallbackReason: error.message,
        recoveryStrategy: errorInfo.strategy.action
      });
    });
  }

  /**
   * Detect project root by looking for config directory
   */
  detectProjectRoot() {
    // Start from current working directory and look for config directory
    let currentDir = process.cwd();
    const maxDepth = 5; // Prevent infinite loops

    for (let i = 0; i < maxDepth; i++) {
      const configPath = path.join(currentDir, 'config', 'config.env');
      try {
        // Check if config.env exists using existsSync instead of accessSync
        if (require('fs').existsSync(configPath)) {
          return currentDir;
        }
        throw new Error('Config file not found');
      } catch (error) {
        // Move up one directory
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
          // Reached filesystem root
          break;
        }
        currentDir = parentDir;
      }
    }

    // Fallback to current working directory
    return process.cwd();
  }

  /**
   * Run startup validation
   */
  async runStartupValidation() {
    return await this.errorHandler.wrapAsync(async () => {
      await this.logInfo('Running MCP server startup validation...');

      // Check if startup validator exists
      const validatorPath = path.join(this.projectRoot, 'src', 'organize', 'startup_validator.js');
      
      try {
        await fs.access(validatorPath);
        
        // Import and run validation
        const validatorModule = await import(`file://${validatorPath}`);
        const result = await validatorModule.runStartupValidation({
          verbose: false,
          skipFastFail: true,
          printReport: false
        });

        if (result.success) {
          this.validationPassed = true;
          await this.logInfo('Startup validation passed', {
            totalChecks: result.result.summary.totalChecks,
            warnings: result.result.warnings.length
          });
        } else {
          await this.logWarn('Startup validation failed, continuing with degraded functionality', {
            criticalFailures: result.result.criticalFailures.length,
            warnings: result.result.warnings.length
          });
        }

      } catch (error) {
        await this.logWarn('Could not run startup validation', {
          validatorPath,
          error: error.message
        });
      }
    }, {
      operation: 'runStartupValidation'
    });
  }

  /**
   * Load required modules with error handling
   */
  async loadModules() {
    return await this.errorHandler.wrapAsync(async () => {
      await this.logInfo('Loading required modules...');

      // Import ModuleLoader
      const moduleLoaderModule = await import('../organize/module_loader.js');
      const ModuleLoader = moduleLoaderModule.ModuleLoader;

      this.moduleLoader = new ModuleLoader({
        baseDir: path.join(this.projectRoot, 'src', 'organize'),
        retryAttempts: 2,
        retryDelay: 500
      });

      // Define modules to load
      const moduleSpecs = [
        {
          name: 'ContentAnalyzer',
          path: './content_analyzer.js',
          required: false
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
        },
        {
          name: 'BatchProcessor',
          path: './batch_processor.js',
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
        await this.logWarn('Some modules failed to load', {
          errors: errors.map(e => ({ name: e.name, error: e.error })),
          loadedCount: results.size,
          failedCount: errors.length
        });
      }

      this.modulesLoaded = true;
      await this.logInfo('Module loading completed', {
        loadedModules: Object.keys(this.modules),
        failedModules: errors.map(e => e.name),
        successRate: `${(results.size / (results.size + errors.length) * 100).toFixed(1)}%`
      });

    }, {
      operation: 'loadModules'
    }, {
      maxRetries: 2,
      retryDelay: 1000
    });
  }

  /**
   * Initialize paths from configuration with proper fallback behavior
   */
  async initializePaths() {
    return await this.errorHandler.wrapAsync(async () => {
      const configEnvPath = path.join(this.projectRoot, 'config', 'config.env');

      try {
        // Check if config file exists
        await fs.access(configEnvPath);

        const configEnvContent = await fs.readFile(configEnvPath, 'utf8');

        // Parse SYNC_HUB path
        const syncHubMatch = configEnvContent.match(/^SYNC_HUB="?(.*?)"?$/m);
        if (syncHubMatch && syncHubMatch[1]) {
          let syncHubPath = syncHubMatch[1].trim();
          // Replace ${HOME} with actual home directory
          syncHubPath = syncHubPath.replace(/\$\{HOME\}/g, os.homedir());
          this.syncHub = syncHubPath;
        }

        this.configLoaded = true;
        await this.logInfo('Configuration loaded successfully', {
          configPath: configEnvPath,
          syncHub: this.syncHub
        });

      } catch (error) {
        const errorInfo = await this.errorHandler.handleError(error, {
          operation: 'loadConfiguration',
          configPath: configEnvPath
        });

        await this.logWarn('Using fallback configuration', {
          configPath: configEnvPath,
          fallbackSyncHub: this.syncHub,
          reason: error.message
        });

        // Use fallback behavior
        this.configLoaded = false;
      }

      // Ensure sync hub directory exists
      try {
        await fs.mkdir(this.syncHub, { recursive: true });
        await this.logInfo('Sync hub directory ensured', {
          syncHub: this.syncHub
        });
      } catch (error) {
        throw new EnhancedError(
          `Failed to create sync hub directory: ${this.syncHub}`,
          ErrorTypes.PERMISSION_DENIED,
          {
            operation: 'createSyncHubDirectory',
            syncHub: this.syncHub
          },
          error
        );
      }
    }, {
      operation: 'initializePaths'
    });
  }



  /**
   * Get configuration status for debugging
   */
  getConfigurationStatus() {
    return {
      projectRoot: this.projectRoot,
      syncHub: this.syncHub,
      configLoaded: this.configLoaded,
      configPath: path.join(this.projectRoot, 'config', 'config.env'),
      logFilePath: this.logFilePath
    };
  }

  /**
   * Generate unique request ID for tracking
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize arguments for logging (remove sensitive data)
   */
  sanitizeArgsForLogging(args) {
    if (!args) return {};

    const sanitized = { ...args };

    // Remove or truncate large content fields
    if (sanitized.content && sanitized.content.length > 200) {
      sanitized.content = sanitized.content.substring(0, 200) + '... [truncated]';
    }

    // Remove sensitive patterns
    const sensitiveKeys = ['password', 'token', 'key', 'secret'];
    sensitiveKeys.forEach(key => {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Format error response according to MCP protocol
   */
  formatErrorResponse(error, toolName, requestId) {
    const errorInfo = {
      error: true,
      tool: toolName,
      requestId,
      message: error.message,
      timestamp: new Date().toISOString(),
      ...(error.code && { code: error.code }),
      ...(error.name && { type: error.name })
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorInfo, null, 2)
        }
      ],
      isError: true
    };
  }

  /**
   * Validate tool arguments against schema
   */
  validateToolArgs(toolName, args, schema) {
    const errors = [];

    if (!args) {
      if (schema.required && schema.required.length > 0) {
        errors.push(`Missing required arguments: ${schema.required.join(', ')}`);
      }
      return errors;
    }

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in args) || args[field] === null || args[field] === undefined) {
          errors.push(`Missing required argument: ${field}`);
        }
      }
    }

    // Basic type checking
    if (schema.properties) {
      for (const [field, fieldSchema] of Object.entries(schema.properties)) {
        if (field in args && args[field] !== null && args[field] !== undefined) {
          const value = args[field];
          const expectedType = fieldSchema.type;

          if (expectedType === 'string' && typeof value !== 'string') {
            errors.push(`Argument '${field}' must be a string, got ${typeof value}`);
          } else if (expectedType === 'number' && typeof value !== 'number') {
            errors.push(`Argument '${field}' must be a number, got ${typeof value}`);
          } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
            errors.push(`Argument '${field}' must be a boolean, got ${typeof value}`);
          } else if (expectedType === 'array' && !Array.isArray(value)) {
            errors.push(`Argument '${field}' must be an array, got ${typeof value}`);
          }
        }
      }
    }

    return errors;
  }

  /**
   * Wrap tool execution with comprehensive error handling
   */
  async executeToolSafely(toolName, toolFunction, args, schema = null) {
    const requestId = this.generateRequestId();

    return await this.errorHandler.wrapAsync(async () => {
      // Validate arguments if schema provided
      if (schema) {
        const validationErrors = this.validateToolArgs(toolName, args, schema);
        if (validationErrors.length > 0) {
          throw new EnhancedError(
            `Tool validation failed: ${validationErrors.join(', ')}`,
            ErrorTypes.VALIDATION_ERROR,
            {
              operation: 'executeToolSafely',
              toolName,
              validationErrors,
              requestId
            }
          );
        }
      }

      await this.logInfo(`Executing tool: ${toolName}`, {
        requestId,
        args: this.sanitizeArgsForLogging(args)
      });

      const result = await toolFunction.call(this, args);

      await this.logInfo(`Tool execution completed: ${toolName}`, {
        requestId,
        success: true
      });

      return result;
    }, {
      operation: 'executeToolSafely',
      toolName,
      requestId
    });
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
        },
        {
          name: 'delete_document',
          description: 'Delete a document from the system',
          inputSchema: {
            type: 'object',
            properties: {
              file_path: { type: 'string', description: 'Relative path to the document to delete' }
            },
            required: ['file_path']
          }
        },
        {
          name: 'rename_document',
          description: 'Rename a document',
          inputSchema: {
            type: 'object',
            properties: {
              old_file_path: { type: 'string', description: 'Current relative path to the document' },
              new_file_name: { type: 'string', description: 'New filename for the document' }
            },
            required: ['old_file_path', 'new_file_name']
          }
        },
        {
          name: 'move_document',
          description: 'Move a document to a different category',
          inputSchema: {
            type: 'object',
            properties: {
              file_path: { type: 'string', description: 'Current relative path to the document' },
              new_category: { type: 'string', description: 'Target category name' }
            },
            required: ['file_path', 'new_category']
          }
        },
        {
          name: 'list_files_in_category',
          description: 'List all files in a specific category',
          inputSchema: {
            type: 'object',
            properties: {
              category: { type: 'string', description: 'Category name to list files from' }
            },
            required: ['category']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const requestId = this.generateRequestId();

      // Enhanced logging with comprehensive context
      await this.logInfo(`Tool call initiated: ${name}`, {
        requestId,
        toolName: name,
        args: this.sanitizeArgsForLogging(args),
        timestamp: new Date().toISOString(),
        userAgent: request.meta?.userAgent || 'unknown'
      });

      // Wrap the entire tool execution in comprehensive error handling
      return await this.errorHandler.wrapAsync(async () => {
        // Validate tool name
        const validTools = [
          'search_documents', 'get_document_content', 'create_document', 'organize_documents',
          'sync_documents', 'get_organization_stats', 'list_categories', 'get_system_status',
          'analyze_content', 'find_duplicates', 'consolidate_content', 'suggest_categories',
          'add_custom_category', 'enhance_content', 'delete_document', 'rename_document',
          'move_document', 'list_files_in_category'
        ];

        if (!validTools.includes(name)) {
          throw this.errorHandler.createContextualError(
            `Unknown tool: ${name}`,
            ErrorTypes.VALIDATION_ERROR,
            {
              operation: 'toolCall',
              toolName: name,
              requestId,
              availableTools: validTools
            }
          );
        }

        let result;
        switch (name) {
          case 'search_documents':
            this.validateToolArguments('search_documents', args);
            result = await this.searchDocuments(args);
            break;
          case 'get_document_content':
            this.validateToolArguments('get_document_content', args);
            result = await this.getDocumentContent(args);
            break;
          case 'create_document':
            this.validateToolArguments('create_document', args);
            result = await this.createDocument(args);
            break;
          case 'organize_documents':
            result = await this.organizeDocuments(args);
            break;
          case 'sync_documents':
            result = await this.syncDocuments(args);
            break;
          case 'get_organization_stats':
            result = await this.getOrganizationStats();
            break;
          case 'list_categories':
            result = await this.listCategories();
            break;
          case 'get_system_status':
            result = await this.getSystemStatus();
            break;
          case 'analyze_content':
            result = await this.analyzeContent(args);
            break;
          case 'find_duplicates':
            result = await this.findDuplicates(args);
            break;
          case 'consolidate_content':
            result = await this.consolidateContent(args);
            break;
          case 'suggest_categories':
            result = await this.suggestCategories(args);
            break;
          case 'add_custom_category':
            result = await this.addCustomCategory(args);
            break;
          case 'enhance_content':
            result = await this.enhanceContent(args);
            break;
          case 'delete_document':
            result = await this.deleteDocument(args);
            break;
          case 'rename_document':
            result = await this.renameDocument(args);
            break;
          case 'move_document':
            result = await this.moveDocument(args);
            break;
          case 'list_files_in_category':
            result = await this.listFilesInCategory(args);
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        await this.logInfo(`Tool call completed successfully: ${name}`, {
          requestId,
          toolName: name,
          executionTime: Date.now() - parseInt(requestId.split('_')[1])
        });

        return result;
      }, {
        operation: 'toolCall',
        toolName: name,
        requestId,
        args: this.sanitizeArgsForLogging(args)
      }, {
        maxRetries: 1, // Most tools shouldn't be retried automatically
        retryDelay: 1000
      }).catch(async (error) => {
        // Final error handling with comprehensive logging
        await this.errorHandler.handleCriticalError(error, {
          operation: 'toolCall',
          toolName: name,
          requestId,
          args: this.sanitizeArgsForLogging(args)
        });

        return this.formatErrorResponse(error, name, requestId);
      });
    });
  }

  setupResourceHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      try {
        await this.logDebug('Listing resources requested');
        return { resources: [] };
      } catch (error) {
        await this.logError('Failed to list resources', {}, error);
        return { resources: [] };
      }
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        const uri = request.params.uri;
        await this.logDebug('Resource read requested', { uri });

        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: `Resource not found: ${uri}`
            }
          ]
        };
      } catch (error) {
        await this.logError('Failed to read resource', { uri: request.params.uri }, error);
        return {
          contents: [
            {
              uri: request.params.uri,
              mimeType: 'text/plain',
              text: `Error reading resource: ${error.message}`
            }
          ]
        };
      }
    });
  }

  async searchDocuments(args) {
    const { query, category, limit = 10, use_regex = false } = args;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Search query is required and must be a non-empty string');
    }

    try {
      let searchPath = this.syncHub;
      if (category) {
        searchPath = path.join(this.syncHub, category);

        // Verify category exists
        try {
          await fs.access(searchPath);
        } catch (error) {
          await this.logWarn(`Search category does not exist: ${category}`, { category, searchPath });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  query,
                  category,
                  total_results: 0,
                  results: [],
                  warning: `Category '${category}' does not exist`
                }, null, 2)
              }
            ]
          };
        }
      }

      const escapedQuery = query.replace(/'/g, "'\\''");
      const grepOptions = use_regex ? '-l -i -E' : '-l -i';

      const grepCommand = `find "${searchPath}" -type f -name "*.md" -o -name "*.txt" -o -name "*.doc*" | xargs grep ${grepOptions} '${escapedQuery}' 2>/dev/null || true`;

      let results;
      try {
        results = execSync(grepCommand, { encoding: 'utf8' }).trim();
      } catch (execError) {
        await this.logError('Search command execution failed', {
          command: grepCommand,
          searchPath,
          query
        }, execError);
        throw new Error(`Search execution failed: ${execError.message}`);
      }

      const files = results ? results.split('\n').filter(Boolean) : [];
      const searchResults = [];
      const processingErrors = [];

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
        } catch (fileError) {
          const errorMsg = `Error processing file ${file}`;
          await this.logError(errorMsg, { file }, fileError);
          processingErrors.push({ file, error: fileError.message });
        }
      }

      const response = {
        query,
        total_results: searchResults.length,
        results: searchResults,
        ...(category && { category }),
        ...(processingErrors.length > 0 && { processing_errors: processingErrors })
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ]
      };
    } catch (error) {
      await this.logError('Search operation failed', { query, category, limit }, error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Validate tool arguments with enhanced error handling
   */
  validateToolArguments(toolName, args, schema) {
    if (!args || typeof args !== 'object') {
      throw this.errorHandler.createContextualError(
        'Arguments must be provided as an object',
        ErrorTypes.VALIDATION_ERROR,
        { operation: 'validateArguments', toolName, argsType: typeof args }
      );
    }

    // Tool-specific validation
    switch (toolName) {
      case 'get_document_content':
        if (!args.file_path || typeof args.file_path !== 'string') {
          throw this.errorHandler.createContextualError(
            'file_path is required and must be a string',
            ErrorTypes.VALIDATION_ERROR,
            { operation: 'validateArguments', toolName, file_path: args.file_path }
          );
        }
        if (args.file_path.includes('..') || path.isAbsolute(args.file_path)) {
          throw this.errorHandler.createContextualError(
            'Invalid file path: relative paths only, no parent directory access',
            ErrorTypes.VALIDATION_ERROR,
            { operation: 'validateArguments', toolName, file_path: args.file_path }
          );
        }
        break;

      case 'search_documents':
        if (!args.query || typeof args.query !== 'string' || args.query.trim() === '') {
          throw this.errorHandler.createContextualError(
            'query is required and must be a non-empty string',
            ErrorTypes.VALIDATION_ERROR,
            { operation: 'validateArguments', toolName, query: args.query }
          );
        }
        break;

      case 'create_document':
        if (!args.title || typeof args.title !== 'string' || args.title.trim() === '') {
          throw this.errorHandler.createContextualError(
            'title is required and must be a non-empty string',
            ErrorTypes.VALIDATION_ERROR,
            { operation: 'validateArguments', toolName, title: args.title }
          );
        }
        if (!args.content || typeof args.content !== 'string') {
          throw this.errorHandler.createContextualError(
            'content is required and must be a string',
            ErrorTypes.VALIDATION_ERROR,
            { operation: 'validateArguments', toolName, content: typeof args.content }
          );
        }
        break;
    }
  }

  async getDocumentContent(args) {
    // Enhanced argument validation
    this.validateToolArguments('get_document_content', args);

    const { file_path } = args;

    try {
      const fullPath = path.join(this.syncHub, file_path);

      // Check if file exists and is accessible
      try {
        await fs.access(fullPath, fs.constants.R_OK);
      } catch (accessError) {
        if (accessError.code === 'ENOENT') {
          throw new Error(`Document not found: ${file_path}`);
        } else if (accessError.code === 'EACCES') {
          throw new Error(`Permission denied accessing document: ${file_path}`);
        } else {
          throw new Error(`Cannot access document: ${file_path} (${accessError.message})`);
        }
      }

      const [content, stats] = await Promise.all([
        fs.readFile(fullPath, 'utf8'),
        fs.stat(fullPath)
      ]);

      await this.logInfo('Document content retrieved successfully', {
        file_path,
        size: stats.size
      });

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
      await this.logError('Failed to read document', { file_path }, error);
      throw new Error(`Failed to read document: ${error.message}`);
    }
  }

  async createDocument(args) {
    const { title, content, category } = args;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      throw new Error('title is required and must be a non-empty string');
    }

    if (!content || typeof content !== 'string') {
      throw new Error('content is required and must be a string');
    }

    try {
      let targetCategory = category;
      // If category is not provided, default to 'Notes & Drafts'
      if (!targetCategory) {
        targetCategory = 'Notes & Drafts';
      }

      // Validate category name
      if (targetCategory.includes('..') || path.isAbsolute(targetCategory)) {
        throw new Error('Invalid category name: relative paths only, no parent directory access');
      }

      // Create category directory if it doesn't exist
      const categoryPath = path.join(this.syncHub, targetCategory);
      try {
        await fs.mkdir(categoryPath, { recursive: true });
      } catch (mkdirError) {
        await this.logError('Failed to create category directory', {
          categoryPath,
          targetCategory
        }, mkdirError);
        throw new Error(`Failed to create category directory: ${mkdirError.message}`);
      }

      // Create safe filename
      const fileName = `${title.replace(/[^a-zA-Z0-9\s\-_]/g, '').replace(/\s+/g, '_')}.md`;
      const filePath = path.join(categoryPath, fileName);

      // Check if file already exists
      try {
        await fs.access(filePath);
        throw new Error(`Document with title "${title}" already exists in category "${targetCategory}"`);
      } catch (accessError) {
        if (accessError.code !== 'ENOENT') {
          throw accessError; // Re-throw if it's not a "file doesn't exist" error
        }
        // File doesn't exist, which is what we want
      }

      const fileContent = `# ${title}\n\n${content}\n\n---\n*Created: ${new Date().toISOString()}*\n`;

      try {
        await fs.writeFile(filePath, fileContent, 'utf8');
      } catch (writeError) {
        await this.logError('Failed to write document file', {
          filePath,
          title,
          targetCategory
        }, writeError);
        throw new Error(`Failed to write document file: ${writeError.message}`);
      }

      const relativePath = path.relative(this.syncHub, filePath);

      await this.logInfo('Document created successfully', {
        title,
        category: targetCategory,
        path: relativePath
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              path: relativePath,
              category: targetCategory,
              filename: fileName,
              message: `Document created successfully in ${targetCategory}`
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      await this.logError('Document creation failed', { title, category }, error);
      throw new Error(`Failed to create document: ${error.message}`);
    }
  }

  async organizeDocuments(args) {
    const { dry_run = false } = args;

    try {
      const command = `cd "${this.projectRoot}" && ./src/organize/organize_module.sh ${dry_run ? 'dry-run' : 'run'}`;

      await this.logInfo('Starting document organization', {
        dry_run,
        command: command.replace(this.projectRoot, '[PROJECT_ROOT]')
      });

      let output;
      try {
        output = execSync(command, {
          encoding: 'utf8',
          timeout: 300000, // 5 minute timeout
          maxBuffer: 1024 * 1024 // 1MB buffer
        });
      } catch (execError) {
        await this.logError('Organization command execution failed', {
          command: command.replace(this.projectRoot, '[PROJECT_ROOT]'),
          dry_run
        }, execError);

        // Try to extract useful information from stderr
        const errorOutput = execError.stderr || execError.stdout || execError.message;
        throw new Error(`Organization script failed: ${errorOutput}`);
      }

      await this.logInfo('Document organization completed successfully', { dry_run });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              dry_run,
              output: output.trim(),
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      await this.logError('Document organization failed', { dry_run }, error);
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
      const { CategoryManager } = await import('../organize/category_manager.js');
      const manager = new CategoryManager({
        projectRoot: this.projectRoot,
        configPath: path.join(this.projectRoot, 'config', 'organize_config.conf')
      });
      await manager.initialize();

      const categoryStats = manager.getCategoryStats();
      const stats = {};
      categoryStats.forEach(stat => {
        stats[stat.name] = stat.fileCount || 0;
      });

      // Count uncategorized files
      try {
        const allEntries = await fs.readdir(this.syncHub, { withFileTypes: true });
        const uncategorizedFiles = allEntries.filter(entry =>
          entry.isFile() && !entry.name.startsWith('.')
        ).length;
        stats['Uncategorized'] = uncategorizedFiles;
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
      const { CategoryManager } = await import('../organize/category_manager.js');
      const manager = new CategoryManager({
        projectRoot: this.projectRoot,
        configPath: path.join(this.projectRoot, 'config', 'organize_config.conf')
      });
      await manager.initialize();

      const allCategories = manager.getAllCategories();
      const categoryStats = manager.getCategoryStats();
      const statsMap = new Map(categoryStats.map(s => [s.name, s]));

      const categoryInfo = allCategories.map(category => {
        const stats = statsMap.get(category.name);
        return {
          name: category.name,
          description: category.description,
          file_count: stats ? stats.fileCount : 0,
          exists: !!stats
        };
      });

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
      const configStatus = this.getConfigurationStatus();

      let driveStatus = null;
      try {
        const command = `cd "${this.projectRoot}" && ./drive_sync.sh status`;
        const output = execSync(command, { encoding: 'utf8' });
        driveStatus = output.trim();
      } catch (driveError) {
        driveStatus = `Drive sync status unavailable: ${driveError.message}`;
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              system_status: 'running',
              configuration: configStatus,
              drive_sync_status: driveStatus,
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get system status: ${error.message}. See server logs for details.`);
    }
  }

  // New Advanced Content Analysis Methods

  async analyzeContent(args) {
    try {
      const { file_paths, similarity_threshold = 0.8 } = args;

      // Import the ContentAnalyzer dynamically
      const { ContentAnalyzer } = await import('../organize/content_analyzer.js');
      const analyzer = new ContentAnalyzer({ similarityThreshold: similarity_threshold });

      const results = new Map();

      for (const filePath of file_paths) {
        const fullPath = path.join(this.syncHub, filePath);
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

      const fullDirectoryPath = path.join(this.syncHub, directory);

      // Get all files in directory
      const files = [];
      const entries = await fs.readdir(fullDirectoryPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && !entry.name.startsWith('.')) {
          files.push(path.join(fullDirectoryPath, entry.name));
        }
      }

      // Import and use ContentAnalyzer
      const { ContentAnalyzer } = await import('../organize/content_analyzer.js');
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

      // Use BatchProcessor if available, otherwise fallback to direct imports
      if (this.modules.BatchProcessor) {
        const processor = new this.modules.BatchProcessor.default({
          projectRoot: this.projectRoot
        });

        const consolidationCandidate = {
          topic,
          files: file_paths.map(filePath => ({
            filePath: path.join(this.syncHub, filePath),
            analysis: {
              topics: [topic],
              metadata: {
                suggestedTitle: path.basename(filePath, path.extname(filePath)),
                originalFilename: path.basename(filePath)
              }
            }
          })),
          recommendedTitle: `${topic} - Consolidated`,
          consolidationStrategy: strategy,
          avgSimilarity: 0.8
        };

        const result = await processor.consolidateContent(consolidationCandidate, {
          syncHubPath: this.syncHub,
          enhanceContent: enhance_with_ai
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                consolidation_result: {
                  success: result.success,
                  target_folder: result.targetFolder,
                  consolidated_document: result.consolidatedDocument,
                  original_files: file_paths,
                  strategy_used: result.consolidationStrategy
                },
                topic,
                files_consolidated: file_paths.length,
                timestamp: new Date().toISOString()
              }, null, 2)
            }
          ]
        };
      }

      // Fallback to direct module imports with error handling
      let ContentAnalyzer, ContentConsolidator;

      try {
        if (this.modules.ContentAnalyzer) {
          ContentAnalyzer = this.modules.ContentAnalyzer.ContentAnalyzer;
        } else {
          const module = await this.moduleLoader.safeImport('../organize/content_analyzer.js', { required: false });
          ContentAnalyzer = module?.ContentAnalyzer;
        }

        if (this.modules.ContentConsolidator) {
          ContentConsolidator = this.modules.ContentConsolidator.ContentConsolidator;
        } else {
          const module = await this.moduleLoader.safeImport('../organize/content_consolidator.js', { required: false });
          ContentConsolidator = module?.ContentConsolidator;
        }
      } catch (importError) {
        await this.logError('Failed to import required modules for consolidation', {}, importError);
        throw new Error('Content consolidation modules not available');
      }

      if (!ContentAnalyzer || !ContentConsolidator) {
        throw new Error('Required modules for content consolidation are not available');
      }

      const analyzer = new ContentAnalyzer();
      const analyzedFiles = [];

      for (const filePath of file_paths) {
        const fullPath = path.join(this.syncHub, filePath);

        try {
          // Check if file exists first
          await fs.access(fullPath);
          const analysis = await analyzer.analyzeContent(fullPath);
          if (analysis) {
            analyzedFiles.push({
              filePath: fullPath, // Use full path for consolidator
              analysis
            });
          } else {
            // Create minimal analysis if analyzer fails
            const content = await fs.readFile(fullPath, 'utf8');
            analyzedFiles.push({
              filePath: fullPath, // Use full path for consolidator
              analysis: {
                metadata: {
                  suggestedTitle: path.basename(filePath, path.extname(filePath)),
                  wordCount: content.split(/\s+/).length,
                  readingTime: Math.ceil(content.split(/\s+/).length / 200)
                },
                content: content
              }
            });
          }
        } catch (fileError) {
          await this.logError(`Failed to read file for consolidation: ${filePath}`, { filePath }, fileError);
          // Skip files that can't be read
          continue;
        }
      }

      if (analyzedFiles.length === 0) {
        throw new Error('No valid files found to consolidate');
      }

      const consolidator = new ContentConsolidator({
        projectRoot: this.projectRoot,
        syncHubPath: this.syncHub, // Use configured sync hub path
        enhanceContent: enhance_with_ai,
        aiService: enhance_with_ai ? 'local' : 'none'
      });

      // Create consolidation candidate object with real analysis
      const consolidationCandidate = {
        topic,
        files: analyzedFiles,
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
                original_files: file_paths, // Use original relative paths
                strategy_used: result.consolidationStrategy
              },
              topic,
              files_consolidated: analyzedFiles.length,
              files_requested: file_paths.length,
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
      const fullDirectoryPath = path.join(this.syncHub, directory);

      // Check if directory exists
      try {
        await fs.access(fullDirectoryPath);
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                category_suggestion: null,
                files_analyzed: 0,
                poorly_categorized: 0,
                suggestion_available: false,
                error: `Directory '${directory}' does not exist`,
                timestamp: new Date().toISOString()
              }, null, 2)
            }
          ]
        };
      }

      // Import CategoryManager
      const { CategoryManager } = await import('../organize/category_manager.js');
      const manager = new CategoryManager({
        configPath: path.join(this.projectRoot, 'config', 'organize_config.conf'),
        projectRoot: this.projectRoot
      });
      await manager.initialize();

      // Import ContentAnalyzer
      const { ContentAnalyzer } = await import('../organize/content_analyzer.js');
      const analyzer = new ContentAnalyzer();

      // Analyze files for poorly matched content
      const allFiles = [];
      const entries = await fs.readdir(fullDirectoryPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && !entry.name.startsWith('.')) {
          const filePath = path.join(fullDirectoryPath, entry.name);
          try {
            const analysis = await analyzer.analyzeContent(filePath);
            if (analysis) {
              const match = manager.findBestCategoryMatch(analysis);
              allFiles.push({ filePath, analysis, match });
            }
          } catch (fileError) {
            await this.logError(`Error analyzing file for category suggestion: ${entry.name}`, {
              fileName: entry.name,
              directory
            }, fileError);
            continue;
          }
        }
      }

      const poorlyMatched = allFiles.filter(f => f.match && f.match.confidence < 0.5);

      let suggestion = null;
      if (poorlyMatched.length >= 3) {
        try {
          suggestion = await manager.suggestCategory(poorlyMatched[0].analysis, poorlyMatched);
        } catch (suggestionError) {
          await this.logError('Error generating category suggestion', {
            directory,
            poorlyMatchedCount: poorlyMatched.length
          }, suggestionError);
        }
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
              directory: directory,
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
      const { CategoryManager } = await import('../organize/category_manager.js');
      const manager = new CategoryManager({
        configPath: path.join(this.projectRoot, 'config', 'organize_config.conf'),
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


      const consolidator = new ContentConsolidator({
        projectRoot: this.projectRoot,
        syncHubPath: this.syncHub, // Use configured sync hub path
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

  async deleteDocument(args) {
    const { file_path } = args;
    try {
      const fullPath = path.join(this.syncHub, file_path);
      await fs.unlink(fullPath);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Document ${file_path} deleted successfully.`
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to delete document ${file_path}: ${error.message}`);
    }
  }

  async renameDocument(args) {
    const { old_file_path, new_file_name } = args;
    try {
      const oldFullPath = path.join(this.syncHub, old_file_path);
      const newFullPath = path.join(path.dirname(oldFullPath), new_file_name);
      await fs.rename(oldFullPath, newFullPath);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              old_path: old_file_path,
              new_path: path.relative(this.syncHub, newFullPath),
              message: `Document ${old_file_path} renamed to ${new_file_name} successfully.`
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to rename document ${old_file_path} to ${new_file_name}: ${error.message}`);
    }
  }

  async moveDocument(args) {
    const { file_path, new_category } = args;
    try {
      const oldFullPath = path.join(this.syncHub, file_path);
      const newCategoryPath = path.join(this.syncHub, new_category);
      await fs.mkdir(newCategoryPath, { recursive: true }); // Ensure target category exists
      const newFullPath = path.join(newCategoryPath, path.basename(file_path));
      await fs.rename(oldFullPath, newFullPath);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              old_path: file_path,
              new_path: path.relative(this.syncHub, newFullPath),
              message: `Document ${file_path} moved to ${new_category} successfully.`
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to move document ${file_path} to ${new_category}: ${error.message}`);
    }
  }

  async listFilesInCategory(args) {
    const { category } = args;
    try {
      const categoryPath = path.join(this.syncHub, category);
      const files = await fs.readdir(categoryPath, { withFileTypes: true });
      const fileList = files
        .filter(dirent => dirent.isFile() && !dirent.name.startsWith('.'))
        .map(dirent => ({
          name: dirent.name,
          path: path.join(category, dirent.name)
        }));
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              category,
              file_count: fileList.length,
              files: fileList
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to list files in category ${category}: ${error.message}`);
    }
  }

  async run() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      await this.logInfo('Enhanced Document Organization MCP Server started successfully', {
        projectRoot: this.projectRoot,
        syncHub: this.syncHub,
        configLoaded: this.configLoaded
      });
    } catch (error) {
      await this.logError('Failed to start MCP Server', {}, error);
      throw error;
    }
  }
}

const docOrgServer = new DocumentOrganizationServer();

docOrgServer.run().catch(async (err) => {
  await docOrgServer.logError('Server startup error', {}, err);
  throw new Error(`Server startup failed: ${err.message}`);
});
