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

import { promises as fs, existsSync } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';
import { createErrorHandler, ErrorTypes, EnhancedError } from '../organize/error_handler.js';

// Dynamic imports will be handled by ModuleLoader

export class DocumentOrganizationServer {
  constructor() {
    this.server = new Server(
      {
        name: 'enhanced-document-organization',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {}
        },
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

    // Register handlers immediately so MCP methods are always available
    this.setupToolHandlers();
    this.setupResourceHandlers();
    // Initialization is now handled by the async initialize() method
  }

  /**
   * Detect project root using robust detection logic
   * NEVER uses process.cwd() which can vary based on execution context
   */
  detectProjectRoot() {
    // Strategy 1: Use this file's location (most reliable)
    if (import.meta.url) {
      try {
        const currentFileDir = path.dirname(new URL(import.meta.url).pathname);
        // Navigate up from src/mcp to project root
        const potentialRoot = path.resolve(currentFileDir, '../../');
        if (this.isProjectRoot(potentialRoot)) {
          console.log(`[MCPServer] Detected project root via import.meta.url: ${potentialRoot}`);
          return potentialRoot;
        }
      } catch (error) {
        console.warn(`[MCPServer] import.meta.url detection failed: ${error.message}`);
      }
    }
    
    // Strategy 2: Known absolute path (most reliable fallback)
    const knownProjectPath = '/Users/moatasimfarooque/Downloads/Programming/CascadeProjects/Drive_sync';
    if (this.isProjectRoot(knownProjectPath)) {
      console.log(`[MCPServer] Using known absolute path: ${knownProjectPath}`);
      return knownProjectPath;
    }
    
    // Strategy 3: Comprehensive fallback strategies (NEVER allow system root)
    const fallbacks = [
      '/Users/moatasimfarooque/Downloads/Programming/CascadeProjects/Drive_sync',
      path.join(os.homedir(), 'Downloads/Programming/CascadeProjects/Drive_sync'),
      path.join(os.homedir(), 'Downloads/Drive_sync'),
      path.join(os.homedir(), 'Drive_sync')
    ];
    
    console.warn(`[MCPServer] All detection strategies failed, trying fallbacks...`);
    
    for (const fallback of fallbacks) {
      if (this.isProjectRoot(fallback)) {
        console.log(`[MCPServer] Using fallback: ${fallback}`);
        return fallback;
      }
    }
    
    // CRITICAL: Never return system root - use first known good path
    const safeFallback = fallbacks[0];
    console.error(`[MCPServer] CRITICAL: All fallbacks failed, using safe default: ${safeFallback}`);
    return safeFallback;
  }
  
  /**
   * Check if a directory is likely the project root
   */
  isProjectRoot(dirPath) {
    try {
      // Primary indicators (any one of these is sufficient)
      const primaryIndicators = [
        path.join(dirPath, 'package.json'),
        path.join(dirPath, '.git'),
        path.join(dirPath, 'config', 'config.env')
      ];
      
      for (const indicator of primaryIndicators) {
        if (existsSync(indicator)) {
          return true;
        }
      }
      
      // Secondary indicators (need multiple)
      const srcExists = existsSync(path.join(dirPath, 'src'));
      const organizeExists = existsSync(path.join(dirPath, 'src', 'organize'));
      
      return srcExists && organizeExists;
    } catch (error) {
      return false;
    }
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
   * Asynchronous initialization of the server.
   * This must be called before run().
   */
  async initialize() {
    try {
      await this.initializePaths();
      await this.runStartupValidation();
      await this.loadModules();
      await this.logInfo('MCP Server initialization completed successfully');
    } catch (error) {
      const errorInfo = await this.errorHandler.handleError(error, {
        operation: 'serverInitialization'
      });
      await this.logWarn('Server initialized with fallback configuration', {
        fallbackReason: error.message,
        recoveryStrategy: errorInfo.strategy.action
      });
    }
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
              enhance_with_ai: { type: 'boolean', description: 'Use AI to enhance content', default: false },
              dry_run: { type: 'boolean', description: 'Preview changes without applying them', default: false }
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
          'move_document'
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
        searchPath = path.isAbsolute(category) ? category : path.join(this.syncHub, category);

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
      // Use robust path resolution for special characters and Unicode
      let actualFilePath;
      const searchPaths = [
        path.isAbsolute(file_path) ? file_path : null,
        path.join(this.syncHub, file_path),
        path.join(this.projectRoot, file_path),
        path.join(this.syncHub, 'organized', file_path),
        path.join(this.syncHub, path.basename(file_path))
      ].filter(Boolean);

      // First try simple access
      for (const searchPath of searchPaths) {
        try {
          await fs.access(searchPath, fs.constants.R_OK);
          actualFilePath = searchPath;
          break;
        } catch {
          continue;
        }
      }

      // If simple access fails, use directory listing approach for special characters/Unicode
      if (!actualFilePath) {
        for (const searchPath of searchPaths) {
          try {
            const dirPath = path.dirname(searchPath);
            const expectedFileName = path.basename(searchPath);
            
            // Check if directory exists first
            try {
              await fs.access(dirPath);
            } catch {
              continue;
            }
            
            // Get actual files from directory to find exact match
            const files = await fs.readdir(dirPath);
            
            // Find exact match by comparing the expected filename with actual files
            const matchingFile = files.find(actualFile => {
              // Direct match
              if (actualFile === expectedFileName) {
                return true;
              }
              
              // Try character substitution for similar-looking Unicode characters
              const normalizedActual = this.normalizeUnicodeChars(actualFile);
              const normalizedExpected = this.normalizeUnicodeChars(expectedFileName);
              if (normalizedActual === normalizedExpected) {
                return true;
              }
              
              // Try various Unicode normalizations
              const normalizations = ['NFC', 'NFD', 'NFKC', 'NFKD'];
              for (const norm of normalizations) {
                if (actualFile.normalize(norm) === expectedFileName.normalize(norm)) {
                  return true;
                }
                if (actualFile === expectedFileName.normalize(norm)) {
                  return true;
                }
                if (actualFile.normalize(norm) === expectedFileName) {
                  return true;
                }
                
                // Try character substitution with Unicode normalization
                const normActual = this.normalizeUnicodeChars(actualFile.normalize(norm));
                const normExpected = this.normalizeUnicodeChars(expectedFileName.normalize(norm));
                if (normActual === normExpected) {
                  return true;
                }
              }
              
              return false;
            });
            
            if (matchingFile) {
              actualFilePath = path.join(dirPath, matchingFile);
              // Verify the exact file can be accessed
              try {
                await fs.access(actualFilePath, fs.constants.R_OK);
                break;
              } catch {
                actualFilePath = null;
                continue;
              }
            }
          } catch {
            continue;
          }
        }
      }

      // Check if file exists and is accessible
      if (!actualFilePath) {
        throw new Error(`Document not found: ${file_path}`);
      }

      const [content, stats] = await Promise.all([
        fs.readFile(actualFilePath, 'utf8'),
        fs.stat(actualFilePath)
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
              summary: `Document organization ${dry_run ? 'simulation' : 'execution'} completed successfully`,
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
              status: 'completed',
              output: output.trim(),
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
              status: 'running',
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

      // Enhanced file path resolution for analyze_content with special character handling
      const allFiles = [];
      for (const filePath of file_paths) {
        // Use robust path resolution for special characters and Unicode
        let actualPath;
        const searchPaths = [
          path.isAbsolute(filePath) ? filePath : null,
          path.join(this.syncHub, filePath),
          path.join(this.projectRoot, filePath),
          path.join(this.syncHub, 'organized', filePath),
          path.join(this.syncHub, path.basename(filePath))
        ].filter(Boolean);

        // First try simple access
        for (const searchPath of searchPaths) {
          try {
            await fs.access(searchPath);
            actualPath = searchPath;
            break;
          } catch {
            continue;
          }
        }

        // If simple access fails, use directory listing approach for special characters/Unicode
        if (!actualPath) {
          for (const searchPath of searchPaths) {
            try {
              const dirPath = path.dirname(searchPath);
              const expectedFileName = path.basename(searchPath);
              
              // Check if directory exists first
              try {
                await fs.access(dirPath);
              } catch {
                continue;
              }
              
              // Get actual files from directory to find exact match
              const files = await fs.readdir(dirPath);
              
              // Find exact match by comparing the expected filename with actual files
              const matchingFile = files.find(actualFile => {
                // Direct match
                if (actualFile === expectedFileName) {
                  return true;
                }
                
                // Try character substitution for similar-looking Unicode characters
                const normalizedActual = this.normalizeUnicodeChars(actualFile);
                const normalizedExpected = this.normalizeUnicodeChars(expectedFileName);
                if (normalizedActual === normalizedExpected) {
                  return true;
                }
                
                // Try various Unicode normalizations
                const normalizations = ['NFC', 'NFD', 'NFKC', 'NFKD'];
                for (const norm of normalizations) {
                  if (actualFile.normalize(norm) === expectedFileName.normalize(norm)) {
                    return true;
                  }
                  if (actualFile === expectedFileName.normalize(norm)) {
                    return true;
                  }
                  if (actualFile.normalize(norm) === expectedFileName) {
                    return true;
                  }
                  
                  // Try character substitution with Unicode normalization
                  const normActual = this.normalizeUnicodeChars(actualFile.normalize(norm));
                  const normExpected = this.normalizeUnicodeChars(expectedFileName.normalize(norm));
                  if (normActual === normExpected) {
                    return true;
                  }
                }
                
                return false;
              });
              
              if (matchingFile) {
                actualPath = path.join(dirPath, matchingFile);
                // Verify the exact file can be accessed
                try {
                  await fs.access(actualPath, fs.constants.F_OK);
                  break;
                } catch {
                  actualPath = null;
                  continue;
                }
              }
            } catch {
              continue;
            }
          }
        }

        if (!actualPath) {
          throw new Error(`File or directory not found: ${filePath}`);
        }

        const stat = await fs.stat(actualPath);
        if (stat.isDirectory()) {
          const walk = async (dir) => {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
              const entryPath = path.join(dir, entry.name);
              
              // Skip Obsidian-related files and directories
              if (this.isObsidianFile(entryPath)) {
                continue;
              }
              
              if (entry.isDirectory() && !entry.name.startsWith('.')) {
                await walk(entryPath);
              } else if (entry.isFile() && !entry.name.startsWith('.')) {
                allFiles.push(entryPath);
              }
            }
          };
          await walk(actualPath);
        } else if (stat.isFile()) {
          allFiles.push(actualPath);
        }
      }
      for (const file of allFiles) {
        const relPath = path.relative(this.syncHub, file);
        const analysis = await analyzer.analyzeContent(file);
        if (analysis) {
          results.set(relPath, analysis);
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              analysis: Object.fromEntries(results),
              analysis_results: Object.fromEntries(results),
              file_paths: file_paths,
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

      // If directory is absolute, use as-is; if relative, join with syncHub
      const fullDirectoryPath = path.isAbsolute(directory)
        ? directory
        : path.join(this.syncHub, directory);

      // Recursively get all files in directory and subdirectories
      const files = [];
      const walk = async (dir) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          // Skip Obsidian-related files and directories
          if (this.isObsidianFile(fullPath)) {
            continue;
          }
          
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            await walk(fullPath);
          } else if (entry.isFile() && !entry.name.startsWith('.')) {
            // Validate file actually exists and is accessible before including in analysis
            try {
              await fs.access(fullPath, fs.constants.F_OK | fs.constants.R_OK);
              files.push(fullPath);
            } catch (error) {
              console.warn(`Skipping inaccessible file: ${fullPath} - ${error.message}`);
            }
          }
        }
      };
      await walk(fullDirectoryPath);

      // Import and use ContentAnalyzer
      const { ContentAnalyzer } = await import('../organize/content_analyzer.js');
      const analyzer = new ContentAnalyzer({ similarityThreshold: similarity_threshold });
      
      // Clear any stale cache to prevent phantom file issues
      analyzer.contentCache.clear();
      analyzer.analysisResults.clear();
      
      // Double-validate files exist before analysis to prevent cache corruption
      const validatedFiles = [];
      for (const filePath of files) {
        try {
          await fs.access(filePath, fs.constants.F_OK | fs.constants.R_OK);
          validatedFiles.push(filePath);
        } catch (error) {
          console.warn(`Skipping file that became inaccessible: ${filePath}`);
        }
      }

      const duplicates = await analyzer.findDuplicates(validatedFiles);
      const duplicateGroups = Array.from(duplicates.entries()).map(([key, group]) => ({
        key,
        type: group.type,
        similarity: group.similarity,
        files: group.files.map(f => path.relative(this.syncHub, f.filePath)),
        recommended_action: group.recommendedAction
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              directory: directory,
              duplicates: duplicateGroups,
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
      const { topic, file_paths, strategy = 'comprehensive_merge', enhance_with_ai = false, dry_run = false } = args;

      // Enhanced input validation
      if (!topic || typeof topic !== 'string') {
        throw new Error('Topic is required and must be a string');
      }

      if (!file_paths || !Array.isArray(file_paths) || file_paths.length === 0) {
        throw new Error('file_paths is required and must be a non-empty array');
      }

      // Enhanced file path resolution with multiple search locations and Unicode/special character handling
      const resolveFilePath = async (filePath) => {
        const searchPaths = [
          // Try absolute path first
          path.isAbsolute(filePath) ? filePath : null,
          // Try relative to sync hub
          path.join(this.syncHub, filePath),
          // Try relative to project root
          path.join(this.projectRoot, filePath),
          // Try in organized folders within sync hub
          path.join(this.syncHub, 'organized', filePath),
          // Try direct filename search in sync hub
          path.join(this.syncHub, path.basename(filePath))
        ].filter(Boolean);

        // First try simple access for each search path
        for (const searchPath of searchPaths) {
          try {
            await fs.access(searchPath);
            return searchPath;
          } catch {
            continue;
          }
        }

        // If simple access fails, use directory listing approach to handle special characters/Unicode
        for (const searchPath of searchPaths) {
          try {
            const dirPath = path.dirname(searchPath);
            const expectedFileName = path.basename(searchPath);
            
            // Check if directory exists first
            try {
              await fs.access(dirPath);
            } catch {
              continue; // Directory doesn't exist, try next search path
            }
            
            // Get actual files from directory to find exact match
            const files = await fs.readdir(dirPath);
            
            // Find exact match by comparing the expected filename with actual files
            // This handles Unicode encoding differences between analysis and consolidation tools
            const matchingFile = files.find(actualFile => {
              // Direct match
              if (actualFile === expectedFileName) {
                return true;
              }
              
              // Try character substitution for similar-looking Unicode characters
              const normalizedActual = this.normalizeUnicodeChars(actualFile);
              const normalizedExpected = this.normalizeUnicodeChars(expectedFileName);
              if (normalizedActual === normalizedExpected) {
                return true;
              }
              
              // Try various Unicode normalizations
              const normalizations = ['NFC', 'NFD', 'NFKC', 'NFKD'];
              for (const norm of normalizations) {
                if (actualFile.normalize(norm) === expectedFileName.normalize(norm)) {
                  return true;
                }
                if (actualFile === expectedFileName.normalize(norm)) {
                  return true;
                }
                if (actualFile.normalize(norm) === expectedFileName) {
                  return true;
                }
                
                // Try character substitution with Unicode normalization
                const normActual = this.normalizeUnicodeChars(actualFile.normalize(norm));
                const normExpected = this.normalizeUnicodeChars(expectedFileName.normalize(norm));
                if (normActual === normExpected) {
                  return true;
                }
              }
              
              return false;
            });
            
            if (matchingFile) {
              const actualFilePath = path.join(dirPath, matchingFile);
              // Verify the exact file can be accessed
              try {
                await fs.access(actualFilePath, fs.constants.F_OK);
                return actualFilePath;
              } catch {
                continue; // File access failed, try next search path
              }
            }
          } catch {
            continue; // Directory listing failed, try next search path
          }
        }
        
        return null;
      };

      // Use BatchProcessor if available, otherwise fallback to direct imports
      if (this.modules.BatchProcessor) {
        const processor = new this.modules.BatchProcessor.default({
          projectRoot: this.projectRoot
        });

        // Enhanced file resolution for batch processor with special character handling
        const resolvedFiles = [];
        const unresolvedFiles = [];

        for (const filePath of file_paths) {
          // Check if this is an Obsidian-related file that should not be consolidated
          const fullPathForCheck = path.isAbsolute(filePath) ? filePath : path.join(this.syncHub, filePath);
          if (this.isObsidianFile(fullPathForCheck)) {
            unresolvedFiles.push(`${filePath} (Obsidian file - protected)`);
            continue;
          }
          
          const resolvedPath = await resolveFilePath(filePath);
          if (resolvedPath) {
            // Double-check resolved path is not an Obsidian file
            if (this.isObsidianFile(resolvedPath)) {
              unresolvedFiles.push(`${filePath} (Obsidian file - protected)`);
              continue;
            }
            
            resolvedFiles.push({
              filePath: resolvedPath,
              originalPath: filePath,
              analysis: {
                topics: [topic],
                metadata: {
                  suggestedTitle: path.basename(filePath, path.extname(filePath)),
                  originalFilename: path.basename(filePath)
                }
              }
            });
          } else {
            unresolvedFiles.push(filePath);
          }
        }

        if (resolvedFiles.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  message: `No accessible files found for consolidation. All ${file_paths.length} files were inaccessible.`,
                  unresolved_files: unresolvedFiles,
                  search_locations: [
                    this.syncHub,
                    this.projectRoot,
                    path.join(this.syncHub, 'organized')
                  ],
                  suggestions: [
                    'Check if files exist in the sync hub directory',
                    'Verify file paths are correct',
                    'Ensure files have been organized first'
                  ],
                  timestamp: new Date().toISOString()
                }, null, 2)
              }
            ]
          };
        }

        const consolidationCandidate = {
          topic,
          files: resolvedFiles,
          recommendedTitle: `${topic} - Consolidated`,
          consolidationStrategy: strategy,
          avgSimilarity: 0.8
        };

        const result = await processor.consolidateContent(consolidationCandidate, {
          syncHubPath: this.syncHub,
          enhanceContent: enhance_with_ai,
          dryRun: dry_run
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
                  resolved_files: resolvedFiles.map(f => f.filePath),
                  unresolved_files: unresolvedFiles,
                  strategy_used: result.consolidationStrategy,
                  dry_run: dry_run
                },
                topic,
                files_consolidated: resolvedFiles.length,
                files_requested: file_paths.length,
                timestamp: new Date().toISOString()
              }, null, 2)
            }
          ]
        };
      }

      // Enhanced fallback to direct module imports with better error handling
      let ContentAnalyzer, ContentConsolidator;

      try {
        // Robustly import ContentAnalyzer with multiple fallback strategies
        let analyzerModule;
        if (this.modules.ContentAnalyzer) {
          analyzerModule = this.modules.ContentAnalyzer;
        } else {
          // Try multiple import paths
          const analyzerPaths = [
            '../organize/content_analyzer.js',
            './organize/content_analyzer.js',
            '../../organize/content_analyzer.js'
          ];
          
          for (const analyzerPath of analyzerPaths) {
            try {
              analyzerModule = await this.moduleLoader.safeImport(analyzerPath, { required: false });
              if (analyzerModule) break;
            } catch {
              continue;
            }
          }
        }
        ContentAnalyzer = analyzerModule?.ContentAnalyzer || analyzerModule?.default;

        // Robustly import ContentConsolidator with multiple fallback strategies
        let consolidatorModule;
        if (this.modules.ContentConsolidator) {
          consolidatorModule = this.modules.ContentConsolidator;
        } else {
          // Try multiple import paths
          const consolidatorPaths = [
            '../organize/content_consolidator.js',
            './organize/content_consolidator.js',
            '../../organize/content_consolidator.js'
          ];
          
          for (const consolidatorPath of consolidatorPaths) {
            try {
              consolidatorModule = await this.moduleLoader.safeImport(consolidatorPath, { required: false });
              if (consolidatorModule) break;
            } catch {
              continue;
            }
          }
        }
        ContentConsolidator = consolidatorModule?.ContentConsolidator || consolidatorModule?.default;
      } catch (importError) {
        await this.logError('Failed to import required modules for consolidation', {}, importError);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: 'Content consolidation modules not available',
                error: importError.message,
                module_paths_tried: [
                  '../organize/content_analyzer.js',
                  './organize/content_analyzer.js', 
                  '../../organize/content_analyzer.js',
                  '../organize/content_consolidator.js',
                  './organize/content_consolidator.js',
                  '../../organize/content_consolidator.js'
                ],
                suggestions: [
                  'Ensure organize modules are properly installed',
                  'Check module paths and dependencies',
                  'Try running the organize_documents tool first'
                ],
                timestamp: new Date().toISOString()
              }, null, 2)
            }
          ]
        };
      }

      if (!ContentAnalyzer || !ContentConsolidator) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: 'Required modules for content consolidation are not available',
                available_modules: {
                  ContentAnalyzer: !!ContentAnalyzer,
                  ContentConsolidator: !!ContentConsolidator
                },
                suggestions: [
                  'Check if organize modules are properly loaded',
                  'Try restarting the MCP server',
                  'Verify module dependencies are installed'
                ],
                timestamp: new Date().toISOString()
              }, null, 2)
            }
          ]
        };
      }

      const analyzer = new ContentAnalyzer();
      const analyzedFiles = [];
      const processingErrors = [];
      const unresolvedFiles = [];

      // Enhanced batch processing with better error tracking
      for (const filePath of file_paths) {
        // Check if this is an Obsidian-related file that should not be consolidated
        const fullPathForCheck = path.isAbsolute(filePath) ? filePath : path.join(this.syncHub, filePath);
        if (this.isObsidianFile(fullPathForCheck)) {
          unresolvedFiles.push(`${filePath} (Obsidian file - protected)`);
          continue;
        }
        
        const resolvedPath = await resolveFilePath(filePath);
        
        if (!resolvedPath) {
          unresolvedFiles.push(filePath);
          continue;
        }
        
        // Double-check resolved path is not an Obsidian file
        if (this.isObsidianFile(resolvedPath)) {
          unresolvedFiles.push(`${filePath} (Obsidian file - protected)`);
          continue;
        }

        try {
          // Attempt to analyze the file
          const analysis = await analyzer.analyzeContent(resolvedPath);
          if (analysis) {
            analyzedFiles.push({
              filePath: resolvedPath,
              originalPath: filePath,
              analysis
            });
          } else {
            // Create minimal analysis if analyzer fails but file is readable
            try {
              const content = await fs.readFile(resolvedPath, 'utf8');
              analyzedFiles.push({
                filePath: resolvedPath,
                originalPath: filePath,
                analysis: {
                  metadata: {
                    suggestedTitle: path.basename(filePath, path.extname(filePath)),
                    wordCount: content.split(/\s+/).length,
                    readingTime: Math.ceil(content.split(/\s+/).length / 200),
                    fileSize: content.length,
                    lastModified: (await fs.stat(resolvedPath)).mtime
                  },
                  content: content,
                  topics: [topic],
                  summary: content.substring(0, 200) + (content.length > 200 ? '...' : '')
                }
              });
            } catch (readError) {
              processingErrors.push({
                file: filePath,
                resolvedPath: resolvedPath,
                error: `Failed to read file: ${readError.message}`,
                type: 'read_error'
              });
            }
          }
        } catch (analysisError) {
          await this.logError(`Failed to analyze file for consolidation: ${filePath}`, { filePath, resolvedPath }, analysisError);
          processingErrors.push({
            file: filePath,
            resolvedPath: resolvedPath,
            error: analysisError.message,
            type: 'analysis_error'
          });
        }
      }

      const validFiles = analyzedFiles.filter(f => f.analysis !== null);
      
      // Enhanced error reporting for batch processing
      if (validFiles.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: `No accessible files found for consolidation. Processed ${file_paths.length} files with 0 successful.`,
                batch_processing_summary: {
                  files_requested: file_paths.length,
                  files_resolved: file_paths.length - unresolvedFiles.length,
                  files_analyzed: validFiles.length,
                  processing_errors: processingErrors.length,
                  unresolved_files: unresolvedFiles.length
                },
                unresolved_files: unresolvedFiles,
                processing_errors: processingErrors,
                search_locations: [
                  this.syncHub,
                  this.projectRoot,
                  path.join(this.syncHub, 'organized')
                ],
                suggestions: [
                  'Check if files exist in the expected locations',
                  'Verify file permissions and accessibility',
                  'Try organizing documents first using organize_documents tool',
                  'Use absolute file paths if possible'
                ],
                timestamp: new Date().toISOString()
              }, null, 2)
            }
          ]
        };
      }

      // Enhanced consolidator configuration
      const consolidator = new ContentConsolidator({
        projectRoot: this.projectRoot,
        syncHubPath: this.syncHub,
        enhanceContent: enhance_with_ai,
        aiService: enhance_with_ai ? 'local' : 'none',
        dryRun: dry_run,
        batchMode: true, // Enable batch processing optimizations
        maxConcurrency: 5 // Limit concurrent operations
      });

      // Create enhanced consolidation candidate object
      const consolidationCandidate = {
        topic,
        files: validFiles,
        recommendedTitle: `${topic} - Consolidated`,
        consolidationStrategy: strategy,
        batchInfo: {
          totalRequested: file_paths.length,
          successfullyProcessed: validFiles.length,
          errors: processingErrors.length,
          unresolved: unresolvedFiles.length
        }
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
                original_files: file_paths,
                resolved_files: validFiles.map(f => f.filePath),
                strategy_used: result.consolidationStrategy,
                dry_run: dry_run
              },
              batch_processing_summary: {
                files_requested: file_paths.length,
                files_successfully_consolidated: validFiles.length,
                files_with_errors: processingErrors.length,
                unresolved_files: unresolvedFiles.length,
                success_rate: `${Math.round((validFiles.length / file_paths.length) * 100)}%`
              },
              processing_errors: processingErrors.length > 0 ? processingErrors : undefined,
              unresolved_files: unresolvedFiles.length > 0 ? unresolvedFiles : undefined,
              topic,
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      await this.logError('Content consolidation failed with critical error', { 
        topic, 
        file_paths, 
        strategy, 
        enhance_with_ai, 
        dry_run 
      }, error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              message: `Content consolidation failed: ${error.message}`,
              error_type: error.constructor.name,
              stack_trace: error.stack?.split('\n').slice(0, 5),
              parameters: {
                topic,
                file_paths,
                strategy,
                enhance_with_ai,
                dry_run
              },
              suggestions: [
                'Check if all required modules are available',
                'Verify file paths and permissions',
                'Try with a smaller batch of files',
                'Enable dry_run mode to test without making changes'
              ],
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    }
  }

  async suggestCategories(args) {
    try {
      const { directory } = args;
      const fullDirectoryPath = path.isAbsolute(directory) ? directory : path.join(this.syncHub, directory);

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

      // Recursively analyze files for poorly matched content
      const allFiles = [];
      const walk = async (dir) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const entryPath = path.join(dir, entry.name);
          
          // Skip Obsidian-related files and directories
          if (this.isObsidianFile(entryPath)) {
            continue;
          }
          
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            await walk(entryPath);
          } else if (entry.isFile() && !entry.name.startsWith('.')) {
            try {
              const analysis = await analyzer.analyzeContent(entryPath);
              if (analysis) {
                const match = manager.findBestCategoryMatch(analysis);
                allFiles.push({ filePath: entryPath, analysis, match });
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
      };
      await walk(fullDirectoryPath);

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
              directory: directory,
              suggestions: suggestion ? [suggestion] : [],
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

      // Instead of using a local AI model, return a message for the MCP client to enhance
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              original_content: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
              enhanced_content: null,
              topic,
              enhancement_type,
              success: false,
              message: 'AI enhancement should be performed by the MCP client. No local AI model was used.',
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Content enhancement failed: ${error.message}`);
    }
  }

  // Helper function to normalize similar-looking Unicode characters
  normalizeUnicodeChars(str) {
    const charMap = {
      // Apostrophes and quotes
      '\u2019': '\'',  // Right single quotation mark to apostrophe
      '\u2018': '\'',  // Left single quotation mark to apostrophe
      '\u201C': '"',  // Left double quotation mark to quote
      '\u201D': '"',  // Right double quotation mark to quote
      // Dashes
      '\u2013': '-',  // En dash to hyphen
      '\u2014': '-',  // Em dash to hyphen
      // Spaces
      '\u00A0': ' ',  // Non-breaking space to regular space
      '\u2009': ' ',  // Thin space to regular space
      '\u200A': ' ',  // Hair space to regular space
    };
    
    let normalized = str;
    for (const [unicode, ascii] of Object.entries(charMap)) {
      normalized = normalized.replace(new RegExp(unicode, 'g'), ascii);
    }
    return normalized;
  }

  // Helper function to identify Obsidian-related files and folders that should be excluded from all operations
  isObsidianFile(filePath) {
    const fileName = path.basename(filePath);
    const relativePath = path.relative(this.syncHub, filePath);
    
    // Obsidian directories to exclude
    const obsidianDirectories = [
      '.obsidian',
      'plugins',
      'themes',
      '.trash'
    ];
    
    // Obsidian files to exclude
    const obsidianFiles = [
      '.obsidian.vimrc',
      'workspace.json',
      'app.json',
      'hotkeys.json',
      'appearance.json',
      'community-plugins.json',
      'core-plugins.json',
      'core-plugins-migration.json',
      'graph.json',
      'workspace-mobile.json'
    ];
    
    // Check if the file/folder is in an Obsidian directory
    for (const obsidianDir of obsidianDirectories) {
      if (relativePath.startsWith(obsidianDir + '/') || relativePath === obsidianDir) {
        return true;
      }
    }
    
    // Check if it's a specific Obsidian file
    if (obsidianFiles.includes(fileName)) {
      return true;
    }
    
    // Check if filename starts with .obsidian
    if (fileName.startsWith('.obsidian')) {
      return true;
    }
    
    // Check if it's in the root .obsidian directory
    if (filePath.includes('/.obsidian/')) {
      return true;
    }
    
    return false;
  }

  async deleteDocument(args) {
    const { file_path } = args;
    console.log(`[DELETE_DEBUG] Starting deleteDocument for: ${file_path}`);
    try {
      // Check if this is an Obsidian-related file that should not be deleted
      const fullPathForCheck = path.isAbsolute(file_path) ? file_path : path.join(this.syncHub, file_path);
      if (this.isObsidianFile(fullPathForCheck)) {
        throw new Error(`Cannot delete Obsidian-related file: ${file_path}. This file is protected to maintain vault integrity.`);
      }
      // Always use directory listing approach to get exact filename
      const fullPath = path.isAbsolute(file_path) ? file_path : path.join(this.syncHub, file_path);
      const dirPath = path.dirname(fullPath);
      const expectedFileName = path.basename(fullPath);
      console.log(`[DELETE_DEBUG] Paths - full: ${fullPath}, dir: ${dirPath}, file: ${expectedFileName}`);
      
      // Get actual files from directory to find exact match
      let actualFilePath;
      let debugInfo = '';
      try {
        debugInfo += `Reading directory: ${dirPath}\n`;
        const files = await fs.readdir(dirPath);
        debugInfo += `Found ${files.length} files in directory\n`;
        debugInfo += `Expected filename: "${expectedFileName}"\n`;
        debugInfo += `Expected filename bytes: ${Buffer.from(expectedFileName, 'utf8').toString('hex')}\n`;
        
        // Find files that contain "Apple" for debugging
        const appleFiles = files.filter(f => f.includes('Apple'));
        debugInfo += `Apple-related files found: ${appleFiles.length}\n`;
        appleFiles.forEach((file, i) => {
          debugInfo += `  ${i+1}. "${file}" (bytes: ${Buffer.from(file, 'utf8').toString('hex')})\n`;
        });
        
        // Find exact match by comparing the expected filename with actual files
        // This handles Unicode encoding differences between analysis and delete tools
        const matchingFile = files.find(actualFile => {
          // Direct match
          if (actualFile === expectedFileName) {
            debugInfo += `Direct match found: "${actualFile}"\n`;
            return true;
          }
          
          // Try character substitution for similar-looking Unicode characters
          const normalizedActual = this.normalizeUnicodeChars(actualFile);
          const normalizedExpected = this.normalizeUnicodeChars(expectedFileName);
          if (normalizedActual === normalizedExpected) {
            debugInfo += `Character substitution match found: "${actualFile}" -> "${normalizedActual}"\n`;
            return true;
          }
          
          // Try various Unicode normalizations
          const normalizations = ['NFC', 'NFD', 'NFKC', 'NFKD'];
          for (const norm of normalizations) {
            if (actualFile.normalize(norm) === expectedFileName.normalize(norm)) {
              debugInfo += `Unicode match found with ${norm}: "${actualFile}"\n`;
              return true;
            }
            if (actualFile === expectedFileName.normalize(norm)) {
              debugInfo += `Filename normalization match found with ${norm}: "${actualFile}"\n`;
              return true;
            }
            if (actualFile.normalize(norm) === expectedFileName) {
              debugInfo += `File normalization match found with ${norm}: "${actualFile}"\n`;
              return true;
            }
            
            // Try character substitution with Unicode normalization
            const normActual = this.normalizeUnicodeChars(actualFile.normalize(norm));
            const normExpected = this.normalizeUnicodeChars(expectedFileName.normalize(norm));
            if (normActual === normExpected) {
              debugInfo += `Combined normalization + substitution match with ${norm}: "${actualFile}"\n`;
              return true;
            }
          }
          
          return false;
        });
        
        debugInfo += `Matching file result: ${matchingFile || 'NONE'}\n`;
        
        if (!matchingFile) {
          throw new Error(`File does not exist. Debug info:\n${debugInfo}`);
        }
        
        actualFilePath = path.join(dirPath, matchingFile);
        debugInfo += `Using actual file path: ${actualFilePath}\n`;
        
        // Verify the exact file can be accessed
        await fs.access(actualFilePath, fs.constants.F_OK);
        debugInfo += `File access verification succeeded\n`;
        
      } catch (error) {
        if (error.message.includes('Debug info:')) {
          throw error; // Re-throw with debug info intact
        }
        throw new Error(`Directory listing failed: ${error.message}. Debug info:\n${debugInfo}`);
      }
      
      // Delete using the exact filename from directory listing
      await fs.unlink(actualFilePath);
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
      // Preserve debug information if present
      if (error.message.includes('Debug info:')) {
        throw new Error(`Failed to delete document ${file_path}: ${error.message}`);
      } else {
        throw new Error(`Failed to delete document ${file_path}: ${error.message}`);
      }
    }
  }

  async renameDocument(args) {
    const { old_file_path, new_file_name } = args;
    try {
      // Check if this is an Obsidian-related file that should not be renamed
      const fullPathForCheck = path.isAbsolute(old_file_path) ? old_file_path : path.join(this.syncHub, old_file_path);
      if (this.isObsidianFile(fullPathForCheck)) {
        throw new Error(`Cannot rename Obsidian-related file: ${old_file_path}. This file is protected to maintain vault integrity.`);
      }
      // Use robust path resolution for special characters and Unicode
      let actualOldPath;
      const searchPaths = [
        path.isAbsolute(old_file_path) ? old_file_path : null,
        path.join(this.syncHub, old_file_path),
        path.join(this.projectRoot, old_file_path),
        path.join(this.syncHub, 'organized', old_file_path),
        path.join(this.syncHub, path.basename(old_file_path))
      ].filter(Boolean);

      // First try simple access
      for (const searchPath of searchPaths) {
        try {
          await fs.access(searchPath);
          actualOldPath = searchPath;
          break;
        } catch {
          continue;
        }
      }

      // If simple access fails, use directory listing approach for special characters/Unicode
      if (!actualOldPath) {
        for (const searchPath of searchPaths) {
          try {
            const dirPath = path.dirname(searchPath);
            const expectedFileName = path.basename(searchPath);
            
            // Check if directory exists first
            try {
              await fs.access(dirPath);
            } catch {
              continue;
            }
            
            // Get actual files from directory to find exact match
            const files = await fs.readdir(dirPath);
            
            // Find exact match by comparing the expected filename with actual files
            const matchingFile = files.find(actualFile => {
              // Direct match
              if (actualFile === expectedFileName) {
                return true;
              }
              
              // Try character substitution for similar-looking Unicode characters
              const normalizedActual = this.normalizeUnicodeChars(actualFile);
              const normalizedExpected = this.normalizeUnicodeChars(expectedFileName);
              if (normalizedActual === normalizedExpected) {
                return true;
              }
              
              // Try various Unicode normalizations
              const normalizations = ['NFC', 'NFD', 'NFKC', 'NFKD'];
              for (const norm of normalizations) {
                if (actualFile.normalize(norm) === expectedFileName.normalize(norm)) {
                  return true;
                }
                if (actualFile === expectedFileName.normalize(norm)) {
                  return true;
                }
                if (actualFile.normalize(norm) === expectedFileName) {
                  return true;
                }
                
                // Try character substitution with Unicode normalization
                const normActual = this.normalizeUnicodeChars(actualFile.normalize(norm));
                const normExpected = this.normalizeUnicodeChars(expectedFileName.normalize(norm));
                if (normActual === normExpected) {
                  return true;
                }
              }
              
              return false;
            });
            
            if (matchingFile) {
              actualOldPath = path.join(dirPath, matchingFile);
              // Verify the exact file can be accessed
              try {
                await fs.access(actualOldPath, fs.constants.F_OK);
                break;
              } catch {
                actualOldPath = null;
                continue;
              }
            }
          } catch {
            continue;
          }
        }
      }

      if (!actualOldPath) {
        throw new Error(`Document not found: ${old_file_path}`);
      }

      const newFullPath = path.join(path.dirname(actualOldPath), new_file_name);
      await fs.rename(actualOldPath, newFullPath);
      
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
    try {
      const { file_path, file_paths, new_category, topic = 'General', strategy = 'move', enhance_with_ai = false, dry_run = false } = args;
      
      // Handle both single file_path and multiple file_paths parameters
      let filePaths = [];
      if (file_path) {
        filePaths = [file_path];
      } else if (file_paths && Array.isArray(file_paths)) {
        filePaths = file_paths;
      } else if (file_paths && typeof file_paths === 'string') {
        filePaths = [file_paths];
      } else {
        throw new Error('Either file_path or file_paths parameter is required');
      }
      
      // If new_category is provided, handle simple move operation
      if (new_category) {
        const results = [];
        for (const filePath of filePaths) {
          try {
            // Check if this is an Obsidian-related file that should not be moved
            const fullPathForCheck = path.isAbsolute(filePath) ? filePath : path.join(this.syncHub, filePath);
            if (this.isObsidianFile(fullPathForCheck)) {
              results.push({
                old_path: filePath,
                error: `Cannot move Obsidian-related file: ${filePath}. This file is protected to maintain vault integrity.`,
                moved: false
              });
              continue;
            }
            
            // Use robust path resolution for special characters and Unicode
            let actualOldPath;
            const searchPaths = [
              path.isAbsolute(filePath) ? filePath : null,
              path.join(this.syncHub, filePath),
              path.join(this.projectRoot, filePath),
              path.join(this.syncHub, 'organized', filePath),
              path.join(this.syncHub, path.basename(filePath))
            ].filter(Boolean);

            // First try simple access
            for (const searchPath of searchPaths) {
              try {
                await fs.access(searchPath);
                actualOldPath = searchPath;
                break;
              } catch {
                continue;
              }
            }

            // If simple access fails, use directory listing approach for special characters/Unicode
            if (!actualOldPath) {
              for (const searchPath of searchPaths) {
                try {
                  const dirPath = path.dirname(searchPath);
                  const expectedFileName = path.basename(searchPath);
                  
                  // Check if directory exists first
                  try {
                    await fs.access(dirPath);
                  } catch {
                    continue;
                  }
                  
                  // Get actual files from directory to find exact match
                  const files = await fs.readdir(dirPath);
                  
                  // Find exact match by comparing the expected filename with actual files
                  const matchingFile = files.find(actualFile => {
                    // Direct match
                    if (actualFile === expectedFileName) {
                      return true;
                    }
                    
                    // Try character substitution for similar-looking Unicode characters
                    const normalizedActual = this.normalizeUnicodeChars(actualFile);
                    const normalizedExpected = this.normalizeUnicodeChars(expectedFileName);
                    if (normalizedActual === normalizedExpected) {
                      return true;
                    }
                    
                    // Try various Unicode normalizations
                    const normalizations = ['NFC', 'NFD', 'NFKC', 'NFKD'];
                    for (const norm of normalizations) {
                      if (actualFile.normalize(norm) === expectedFileName.normalize(norm)) {
                        return true;
                      }
                      if (actualFile === expectedFileName.normalize(norm)) {
                        return true;
                      }
                      if (actualFile.normalize(norm) === expectedFileName) {
                        return true;
                      }
                      
                      // Try character substitution with Unicode normalization
                      const normActual = this.normalizeUnicodeChars(actualFile.normalize(norm));
                      const normExpected = this.normalizeUnicodeChars(expectedFileName.normalize(norm));
                      if (normActual === normExpected) {
                        return true;
                      }
                    }
                    
                    return false;
                  });
                  
                  if (matchingFile) {
                    actualOldPath = path.join(dirPath, matchingFile);
                    // Verify the exact file can be accessed
                    try {
                      await fs.access(actualOldPath, fs.constants.F_OK);
                      break;
                    } catch {
                      actualOldPath = null;
                      continue;
                    }
                  }
                } catch {
                  continue;
                }
              }
            }

            if (!actualOldPath) {
              throw new Error(`Document not found: ${filePath}`);
            }
            
            const newCategoryPath = path.join(this.syncHub, new_category);
            
            // Ensure new category directory exists
            await fs.mkdir(newCategoryPath, { recursive: true });
            
            const fileName = path.basename(actualOldPath);
            const newFullPath = path.join(newCategoryPath, fileName);
            
            if (!dry_run) {
              await fs.rename(actualOldPath, newFullPath);
            }
            
            results.push({
              old_path: filePath,
              new_path: path.relative(this.syncHub, newFullPath),
              category: new_category,
              moved: !dry_run
            });
          } catch (moveError) {
            results.push({
              old_path: filePath,
              error: moveError.message,
              moved: false
            });
          }
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: results.every(r => r.moved !== false),
                results,
                new_category,
                dry_run,
                message: `${dry_run ? 'Simulated' : 'Completed'} move of ${results.length} file(s) to ${new_category}`,
                timestamp: new Date().toISOString()
              }, null, 2)
            }
          ]
        };
      }

      // Robustly import ContentAnalyzer and ContentConsolidator
      let ContentAnalyzer, ContentConsolidator;
      try {
        const analyzerModule = this.modules.ContentAnalyzer || await this.moduleLoader.safeImport('../organize/content_analyzer.js', { required: false });
        ContentAnalyzer = analyzerModule?.ContentAnalyzer || analyzerModule?.default;
        const consolidatorModule = this.modules.ContentConsolidator || await this.moduleLoader.safeImport('../organize/content_consolidator.js', { required: false });
        ContentConsolidator = consolidatorModule?.ContentConsolidator || consolidatorModule?.default;
      } catch (importError) {
        await this.logError('Failed to import required modules for moveDocument', {}, importError);
        throw new Error('Content move modules not available');
      }

      if (!ContentAnalyzer || !ContentConsolidator) {
        throw new Error('Required modules for content move are not available');
      }

      const analyzer = new ContentAnalyzer();
      const analyzedFiles = [];

      for (const filePath of file_paths) {
        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.syncHub, filePath);
        try {
          await fs.access(fullPath);
          const analysis = await analyzer.analyzeContent(fullPath);
          if (analysis) {
            analyzedFiles.push({ filePath: fullPath, analysis });
          } else {
            const content = await fs.readFile(fullPath, 'utf8');
            analyzedFiles.push({
              filePath: fullPath,
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
          await this.logError(`Failed to read file for move: ${filePath}`, { filePath }, fileError);
          continue;
        }
      }

      if (analyzedFiles.length === 0) {
        throw new Error('No valid files found to move');
      }

      if (enhance_with_ai) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                consolidation_result: null,
                topic,
                files_consolidated: analyzedFiles.length,
                files_requested: filePaths.length,
                enhance_with_ai: true,
                message: 'AI-based consolidation/enhancement should be performed by the MCP client. No local AI model was used.',
                timestamp: new Date().toISOString()
              }, null, 2)
            }
          ]
        };
      }

      const consolidator = new ContentConsolidator({
        projectRoot: this.projectRoot,
        syncHubPath: this.syncHub,
        enhanceContent: false,
        aiService: 'none',
        dryRun: dry_run
      });

      const consolidationCandidate = {
        topic,
        files: analyzedFiles,
        recommendedTitle: `${topic} - Moved`,
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
                original_files: filePaths,
                strategy_used: result.consolidationStrategy,
                dry_run: dry_run
              },
              topic,
              files_consolidated: analyzedFiles.length,
              files_requested: filePaths.length,
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Move document failed: ${error.message}`);
    }
  }

  /**
   * Start the MCP server
   */
  async run() {
    try {
      await this.logInfo('Starting MCP server...');
      
      // Create proper stdio transport for MCP client discovery
      const transport = new StdioServerTransport();
      
      // Start the server with proper stdio transport
      await this.server.connect(transport);
      
      await this.logInfo('MCP server is running and ready to accept connections');
      
      // Keep the process alive
      process.on('SIGINT', async () => {
        await this.logInfo('Received SIGINT, shutting down MCP server...');
        await this.server.close();
        process.exitCode = 0;
      });
      
      process.on('SIGTERM', async () => {
        await this.logInfo('Received SIGTERM, shutting down MCP server...');
        await this.server.close();
        process.exitCode = 0;
      });
      
    } catch (error) {
      await this.logError('Failed to start MCP server', {}, error);
      throw error;
    }
  }
}
// Entrypoint: start the server if this file is run directly
// ES module equivalent of require.main === module
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const server = new DocumentOrganizationServer();
    await server.initialize();
    await server.run();
  })().catch((err) => {
    // Fallback logging if errorHandler is not available
    console.error('Server startup error', err);
    throw err;
  });
}
