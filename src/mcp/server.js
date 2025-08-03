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
// Removed execSync import - replaced with Node.js fs operations and spawn
import os from 'os';
import { createErrorHandler, ErrorTypes, EnhancedError } from '../organize/error_handler.js';
import { FileEditor, EditOperations } from '../organize/file_editor.js';

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

    // Folder-move policy enforcement
    this.folderMovePolicy = {
      enabled: true,
      enforceStrictMode: true,
      allowedOperations: ['rename_within_folder', 'move_entire_folder'],
      blockedOperations: ['move_individual_file', 'move_file_between_folders']
    };

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

      // Import enhanced ModuleLoader with multi-directory support
      const moduleLoaderModule = await import('../organize/module_loader.js');
      const ModuleLoader = moduleLoaderModule.ModuleLoader;

      this.moduleLoader = new ModuleLoader({
        retryAttempts: 2,
        retryDelay: 500
      });

      await this.logInfo('Enhanced ModuleLoader initialized with multi-directory support', {
        moduleDirectories: this.moduleLoader.getStats().moduleDirectories
      });

      // Define modules to load using enhanced multi-directory support
      const moduleSpecs = {
        DocumentFolderManager: {
          directory: 'organize',
          path: 'document_folder_manager',
          required: true
        },
        DocumentSearchEngine: {
          directory: 'organize',
          path: 'document_search_engine',
          required: false
        },
        ContentAnalyzer: {
          directory: 'organize',
          path: 'content_analyzer',
          required: false
        },
        ContentConsolidator: {
          directory: 'organize',
          path: 'content_consolidator',
          required: false
        },
        ContentConsolidationEngine: {
          directory: 'organize',
          path: 'content_consolidation_engine',
          required: false
        },
        CategoryManager: {
          directory: 'organize',
          path: 'category_manager',
          required: false
        },
        BatchProcessor: {
          directory: 'organize',
          path: 'batch_processor',
          required: false
        },
        SimplePathResolver: {
          directory: 'organize',
          path: 'simple_path_resolver',
          required: false
        }
      };

      const { results, errors } = await this.moduleLoader.loadModulesFromAllDirectories(moduleSpecs);

      // Store loaded modules
      for (const [name, module] of results) {
        this.modules[name] = module;
      }

      // Initialize SimplePathResolver if loaded
      if (this.modules.SimplePathResolver) {
        this.pathResolver = new this.modules.SimplePathResolver.SimplePathResolver();
        await this.logInfo('SimplePathResolver initialized', {
          projectRoot: this.pathResolver.projectRoot,
          syncHubPath: this.pathResolver.syncHubPath
        });
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

      // Initialize DocumentFolderManager if loaded
      if (this.modules.DocumentFolderManager) {
        this.documentFolderManager = new this.modules.DocumentFolderManager.DocumentFolderManager(this.syncHub);
        await this.logInfo('DocumentFolderManager initialized', {
          syncHub: this.syncHub
        });

        // Initialize DocumentSearchEngine if loaded
        if (this.modules.DocumentSearchEngine) {
          this.documentSearchEngine = new this.modules.DocumentSearchEngine.DocumentSearchEngine(this.documentFolderManager);
          await this.logInfo('DocumentSearchEngine initialized');
        }

        // Initialize FileEditor
        this.fileEditor = new FileEditor({
          createBackup: true,
          validateChanges: true,
          dryRun: false
        });
        await this.logInfo('FileEditor initialized');
      }

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
   * Calculate total size of a folder recursively
   */
  async calculateFolderSize(folderPath) {
    let totalSize = 0;

    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(folderPath, entry.name);

        if (entry.isDirectory()) {
          totalSize += await this.calculateFolderSize(entryPath);
        } else if (entry.isFile()) {
          const stats = await fs.stat(entryPath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      // Return 0 if we can't access the folder
      return 0;
    }

    return totalSize;
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
   * Format comprehensive error response according to MCP protocol
   */
  formatErrorResponse(error, toolName, requestId, context = {}) {
    // Use ToolResponseHandler if available for comprehensive error formatting
    if (this.modules.ToolResponseHandler) {
      const handler = new this.modules.ToolResponseHandler();
      return handler.createComprehensiveErrorResponse(error, {
        ...context,
        tool: toolName,
        requestId,
        component: 'MCPServer'
      });
    }

    // Fallback to basic error formatting
    const errorInfo = {
      success: false,
      error: {
        message: error.message,
        type: error.name || 'Error',
        code: error.code || 'UNKNOWN_ERROR',
        category: this.categorizeError(error),
        severity: this.determineSeverity(error, context)
      },
      context: {
        tool: toolName,
        requestId,
        operation: context.operation || 'unknown',
        timestamp: new Date().toISOString()
      },
      debugInfo: {
        stack: error.stack,
        nodeVersion: process.version,
        platform: process.platform
      },
      recovery: this.generateRecoveryGuidance(error, context),
      timestamp: new Date().toISOString()
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
   * Categorize error for better handling
   */
  categorizeError(error) {
    if (!error) return 'unknown';

    // Check error code first
    if (error.code === 'ENOENT') return 'file_not_found';
    if (error.code === 'EACCES') return 'permission_denied';
    if (error.code === 'ETIMEDOUT' || error.code === 'TIMEOUT') return 'timeout';

    // Check error message patterns
    const message = error.message?.toLowerCase() || '';

    if (message.includes('import') || message.includes('module')) return 'module_import';
    if (message.includes('config') || message.includes('configuration')) return 'configuration';
    if (message.includes('validation') || message.includes('invalid')) return 'validation';
    if (message.includes('folder') || message.includes('directory')) return 'folder_operation';
    if (message.includes('search') || message.includes('query')) return 'search_operation';
    if (message.includes('content') || message.includes('process')) return 'content_processing';

    return 'unknown';
  }

  /**
   * Determine error severity
   */
  determineSeverity(error, context = {}) {
    if (error.code === 'EACCES' || error.message?.includes('CRITICAL')) return 'critical';
    if (error.message?.includes('corrupt') || context.operation?.includes('delete')) return 'high';
    if (error.code === 'ENOENT' || error.message?.includes('not found')) return 'medium';
    if (error.message?.includes('warning')) return 'low';
    return 'medium';
  }

  /**
   * Generate recovery guidance for errors
   */
  generateRecoveryGuidance(error, context = {}) {
    const category = this.categorizeError(error);

    const guidance = {
      file_not_found: {
        immediate: ['Verify the file path is correct', 'Check if the file exists'],
        alternatives: ['Search for the file in parent directories', 'Create the file if needed']
      },
      permission_denied: {
        immediate: ['Check file permissions', 'Verify access rights'],
        alternatives: ['Use a different location', 'Request administrator access']
      },
      validation: {
        immediate: ['Check input parameters', 'Verify required fields'],
        alternatives: ['Use default values', 'Simplify the request']
      },
      search_operation: {
        immediate: ['Verify search path exists', 'Check search permissions'],
        alternatives: ['Try a broader search', 'Use different search terms']
      },
      folder_operation: {
        immediate: ['Check folder exists', 'Verify folder permissions'],
        alternatives: ['Create the folder', 'Use a different location']
      }
    };

    return guidance[category] || {
      immediate: ['Review the error message'],
      alternatives: ['Try a different approach', 'Contact support']
    };
  }

  /**
   * Find loose files that need to be organized into document folders
   */
  async findLooseFiles() {
    const looseFiles = [];

    try {
      const syncHubEntries = await fs.readdir(this.syncHub, { withFileTypes: true });

      for (const entry of syncHubEntries) {
        if (entry.isFile() && !entry.name.startsWith('.')) {
          // This is a loose file in the root
          looseFiles.push(path.join(this.syncHub, entry.name));
        } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
          // Check category directories for loose files
          const categoryPath = path.join(this.syncHub, entry.name);
          const categoryEntries = await fs.readdir(categoryPath, { withFileTypes: true });

          for (const categoryEntry of categoryEntries) {
            if (categoryEntry.isFile() && !categoryEntry.name.startsWith('.')) {
              // Check if this file is part of a document folder
              const filePath = path.join(categoryPath, categoryEntry.name);
              const parentDir = path.dirname(filePath);
              const isInDocumentFolder = await this.documentFolderManager.isDocumentFolder(parentDir);

              if (!isInDocumentFolder) {
                looseFiles.push(filePath);
              }
            }
          }
        }
      }
    } catch (error) {
      await this.logWarn('Error finding loose files', { error: error.message });
    }

    return looseFiles;
  }

  /**
   * Determine the appropriate category for a file based on content and name
   */
  async determineFileCategory(filePath, content) {
    const fileName = path.basename(filePath).toLowerCase();
    const fileContent = content.toLowerCase();

    // AI & ML category
    if (fileName.includes('ai') || fileName.includes('ml') || fileName.includes('machine') ||
      fileContent.includes('machine learning') || fileContent.includes('artificial intelligence') ||
      fileContent.includes('neural network') || fileContent.includes('deep learning')) {
      return 'AI & ML';
    }

    // Research Papers category
    if (fileName.includes('research') || fileName.includes('paper') || fileName.includes('study') ||
      fileContent.includes('abstract') || fileContent.includes('methodology') ||
      fileContent.includes('conclusion') || fileContent.includes('references')) {
      return 'Research Papers';
    }

    // Development category
    if (fileName.includes('code') || fileName.includes('dev') || fileName.includes('api') ||
      fileContent.includes('function') || fileContent.includes('class') ||
      fileContent.includes('import') || fileContent.includes('```')) {
      return 'Development';
    }

    // Web Content category
    if (fileName.includes('web') || fileName.includes('html') || fileName.includes('css') ||
      fileContent.includes('<html>') || fileContent.includes('http') ||
      fileContent.includes('website') || fileContent.includes('browser')) {
      return 'Web Content';
    }

    // Default to Notes & Drafts
    return 'Notes & Drafts';
  }

  /**
   * Sanitize document name for folder creation
   */
  sanitizeDocumentName(fileName) {
    // Remove extension and sanitize
    const nameWithoutExt = path.parse(fileName).name;
    return nameWithoutExt
      .replace(/[<>:"/\\|?*]/g, '-')  // Replace invalid characters
      .replace(/\s+/g, '-')           // Replace spaces with hyphens
      .replace(/-+/g, '-')            // Replace multiple hyphens with single
      .replace(/^-|-$/g, '')          // Remove leading/trailing hyphens
      .substring(0, 100);             // Limit length
  }

  /**
   * Ensure category directories exist with proper structure
   */
  async ensureCategoryStructure(dryRun = false) {
    const categories = ['AI & ML', 'Research Papers', 'Web Content', 'Notes & Drafts', 'Development'];

    for (const category of categories) {
      const categoryPath = path.join(this.syncHub, category);

      if (dryRun) {
        await this.logDebug(`DRY RUN: Would ensure category directory exists: ${categoryPath}`);
      } else {
        try {
          await fs.mkdir(categoryPath, { recursive: true });
          await this.logDebug(`Ensured category directory exists: ${categoryPath}`);
        } catch (error) {
          await this.logWarn(`Failed to create category directory: ${categoryPath}`, {
            error: error.message
          });
        }
      }
    }
  }

  /**
   * Validate document folder integrity before and after sync operations
   */
  async validateDocumentFolderIntegrity(syncResults, phase = 'pre-sync') {
    try {
      const allDocumentFolders = await this.documentFolderManager.findDocumentFolders(this.syncHub, true);
      syncResults.documentFoldersFound = allDocumentFolders.length;

      await this.logDebug(`${phase}: Found ${allDocumentFolders.length} document folders`);

      let integrityIssues = 0;

      for (const docFolderPath of allDocumentFolders) {
        try {
          // Check if main document file exists
          const mainFile = await this.documentFolderManager.getMainDocumentFile(docFolderPath);
          if (!mainFile) {
            syncResults.warnings.push(`Document folder missing main file: ${docFolderPath}`);
            integrityIssues++;
            continue;
          }

          // Check if images folder exists
          const imagesFolder = await this.documentFolderManager.getImagesFolder(docFolderPath, false);
          if (!existsSync(imagesFolder)) {
            syncResults.warnings.push(`Document folder missing images subfolder: ${docFolderPath}`);
            integrityIssues++;
          }

        } catch (error) {
          syncResults.errors.push(`Failed to validate document folder ${docFolderPath}: ${error.message}`);
          integrityIssues++;
        }
      }

      await this.logInfo(`${phase}: Document folder integrity check completed`, {
        totalFolders: allDocumentFolders.length,
        integrityIssues,
        phase
      });

    } catch (error) {
      syncResults.errors.push(`Failed to validate document folder integrity: ${error.message}`);
      await this.logError(`${phase}: Document folder integrity validation failed`, {
        error: error.message,
        phase
      });
    }
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
          name: 'get_folder_move_policy',
          description: 'Get folder-move policy status and enforcement details to ensure image references are preserved',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
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
        },
        {
          name: 'resolve_path',
          description: 'Resolve and validate file or directory paths using simplified path resolution',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Path to resolve (relative or absolute)' },
              base_path: { type: 'string', description: 'Base path for relative resolution (optional)' },
              validate_existence: { type: 'boolean', description: 'Check if path exists', default: true },
              path_type: { type: 'string', description: 'Expected path type', enum: ['file', 'directory', 'any'], default: 'any' }
            },
            required: ['path']
          }
        },
        {
          name: 'get_module_info',
          description: 'Get information about loaded modules and module directories',
          inputSchema: {
            type: 'object',
            properties: {
              include_stats: { type: 'boolean', description: 'Include module loading statistics', default: true },
              include_directories: { type: 'boolean', description: 'Include module directory information', default: true }
            }
          }
        },
        {
          name: 'load_module',
          description: 'Dynamically load a module from organize, sync, or mcp directories',
          inputSchema: {
            type: 'object',
            properties: {
              module_name: { type: 'string', description: 'Name of the module to load' },
              directory: { type: 'string', description: 'Directory to load from', enum: ['organize', 'sync', 'mcp'], default: 'organize' },
              required: { type: 'boolean', description: 'Whether module is required', default: false }
            },
            required: ['module_name']
          }
        },
        {
          name: 'validate_paths',
          description: 'Validate multiple paths and check their existence and types',
          inputSchema: {
            type: 'object',
            properties: {
              paths: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    path: { type: 'string', description: 'Path to validate' },
                    expected_type: { type: 'string', enum: ['file', 'directory', 'any'], default: 'any' },
                    required: { type: 'boolean', default: true }
                  },
                  required: ['path']
                },
                description: 'Array of paths to validate'
              }
            },
            required: ['paths']
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
          'move_document', 'edit_file', 'replace_text', 'insert_lines', 'delete_lines',
          'append_to_file', 'prepend_to_file'
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
          case 'get_folder_move_policy':
            result = await this.getFolderMovePolicyTool();
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
          case 'resolve_path':
            result = await this.resolvePath(args);
            break;
          case 'get_module_info':
            result = await this.getModuleInfo(args);
            break;
          case 'load_module':
            result = await this.loadModule(args);
            break;
          case 'validate_paths':
            result = await this.validatePaths(args);
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
        // Final error handling with comprehensive logging and context
        const errorContext = {
          operation: 'toolCall',
          toolName: name,
          requestId,
          args: this.sanitizeArgsForLogging(args),
          component: 'MCPServer',
          timestamp: new Date().toISOString()
        };

        const errorInfo = await this.errorHandler.handleError(error, errorContext);

        // Log comprehensive error information
        await this.errorHandler.logError(`Tool execution failed: ${name}`, {
          ...errorContext,
          errorId: errorInfo.errorId,
          severity: errorInfo.severity,
          category: this.categorizeError(error),
          recoverable: errorInfo.strategy.retryable
        }, error);

        // Return comprehensive error response
        return this.formatErrorResponse(error, name, requestId, {
          ...errorContext,
          errorInfo,
          troubleshooting: errorInfo.troubleshooting
        });
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
      // Initialize DocumentSearchEngine if not already done
      if (!this.documentSearchEngine && this.documentFolderManager) {
        const { DocumentSearchEngine } = await import('../organize/document_search_engine.js');
        this.documentSearchEngine = new DocumentSearchEngine(this.documentFolderManager);
      }

      // If DocumentSearchEngine is available, use it
      if (this.documentSearchEngine) {
        const searchOptions = {
          category,
          limit,
          useRegex: use_regex,
          caseSensitive: false
        };

        const searchResults = await this.documentSearchEngine.searchDocuments(query, searchOptions);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(searchResults, null, 2)
            }
          ]
        };
      }

      // Fallback to basic search if DocumentSearchEngine is not available
      await this.logWarn('DocumentSearchEngine not available, using fallback search', {
        query,
        category,
        limit
      });

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

      // Simple JavaScript-based search as fallback
      const searchResults = await this.performFallbackSearch(searchPath, query, limit);

      const response = {
        query,
        total_results: searchResults.length,
        results: searchResults,
        ...(category && { category }),
        search_method: 'fallback'
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
      await this.logError('Search operation failed', {
        query,
        category,
        limit,
        error: error.message
      }, error);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              message: `Search failed: ${error.message}`,
              query,
              category,
              total_results: 0,
              results: []
            }, null, 2)
          }
        ]
      };
    }
  }

  /**
   * Fallback search method using JavaScript file system traversal
   */
  async performFallbackSearch(searchPath, query, limit) {
    const searchResults = [];
    const queryLower = query.toLowerCase();

    try {
      // Simple recursive file search
      const searchFiles = async (dirPath) => {
        const items = await fs.readdir(dirPath);

        for (const item of items) {
          const itemPath = path.join(dirPath, item);
          const stats = await fs.stat(itemPath);

          if (stats.isDirectory()) {
            // Skip hidden directories and images folders
            if (!item.startsWith('.') && item !== 'images') {
              await searchFiles(itemPath);
            }
          } else if (stats.isFile()) {
            // Check file extensions
            const ext = path.extname(item).toLowerCase();
            if (['.md', '.txt'].includes(ext)) {
              try {
                const content = await fs.readFile(itemPath, 'utf8');

                // Simple case-insensitive search
                if (content.toLowerCase().includes(queryLower)) {
                  const relativePath = path.relative(this.syncHub, itemPath);
                  const preview = content.substring(0, 200) + (content.length > 200 ? '...' : '');

                  searchResults.push({
                    path: relativePath,
                    name: path.basename(itemPath),
                    category: path.dirname(relativePath),
                    size: stats.size,
                    modified: stats.mtime.toISOString(),
                    preview
                  });

                  // Stop if we've reached the limit
                  if (searchResults.length >= limit) {
                    return;
                  }
                }
              } catch (fileError) {
                // Skip files that can't be read
                await this.logDebug('Could not read file during search', {
                  file: itemPath,
                  error: fileError.message
                });
              }
            }
          }
        }
      };

      await searchFiles(searchPath);
    } catch (error) {
      await this.logError('Fallback search failed', {
        searchPath,
        query,
        error: error.message
      }, error);
    }

    return searchResults;
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

      // Use DocumentFolderManager if available, otherwise fallback to old behavior
      if (this.documentFolderManager) {
        const documentContent = `# ${title}\n\n${content}\n\n---\n*Created: ${new Date().toISOString()}*\n`;

        const documentFolderPath = await this.documentFolderManager.createDocumentFolder(
          title,
          targetCategory,
          documentContent
        );

        const relativePath = path.relative(this.syncHub, documentFolderPath);

        await this.logInfo('Document folder created successfully', {
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
                folderName: path.basename(documentFolderPath),
                message: `Document folder created successfully in ${targetCategory}`,
                structure: {
                  mainFile: 'main.md',
                  imagesFolder: 'images/'
                }
              }, null, 2)
            }
          ]
        };
      }

      // Fallback to old file-based behavior if DocumentFolderManager not available
      const categoryPath = path.join(this.syncHub, targetCategory);
      await fs.mkdir(categoryPath, { recursive: true });

      const fileName = `${title.replace(/[^a-zA-Z0-9\s\-_]/g, '').replace(/\s+/g, '_')}.md`;
      const filePath = path.join(categoryPath, fileName);

      // Check if file already exists
      try {
        await fs.access(filePath);
        throw new Error(`Document with title "${title}" already exists in category "${targetCategory}"`);
      } catch (accessError) {
        if (accessError.code !== 'ENOENT') {
          throw accessError;
        }
      }

      const fileContent = `# ${title}\n\n${content}\n\n---\n*Created: ${new Date().toISOString()}*\n`;
      await fs.writeFile(filePath, fileContent, 'utf8');

      const relativePath = path.relative(this.syncHub, filePath);

      await this.logInfo('Document created successfully (fallback mode)', {
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
              message: `Document created successfully in ${targetCategory} (fallback mode)`
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

    return await this.errorHandler.wrapAsync(async () => {
      await this.logInfo('Starting folder-based document organization', { dry_run });

      // Check if DocumentFolderManager is available
      if (!this.documentFolderManager) {
        throw new EnhancedError(
          'DocumentFolderManager not available',
          ErrorTypes.MODULE_NOT_LOADED,
          {
            operation: 'organizeDocuments',
            dry_run
          }
        );
      }

      const organizationResults = {
        processed: 0,
        moved: 0,
        created: 0,
        errors: [],
        categories: {}
      };

      try {
        // Find all loose files in the sync hub that need organization
        const looseFiles = await this.findLooseFiles();

        await this.logInfo(`Found ${looseFiles.length} loose files to organize`, { dry_run });

        for (const filePath of looseFiles) {
          try {
            const fileName = path.basename(filePath);
            const fileContent = await fs.readFile(filePath, 'utf8');

            // Determine category for the file
            const category = await this.determineFileCategory(filePath, fileContent);

            // Create document folder name from file name
            const documentName = this.sanitizeDocumentName(fileName);

            if (dry_run) {
              await this.logInfo(`DRY RUN: Would create document folder: ${category}/${documentName}`, {
                sourceFile: filePath
              });
              organizationResults.processed++;
              organizationResults.categories[category] = (organizationResults.categories[category] || 0) + 1;
            } else {
              // Create document folder and move file content
              const documentFolderPath = await this.documentFolderManager.createDocumentFolder(
                documentName,
                category,
                fileContent
              );

              // Remove original loose file
              await fs.unlink(filePath);

              await this.logInfo(`Organized file into document folder`, {
                sourceFile: filePath,
                documentFolder: documentFolderPath
              });

              organizationResults.processed++;
              organizationResults.moved++;
              organizationResults.categories[category] = (organizationResults.categories[category] || 0) + 1;
            }
          } catch (fileError) {
            const errorMsg = `Failed to organize file ${filePath}: ${fileError.message}`;
            organizationResults.errors.push(errorMsg);
            await this.logWarn(errorMsg, { filePath });
          }
        }

        // Ensure category directories exist and have proper structure
        await this.ensureCategoryStructure(dry_run);

        const summary = dry_run
          ? `Document organization simulation completed. Would process ${organizationResults.processed} files across ${Object.keys(organizationResults.categories).length} categories.`
          : `Document organization completed. Processed ${organizationResults.processed} files, moved ${organizationResults.moved} files across ${Object.keys(organizationResults.categories).length} categories.`;

        await this.logInfo('Document organization completed', organizationResults);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                dry_run,
                summary,
                results: organizationResults,
                timestamp: new Date().toISOString()
              }, null, 2)
            }
          ]
        };

      } catch (error) {
        throw new EnhancedError(
          `Organization failed: ${error.message}`,
          ErrorTypes.OPERATION_FAILED,
          {
            operation: 'organizeDocuments',
            dry_run,
            results: organizationResults
          },
          error
        );
      }
    }, {
      operation: 'organizeDocuments',
      dry_run
    });
  }

  async syncDocuments(args) {
    const { service = 'all' } = args;

    return await this.errorHandler.wrapAsync(async () => {
      await this.logInfo('Starting folder-aware document synchronization', { service });

      // Check if DocumentFolderManager is available
      if (!this.documentFolderManager) {
        throw new EnhancedError(
          'DocumentFolderManager not available',
          ErrorTypes.MODULE_NOT_LOADED,
          {
            operation: 'syncDocuments',
            service
          }
        );
      }

      const syncResults = {
        service,
        documentFoldersFound: 0,
        syncStatus: {},
        warnings: [],
        errors: []
      };

      try {
        // Pre-sync validation: ensure document folder integrity
        await this.validateDocumentFolderIntegrity(syncResults);

        // Execute the sync command with folder structure preservation
        const command = `cd "${this.projectRoot}" && ./src/sync/sync_module.sh ${service}`;

        await this.logInfo('Executing sync command with folder preservation', {
          command: command.replace(this.projectRoot, '[PROJECT_ROOT]'),
          service
        });

        let output;
        try {
          // Use Node.js spawn instead of execSync for better error handling
          const { spawn } = await import('child_process');

          output = await new Promise((resolve, reject) => {
            const child = spawn('sh', ['-c', command], {
              stdio: ['ignore', 'pipe', 'pipe'],
              timeout: 600000, // 10 minute timeout for sync operations
              cwd: this.projectRoot
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
              stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
              stderr += data.toString();
            });

            child.on('close', (code) => {
              if (code === 0) {
                resolve(stdout.trim());
              } else {
                reject(new Error(`Command exited with code ${code}: ${stderr || stdout}`));
              }
            });

            child.on('error', (error) => {
              reject(error);
            });

            // Handle timeout
            setTimeout(() => {
              child.kill();
              reject(new Error('Command timeout'));
            }, 600000);
          });

          syncResults.syncStatus.command_output = output;
          syncResults.syncStatus.success = true;

        } catch (execError) {
          const errorOutput = execError.message;
          syncResults.errors.push(`Sync command failed: ${errorOutput}`);
          syncResults.syncStatus.success = false;
          syncResults.syncStatus.error = errorOutput;

          await this.logError('Sync command execution failed', {
            command: command.replace(this.projectRoot, '[PROJECT_ROOT]'),
            service,
            error: errorOutput
          });
        }

        // Post-sync validation: verify document folder integrity is maintained
        await this.validateDocumentFolderIntegrity(syncResults, 'post-sync');

        const success = syncResults.syncStatus.success && syncResults.errors.length === 0;
        const summary = success
          ? `Document synchronization completed successfully for ${service}. ${syncResults.documentFoldersFound} document folders maintained integrity.`
          : `Document synchronization completed with ${syncResults.errors.length} errors for ${service}.`;

        await this.logInfo('Document synchronization completed', {
          service,
          success,
          documentFoldersFound: syncResults.documentFoldersFound,
          errorsCount: syncResults.errors.length,
          warningsCount: syncResults.warnings.length
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success,
                service,
                status: success ? 'completed' : 'completed_with_errors',
                summary,
                results: syncResults,
                folder_structure_preserved: true,
                timestamp: new Date().toISOString()
              }, null, 2)
            }
          ]
        };

      } catch (error) {
        throw new EnhancedError(
          `Sync failed: ${error.message}`,
          ErrorTypes.OPERATION_FAILED,
          {
            operation: 'syncDocuments',
            service,
            results: syncResults
          },
          error
        );
      }
    }, {
      operation: 'syncDocuments',
      service
    });
  }

  async getOrganizationStats() {
    return await this.errorHandler.wrapAsync(async () => {
      await this.logInfo('Getting folder-based organization statistics');

      // Check if DocumentFolderManager is available
      if (!this.documentFolderManager) {
        throw new EnhancedError(
          'DocumentFolderManager not available',
          ErrorTypes.MODULE_NOT_LOADED,
          {
            operation: 'getOrganizationStats'
          }
        );
      }

      const stats = {
        categories: {},
        totalDocumentFolders: 0,
        totalLooseFiles: 0,
        totalImages: 0
      };

      try {
        // Get all category directories
        const syncHubEntries = await fs.readdir(this.syncHub, { withFileTypes: true });
        const categoryDirs = syncHubEntries.filter(entry =>
          entry.isDirectory() && !entry.name.startsWith('.')
        );

        // Count document folders in each category
        for (const categoryDir of categoryDirs) {
          const categoryPath = path.join(this.syncHub, categoryDir.name);
          const documentFolders = await this.documentFolderManager.listDocumentFolders(categoryPath);

          let categoryImageCount = 0;

          // Count images in each document folder
          for (const docFolderPath of documentFolders) {
            try {
              const metadata = await this.documentFolderManager.getDocumentFolderMetadata(docFolderPath);
              categoryImageCount += metadata.metadata.imageCount || 0;
            } catch (error) {
              await this.logWarn(`Failed to get metadata for document folder: ${docFolderPath}`, {
                error: error.message
              });
            }
          }

          stats.categories[categoryDir.name] = {
            documentFolders: documentFolders.length,
            images: categoryImageCount
          };

          stats.totalDocumentFolders += documentFolders.length;
          stats.totalImages += categoryImageCount;
        }

        // Count loose files (files not in document folders)
        const looseFiles = await this.findLooseFiles();
        stats.totalLooseFiles = looseFiles.length;

        // Add uncategorized loose files as a category
        if (stats.totalLooseFiles > 0) {
          stats.categories['Uncategorized (Loose Files)'] = {
            documentFolders: 0,
            looseFiles: stats.totalLooseFiles,
            images: 0
          };
        }

        await this.logInfo('Organization statistics calculated', {
          totalCategories: Object.keys(stats.categories).length,
          totalDocumentFolders: stats.totalDocumentFolders,
          totalLooseFiles: stats.totalLooseFiles,
          totalImages: stats.totalImages
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                sync_hub: this.syncHub,
                organization_type: 'folder-based',
                categories: stats.categories,
                summary: {
                  total_document_folders: stats.totalDocumentFolders,
                  total_loose_files: stats.totalLooseFiles,
                  total_images: stats.totalImages,
                  total_categories: Object.keys(stats.categories).length
                },
                last_updated: new Date().toISOString()
              }, null, 2)
            }
          ]
        };

      } catch (error) {
        throw new EnhancedError(
          `Failed to get organization stats: ${error.message}`,
          ErrorTypes.OPERATION_FAILED,
          {
            operation: 'getOrganizationStats'
          },
          error
        );
      }
    }, {
      operation: 'getOrganizationStats'
    });
  }

  async listCategories() {
    try {
      // Use DocumentFolderManager to get accurate folder-based counts
      if (!this.documentFolderManager) {
        throw new Error('DocumentFolderManager not initialized');
      }

      const { CategoryManager } = await import('../organize/category_manager.js');
      const manager = new CategoryManager({
        projectRoot: this.projectRoot,
        syncHub: this.syncHub,
        configPath: path.join(this.projectRoot, 'config', 'organize_config.conf')
      });
      await manager.initialize();

      const allCategories = manager.getAllCategories();
      const categoryInfo = [];

      // Get accurate document folder counts for each category
      for (const category of allCategories) {
        const categoryPath = path.join(this.syncHub, category.name);
        let documentFolderCount = 0;
        let totalSize = 0;

        try {
          if (existsSync(categoryPath)) {
            const documentFolders = await this.documentFolderManager.listDocumentFolders(categoryPath);
            documentFolderCount = documentFolders.length;

            // Calculate total size of document folders
            for (const folderPath of documentFolders) {
              try {
                const stats = await fs.stat(folderPath);
                totalSize += await this.calculateFolderSize(folderPath);
              } catch (error) {
                // Skip folders that can't be accessed
                continue;
              }
            }
          }
        } catch (error) {
          await this.logWarn(`Error counting documents in category ${category.name}`, {
            categoryPath,
            error: error.message
          });
        }

        categoryInfo.push({
          name: category.name,
          description: category.description,
          document_folder_count: documentFolderCount,
          total_size: totalSize,
          exists: existsSync(categoryPath),
          category_path: categoryPath
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              categories: categoryInfo,
              total_categories: categoryInfo.length,
              total_document_folders: categoryInfo.reduce((sum, cat) => sum + cat.document_folder_count, 0)
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
        // Use Node.js spawn instead of execSync
        const { spawn } = await import('child_process');

        const output = await new Promise((resolve, reject) => {
          const child = spawn('./drive_sync.sh', ['status'], {
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: this.projectRoot,
            timeout: 10000
          });

          let stdout = '';
          let stderr = '';

          child.stdout.on('data', (data) => {
            stdout += data.toString();
          });

          child.stderr.on('data', (data) => {
            stderr += data.toString();
          });

          child.on('close', (code) => {
            if (code === 0) {
              resolve(stdout.trim());
            } else {
              reject(new Error(`drive_sync.sh exited with code ${code}: ${stderr || stdout}`));
            }
          });

          child.on('error', (error) => {
            reject(error);
          });

          setTimeout(() => {
            child.kill();
            reject(new Error('drive_sync.sh timeout'));
          }, 10000);
        });

        driveStatus = output;
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

      // Check if DocumentFolderManager is available
      if (!this.documentFolderManager) {
        throw new Error('DocumentFolderManager not available - required for folder-based analysis');
      }

      // Import the ContentAnalyzer dynamically
      const { ContentAnalyzer } = await import('../organize/content_analyzer.js');
      const analyzer = new ContentAnalyzer({ similarityThreshold: similarity_threshold });

      const results = new Map();
      const processedDocuments = [];

      // Process each path to find document folders or individual files
      for (const filePath of file_paths) {
        let actualPath;
        const searchPaths = [
          path.isAbsolute(filePath) ? filePath : null,
          path.join(this.syncHub, filePath),
          path.join(this.projectRoot, filePath),
          path.join(this.syncHub, 'organized', filePath),
          path.join(this.syncHub, path.basename(filePath))
        ].filter(Boolean);

        // Find the actual path
        for (const searchPath of searchPaths) {
          try {
            await fs.access(searchPath);
            actualPath = searchPath;
            break;
          } catch {
            continue;
          }
        }

        if (!actualPath) {
          throw new Error(`File or directory not found: ${filePath}`);
        }

        const stat = await fs.stat(actualPath);

        if (stat.isDirectory()) {
          // Check if this is a document folder
          const isDocFolder = await this.documentFolderManager.isDocumentFolder(actualPath);

          if (isDocFolder) {
            // Process as a single document folder
            processedDocuments.push({
              type: 'document_folder',
              path: actualPath,
              originalPath: filePath
            });
          } else {
            // Find all document folders within this directory
            const documentFolders = await this.documentFolderManager.findDocumentFolders(actualPath, true);
            for (const docFolder of documentFolders) {
              processedDocuments.push({
                type: 'document_folder',
                path: docFolder,
                originalPath: filePath
              });
            }
          }
        } else if (stat.isFile()) {
          // Process as individual file (legacy support)
          processedDocuments.push({
            type: 'individual_file',
            path: actualPath,
            originalPath: filePath
          });
        }
      }

      // Analyze each processed document
      for (const doc of processedDocuments) {
        let analysisPath;
        let relPath;

        if (doc.type === 'document_folder') {
          // Get the main document file from the folder
          const mainFile = await this.documentFolderManager.getMainDocumentFile(doc.path);
          if (!mainFile) {
            await this.logWarn(`No main document file found in folder: ${doc.path}`);
            continue;
          }
          analysisPath = mainFile;
          relPath = path.relative(this.syncHub, doc.path); // Use folder path for relative path
        } else {
          // Individual file
          analysisPath = doc.path;
          relPath = path.relative(this.syncHub, doc.path);
        }

        try {
          const analysis = await analyzer.analyzeContent(analysisPath);
          if (analysis) {
            // Enhance analysis with folder information
            if (doc.type === 'document_folder') {
              analysis.documentFolder = doc.path;
              analysis.isDocumentFolder = true;
              analysis.mainDocumentFile = analysisPath;

              // Check for images in the document folder
              const imagesFolder = await this.documentFolderManager.getImagesFolder(doc.path, false);
              if (existsSync(imagesFolder)) {
                try {
                  const imageFiles = await fs.readdir(imagesFolder);
                  analysis.imageCount = imageFiles.filter(f => !f.startsWith('.')).length;
                  analysis.hasImages = analysis.imageCount > 0;
                } catch (error) {
                  analysis.imageCount = 0;
                  analysis.hasImages = false;
                }
              } else {
                analysis.imageCount = 0;
                analysis.hasImages = false;
              }
            } else {
              analysis.isDocumentFolder = false;
              analysis.imageCount = 0;
              analysis.hasImages = false;
            }

            results.set(relPath, analysis);
          }
        } catch (error) {
          await this.logWarn(`Failed to analyze ${doc.type}: ${analysisPath}`, { error: error.message });
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
              documents_processed: processedDocuments.length,
              successful_analyses: results.size,
              folder_based_documents: processedDocuments.filter(d => d.type === 'document_folder').length,
              individual_files: processedDocuments.filter(d => d.type === 'individual_file').length,
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

      // Check if DocumentFolderManager is available
      if (!this.documentFolderManager) {
        throw new Error('DocumentFolderManager not available - required for folder-based duplicate detection');
      }

      // If directory is absolute, use as-is; if relative, join with syncHub
      const fullDirectoryPath = path.isAbsolute(directory)
        ? directory
        : path.join(this.syncHub, directory);

      // Find all document folders in the directory
      const documentFolders = await this.documentFolderManager.findDocumentFolders(fullDirectoryPath, true);

      // Also find any loose files (for backward compatibility)
      const looseFiles = [];
      const walk = async (dir) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Skip Obsidian-related files and directories
          if (this.isObsidianFile(fullPath)) {
            continue;
          }

          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            // Check if this is a document folder
            const isDocFolder = await this.documentFolderManager.isDocumentFolder(fullPath);
            if (!isDocFolder) {
              // Only recurse into non-document folders
              await walk(fullPath);
            }
          } else if (entry.isFile() && !entry.name.startsWith('.')) {
            // Check if this file is part of a document folder
            const parentDir = path.dirname(fullPath);
            const isInDocumentFolder = await this.documentFolderManager.isDocumentFolder(parentDir);

            if (!isInDocumentFolder) {
              // This is a loose file, include it for analysis
              try {
                await fs.access(fullPath, fs.constants.F_OK | fs.constants.R_OK);
                looseFiles.push(fullPath);
              } catch (error) {
                console.warn(`Skipping inaccessible file: ${fullPath} - ${error.message}`);
              }
            }
          }
        }
      };
      await walk(fullDirectoryPath);

      // Prepare files for analysis
      const filesToAnalyze = [];
      const documentInfo = new Map(); // Track which files belong to which document folders

      // Process document folders
      for (const docFolder of documentFolders) {
        const mainFile = await this.documentFolderManager.getMainDocumentFile(docFolder);
        if (mainFile) {
          try {
            await fs.access(mainFile, fs.constants.F_OK | fs.constants.R_OK);
            filesToAnalyze.push(mainFile);
            documentInfo.set(mainFile, {
              type: 'document_folder',
              folderPath: docFolder,
              displayPath: path.relative(this.syncHub, docFolder)
            });
          } catch (error) {
            console.warn(`Skipping inaccessible main file: ${mainFile} - ${error.message}`);
          }
        }
      }

      // Process loose files
      for (const looseFile of looseFiles) {
        filesToAnalyze.push(looseFile);
        documentInfo.set(looseFile, {
          type: 'loose_file',
          displayPath: path.relative(this.syncHub, looseFile)
        });
      }

      // Import and use ContentAnalyzer
      const { ContentAnalyzer } = await import('../organize/content_analyzer.js');
      const analyzer = new ContentAnalyzer({ similarityThreshold: similarity_threshold });

      // Clear any stale cache to prevent phantom file issues
      analyzer.contentCache.clear();
      analyzer.analysisResults.clear();

      const duplicates = await analyzer.findDuplicates(filesToAnalyze);

      // Transform results to include document folder information
      const duplicateGroups = Array.from(duplicates.entries()).map(([key, group]) => {
        const enhancedFiles = group.files.map(f => {
          const info = documentInfo.get(f.filePath);
          return {
            ...f,
            documentType: info.type,
            displayPath: info.displayPath,
            ...(info.type === 'document_folder' && { documentFolder: info.folderPath })
          };
        });

        return {
          key,
          type: group.type,
          similarity: group.similarity,
          files: enhancedFiles,
          recommended_action: group.recommendedAction,
          involves_document_folders: enhancedFiles.some(f => f.documentType === 'document_folder'),
          involves_loose_files: enhancedFiles.some(f => f.documentType === 'loose_file')
        };
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              directory: directory,
              duplicates: duplicateGroups,
              duplicate_groups: duplicateGroups,
              document_folders_scanned: documentFolders.length,
              loose_files_scanned: looseFiles.length,
              total_documents_analyzed: filesToAnalyze.length,
              duplicate_groups_found: duplicateGroups.length,
              exact_duplicates: duplicateGroups.filter(g => g.type === 'exact').length,
              similar_content: duplicateGroups.filter(g => g.type === 'similar').length,
              folder_based_duplicates: duplicateGroups.filter(g => g.involves_document_folders).length,
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
      const { topic, file_paths, strategy = 'simple_merge', enhance_with_ai = false, dry_run = false } = args;

      await this.logInfo(`Starting content consolidation`, {
        topic,
        strategy,
        fileCount: file_paths.length,
        dryRun: dry_run
      });

      // Enhanced input validation
      if (!topic || typeof topic !== 'string') {
        throw new Error('Topic is required and must be a string');
      }

      if (!file_paths || !Array.isArray(file_paths) || file_paths.length === 0) {
        throw new Error('file_paths is required and must be a non-empty array');
      }

      // Check if DocumentFolderManager is available
      if (!this.documentFolderManager) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: 'DocumentFolderManager not available - required for folder-based consolidation',
                suggestions: [
                  'Ensure DocumentFolderManager module is properly loaded',
                  'Try restarting the MCP server',
                  'Check module dependencies'
                ],
                timestamp: new Date().toISOString()
              }, null, 2)
            }
          ]
        };
      }

      // Import ContentConsolidationEngine
      let ContentConsolidationEngine;
      try {
        const engineModule = await import('../organize/content_consolidation_engine.js');
        ContentConsolidationEngine = engineModule.ContentConsolidationEngine || engineModule.default;
      } catch (importError) {
        await this.logError('Failed to import ContentConsolidationEngine', {}, importError);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: 'ContentConsolidationEngine not available',
                error: importError.message,
                suggestions: [
                  'Ensure content_consolidation_engine.js exists in organize folder',
                  'Check module import paths',
                  'Verify file permissions'
                ],
                timestamp: new Date().toISOString()
              }, null, 2)
            }
          ]
        };
      }

      // Create consolidation engine
      const consolidationEngine = new ContentConsolidationEngine(this.documentFolderManager, {
        projectRoot: this.projectRoot,
        syncHubPath: this.syncHub,
        dryRun: dry_run
      });

      // Resolve file paths to document folders
      const documentFolders = [];
      const unresolvedFiles = [];

      for (const filePath of file_paths) {
        try {
          // Try to resolve as absolute path first
          let resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(this.syncHub, filePath);

          // Check if it's a file - if so, get its parent directory (document folder)
          const stats = await fs.stat(resolvedPath);
          if (stats.isFile()) {
            resolvedPath = path.dirname(resolvedPath);
          }

          // Verify it's a document folder
          if (await this.documentFolderManager.isDocumentFolder(resolvedPath)) {
            documentFolders.push(resolvedPath);
          } else {
            // Try to find document folder containing this file
            const parentFolder = path.dirname(resolvedPath);
            if (await this.documentFolderManager.isDocumentFolder(parentFolder)) {
              documentFolders.push(parentFolder);
            } else {
              unresolvedFiles.push(filePath);
            }
          }
        } catch (error) {
          await this.logWarn(`Failed to resolve file path: ${filePath}`, { error: error.message });
          unresolvedFiles.push(filePath);
        }
      }

      if (documentFolders.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: `No document folders found for consolidation. All ${file_paths.length} files were unresolvable.`,
                unresolved_files: unresolvedFiles,
                search_locations: [
                  this.syncHub,
                  path.join(this.syncHub, 'organized')
                ],
                suggestions: [
                  'Ensure files are in document folders (folders containing main.md and images/ subfolder)',
                  'Check if files exist in the sync hub directory',
                  'Verify file paths are correct',
                  'Try organizing documents first using organize_documents tool'
                ],
                timestamp: new Date().toISOString()
              }, null, 2)
            }
          ]
        };
      }

      // Perform content consolidation
      const result = await consolidationEngine.consolidateContent(documentFolders, topic, strategy);

      await this.logInfo('Content consolidation completed', {
        topic,
        strategy,
        success: result.success,
        consolidatedFolder: result.consolidatedFolder
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              consolidation_result: {
                success: result.success,
                target_folder: result.consolidatedFolder,
                consolidated_document: path.join(result.consolidatedFolder, 'main.md'),
                original_files: file_paths,
                resolved_folders: documentFolders.map(f => path.basename(f)),
                unresolved_files: unresolvedFiles.length > 0 ? unresolvedFiles : undefined,
                strategy_used: result.strategy,
                images_merged: result.imagesMerged,
                dry_run: dry_run
              },
              batch_processing_summary: {
                files_requested: file_paths.length,
                folders_consolidated: documentFolders.length,
                unresolved_files: unresolvedFiles.length,
                success_rate: `${Math.round((documentFolders.length / file_paths.length) * 100)}%`
              },
              topic,
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };

    } catch (error) {
      await this.logError('Content consolidation failed with critical error', {
        topic: args.topic,
        file_paths: args.file_paths,
        strategy: args.strategy,
        enhance_with_ai: args.enhance_with_ai,
        dry_run: args.dry_run
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
              parameters: args,
              suggestions: [
                'Check if all required modules are available',
                'Verify file paths point to document folders',
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
                document_folders_analyzed: 0,
                poorly_categorized: 0,
                suggestion_available: false,
                error: `Directory '${directory}' does not exist`,
                timestamp: new Date().toISOString()
              }, null, 2)
            }
          ]
        };
      }

      // Use DocumentFolderManager to find document folders
      if (!this.documentFolderManager) {
        throw new Error('DocumentFolderManager not initialized');
      }

      // Import CategoryManager
      const { CategoryManager } = await import('../organize/category_manager.js');
      const manager = new CategoryManager({
        configPath: path.join(this.projectRoot, 'config', 'organize_config.conf'),
        projectRoot: this.projectRoot,
        syncHub: this.syncHub
      });
      await manager.initialize();

      // Import ContentAnalyzer
      const { ContentAnalyzer } = await import('../organize/content_analyzer.js');
      const analyzer = new ContentAnalyzer();

      // Find all document folders in the directory
      const documentFolders = await this.documentFolderManager.findDocumentFolders(fullDirectoryPath, true);
      const analyzedDocuments = [];

      // Analyze each document folder
      for (const folderPath of documentFolders) {
        try {
          // Get the main document file content
          const mainFilePath = await this.documentFolderManager.getMainDocumentFile(folderPath);
          if (!mainFilePath) {
            continue;
          }

          // Analyze the main document content
          const analysis = await analyzer.analyzeContent(mainFilePath);
          if (analysis) {
            const match = manager.findBestCategoryMatch(analysis);
            analyzedDocuments.push({
              folderPath,
              mainFilePath,
              analysis,
              match,
              folderName: path.basename(folderPath)
            });
          }
        } catch (fileError) {
          await this.logError(`Error analyzing document folder for category suggestion: ${path.basename(folderPath)}`, {
            folderPath,
            directory
          }, fileError);
          continue;
        }
      }

      const poorlyMatched = analyzedDocuments.filter(doc => doc.match && doc.match.confidence < 0.5);

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
              document_folders_analyzed: analyzedDocuments.length,
              poorly_categorized: poorlyMatched.length,
              suggestion_available: suggestion !== null,
              analyzed_folders: analyzedDocuments.map(doc => ({
                folder_name: doc.folderName,
                confidence: doc.match ? doc.match.confidence : 0,
                current_category: doc.match ? doc.match.category.name : 'Unknown'
              })),
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
        projectRoot: this.projectRoot,
        syncHub: this.syncHub
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

      // Validate input
      if (!content || typeof content !== 'string') {
        throw new Error('Content is required and must be a string');
      }

      // Analyze content structure
      const contentAnalysis = this.analyzeContentStructure(content);

      // Generate enhancement instructions based on type
      const enhancementInstructions = this.generateEnhancementInstructions(enhancement_type, contentAnalysis, topic);

      // Create client-side enhancement package
      const enhancementPackage = {
        success: true,
        operation: 'enhance_content',
        client_action_required: true,
        original_content: content,
        content_analysis: contentAnalysis,
        enhancement_instructions: enhancementInstructions,
        enhancement_type,
        topic,
        metadata: {
          content_length: content.length,
          estimated_reading_time: Math.ceil(content.split(' ').length / 200),
          structure_complexity: contentAnalysis.complexity_score,
          timestamp: new Date().toISOString()
        },
        client_instructions: {
          action: 'enhance_content',
          description: 'Use your AI capabilities to enhance the provided content according to the instructions',
          expected_output: 'Enhanced content with improved flow, structure, and readability',
          preserve_original: true
        }
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(enhancementPackage, null, 2)
          }
        ]
      };
    } catch (error) {
      await this.logError('Content enhancement failed', {
        error: error.message,
        args: this.sanitizeArgsForLogging(args)
      });

      // Return error in consistent format
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              operation: 'enhance_content',
              error: error.message,
              original_content: args.content || '',
              timestamp: new Date().toISOString(),
              debug_info: {
                content_provided: !!args.content,
                content_type: typeof args.content,
                content_length: args.content ? args.content.length : 0
              }
            }, null, 2)
          }
        ]
      };
    }
  }

  /**
   * Analyze content structure for enhancement guidance
   */
  analyzeContentStructure(content) {
    const lines = content.split('\n');
    const words = content.split(/\s+/).filter(word => word.length > 0);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Detect structure elements
    const headers = lines.filter(line => line.trim().startsWith('#'));
    const lists = lines.filter(line => /^\s*[-*+]\s/.test(line) || /^\s*\d+\.\s/.test(line));
    const codeBlocks = (content.match(/```[\s\S]*?```/g) || []).length;
    const links = (content.match(/\[.*?\]\(.*?\)/g) || []).length;
    const emphasis = (content.match(/\*\*.*?\*\*|\*.*?\*/g) || []).length;

    // Calculate complexity score
    const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;
    const avgSentencesPerParagraph = lines.filter(line => line.trim().length > 0).length / Math.max(1, content.split('\n\n').length);

    let complexityScore = 0;
    if (avgWordsPerSentence > 20) complexityScore += 2;
    if (avgWordsPerSentence > 15) complexityScore += 1;
    if (headers.length === 0 && words.length > 100) complexityScore += 2;
    if (sentences.length > 10 && headers.length === 0) complexityScore += 1;

    return {
      word_count: words.length,
      sentence_count: sentences.length,
      paragraph_count: content.split('\n\n').filter(p => p.trim().length > 0).length,
      header_count: headers.length,
      list_count: lists.length,
      code_block_count: codeBlocks,
      link_count: links,
      emphasis_count: emphasis,
      avg_words_per_sentence: Math.round(avgWordsPerSentence * 10) / 10,
      avg_sentences_per_paragraph: Math.round(avgSentencesPerParagraph * 10) / 10,
      complexity_score: Math.min(10, complexityScore),
      structure_elements: {
        has_headers: headers.length > 0,
        has_lists: lists.length > 0,
        has_code: codeBlocks > 0,
        has_links: links > 0,
        has_emphasis: emphasis > 0
      }
    };
  }

  /**
   * Generate enhancement instructions based on type and content analysis
   */
  generateEnhancementInstructions(enhancementType, analysis, topic) {
    const baseInstructions = {
      preserve_meaning: 'Maintain the original meaning and key information',
      maintain_tone: 'Keep the original tone and style appropriate for the topic',
      improve_clarity: 'Make the content clearer and easier to understand'
    };

    const typeSpecificInstructions = {
      flow: {
        focus: 'Improve the logical flow and transitions between ideas',
        actions: [
          'Add smooth transitions between paragraphs',
          'Reorganize content for better logical progression',
          'Ensure ideas build upon each other naturally',
          'Remove redundant or repetitive content'
        ]
      },
      structure: {
        focus: 'Improve the overall structure and organization',
        actions: [
          analysis.header_count === 0 ? 'Add appropriate headings and subheadings' : 'Improve existing heading structure',
          'Break up long paragraphs into digestible chunks',
          'Use bullet points or numbered lists where appropriate',
          'Ensure consistent formatting throughout'
        ]
      },
      clarity: {
        focus: 'Enhance clarity and readability',
        actions: [
          'Simplify complex sentences without losing meaning',
          'Replace jargon with clearer alternatives where appropriate',
          'Add explanations for technical terms if needed',
          'Improve word choice for better precision'
        ]
      },
      comprehensive: {
        focus: 'Comprehensive enhancement covering flow, structure, and clarity',
        actions: [
          'Improve logical flow and transitions',
          analysis.header_count === 0 ? 'Add appropriate structural elements (headings, lists)' : 'Optimize existing structure',
          'Enhance clarity and readability',
          'Ensure consistent tone and style',
          'Remove redundancy while preserving important details',
          'Optimize for the target topic: ' + topic
        ]
      }
    };

    const instructions = typeSpecificInstructions[enhancementType] || typeSpecificInstructions.comprehensive;

    // Add content-specific recommendations
    const recommendations = [];

    if (analysis.avg_words_per_sentence > 20) {
      recommendations.push('Break down long sentences for better readability');
    }

    if (analysis.complexity_score > 6) {
      recommendations.push('Simplify complex structure while maintaining depth');
    }

    if (analysis.word_count > 500 && analysis.header_count === 0) {
      recommendations.push('Add section headers to improve navigation');
    }

    if (analysis.paragraph_count > 10 && !analysis.structure_elements.has_lists) {
      recommendations.push('Consider using lists to break up dense text');
    }

    return {
      ...baseInstructions,
      enhancement_focus: instructions.focus,
      specific_actions: instructions.actions,
      content_recommendations: recommendations,
      enhancement_guidelines: {
        target_readability: 'Aim for clear, professional writing appropriate for the topic',
        structure_goal: 'Well-organized content with logical flow',
        tone_target: `Maintain appropriate tone for ${topic} content`,
        length_guidance: analysis.word_count > 1000 ? 'Consider breaking into sections' : 'Maintain current length while improving quality'
      }
    };
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

  /**
   * Check if a file path is Obsidian-related and should be protected
   */
  isObsidianFile(filePath) {
    const obsidianPatterns = [
      /\.obsidian/,
      /\.obsidian\//,
      /obsidian/i,
      /\.md\.tmp$/,
      /\.obsidian-workspace$/
    ];

    return obsidianPatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Validate folder-move policy compliance for file operations
   * @param {string} operation - The type of operation being performed
   * @param {string} sourcePath - Source file/folder path
   * @param {string} targetPath - Target file/folder path
   * @returns {Object} Validation result with compliance status and details
   */
  validateFolderMovePolicy(operation, sourcePath, targetPath = null) {
    if (!this.folderMovePolicy.enabled) {
      return { compliant: true, message: 'Folder-move policy is disabled' };
    }

    const sourceIsFile = path.extname(sourcePath) !== '';
    const sourceDir = path.dirname(sourcePath);
    const targetDir = targetPath ? path.dirname(targetPath) : null;

    // Check if this is a cross-folder file move (BLOCKED)
    if (sourceIsFile && targetPath && sourceDir !== targetDir) {
      return {
        compliant: false,
        violation: 'move_file_between_folders',
        message: `POLICY VIOLATION: Cannot move individual file '${path.basename(sourcePath)}' between folders. Must move entire folder '${path.basename(sourceDir)}' to preserve image references and document integrity.`,
        recommendation: `Move the entire folder '${path.basename(sourceDir)}' instead of individual files.`,
        blockedOperation: operation
      };
    }

    // Check if this is an individual file move without folder context (BLOCKED)
    if (sourceIsFile && operation.includes('move') && !operation.includes('rename')) {
      return {
        compliant: false,
        violation: 'move_individual_file',
        message: `POLICY VIOLATION: Cannot move individual file '${path.basename(sourcePath)}'. Must move entire folder to preserve image references.`,
        recommendation: `Move the entire folder '${path.basename(sourceDir)}' instead.`,
        blockedOperation: operation
      };
    }

    // Allow rename within same folder (ALLOWED)
    if (sourceIsFile && targetPath && sourceDir === targetDir) {
      return {
        compliant: true,
        operation: 'rename_within_folder',
        message: `Allowed: Renaming file within same folder preserves image references.`
      };
    }

    // Allow folder operations (ALLOWED)
    if (!sourceIsFile) {
      return {
        compliant: true,
        operation: 'move_entire_folder',
        message: `Allowed: Moving entire folder preserves all internal references.`
      };
    }

    return { compliant: true, message: 'Operation complies with folder-move policy' };
  }

  /**
   * Enforce folder-move policy for file operations
   * @param {string} operation - The type of operation being performed
   * @param {string} sourcePath - Source file/folder path
   * @param {string} targetPath - Target file/folder path
   * @throws {Error} If operation violates folder-move policy
   */
  enforceFolderMovePolicy(operation, sourcePath, targetPath = null) {
    const validation = this.validateFolderMovePolicy(operation, sourcePath, targetPath);

    if (!validation.compliant) {
      const error = new Error(validation.message);
      error.policyViolation = validation.violation;
      error.recommendation = validation.recommendation;
      error.blockedOperation = validation.blockedOperation;
      throw error;
    }

    return validation;
  }

  /**
   * Get folder-move policy status and configuration
   */
  getFolderMovePolicyStatus() {
    return {
      enabled: this.folderMovePolicy.enabled,
      strictMode: this.folderMovePolicy.enforceStrictMode,
      allowedOperations: this.folderMovePolicy.allowedOperations,
      blockedOperations: this.folderMovePolicy.blockedOperations,
      description: 'Ensures image references are preserved by requiring entire folder moves instead of individual file moves'
    };
  }

  /**
   * MCP tool wrapper for folder-move policy status
   */
  async getFolderMovePolicyTool() {
    try {
      const policyStatus = this.getFolderMovePolicyStatus();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              folder_move_policy: policyStatus,
              enforcement_details: {
                policy_purpose: 'Preserve image references and document integrity',
                allowed_operations: [
                  'Rename files within the same folder',
                  'Move entire folders (with all contents)',
                  'Create new folders',
                  'Delete individual files (with warnings)'
                ],
                blocked_operations: [
                  'Move individual files between folders',
                  'Move files without their associated images folder',
                  'Break relative image path references'
                ],
                compliance_examples: {
                  compliant: [
                    'mv "Deep Learning Guide/" "03_Deep_Learning_Neural_Networks/"',
                    'Rename "guide.md" to "neural_networks_guide.md" within same folder'
                  ],
                  non_compliant: [
                    'mv "Deep Learning Guide/guide.md" "Another Folder/"',
                    'Move individual .md file without its images/ subfolder'
                  ]
                }
              },
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get folder-move policy status: ${error.message}`);
    }
  }

  async deleteDocument(args) {
    const { file_path } = args;

    try {
      // Check if this is an Obsidian-related file that should not be deleted
      const fullPathForCheck = path.isAbsolute(file_path) ? file_path : path.join(this.syncHub, file_path);
      if (this.isObsidianFile(fullPathForCheck)) {
        throw new Error(`Cannot delete Obsidian-related file: ${file_path}. This file is protected to maintain vault integrity.`);
      }

      // Use DocumentFolderManager if available for folder-based deletion
      if (this.documentFolderManager) {
        const fullPath = path.isAbsolute(file_path) ? file_path : path.join(this.syncHub, file_path);

        // Check if the path is a document folder
        const isDocFolder = await this.documentFolderManager.isDocumentFolder(fullPath);

        if (isDocFolder) {
          // Delete entire document folder atomically
          await this.documentFolderManager.deleteDocumentFolder(fullPath);

          await this.logInfo('Document folder deleted successfully', {
            folderPath: file_path
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: `Document folder ${file_path} deleted successfully (including all images).`,
                  deletedType: 'folder'
                }, null, 2)
              }
            ]
          };
        }

        // If not a document folder, check if it's a path to a document folder
        // by checking parent directories
        let currentPath = fullPath;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          const parentPath = path.dirname(currentPath);
          if (parentPath === currentPath) break; // Reached root

          const isParentDocFolder = await this.documentFolderManager.isDocumentFolder(parentPath);
          if (isParentDocFolder) {
            // Delete the entire document folder
            await this.documentFolderManager.deleteDocumentFolder(parentPath);

            await this.logInfo('Document folder deleted successfully (found via parent path)', {
              originalPath: file_path,
              deletedFolderPath: parentPath
            });

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: `Document folder containing ${file_path} deleted successfully (including all images).`,
                    deletedType: 'folder',
                    deletedPath: path.relative(this.syncHub, parentPath)
                  }, null, 2)
                }
              ]
            };
          }

          currentPath = parentPath;
          attempts++;
        }
      }

      // Fallback to old file-based deletion if DocumentFolderManager not available
      // or if the path doesn't correspond to a document folder
      const fullPath = path.isAbsolute(file_path) ? file_path : path.join(this.syncHub, file_path);
      const dirPath = path.dirname(fullPath);
      const expectedFileName = path.basename(fullPath);

      // Get actual files from directory to find exact match
      let actualFilePath;
      try {
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

        if (!matchingFile) {
          throw new Error(`File does not exist: ${file_path}`);
        }

        actualFilePath = path.join(dirPath, matchingFile);
        await fs.access(actualFilePath, fs.constants.F_OK);

      } catch (error) {
        throw new Error(`Failed to locate file for deletion: ${error.message}`);
      }

      // Delete using the exact filename from directory listing
      await fs.unlink(actualFilePath);

      await this.logInfo('Document file deleted successfully (fallback mode)', {
        filePath: file_path
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Document ${file_path} deleted successfully (fallback mode).`,
              deletedType: 'file'
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      await this.logError('Document deletion failed', { file_path }, error);
      throw new Error(`Failed to delete document ${file_path}: ${error.message}`);
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

      // Use DocumentFolderManager if available for folder-based renaming
      if (this.documentFolderManager) {
        const fullPath = path.isAbsolute(old_file_path) ? old_file_path : path.join(this.syncHub, old_file_path);

        // Check if the path is a document folder
        const isDocFolder = await this.documentFolderManager.isDocumentFolder(fullPath);

        if (isDocFolder) {
          // Rename document folder and preserve internal references
          const sanitizedNewName = this.documentFolderManager.sanitizeFolderName(new_file_name);
          const parentDir = path.dirname(fullPath);
          const newFolderPath = path.join(parentDir, sanitizedNewName);

          // Check if target already exists
          if (existsSync(newFolderPath)) {
            throw new Error(`Target folder already exists: ${sanitizedNewName}`);
          }

          // Move the folder to new name
          await this.documentFolderManager.moveDocumentFolder(fullPath, newFolderPath);

          // Update main document file content to reflect new name
          const mainFilePath = await this.documentFolderManager.getMainDocumentFile(newFolderPath);
          if (mainFilePath) {
            const content = await fs.readFile(mainFilePath, 'utf8');
            // Update the first heading if it matches the old folder name
            const oldFolderName = path.basename(fullPath);
            const updatedContent = content.replace(
              new RegExp(`^# ${oldFolderName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm'),
              `# ${new_file_name}`
            );
            if (updatedContent !== content) {
              await fs.writeFile(mainFilePath, updatedContent, 'utf8');
            }
          }

          const relativePath = path.relative(this.syncHub, newFolderPath);

          await this.logInfo('Document folder renamed successfully', {
            oldPath: old_file_path,
            newPath: relativePath,
            newName: sanitizedNewName
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  old_path: old_file_path,
                  new_path: relativePath,
                  new_name: sanitizedNewName,
                  message: `Document folder renamed from ${path.basename(fullPath)} to ${sanitizedNewName} successfully.`,
                  renamedType: 'folder'
                }, null, 2)
              }
            ]
          };
        }

        // If not a document folder, check if it's a path within a document folder
        let currentPath = fullPath;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          const parentPath = path.dirname(currentPath);
          if (parentPath === currentPath) break; // Reached root

          const isParentDocFolder = await this.documentFolderManager.isDocumentFolder(parentPath);
          if (isParentDocFolder) {
            // This is a file within a document folder - rename the entire folder
            const sanitizedNewName = this.documentFolderManager.sanitizeFolderName(new_file_name);
            const grandParentDir = path.dirname(parentPath);
            const newFolderPath = path.join(grandParentDir, sanitizedNewName);

            if (existsSync(newFolderPath)) {
              throw new Error(`Target folder already exists: ${sanitizedNewName}`);
            }

            await this.documentFolderManager.moveDocumentFolder(parentPath, newFolderPath);

            const relativePath = path.relative(this.syncHub, newFolderPath);

            await this.logInfo('Document folder renamed successfully (found via parent path)', {
              originalPath: old_file_path,
              renamedFolderPath: relativePath
            });

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    old_path: old_file_path,
                    new_path: relativePath,
                    new_name: sanitizedNewName,
                    message: `Document folder containing ${old_file_path} renamed to ${sanitizedNewName} successfully.`,
                    renamedType: 'folder'
                  }, null, 2)
                }
              ]
            };
          }

          currentPath = parentPath;
          attempts++;
        }
      }

      // Fallback to old file-based renaming if DocumentFolderManager not available
      // or if the path doesn't correspond to a document folder

      // Enforce folder-move policy for rename operations
      const targetFullPath = path.join(path.dirname(fullPathForCheck), new_file_name);
      this.enforceFolderMovePolicy('rename_document', fullPathForCheck, targetFullPath);

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

      await this.logInfo('Document file renamed successfully (fallback mode)', {
        oldPath: old_file_path,
        newPath: path.relative(this.syncHub, newFullPath)
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              old_path: old_file_path,
              new_path: path.relative(this.syncHub, newFullPath),
              message: `Document ${old_file_path} renamed to ${new_file_name} successfully (fallback mode).`,
              renamedType: 'file'
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      await this.logError('Document rename failed', { old_file_path, new_file_name }, error);
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

            // Use DocumentFolderManager if available for folder-based moving
            if (this.documentFolderManager) {
              const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.syncHub, filePath);

              // Check if the path is a document folder
              const isDocFolder = await this.documentFolderManager.isDocumentFolder(fullPath);

              if (isDocFolder) {
                // Move entire document folder to new category
                const folderName = path.basename(fullPath);
                const newCategoryPath = path.join(this.syncHub, new_category);
                const newFolderPath = path.join(newCategoryPath, folderName);

                // Ensure new category directory exists
                await fs.mkdir(newCategoryPath, { recursive: true });

                if (!dry_run) {
                  await this.documentFolderManager.moveDocumentFolder(fullPath, newFolderPath);
                }

                results.push({
                  old_path: filePath,
                  new_path: path.relative(this.syncHub, newFolderPath),
                  category: new_category,
                  moved: !dry_run,
                  movedType: 'folder'
                });
                continue;
              }

              // If not a document folder, check if it's a path within a document folder
              let currentPath = fullPath;
              let attempts = 0;
              const maxAttempts = 3;
              let foundDocumentFolder = false;

              while (attempts < maxAttempts && !foundDocumentFolder) {
                const parentPath = path.dirname(currentPath);
                if (parentPath === currentPath) break; // Reached root

                const isParentDocFolder = await this.documentFolderManager.isDocumentFolder(parentPath);
                if (isParentDocFolder) {
                  // Move the entire document folder
                  const folderName = path.basename(parentPath);
                  const newCategoryPath = path.join(this.syncHub, new_category);
                  const newFolderPath = path.join(newCategoryPath, folderName);

                  await fs.mkdir(newCategoryPath, { recursive: true });

                  if (!dry_run) {
                    await this.documentFolderManager.moveDocumentFolder(parentPath, newFolderPath);
                  }

                  results.push({
                    old_path: filePath,
                    new_path: path.relative(this.syncHub, newFolderPath),
                    category: new_category,
                    moved: !dry_run,
                    movedType: 'folder',
                    note: `Moved entire document folder containing ${filePath}`
                  });
                  foundDocumentFolder = true;
                  break;
                }

                currentPath = parentPath;
                attempts++;
              }

              if (foundDocumentFolder) {
                continue;
              }
            }

            // Fallback to old file-based moving if DocumentFolderManager not available
            // or if the path doesn't correspond to a document folder

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

            // Enforce folder-move policy for move operations
            this.enforceFolderMovePolicy('move_document', actualOldPath, newFullPath);

            if (!dry_run) {
              await fs.rename(actualOldPath, newFullPath);
            }

            results.push({
              old_path: filePath,
              new_path: path.relative(this.syncHub, newFullPath),
              category: new_category,
              moved: !dry_run,
              movedType: 'file'
            });
          } catch (moveError) {
            results.push({
              old_path: filePath,
              error: moveError.message,
              moved: false
            });
          }
        }

        await this.logInfo('Document move operation completed', {
          totalFiles: filePaths.length,
          successfulMoves: results.filter(r => r.moved).length,
          failedMoves: results.filter(r => !r.moved).length,
          newCategory: new_category,
          dryRun: dry_run
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: results.every(r => r.moved !== false),
                results,
                new_category,
                dry_run,
                message: `${dry_run ? 'Simulated' : 'Completed'} move of ${results.length} document(s) to ${new_category}`,
                timestamp: new Date().toISOString()
              }, null, 2)
            }
          ]
        };
      }

      // Handle consolidation-based moves (legacy functionality)
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
      await this.logError('Document move failed', { file_path, file_paths, new_category }, error);
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

  /**
   * Resolve and validate file or directory paths using simplified path resolution
   */
  async resolvePath(args) {
    const { path: inputPath, base_path, validate_existence = true, path_type = 'any' } = args;

    if (!this.pathResolver) {
      throw new Error('SimplePathResolver not available. Module may not be loaded.');
    }

    try {
      // Resolve the path
      const resolvedPath = this.pathResolver.resolvePath(inputPath, base_path);

      const result = {
        input_path: inputPath,
        resolved_path: resolvedPath,
        is_absolute: this.pathResolver.constructor.isAbsolute ? this.pathResolver.constructor.isAbsolute(resolvedPath) : path.isAbsolute(resolvedPath),
        base_path: base_path || null
      };

      if (validate_existence) {
        try {
          const validatedPath = await this.pathResolver.validatePath(resolvedPath, path_type);
          result.exists = true;
          result.validated_path = validatedPath;

          // Get additional info about the path
          if (path_type === 'any' || path_type === 'file') {
            result.is_file = await this.pathResolver.fileExists(resolvedPath);
          }
          if (path_type === 'any' || path_type === 'directory') {
            result.is_directory = await this.pathResolver.directoryExists(resolvedPath);
          }
        } catch (error) {
          result.exists = false;
          result.error = error.message;
        }
      }

      await this.logInfo('Path resolved successfully', {
        inputPath,
        resolvedPath,
        exists: result.exists
      });

      return {
        type: 'text',
        text: JSON.stringify(result, null, 2)
      };
    } catch (error) {
      await this.logError('Path resolution failed', { inputPath, basePath: base_path }, error);
      throw error;
    }
  }

  /**
   * Get information about loaded modules and module directories
   */
  async getModuleInfo(args) {
    const { include_stats = true, include_directories = true } = args;

    const result = {
      modules_loaded: this.modulesLoaded,
      loaded_modules: Object.keys(this.modules),
      module_count: Object.keys(this.modules).length
    };

    if (include_directories && this.moduleLoader) {
      const stats = this.moduleLoader.getStats();
      result.module_directories = stats.moduleDirectories;
      result.base_directory = stats.baseDir;
    }

    if (include_stats && this.moduleLoader) {
      const stats = this.moduleLoader.getStats();
      result.statistics = {
        cached_modules: stats.cached,
        failed_modules: stats.failed,
        cached_module_list: stats.cachedModules,
        failed_module_list: stats.failedModules
      };
    }

    // Add path resolver info if available
    if (this.pathResolver) {
      result.path_resolver = {
        available: true,
        project_root: this.pathResolver.projectRoot,
        sync_hub_path: this.pathResolver.syncHubPath
      };
    } else {
      result.path_resolver = {
        available: false
      };
    }

    await this.logInfo('Module information retrieved', {
      moduleCount: result.module_count,
      pathResolverAvailable: !!this.pathResolver
    });

    return {
      type: 'text',
      text: JSON.stringify(result, null, 2)
    };
  }

  /**
   * Dynamically load a module from organize, sync, or mcp directories
   */
  async loadModule(args) {
    const { module_name, directory = 'organize', required = false } = args;

    if (!this.moduleLoader) {
      throw new Error('ModuleLoader not available');
    }

    try {
      let module;

      // Use directory-specific loading methods
      switch (directory) {
        case 'organize':
          module = await this.moduleLoader.loadOrganizeModule(module_name, { required });
          break;
        case 'sync':
          module = await this.moduleLoader.loadSyncModule(module_name, { required });
          break;
        case 'mcp':
          module = await this.moduleLoader.loadMcpModule(module_name, { required });
          break;
        default:
          throw new Error(`Invalid directory: ${directory}. Must be 'organize', 'sync', or 'mcp'`);
      }

      const result = {
        module_name,
        directory,
        loaded: !!module,
        required
      };

      if (module) {
        // Store the loaded module
        this.modules[module_name] = module;

        result.exports = Object.keys(module);
        result.has_default = !!module.default;

        await this.logInfo('Module loaded successfully', {
          moduleName: module_name,
          directory,
          exports: result.exports
        });
      } else {
        result.error = 'Module not found or failed to load';

        await this.logWarn('Module loading failed', {
          moduleName: module_name,
          directory,
          required
        });
      }

      return {
        type: 'text',
        text: JSON.stringify(result, null, 2)
      };
    } catch (error) {
      await this.logError('Module loading error', { moduleName: module_name, directory }, error);
      throw error;
    }
  }

  /**
   * Validate multiple paths and check their existence and types
   */
  async validatePaths(args) {
    const { paths } = args;

    if (!this.pathResolver) {
      throw new Error('SimplePathResolver not available. Module may not be loaded.');
    }

    if (!Array.isArray(paths) || paths.length === 0) {
      throw new Error('Paths array is required and must not be empty');
    }

    const results = [];
    let validCount = 0;
    let invalidCount = 0;

    for (const pathSpec of paths) {
      const { path: inputPath, expected_type = 'any', required = true } = pathSpec;

      const pathResult = {
        input_path: inputPath,
        expected_type,
        required
      };

      try {
        // Resolve the path
        const resolvedPath = this.pathResolver.resolvePath(inputPath);
        pathResult.resolved_path = resolvedPath;
        pathResult.is_absolute = path.isAbsolute(resolvedPath);

        // Validate existence and type
        try {
          const validatedPath = await this.pathResolver.validatePath(resolvedPath, expected_type);
          pathResult.exists = true;
          pathResult.validated_path = validatedPath;
          pathResult.valid = true;
          validCount++;

          // Get specific type information
          if (expected_type === 'any') {
            pathResult.is_file = await this.pathResolver.fileExists(resolvedPath);
            pathResult.is_directory = await this.pathResolver.directoryExists(resolvedPath);
            pathResult.actual_type = pathResult.is_file ? 'file' : (pathResult.is_directory ? 'directory' : 'unknown');
          } else {
            pathResult.actual_type = expected_type;
          }
        } catch (validationError) {
          pathResult.exists = false;
          pathResult.valid = false;
          pathResult.error = validationError.message;

          if (required) {
            invalidCount++;
          }
        }
      } catch (resolutionError) {
        pathResult.valid = false;
        pathResult.error = `Path resolution failed: ${resolutionError.message}`;

        if (required) {
          invalidCount++;
        }
      }

      results.push(pathResult);
    }

    const summary = {
      total_paths: paths.length,
      valid_paths: validCount,
      invalid_paths: invalidCount,
      validation_success_rate: `${((validCount / paths.length) * 100).toFixed(1)}%`,
      results
    };

    await this.logInfo('Path validation completed', {
      totalPaths: paths.length,
      validPaths: validCount,
      invalidPaths: invalidCount
    });

    return {
      type: 'text',
      text: JSON.stringify(summary, null, 2)
    };
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
