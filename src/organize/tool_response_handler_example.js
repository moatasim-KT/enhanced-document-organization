/**
 * Example usage of ToolResponseHandler
 * Demonstrates how to integrate the handler with MCP tools
 */

import { ToolResponseHandler } from './tool_response_handler.js';

// Example of how to use ToolResponseHandler in MCP tools
export class ExampleMCPToolIntegration {
    constructor() {
        this.responseHandler = new ToolResponseHandler();
    }

    /**
     * Example: Enhanced content tool using ToolResponseHandler
     */
    async enhanceContent(args) {
        const { content, topic, enhancement_type = 'comprehensive' } = args;

        try {
            // Create enhancement instruction for client-side processing
            const instruction = this.responseHandler.createEnhancementInstruction(
                content,
                enhancement_type,
                topic
            );

            // Return formatted client instruction response
            return this.responseHandler.formatClientInstructionResponse(instruction, {
                originalContent: content,
                contentLength: content.length,
                enhancementType: enhancement_type,
                topic: topic || 'auto-detected'
            });

        } catch (error) {
            // Return formatted error response
            return this.responseHandler.formatErrorResponse(error, {
                operation: 'enhance_content',
                args: { content: content?.substring(0, 100) + '...', topic, enhancement_type }
            });
        }
    }

    /**
     * Example: Search tool using ToolResponseHandler with operation metadata
     */
    async searchDocuments(args) {
        const startTime = Date.now();

        const mockSearchTool = async (searchArgs) => {
            // Simulate search operation
            await new Promise(resolve => setTimeout(resolve, 100));
            return {
                results: [
                    {
                        path: '/test/document.md',
                        title: 'Test Document',
                        preview: 'This is a test document...',
                        relevance: 0.95
                    }
                ],
                totalFound: 1,
                searchTime: Date.now() - startTime
            };
        };

        return await this.responseHandler.wrapToolExecution(
            mockSearchTool,
            args,
            {
                operation: 'search_documents',
                metadata: { searchType: 'content_search' },
                context: { query: args.query },
                debugData: { searchPaths: ['/test'], indexSize: 100 }
            }
        );
    }

    /**
     * Example: Tool that requires external resources
     */
    async analyzeWithAI(args) {
        // This operation requires AI capabilities not available on the server
        return this.responseHandler.createExternalResourceResponse(
            'ai_analysis',
            'AI analysis requires external language model access',
            {
                clientSide: 'Use your AI capabilities to analyze the content',
                fallback: 'Perform basic text analysis without AI',
                instruction: this.responseHandler.createAnalysisInstruction(
                    args.content,
                    args.analysis_type || 'comprehensive'
                )
            }
        );
    }

    /**
     * Example: Tool with comprehensive error handling
     */
    async processDocument(args) {
        try {
            // Simulate document processing
            if (!args.file_path) {
                throw new Error('file_path is required');
            }

            if (args.file_path.includes('nonexistent')) {
                const error = new Error('Document not found');
                error.code = 'ENOENT';
                throw error;
            }

            const result = {
                processed: true,
                file_path: args.file_path,
                size: 1024,
                lastModified: new Date().toISOString()
            };

            return this.responseHandler.formatSuccessResponse(result, {
                operation: 'process_document',
                processingTime: 150
            });

        } catch (error) {
            return this.responseHandler.formatErrorResponse(error, {
                operation: 'process_document',
                file_path: args.file_path,
                timestamp: new Date().toISOString()
            });
        }
    }
}

// Example usage demonstration
export async function demonstrateToolResponseHandler() {
    const integration = new ExampleMCPToolIntegration();

    console.log('=== ToolResponseHandler Integration Examples ===\n');

    // 1. Enhancement instruction example
    console.log('1. Enhancement Instruction:');
    const enhanceResult = await integration.enhanceContent({
        content: 'This is some content that needs enhancement for better readability.',
        topic: 'Writing Guide',
        enhancement_type: 'flow'
    });
    console.log(JSON.stringify(JSON.parse(enhanceResult.content[0].text), null, 2));
    console.log('\n');

    // 2. Successful operation with metadata
    console.log('2. Successful Search with Metadata:');
    const searchResult = await integration.searchDocuments({
        query: 'machine learning',
        limit: 5
    });
    console.log(JSON.stringify(JSON.parse(searchResult.content[0].text), null, 2));
    console.log('\n');

    // 3. External resource response
    console.log('3. External Resource Response:');
    const aiResult = await integration.analyzeWithAI({
        content: 'Content to analyze',
        analysis_type: 'sentiment'
    });
    console.log(JSON.stringify(JSON.parse(aiResult.content[0].text), null, 2));
    console.log('\n');

    // 4. Error handling
    console.log('4. Error Response:');
    const errorResult = await integration.processDocument({
        file_path: 'nonexistent/file.md'
    });
    console.log(JSON.stringify(JSON.parse(errorResult.content[0].text), null, 2));
}

// Run demonstration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    demonstrateToolResponseHandler().catch(console.error);
}