/**
 * Tool Response Handler
 * Provides consistent response formatting and client instruction generation for MCP tools
 */

export class ToolResponseHandler {
    constructor() {
        this.version = '1.0.0';
    }

    /**
     * Format a successful tool response with consistent structure
     * @param {any} data - The response data
     * @param {Object} metadata - Optional metadata about the operation
     * @returns {Object} Formatted success response
     */
    formatSuccessResponse(data, metadata = {}) {
        const response = {
            success: true,
            data,
            timestamp: new Date().toISOString(),
            ...metadata
        };

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(response, null, 2)
                }
            ],
            isError: false
        };
    }

    /**
     * Format an error response with comprehensive structure and context
     * @param {Error} error - The error that occurred
     * @param {Object} context - Additional context about the error
     * @returns {Object} Formatted error response
     */
    formatErrorResponse(error, context = {}) {
        const errorResponse = {
            success: false,
            error: {
                message: error.message,
                type: error.name || 'Error',
                code: error.code || 'UNKNOWN_ERROR',
                category: this._categorizeError(error),
                severity: this._determineSeverity(error, context)
            },
            context: {
                ...context,
                operation: context.operation || 'unknown',
                component: context.component || 'unknown',
                timestamp: new Date().toISOString()
            },
            timestamp: new Date().toISOString(),
            debugInfo: this._extractDebugInfo(error, context),
            recoveryGuidance: this._generateRecoveryGuidance(error, context),
            troubleshooting: this._generateTroubleshootingInfo(error, context)
        };

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(errorResponse, null, 2)
                }
            ],
            isError: true
        };
    }

    /**
     * Format a response that provides instructions for client-side operations
     * @param {Object} instruction - The instruction object for the client
     * @param {any} data - Associated data for the instruction
     * @returns {Object} Formatted client instruction response
     */
    formatClientInstructionResponse(instruction, data) {
        const response = {
            success: true,
            clientInstruction: instruction,
            data,
            timestamp: new Date().toISOString(),
            requiresClientAction: true
        };

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(response, null, 2)
                }
            ],
            isError: false
        };
    }

    /**
     * Create enhancement instruction for client-side AI enhancement
     * @param {string} content - Content to be enhanced
     * @param {string} enhancementType - Type of enhancement (flow, structure, clarity, comprehensive)
     * @param {string} topic - Topic or subject of the content
     * @returns {Object} Enhancement instruction object
     */
    createEnhancementInstruction(content, enhancementType = 'comprehensive', topic = '') {
        const enhancementPrompts = {
            flow: 'Improve the flow and readability of this content while maintaining its core message and structure.',
            structure: 'Reorganize this content with better structure, headings, and logical flow.',
            clarity: 'Enhance the clarity and comprehensibility of this content, making it easier to understand.',
            comprehensive: 'Comprehensively enhance this content by improving flow, structure, clarity, and overall quality.'
        };

        return {
            type: 'enhance_content',
            action: 'client_side_enhancement',
            parameters: {
                content,
                enhancementType,
                topic,
                prompt: enhancementPrompts[enhancementType] || enhancementPrompts.comprehensive,
                instructions: [
                    'Use your AI capabilities to enhance the provided content',
                    'Maintain the original meaning and key information',
                    'Apply the specified enhancement type',
                    topic ? `Consider the topic: ${topic}` : 'Infer the topic from the content',
                    'Return the enhanced content in the same format as the original'
                ]
            },
            metadata: {
                originalLength: content.length,
                enhancementType,
                topic: topic || 'auto-detected'
            }
        };
    }

    /**
     * Create analysis instruction for client-side content analysis
     * @param {string} content - Content to be analyzed
     * @param {string} analysisType - Type of analysis to perform
     * @returns {Object} Analysis instruction object
     */
    createAnalysisInstruction(content, analysisType) {
        const analysisPrompts = {
            summary: 'Provide a concise summary of this content, highlighting key points and main themes.',
            topics: 'Identify and list the main topics and themes covered in this content.',
            keywords: 'Extract important keywords and key phrases from this content.',
            structure: 'Analyze the structure and organization of this content.',
            sentiment: 'Analyze the sentiment and tone of this content.',
            comprehensive: 'Perform a comprehensive analysis including summary, topics, keywords, structure, and sentiment.'
        };

        return {
            type: 'analyze_content',
            action: 'client_side_analysis',
            parameters: {
                content,
                analysisType,
                prompt: analysisPrompts[analysisType] || analysisPrompts.comprehensive,
                instructions: [
                    'Analyze the provided content using your AI capabilities',
                    'Focus on the specified analysis type',
                    'Provide structured, actionable insights',
                    'Return results in a clear, organized format'
                ]
            },
            metadata: {
                contentLength: content.length,
                analysisType,
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Add operation metadata to a response
     * @param {Object} response - The response object to enhance
     * @param {string} operation - The operation that was performed
     * @param {Object} timing - Timing information about the operation
     * @returns {Object} Enhanced response with metadata
     */
    addOperationMetadata(response, operation, timing = {}) {
        const metadata = {
            operation,
            timing: {
                startTime: timing.startTime || new Date().toISOString(),
                endTime: timing.endTime || new Date().toISOString(),
                duration: timing.duration || 0,
                ...timing
            },
            version: this.version
        };

        if (response.content && response.content[0] && response.content[0].text) {
            try {
                const responseData = JSON.parse(response.content[0].text);
                responseData.operationMetadata = metadata;
                response.content[0].text = JSON.stringify(responseData, null, 2);
            } catch (error) {
                // If parsing fails, add metadata as a separate content block
                response.content.push({
                    type: 'text',
                    text: `\n\nOperation Metadata:\n${JSON.stringify(metadata, null, 2)}`
                });
            }
        }

        return response;
    }

    /**
     * Add debug information to a response
     * @param {Object} response - The response object to enhance
     * @param {Object} debugData - Debug information to add
     * @returns {Object} Enhanced response with debug information
     */
    addDebugInformation(response, debugData) {
        if (response.content && response.content[0] && response.content[0].text) {
            try {
                const responseData = JSON.parse(response.content[0].text);
                responseData.debugInfo = {
                    ...responseData.debugInfo,
                    ...debugData,
                    timestamp: new Date().toISOString()
                };
                response.content[0].text = JSON.stringify(responseData, null, 2);
            } catch (error) {
                // If parsing fails, add debug info as a separate content block
                response.content.push({
                    type: 'text',
                    text: `\n\nDebug Information:\n${JSON.stringify(debugData, null, 2)}`
                });
            }
        }

        return response;
    }

    /**
     * Extract comprehensive debug information from error and context
     * @private
     * @param {Error} error - The error object
     * @param {Object} context - Additional context
     * @returns {Object} Debug information
     */
    _extractDebugInfo(error, context) {
        const debugInfo = {
            stack: error.stack,
            originalError: error.originalError ? {
                name: error.originalError.name,
                message: error.originalError.message,
                code: error.originalError.code,
                stack: error.originalError.stack
            } : null,
            context,
            timestamp: new Date().toISOString(),
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                pid: process.pid,
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage()
            },
            errorChain: this._buildErrorChain(error),
            systemState: this._captureSystemState(context)
        };

        // Add file system context if available
        if (context.filePath || context.folderPath) {
            debugInfo.fileSystemContext = this._captureFileSystemContext(context);
        }

        return debugInfo;
    }

    /**
     * Categorize error for better handling
     * @private
     * @param {Error} error - The error object
     * @returns {string} Error category
     */
    _categorizeError(error) {
        if (!error) return 'unknown';

        // Check error code first
        if (error.code === 'ENOENT') return 'file_not_found';
        if (error.code === 'EACCES') return 'permission_denied';
        if (error.code === 'ETIMEDOUT' || error.code === 'TIMEOUT') return 'timeout';
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') return 'network';

        // Check error message patterns
        const message = error.message?.toLowerCase() || '';

        if (message.includes('import') || message.includes('module') || message.includes('require')) {
            return 'module_import';
        }
        if (message.includes('config') || message.includes('configuration')) {
            return 'configuration';
        }
        if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
            return 'validation';
        }
        if (message.includes('network') || message.includes('connection') || message.includes('fetch')) {
            return 'network';
        }
        if (message.includes('timeout') || message.includes('timed out')) {
            return 'timeout';
        }
        if (message.includes('content') || message.includes('parse') || message.includes('process')) {
            return 'content_processing';
        }
        if (message.includes('folder') || message.includes('directory')) {
            return 'folder_operation';
        }
        if (message.includes('search') || message.includes('query')) {
            return 'search_operation';
        }

        return 'unknown';
    }

    /**
     * Determine error severity
     * @private
     * @param {Error} error - The error object
     * @param {Object} context - Error context
     * @returns {string} Severity level
     */
    _determineSeverity(error, context) {
        // Critical errors that prevent system operation
        if (error.code === 'EACCES' || error.message?.includes('CRITICAL')) {
            return 'critical';
        }

        // High severity for data loss or corruption risks
        if (error.message?.includes('corrupt') || error.message?.includes('delete') ||
            context.operation?.includes('delete') || context.operation?.includes('move')) {
            return 'high';
        }

        // Medium severity for functional failures
        if (error.code === 'ENOENT' || error.message?.includes('not found') ||
            error.message?.includes('failed to')) {
            return 'medium';
        }

        // Low severity for recoverable issues
        if (error.message?.includes('warning') || error.message?.includes('skip')) {
            return 'low';
        }

        return 'medium'; // Default
    }

    /**
     * Generate recovery guidance for the error
     * @private
     * @param {Error} error - The error object
     * @param {Object} context - Error context
     * @returns {Object} Recovery guidance
     */
    _generateRecoveryGuidance(error, context) {
        const category = this._categorizeError(error);

        const recoveryStrategies = {
            file_not_found: {
                immediate: [
                    'Verify the file path is correct',
                    'Check if the file was moved or deleted',
                    'Ensure you have read permissions for the directory'
                ],
                alternative: [
                    'Search for the file in parent directories',
                    'Use the search tool to locate similar files',
                    'Create the file if it should exist'
                ],
                prevention: [
                    'Use absolute paths when possible',
                    'Implement file existence checks before operations',
                    'Add file monitoring for critical files'
                ]
            },
            permission_denied: {
                immediate: [
                    'Check file and directory permissions',
                    'Verify you have the necessary access rights',
                    'Try running with appropriate permissions'
                ],
                alternative: [
                    'Use a different file location with write access',
                    'Copy files to a writable location',
                    'Request administrator access if needed'
                ],
                prevention: [
                    'Set up proper file permissions during setup',
                    'Use user-writable directories for operations',
                    'Implement permission checks before operations'
                ]
            },
            module_import: {
                immediate: [
                    'Check if the module is installed',
                    'Verify the import path is correct',
                    'Ensure all dependencies are available'
                ],
                alternative: [
                    'Use a fallback implementation',
                    'Install missing dependencies',
                    'Use dynamic imports with error handling'
                ],
                prevention: [
                    'Add dependency checks during startup',
                    'Use package.json to manage dependencies',
                    'Implement graceful degradation for optional modules'
                ]
            },
            validation: {
                immediate: [
                    'Check the input parameters',
                    'Verify required fields are provided',
                    'Ensure data types match expectations'
                ],
                alternative: [
                    'Use default values for missing parameters',
                    'Prompt user for correct input',
                    'Skip validation for non-critical fields'
                ],
                prevention: [
                    'Add input validation at entry points',
                    'Provide clear parameter documentation',
                    'Use schema validation for complex inputs'
                ]
            },
            folder_operation: {
                immediate: [
                    'Verify the folder exists and is accessible',
                    'Check folder permissions',
                    'Ensure the folder is not in use by another process'
                ],
                alternative: [
                    'Create the folder if it doesn\'t exist',
                    'Use a temporary folder for operations',
                    'Retry the operation after a brief delay'
                ],
                prevention: [
                    'Implement atomic folder operations',
                    'Add folder existence checks',
                    'Use proper locking mechanisms'
                ]
            },
            search_operation: {
                immediate: [
                    'Verify the search path exists',
                    'Check if there are files to search',
                    'Ensure search permissions are adequate'
                ],
                alternative: [
                    'Expand the search to parent directories',
                    'Use different search criteria',
                    'Try a simpler search approach'
                ],
                prevention: [
                    'Index files for faster searching',
                    'Implement search result caching',
                    'Add search path validation'
                ]
            },
            content_processing: {
                immediate: [
                    'Check if the content format is supported',
                    'Verify the content is not corrupted',
                    'Ensure sufficient memory is available'
                ],
                alternative: [
                    'Use a simpler processing approach',
                    'Process content in smaller chunks',
                    'Skip problematic content sections'
                ],
                prevention: [
                    'Add content format validation',
                    'Implement streaming for large content',
                    'Add memory usage monitoring'
                ]
            },
            network: {
                immediate: [
                    'Check network connectivity',
                    'Verify the target server is accessible',
                    'Check for firewall or proxy issues'
                ],
                alternative: [
                    'Use cached data if available',
                    'Retry with exponential backoff',
                    'Switch to offline mode'
                ],
                prevention: [
                    'Implement connection pooling',
                    'Add network status monitoring',
                    'Use circuit breaker patterns'
                ]
            },
            timeout: {
                immediate: [
                    'Increase timeout values',
                    'Check system performance',
                    'Verify no blocking operations'
                ],
                alternative: [
                    'Break operation into smaller steps',
                    'Use asynchronous processing',
                    'Implement operation cancellation'
                ],
                prevention: [
                    'Set appropriate timeout values',
                    'Monitor operation performance',
                    'Implement progress indicators'
                ]
            }
        };

        return recoveryStrategies[category] || {
            immediate: ['Review the error message for specific guidance'],
            alternative: ['Try a different approach or contact support'],
            prevention: ['Implement proper error handling and validation']
        };
    }

    /**
     * Generate troubleshooting information
     * @private
     * @param {Error} error - The error object
     * @param {Object} context - Error context
     * @returns {Object} Troubleshooting information
     */
    _generateTroubleshootingInfo(error, context) {
        return {
            commonCauses: this._identifyCommonCauses(error, context),
            diagnosticSteps: this._generateDiagnosticSteps(error, context),
            relatedIssues: this._findRelatedIssues(error, context),
            supportInfo: {
                errorId: this._generateErrorId(error, context),
                reportingGuidelines: [
                    'Include the full error message and stack trace',
                    'Provide steps to reproduce the issue',
                    'Include system information and environment details',
                    'Attach relevant log files if available'
                ]
            }
        };
    }

    /**
     * Build error chain for nested errors
     * @private
     * @param {Error} error - The error object
     * @returns {Array} Error chain
     */
    _buildErrorChain(error) {
        const chain = [];
        let currentError = error;

        while (currentError) {
            chain.push({
                name: currentError.name,
                message: currentError.message,
                code: currentError.code,
                type: currentError.type
            });
            currentError = currentError.originalError || currentError.cause;
        }

        return chain;
    }

    /**
     * Capture current system state
     * @private
     * @param {Object} context - Error context
     * @returns {Object} System state information
     */
    _captureSystemState(context) {
        return {
            timestamp: new Date().toISOString(),
            operation: context.operation,
            component: context.component,
            workingDirectory: process.cwd(),
            environment: process.env.NODE_ENV || 'development',
            args: context.args ? this._sanitizeArgsForLogging(context.args) : null
        };
    }

    /**
     * Capture file system context
     * @private
     * @param {Object} context - Error context
     * @returns {Object} File system context
     */
    _captureFileSystemContext(context) {
        const fsContext = {};

        if (context.filePath) {
            fsContext.targetFile = {
                path: context.filePath,
                exists: this._checkFileExists(context.filePath),
                accessible: this._checkFileAccessible(context.filePath)
            };
        }

        if (context.folderPath) {
            fsContext.targetFolder = {
                path: context.folderPath,
                exists: this._checkFileExists(context.folderPath),
                accessible: this._checkFileAccessible(context.folderPath)
            };
        }

        return fsContext;
    }

    /**
     * Check if file exists (safe version)
     * @private
     * @param {string} filePath - Path to check
     * @returns {boolean} Whether file exists
     */
    _checkFileExists(filePath) {
        try {
            const fs = require('fs');
            return fs.existsSync(filePath);
        } catch {
            return false;
        }
    }

    /**
     * Check if file is accessible (safe version)
     * @private
     * @param {string} filePath - Path to check
     * @returns {boolean} Whether file is accessible
     */
    _checkFileAccessible(filePath) {
        try {
            const fs = require('fs');
            fs.accessSync(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Identify common causes for the error
     * @private
     * @param {Error} error - The error object
     * @param {Object} context - Error context
     * @returns {Array} Common causes
     */
    _identifyCommonCauses(error, context) {
        const category = this._categorizeError(error);

        const commonCauses = {
            file_not_found: [
                'File was moved or deleted',
                'Incorrect file path specified',
                'File is in a different directory than expected',
                'Permissions prevent file access'
            ],
            permission_denied: [
                'Insufficient user permissions',
                'File or directory is read-only',
                'File is locked by another process',
                'Security restrictions in place'
            ],
            module_import: [
                'Module not installed or missing',
                'Incorrect import path',
                'Version compatibility issues',
                'Circular dependency problems'
            ],
            validation: [
                'Required parameters missing',
                'Invalid parameter types',
                'Parameter values out of range',
                'Malformed input data'
            ],
            folder_operation: [
                'Folder does not exist',
                'Insufficient permissions',
                'Folder is not empty when it should be',
                'Path contains invalid characters'
            ],
            search_operation: [
                'Search path does not exist',
                'No files match search criteria',
                'Search permissions insufficient',
                'Search index is outdated'
            ],
            content_processing: [
                'Content format not supported',
                'Content is corrupted or malformed',
                'Insufficient memory for processing',
                'Content size exceeds limits'
            ]
        };

        return commonCauses[category] || ['Unknown cause - requires investigation'];
    }

    /**
     * Generate diagnostic steps
     * @private
     * @param {Error} error - The error object
     * @param {Object} context - Error context
     * @returns {Array} Diagnostic steps
     */
    _generateDiagnosticSteps(error, context) {
        const category = this._categorizeError(error);

        const diagnosticSteps = {
            file_not_found: [
                'Verify the file path exists',
                'Check parent directory permissions',
                'List directory contents to confirm file location',
                'Check if file was recently moved or deleted'
            ],
            permission_denied: [
                'Check file/directory permissions with ls -la',
                'Verify current user has necessary access',
                'Check if file is locked by another process',
                'Try accessing with elevated permissions'
            ],
            module_import: [
                'Verify module is installed with npm list',
                'Check import path syntax',
                'Verify module version compatibility',
                'Check for circular dependencies'
            ],
            validation: [
                'Review input parameters',
                'Check parameter types and formats',
                'Verify required fields are present',
                'Test with minimal valid input'
            ],
            folder_operation: [
                'Check if folder exists',
                'Verify folder permissions',
                'Check folder contents',
                'Test with a simple folder operation'
            ],
            search_operation: [
                'Verify search path exists',
                'Check search permissions',
                'Test with a simple search query',
                'Verify search index is current'
            ],
            content_processing: [
                'Check content format and encoding',
                'Verify content is not corrupted',
                'Test with smaller content samples',
                'Check available memory and resources'
            ]
        };

        return diagnosticSteps[category] || ['Investigate error message and stack trace'];
    }

    /**
     * Find related issues
     * @private
     * @param {Error} error - The error object
     * @param {Object} context - Error context
     * @returns {Array} Related issues
     */
    _findRelatedIssues(error, context) {
        // This could be enhanced to check against a knowledge base
        return [
            'Check recent system changes',
            'Review similar errors in logs',
            'Verify system dependencies',
            'Check for known issues in documentation'
        ];
    }

    /**
     * Generate unique error ID for tracking
     * @private
     * @param {Error} error - The error object
     * @param {Object} context - Error context
     * @returns {string} Unique error ID
     */
    _generateErrorId(error, context) {
        const timestamp = Date.now();
        const errorHash = this._simpleHash(error.message + error.stack);
        const contextHash = this._simpleHash(JSON.stringify(context));
        return `ERR_${timestamp}_${errorHash}_${contextHash}`.substring(0, 32);
    }

    /**
     * Simple hash function for error ID generation
     * @private
     * @param {string} str - String to hash
     * @returns {string} Hash value
     */
    _simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Create a standardized response for operations that require external resources
     * @param {string} operation - The operation being performed
     * @param {string} reason - Why external resources are needed
     * @param {Object} alternatives - Alternative approaches or fallback options
     * @returns {Object} Formatted response explaining the limitation
     */
    createExternalResourceResponse(operation, reason, alternatives = {}) {
        const response = {
            success: false,
            requiresExternalResources: true,
            operation,
            reason,
            alternatives,
            clientGuidance: {
                message: 'This operation requires external resources not available to the MCP server',
                suggestedActions: [
                    'Use client-side capabilities for this operation',
                    'Consider alternative approaches listed in the response',
                    'Check if the operation can be broken down into server-supported steps'
                ]
            },
            timestamp: new Date().toISOString()
        };

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(response, null, 2)
                }
            ],
            isError: false
        };
    }

    /**
     * Wrap a tool execution with consistent response formatting and error handling
     * @param {Function} toolFunction - The tool function to execute
     * @param {Object} args - Arguments for the tool function
     * @param {Object} options - Options for response formatting
     * @returns {Promise<Object>} Formatted response
     */
    async wrapToolExecution(toolFunction, args, options = {}) {
        const startTime = Date.now();
        const operation = options.operation || 'unknown_operation';

        try {
            const result = await toolFunction(args);
            const endTime = Date.now();

            const timing = {
                startTime: new Date(startTime).toISOString(),
                endTime: new Date(endTime).toISOString(),
                duration: endTime - startTime
            };

            let response = this.formatSuccessResponse(result, options.metadata);
            response = this.addOperationMetadata(response, operation, timing);

            if (options.debugData) {
                response = this.addDebugInformation(response, options.debugData);
            }

            return response;
        } catch (error) {
            const endTime = Date.now();
            const timing = {
                startTime: new Date(startTime).toISOString(),
                endTime: new Date(endTime).toISOString(),
                duration: endTime - startTime
            };

            const context = {
                operation,
                args: this._sanitizeArgsForLogging(args),
                timing,
                ...options.context
            };

            let response = this.formatErrorResponse(error, context);

            if (options.debugData) {
                response = this.addDebugInformation(response, options.debugData);
            }

            return response;
        }
    }

    /**
     * Create a comprehensive error response with recovery suggestions
     * @param {Error} error - The error that occurred
     * @param {Object} context - Error context including operation details
     * @param {Object} options - Additional options for error formatting
     * @returns {Object} Comprehensive error response
     */
    createComprehensiveErrorResponse(error, context = {}, options = {}) {
        const errorCategory = this._categorizeError(error);
        const severity = this._determineSeverity(error, context);
        const recoveryGuidance = this._generateRecoveryGuidance(error, context);

        const comprehensiveError = {
            success: false,
            error: {
                id: this._generateErrorId(error, context),
                message: error.message,
                type: error.name || 'Error',
                code: error.code || 'UNKNOWN_ERROR',
                category: errorCategory,
                severity: severity
            },
            context: {
                ...context,
                operation: context.operation || 'unknown',
                component: context.component || 'unknown',
                timestamp: new Date().toISOString(),
                requestId: context.requestId || this._generateRequestId()
            },
            recovery: {
                isRecoverable: this._isRecoverable(error, context),
                automaticRetry: this._shouldAutoRetry(error, context),
                userAction: recoveryGuidance.immediate,
                alternatives: recoveryGuidance.alternative,
                prevention: recoveryGuidance.prevention
            },
            troubleshooting: this._generateTroubleshootingInfo(error, context),
            debugInfo: options.includeDebugInfo !== false ? this._extractDebugInfo(error, context) : null,
            timestamp: new Date().toISOString()
        };

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(comprehensiveError, null, 2)
                }
            ],
            isError: true
        };
    }

    /**
     * Create a user-friendly error response with actionable guidance
     * @param {Error} error - The error that occurred
     * @param {Object} context - Error context
     * @param {string} userMessage - User-friendly message
     * @returns {Object} User-friendly error response
     */
    createUserFriendlyErrorResponse(error, context = {}, userMessage = null) {
        const category = this._categorizeError(error);
        const recovery = this._generateRecoveryGuidance(error, context);

        const friendlyMessages = {
            file_not_found: 'The requested file could not be found. Please check the file path and try again.',
            permission_denied: 'Access to the file or folder was denied. Please check your permissions.',
            module_import: 'A required component could not be loaded. The system will use a fallback approach.',
            validation: 'The provided information is invalid or incomplete. Please check your input.',
            folder_operation: 'The folder operation could not be completed. Please verify the folder exists and is accessible.',
            search_operation: 'The search could not be completed. Please try a different search term or location.',
            content_processing: 'The content could not be processed. Please check the content format and try again.',
            network: 'A network error occurred. Please check your connection and try again.',
            timeout: 'The operation took too long to complete. Please try again or use a simpler approach.',
            unknown: 'An unexpected error occurred. Please try again or contact support if the problem persists.'
        };

        const userFriendlyError = {
            success: false,
            message: userMessage || friendlyMessages[category] || friendlyMessages.unknown,
            error: {
                type: category,
                severity: this._determineSeverity(error, context)
            },
            suggestions: recovery.immediate.slice(0, 3), // Top 3 suggestions
            alternatives: recovery.alternative.slice(0, 2), // Top 2 alternatives
            canRetry: this._shouldAutoRetry(error, context),
            timestamp: new Date().toISOString()
        };

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(userFriendlyError, null, 2)
                }
            ],
            isError: true
        };
    }

    /**
     * Determine if an error is recoverable
     * @private
     * @param {Error} error - The error object
     * @param {Object} context - Error context
     * @returns {boolean} Whether the error is recoverable
     */
    _isRecoverable(error, context) {
        const category = this._categorizeError(error);
        const recoverableCategories = [
            'network', 'timeout', 'content_processing', 'search_operation'
        ];

        // Check if it's a recoverable category
        if (recoverableCategories.includes(category)) {
            return true;
        }

        // Check specific error codes
        if (error.code === 'ENOENT' && context.operation !== 'delete') {
            return true; // File not found is recoverable for most operations
        }

        return false;
    }

    /**
     * Determine if an error should trigger automatic retry
     * @private
     * @param {Error} error - The error object
     * @param {Object} context - Error context
     * @returns {boolean} Whether to auto-retry
     */
    _shouldAutoRetry(error, context) {
        const category = this._categorizeError(error);
        const retryableCategories = ['network', 'timeout'];

        // Don't retry if we've already retried
        if (context.retryCount && context.retryCount > 0) {
            return false;
        }

        return retryableCategories.includes(category);
    }

    /**
     * Generate a unique request ID
     * @private
     * @returns {string} Unique request ID
     */
    _generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Sanitize arguments for logging (remove sensitive data)
     * @private
     * @param {Object} args - Arguments to sanitize
     * @returns {Object} Sanitized arguments
     */
    _sanitizeArgsForLogging(args) {
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
}