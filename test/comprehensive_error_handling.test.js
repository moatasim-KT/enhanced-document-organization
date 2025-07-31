/**
 * Comprehensive Error Handling Test Suite
 * Tests the enhanced error handling system with structured responses and recovery guidance
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolResponseHandler } from '../src/organize/tool_response_handler.js';
import { ErrorHandler, ErrorTypes, EnhancedError } from '../src/organize/error_handler.js';

describe('Comprehensive Error Handling', () => {
    let toolResponseHandler;
    let errorHandler;

    beforeEach(() => {
        toolResponseHandler = new ToolResponseHandler();
        errorHandler = new ErrorHandler({ component: 'test' });
    });

    describe('ToolResponseHandler Enhanced Error Responses', () => {
        it('should create comprehensive error response with recovery guidance', () => {
            const error = new Error('File not found');
            error.code = 'ENOENT';

            const context = {
                operation: 'read_file',
                filePath: '/path/to/missing/file.txt',
                component: 'FileManager'
            };

            const response = toolResponseHandler.createComprehensiveErrorResponse(error, context);

            expect(response.isError).toBe(true);
            const parsedContent = JSON.parse(response.content[0].text);

            // Check basic error structure
            expect(parsedContent.success).toBe(false);
            expect(parsedContent.error.message).toBe('File not found');
            expect(parsedContent.error.category).toBe('file_not_found');
            expect(parsedContent.error.severity).toBe('medium');

            // Check recovery guidance
            expect(parsedContent.recovery).toBeDefined();
            expect(parsedContent.recovery.isRecoverable).toBeDefined();
            expect(parsedContent.recovery.userAction).toBeInstanceOf(Array);
            expect(parsedContent.recovery.alternatives).toBeInstanceOf(Array);

            // Check troubleshooting info
            expect(parsedContent.troubleshooting).toBeDefined();
            expect(parsedContent.troubleshooting.commonCauses).toBeInstanceOf(Array);
            expect(parsedContent.troubleshooting.diagnosticSteps).toBeInstanceOf(Array);
        });

        it('should create user-friendly error response', () => {
            const error = new Error('Permission denied');
            error.code = 'EACCES';

            const context = {
                operation: 'write_file',
                filePath: '/protected/file.txt'
            };

            const response = toolResponseHandler.createUserFriendlyErrorResponse(error, context);

            expect(response.isError).toBe(true);
            const parsedContent = JSON.parse(response.content[0].text);

            expect(parsedContent.success).toBe(false);
            expect(parsedContent.message).toContain('Access to the file or folder was denied');
            expect(parsedContent.error.type).toBe('permission_denied');
            expect(parsedContent.suggestions).toBeInstanceOf(Array);
            expect(parsedContent.alternatives).toBeInstanceOf(Array);
        });

        it('should categorize different error types correctly', () => {
            const testCases = [
                { error: new Error('Module not found'), code: null, expectedCategory: 'module_import' },
                { error: new Error('Invalid configuration'), code: null, expectedCategory: 'configuration' },
                { error: new Error('Network timeout'), code: 'ETIMEDOUT', expectedCategory: 'timeout' },
                { error: new Error('Folder operation failed'), code: null, expectedCategory: 'folder_operation' },
                { error: new Error('Search query invalid'), code: null, expectedCategory: 'validation' },
                { error: new Error('Content processing error'), code: null, expectedCategory: 'content_processing' }
            ];

            testCases.forEach(({ error, code, expectedCategory }) => {
                if (code) error.code = code;

                const response = toolResponseHandler.createComprehensiveErrorResponse(error);
                const parsedContent = JSON.parse(response.content[0].text);

                expect(parsedContent.error.category).toBe(expectedCategory);
            });
        });

        it('should determine severity levels correctly', () => {
            const testCases = [
                { error: new Error('CRITICAL system failure'), expectedSeverity: 'critical' },
                { error: new Error('Permission denied'), code: 'EACCES', expectedSeverity: 'critical' },
                { error: new Error('Data corruption detected'), expectedSeverity: 'high' },
                { error: new Error('File not found'), code: 'ENOENT', expectedSeverity: 'medium' },
                { error: new Error('Warning: deprecated method'), expectedSeverity: 'medium' }
            ];

            testCases.forEach(({ error, code, expectedSeverity }) => {
                if (code) error.code = code;

                const response = toolResponseHandler.createComprehensiveErrorResponse(error);
                const parsedContent = JSON.parse(response.content[0].text);

                expect(parsedContent.error.severity).toBe(expectedSeverity);
            });
        });

        it('should provide appropriate recovery guidance for different error categories', () => {
            const fileNotFoundError = new Error('File not found');
            fileNotFoundError.code = 'ENOENT';

            const response = toolResponseHandler.createComprehensiveErrorResponse(fileNotFoundError);
            const parsedContent = JSON.parse(response.content[0].text);

            expect(parsedContent.recovery.userAction).toContain('Verify the file path is correct');
            expect(parsedContent.recovery.alternatives).toContain('Search for the file in parent directories');
            expect(parsedContent.recovery.prevention).toContain('Use absolute paths when possible');
        });

        it('should include comprehensive debug information', () => {
            const error = new Error('Test error');
            const context = {
                operation: 'test_operation',
                filePath: '/test/path',
                component: 'TestComponent'
            };

            const response = toolResponseHandler.createComprehensiveErrorResponse(error, context, {
                includeDebugInfo: true
            });
            const parsedContent = JSON.parse(response.content[0].text);

            expect(parsedContent.debugInfo).toBeDefined();
            expect(parsedContent.debugInfo.environment).toBeDefined();
            expect(parsedContent.debugInfo.environment.nodeVersion).toBeDefined();
            expect(parsedContent.debugInfo.environment.platform).toBeDefined();
            expect(parsedContent.debugInfo.systemState).toBeDefined();
        });

        it('should generate unique error IDs', () => {
            const error1 = new Error('Test error 1');
            const error2 = new Error('Test error 2');

            const response1 = toolResponseHandler.createComprehensiveErrorResponse(error1);
            const response2 = toolResponseHandler.createComprehensiveErrorResponse(error2);

            const parsed1 = JSON.parse(response1.content[0].text);
            const parsed2 = JSON.parse(response2.content[0].text);

            expect(parsed1.error.id).toBeDefined();
            expect(parsed2.error.id).toBeDefined();
            expect(parsed1.error.id).not.toBe(parsed2.error.id);
        });
    });

    describe('ErrorHandler Enhanced Processing', () => {
        it('should handle errors with comprehensive context', async () => {
            const error = new Error('Test error');
            const context = {
                operation: 'test_operation',
                component: 'TestComponent',
                filePath: '/test/file.txt'
            };

            const result = await errorHandler.handleError(error, context);

            expect(result.error).toBeInstanceOf(EnhancedError);
            expect(result.strategy).toBeDefined();
            expect(result.errorId).toBeDefined();
            expect(result.severity).toBeDefined();
            expect(result.troubleshooting).toBeDefined();
        });

        it('should generate troubleshooting information', async () => {
            const error = new Error('Module import failed');
            const context = { operation: 'load_module' };

            const result = await errorHandler.handleError(error, context);

            expect(result.troubleshooting).toBeDefined();
            expect(result.troubleshooting.commonCauses).toBeInstanceOf(Array);
            expect(result.troubleshooting.diagnosticSteps).toBeInstanceOf(Array);
            expect(result.troubleshooting.preventionTips).toBeInstanceOf(Array);
            expect(result.troubleshooting.supportInfo).toBeDefined();
        });

        it('should classify errors correctly', () => {
            const testCases = [
                { error: new Error('ENOENT: no such file'), code: 'ENOENT', expected: ErrorTypes.FILE_NOT_FOUND },
                { error: new Error('EACCES: permission denied'), code: 'EACCES', expected: ErrorTypes.PERMISSION_DENIED },
                { error: new Error('Module not found'), expected: ErrorTypes.MODULE_IMPORT_FAILURE },
                { error: new Error('Invalid configuration'), expected: ErrorTypes.CONFIGURATION_ERROR },
                { error: new Error('Network timeout'), code: 'ETIMEDOUT', expected: ErrorTypes.TIMEOUT_ERROR }
            ];

            testCases.forEach(({ error, code, expected }) => {
                if (code) error.code = code;
                const classified = ErrorHandler.classifyError(error);
                expect(classified).toBe(expected);
            });
        });

        it('should create appropriate recovery strategies', () => {
            const strategies = [
                { type: ErrorTypes.FILE_NOT_FOUND, expectedAction: 'skip' },
                { type: ErrorTypes.PERMISSION_DENIED, expectedAction: 'retry_with_fallback' },
                { type: ErrorTypes.MODULE_IMPORT_FAILURE, expectedAction: 'use_fallback' },
                { type: ErrorTypes.VALIDATION_ERROR, expectedAction: 'reject' },
                { type: ErrorTypes.NETWORK_ERROR, expectedAction: 'retry' }
            ];

            strategies.forEach(({ type, expectedAction }) => {
                const strategy = ErrorHandler.createRecoveryStrategy(type);
                expect(strategy.action).toBe(expectedAction);
                expect(strategy.retryable).toBeDefined();
                expect(strategy.fallback).toBeDefined();
            });
        });

        it('should determine severity levels correctly', () => {
            const testCases = [
                { error: new Error('CRITICAL failure'), expected: 'critical' },
                { error: new Error('Permission denied'), code: 'EACCES', expected: 'critical' },
                { error: new Error('Data corruption'), expected: 'high' },
                { error: new Error('File not found'), code: 'ENOENT', expected: 'medium' },
                { error: new Error('Warning message'), expected: 'medium' }
            ];

            testCases.forEach(({ error, code, expected }) => {
                if (code) error.code = code;
                const severity = errorHandler.determineSeverity(error);
                expect(severity).toBe(expected);
            });
        });

        it('should sanitize sensitive information in context', () => {
            const sensitiveContext = {
                password: 'secret123',
                token: 'abc123token',
                key: 'privatekey',
                content: 'a'.repeat(1000), // Large content
                normalField: 'normal value'
            };

            const sanitized = errorHandler.sanitizeContextForSupport(sensitiveContext);

            expect(sanitized.password).toBe('[REDACTED]');
            expect(sanitized.token).toBe('[REDACTED]');
            expect(sanitized.key).toBe('[REDACTED]');
            expect(sanitized.content).toContain('[truncated]');
            expect(sanitized.normalField).toBe('normal value');
        });
    });

    describe('Error Response Integration', () => {
        it('should wrap tool execution with comprehensive error handling', async () => {
            const mockTool = vi.fn().mockRejectedValue(new Error('Tool execution failed'));

            const response = await toolResponseHandler.wrapToolExecution(
                mockTool,
                { testArg: 'value' },
                {
                    operation: 'test_tool',
                    context: { component: 'TestSuite' }
                }
            );

            expect(response.isError).toBe(true);
            const parsedContent = JSON.parse(response.content[0].text);

            expect(parsedContent.success).toBe(false);
            expect(parsedContent.context.operation).toBe('test_tool');
            expect(parsedContent.debugInfo).toBeDefined();
        });

        it('should provide meaningful error messages for common scenarios', () => {
            const scenarios = [
                {
                    error: new Error('ENOENT: no such file or directory'),
                    code: 'ENOENT',
                    expectedMessage: 'The requested file could not be found'
                },
                {
                    error: new Error('EACCES: permission denied'),
                    code: 'EACCES',
                    expectedMessage: 'Access to the file or folder was denied'
                },
                {
                    error: new Error('Module not found'),
                    expectedMessage: 'A required component could not be loaded'
                }
            ];

            scenarios.forEach(({ error, code, expectedMessage }) => {
                if (code) error.code = code;

                const response = toolResponseHandler.createUserFriendlyErrorResponse(error);
                const parsedContent = JSON.parse(response.content[0].text);

                expect(parsedContent.message).toContain(expectedMessage);
            });
        });
    });

    describe('Error Prevention and Monitoring', () => {
        it('should provide prevention tips for different error types', () => {
            const fileError = new Error('File not found');
            fileError.code = 'ENOENT';

            const preventionTips = errorHandler.getPreventionTips(ErrorTypes.FILE_NOT_FOUND);

            expect(preventionTips).toBeInstanceOf(Array);
            expect(preventionTips).toContain('Use absolute paths when possible');
            expect(preventionTips).toContain('Implement file existence checks before operations');
        });

        it('should generate diagnostic steps for troubleshooting', () => {
            const diagnosticSteps = errorHandler.getDiagnosticSteps(ErrorTypes.PERMISSION_DENIED);

            expect(diagnosticSteps).toBeInstanceOf(Array);
            expect(diagnosticSteps).toContain('Check file/directory permissions');
            expect(diagnosticSteps).toContain('Verify current user has necessary access');
        });

        it('should identify common causes for errors', () => {
            const commonCauses = errorHandler.getCommonCauses(ErrorTypes.MODULE_IMPORT_FAILURE);

            expect(commonCauses).toBeInstanceOf(Array);
            expect(commonCauses).toContain('Module not installed or missing');
            expect(commonCauses).toContain('Incorrect import path');
        });
    });
});