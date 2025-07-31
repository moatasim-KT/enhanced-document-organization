/**
 * Test suite for ToolResponseHandler
 * Tests consistent response formatting and client instruction generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolResponseHandler } from '../src/organize/tool_response_handler.js';

describe('ToolResponseHandler', () => {
    let handler;

    beforeEach(() => {
        handler = new ToolResponseHandler();
    });

    describe('formatSuccessResponse', () => {
        it('should format a basic success response', () => {
            const data = { message: 'Operation completed' };
            const response = handler.formatSuccessResponse(data);

            expect(response.isError).toBe(false);
            expect(response.content).toHaveLength(1);
            expect(response.content[0].type).toBe('text');

            const parsedContent = JSON.parse(response.content[0].text);
            expect(parsedContent.success).toBe(true);
            expect(parsedContent.data).toEqual(data);
            expect(parsedContent.timestamp).toBeDefined();
        });

        it('should include metadata in success response', () => {
            const data = { result: 'test' };
            const metadata = { operation: 'test_operation', version: '1.0' };
            const response = handler.formatSuccessResponse(data, metadata);

            const parsedContent = JSON.parse(response.content[0].text);
            expect(parsedContent.operation).toBe('test_operation');
            expect(parsedContent.version).toBe('1.0');
        });
    });

    describe('formatErrorResponse', () => {
        it('should format a basic error response', () => {
            const error = new Error('Test error');
            const response = handler.formatErrorResponse(error);

            expect(response.isError).toBe(true);
            expect(response.content).toHaveLength(1);

            const parsedContent = JSON.parse(response.content[0].text);
            expect(parsedContent.success).toBe(false);
            expect(parsedContent.error.message).toBe('Test error');
            expect(parsedContent.error.type).toBe('Error');
            expect(parsedContent.debugInfo).toBeDefined();
        });

        it('should include context in error response', () => {
            const error = new Error('Test error');
            const context = { operation: 'test_op', args: { test: 'value' } };
            const response = handler.formatErrorResponse(error, context);

            const parsedContent = JSON.parse(response.content[0].text);
            expect(parsedContent.context).toEqual(context);
        });

        it('should handle custom error codes', () => {
            const error = new Error('Custom error');
            error.code = 'CUSTOM_ERROR';
            error.name = 'CustomError';
            const response = handler.formatErrorResponse(error);

            const parsedContent = JSON.parse(response.content[0].text);
            expect(parsedContent.error.code).toBe('CUSTOM_ERROR');
            expect(parsedContent.error.type).toBe('CustomError');
        });
    });

    describe('formatClientInstructionResponse', () => {
        it('should format client instruction response', () => {
            const instruction = { type: 'enhance', action: 'client_side' };
            const data = { content: 'test content' };
            const response = handler.formatClientInstructionResponse(instruction, data);

            expect(response.isError).toBe(false);
            const parsedContent = JSON.parse(response.content[0].text);
            expect(parsedContent.success).toBe(true);
            expect(parsedContent.clientInstruction).toEqual(instruction);
            expect(parsedContent.data).toEqual(data);
            expect(parsedContent.requiresClientAction).toBe(true);
        });
    });

    describe('createEnhancementInstruction', () => {
        it('should create basic enhancement instruction', () => {
            const content = 'This is test content to enhance.';
            const instruction = handler.createEnhancementInstruction(content);

            expect(instruction.type).toBe('enhance_content');
            expect(instruction.action).toBe('client_side_enhancement');
            expect(instruction.parameters.content).toBe(content);
            expect(instruction.parameters.enhancementType).toBe('comprehensive');
            expect(instruction.parameters.prompt).toContain('Comprehensively enhance');
            expect(instruction.parameters.instructions).toBeInstanceOf(Array);
            expect(instruction.metadata.originalLength).toBe(content.length);
        });

        it('should create enhancement instruction with specific type', () => {
            const content = 'Test content';
            const instruction = handler.createEnhancementInstruction(content, 'flow', 'AI Research');

            expect(instruction.parameters.enhancementType).toBe('flow');
            expect(instruction.parameters.topic).toBe('AI Research');
            expect(instruction.parameters.prompt).toContain('flow and readability');
            expect(instruction.metadata.topic).toBe('AI Research');
        });

        it('should handle all enhancement types', () => {
            const content = 'Test content';
            const types = ['flow', 'structure', 'clarity', 'comprehensive'];

            types.forEach(type => {
                const instruction = handler.createEnhancementInstruction(content, type);
                expect(instruction.parameters.enhancementType).toBe(type);
                expect(instruction.parameters.prompt).toBeDefined();
            });
        });
    });

    describe('createAnalysisInstruction', () => {
        it('should create basic analysis instruction', () => {
            const content = 'Content to analyze';
            const instruction = handler.createAnalysisInstruction(content, 'summary');

            expect(instruction.type).toBe('analyze_content');
            expect(instruction.action).toBe('client_side_analysis');
            expect(instruction.parameters.content).toBe(content);
            expect(instruction.parameters.analysisType).toBe('summary');
            expect(instruction.parameters.prompt).toContain('summary');
            expect(instruction.metadata.contentLength).toBe(content.length);
        });

        it('should handle different analysis types', () => {
            const content = 'Test content';
            const types = ['summary', 'topics', 'keywords', 'structure', 'sentiment', 'comprehensive'];

            types.forEach(type => {
                const instruction = handler.createAnalysisInstruction(content, type);
                expect(instruction.parameters.analysisType).toBe(type);
                expect(instruction.parameters.prompt).toBeDefined();
            });
        });
    });

    describe('addOperationMetadata', () => {
        it('should add metadata to response', () => {
            const response = handler.formatSuccessResponse({ test: 'data' });
            const timing = { duration: 100, startTime: '2023-01-01T00:00:00Z' };
            const enhancedResponse = handler.addOperationMetadata(response, 'test_operation', timing);

            const parsedContent = JSON.parse(enhancedResponse.content[0].text);
            expect(parsedContent.operationMetadata).toBeDefined();
            expect(parsedContent.operationMetadata.operation).toBe('test_operation');
            expect(parsedContent.operationMetadata.timing.duration).toBe(100);
            expect(parsedContent.operationMetadata.version).toBe('1.0.0');
        });
    });

    describe('addDebugInformation', () => {
        it('should add debug information to response', () => {
            const response = handler.formatSuccessResponse({ test: 'data' });
            const debugData = { searchPaths: ['/test/path'], attemptedOperations: ['search'] };
            const enhancedResponse = handler.addDebugInformation(response, debugData);

            const parsedContent = JSON.parse(enhancedResponse.content[0].text);
            expect(parsedContent.debugInfo).toBeDefined();
            expect(parsedContent.debugInfo.searchPaths).toEqual(['/test/path']);
            expect(parsedContent.debugInfo.attemptedOperations).toEqual(['search']);
        });
    });

    describe('createExternalResourceResponse', () => {
        it('should create external resource response', () => {
            const response = handler.createExternalResourceResponse(
                'ai_enhancement',
                'Requires AI model access',
                { clientSide: 'Use client AI capabilities' }
            );

            expect(response.isError).toBe(false);
            const parsedContent = JSON.parse(response.content[0].text);
            expect(parsedContent.success).toBe(false);
            expect(parsedContent.requiresExternalResources).toBe(true);
            expect(parsedContent.operation).toBe('ai_enhancement');
            expect(parsedContent.reason).toBe('Requires AI model access');
            expect(parsedContent.alternatives.clientSide).toBe('Use client AI capabilities');
            expect(parsedContent.clientGuidance).toBeDefined();
        });
    });

    describe('wrapToolExecution', () => {
        it('should wrap successful tool execution', async () => {
            const mockTool = async (args) => ({ result: 'success', input: args.test });
            const args = { test: 'value' };
            const options = { operation: 'mock_tool', metadata: { version: '1.0' } };

            const response = await handler.wrapToolExecution(mockTool, args, options);

            expect(response.isError).toBe(false);
            const parsedContent = JSON.parse(response.content[0].text);
            expect(parsedContent.success).toBe(true);
            expect(parsedContent.data.result).toBe('success');
            expect(parsedContent.operationMetadata.operation).toBe('mock_tool');
            expect(parsedContent.operationMetadata.timing.duration).toBeGreaterThanOrEqual(0);
        });

        it('should wrap failed tool execution', async () => {
            const mockTool = async () => {
                throw new Error('Tool failed');
            };
            const args = { test: 'value' };
            const options = { operation: 'failing_tool' };

            const response = await handler.wrapToolExecution(mockTool, args, options);

            expect(response.isError).toBe(true);
            const parsedContent = JSON.parse(response.content[0].text);
            expect(parsedContent.success).toBe(false);
            expect(parsedContent.error.message).toBe('Tool failed');
            expect(parsedContent.context.operation).toBe('failing_tool');
        });

        it('should include debug data when provided', async () => {
            const mockTool = async () => ({ result: 'success' });
            const debugData = { searchPaths: ['/test'] };
            const options = { operation: 'test', debugData };

            const response = await handler.wrapToolExecution(mockTool, {}, options);

            const parsedContent = JSON.parse(response.content[0].text);
            expect(parsedContent.debugInfo.searchPaths).toEqual(['/test']);
        });
    });

    describe('_sanitizeArgsForLogging', () => {
        it('should truncate long content', () => {
            const args = { content: 'a'.repeat(300) };
            const sanitized = handler._sanitizeArgsForLogging(args);

            expect(sanitized.content.length).toBeLessThan(300);
            expect(sanitized.content).toContain('[truncated]');
        });

        it('should redact sensitive keys', () => {
            const args = { password: 'secret', token: 'abc123', normalField: 'value' };
            const sanitized = handler._sanitizeArgsForLogging(args);

            expect(sanitized.password).toBe('[REDACTED]');
            expect(sanitized.token).toBe('[REDACTED]');
            expect(sanitized.normalField).toBe('value');
        });

        it('should handle null/undefined args', () => {
            expect(handler._sanitizeArgsForLogging(null)).toEqual({});
            expect(handler._sanitizeArgsForLogging(undefined)).toEqual({});
        });
    });

    describe('integration scenarios', () => {
        it('should handle complete enhancement workflow', () => {
            const content = 'This content needs enhancement for better readability and flow.';
            const instruction = handler.createEnhancementInstruction(content, 'flow', 'Writing Guide');
            const response = handler.formatClientInstructionResponse(instruction, { originalContent: content });

            expect(response.isError).toBe(false);
            const parsedContent = JSON.parse(response.content[0].text);
            expect(parsedContent.requiresClientAction).toBe(true);
            expect(parsedContent.clientInstruction.type).toBe('enhance_content');
            expect(parsedContent.clientInstruction.parameters.topic).toBe('Writing Guide');
        });

        it('should handle error with full context and debug info', () => {
            const error = new Error('File not found');
            error.code = 'ENOENT';
            const context = { operation: 'read_file', filePath: '/missing/file.txt' };
            const response = handler.formatErrorResponse(error, context);

            const parsedContent = JSON.parse(response.content[0].text);
            expect(parsedContent.error.code).toBe('ENOENT');
            expect(parsedContent.context.filePath).toBe('/missing/file.txt');
            expect(parsedContent.debugInfo.stack).toBeDefined();
        });
    });
});