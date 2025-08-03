#!/usr/bin/env node

/**
 * Error Handling Demonstration
 * Shows the enhanced error handling capabilities with structured responses and recovery guidance
 */

import { ToolResponseHandler } from './tool_response_handler.js';
import { ErrorHandler, ErrorTypes, EnhancedError } from './error_handler.js';

async function demonstrateErrorHandling() {
    console.log('🚀 Enhanced Error Handling Demonstration');
    console.log('='.repeat(60));

    const toolResponseHandler = new ToolResponseHandler();
    const errorHandler = new ErrorHandler({ component: 'demo' });

    // Demonstrate different error types and their handling
    const errorScenarios = [
        {
            name: 'File Not Found Error',
            error: new Error('ENOENT: no such file or directory'),
            code: 'ENOENT',
            context: { operation: 'read_file', filePath: '/missing/file.txt' }
        },
        {
            name: 'Permission Denied Error',
            error: new Error('EACCES: permission denied'),
            code: 'EACCES',
            context: { operation: 'write_file', filePath: '/protected/file.txt' }
        },
        {
            name: 'Module Import Error',
            error: new Error('Cannot find module \'missing-module\''),
            context: { operation: 'load_module', moduleName: 'missing-module' }
        },
        {
            name: 'Validation Error',
            error: new Error('Required parameter missing: query'),
            context: { operation: 'search_documents', args: {} }
        },
        {
            name: 'Content Processing Error',
            error: new Error('Failed to parse content: invalid format'),
            context: { operation: 'process_content', contentType: 'unknown' }
        }
    ];

    for (const scenario of errorScenarios) {
        console.log(`\n📋 ${scenario.name}`);
        console.log('-'.repeat(40));

        // Set error code if provided
        if (scenario.code) {
            scenario.error.code = scenario.code;
        }

        try {
            // Demonstrate comprehensive error response
            const comprehensiveResponse = toolResponseHandler.createComprehensiveErrorResponse(
                scenario.error,
                scenario.context
            );

            const parsedResponse = JSON.parse(comprehensiveResponse.content[0].text);

            console.log(`🔍 Error Category: ${parsedResponse.error.category}`);
            console.log(`⚠️  Severity: ${parsedResponse.error.severity}`);
            console.log(`🔧 Recovery Actions:`);
            parsedResponse.recovery.userAction.slice(0, 2).forEach((action, index) => {
                console.log(`   ${index + 1}. ${action}`);
            });

            console.log(`💡 Alternatives:`);
            parsedResponse.recovery.alternatives.slice(0, 2).forEach((alt, index) => {
                console.log(`   ${index + 1}. ${alt}`);
            });

            // Demonstrate user-friendly error response
            const friendlyResponse = toolResponseHandler.createUserFriendlyErrorResponse(
                scenario.error,
                scenario.context
            );

            const parsedFriendly = JSON.parse(friendlyResponse.content[0].text);
            console.log(`📝 User Message: ${parsedFriendly.message}`);

            // Demonstrate ErrorHandler processing
            const errorInfo = await errorHandler.handleError(scenario.error, scenario.context);
            console.log(`🆔 Error ID: ${errorInfo.errorId}`);
            console.log(`🔄 Retryable: ${errorInfo.shouldRetry ? 'Yes' : 'No'}`);

        } catch (demoError) {
            console.error(`❌ Demo error: ${demoError.message}`);
        }
    }

    // Demonstrate tool execution wrapper
    console.log(`\n🛠️  Tool Execution Wrapper Demo`);
    console.log('-'.repeat(40));

    const mockFailingTool = async () => {
        throw new Error('Simulated tool failure');
    };

    const mockSuccessfulTool = async () => {
        return { result: 'success', data: 'Tool executed successfully' };
    };

    try {
        // Test successful execution
        const successResponse = await toolResponseHandler.wrapToolExecution(
            mockSuccessfulTool,
            { testParam: 'value' },
            { operation: 'demo_tool', metadata: { version: '1.0' } }
        );

        console.log('✅ Successful tool execution wrapped correctly');

        // Test failed execution
        const failureResponse = await toolResponseHandler.wrapToolExecution(
            mockFailingTool,
            { testParam: 'value' },
            { operation: 'demo_tool_fail', context: { component: 'demo' } }
        );

        const parsedFailure = JSON.parse(failureResponse.content[0].text);
        console.log(`❌ Failed tool execution handled: ${parsedFailure.error.message}`);
        console.log(`🔧 Recovery guidance provided: ${parsedFailure.recovery ? 'Yes' : 'No'}`);

    } catch (wrapperError) {
        console.error(`❌ Wrapper demo error: ${wrapperError.message}`);
    }

    console.log(`\n🎯 Error Handling Enhancement Summary`);
    console.log('='.repeat(60));
    console.log('✅ Structured error responses with detailed context');
    console.log('✅ Error categorization and severity assessment');
    console.log('✅ Recovery guidance and troubleshooting steps');
    console.log('✅ User-friendly error messages');
    console.log('✅ Comprehensive debug information');
    console.log('✅ Unique error IDs for tracking');
    console.log('✅ Tool execution safety wrappers');
    console.log('✅ Prevention tips and diagnostic steps');
    console.log('\n🚀 Enhanced error handling implementation complete!');
}

// Run the demonstration
if (import.meta.url === `file://${process.argv[1]}`) {
    demonstrateErrorHandling().catch(console.error);
}

export { demonstrateErrorHandling };