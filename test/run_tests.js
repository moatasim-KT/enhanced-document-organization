#!/usr/bin/env node

/**
 * Test Runner for Enhanced Document Organization System
 * Runs all test suites and provides comprehensive reporting
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TestRunner {
    constructor() {
        this.testResults = [];
        this.totalTests = 0;
        this.passedTests = 0;
        this.failedTests = 0;
    }

    async runTest(testFile, description) {
        console.log(`\n🧪 Running: ${description}`);
        console.log('=' .repeat(60));

        try {
            const testPath = path.join(__dirname, testFile);
            const result = execSync(`node "${testPath}"`, { 
                encoding: 'utf8',
                timeout: 30000,
                stdio: 'inherit'
            });

            this.testResults.push({
                test: description,
                file: testFile,
                status: 'PASSED',
                output: result
            });

            this.passedTests++;
            console.log(`✅ ${description} - PASSED`);

        } catch (error) {
            this.testResults.push({
                test: description,
                file: testFile,
                status: 'FAILED',
                error: error.message,
                output: error.stdout || '',
                stderr: error.stderr || ''
            });

            this.failedTests++;
            console.log(`❌ ${description} - FAILED`);
            console.log(`Error: ${error.message}`);
        }

        this.totalTests++;
    }

    async runAllTests() {
        console.log('🚀 Enhanced Document Organization System - Test Suite');
        console.log('=' .repeat(80));

        // Define test suites
        const testSuites = [
            {
                file: 'simple_comprehensive_test.js',
                description: 'Simple Comprehensive Test Suite (Core Functionality)'
            },
            {
                file: 'organize/test_content_consolidator_paths.js',
                description: 'ContentConsolidator Path Management Tests'
            },
            {
                file: 'organize/test_dry_run_functionality.js',
                description: 'Dry-Run Functionality Tests'
            },
            {
                file: 'organize/test_system_validation.js',
                description: 'System Validation Tests'
            },
            {
                file: 'organize/test_enhanced_error_system.js',
                description: 'Enhanced Error Handling Tests'
            },
            {
                file: 'organize/test_error_handling_system.js',
                description: 'Error Handler System Tests'
            },
            {
                file: 'organize/test_module_imports.js',
                description: 'Module Import Resolution Tests'
            },
            {
                file: 'comprehensive_test_suite.js',
                description: 'Full Comprehensive Test Suite (Advanced)'
            },
            {
                file: 'mcp/test_mcp_tools.js',
                description: 'Enhanced MCP Tools Tests'
            },
            {
                file: 'mcp/test_error_handling.js',
                description: 'MCP Error Handling Tests'
            }
        ];

        // Run all test suites
        for (const suite of testSuites) {
            await this.runTest(suite.file, suite.description);
        }

        // Generate summary report
        this.generateSummaryReport();
    }

    generateSummaryReport() {
        console.log('\n🏁 Test Suite Summary');
        console.log('=' .repeat(80));

        console.log(`Total Tests: ${this.totalTests}`);
        console.log(`✅ Passed: ${this.passedTests}`);
        console.log(`❌ Failed: ${this.failedTests}`);
        console.log(`Success Rate: ${((this.passedTests / this.totalTests) * 100).toFixed(1)}%`);

        if (this.failedTests > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults
                .filter(result => result.status === 'FAILED')
                .forEach(result => {
                    console.log(`  - ${result.test}: ${result.error}`);
                });
        }

        console.log('\n📊 Test Results by Category:');
        const categories = {
            'System Validation': this.testResults.filter(r => r.test.includes('System Validation')),
            'Error Handling': this.testResults.filter(r => r.test.includes('Error')),
            'Module System': this.testResults.filter(r => r.test.includes('Module')),
            'MCP Server': this.testResults.filter(r => r.test.includes('MCP'))
        };

        for (const [category, tests] of Object.entries(categories)) {
            if (tests.length > 0) {
                const passed = tests.filter(t => t.status === 'PASSED').length;
                const total = tests.length;
                console.log(`  ${category}: ${passed}/${total} passed`);
            }
        }

        // Overall result
        const overallStatus = this.failedTests === 0 ? 'PASSED' : 'FAILED';
        console.log(`\n🎯 Overall Result: ${overallStatus}`);

        if (overallStatus === 'PASSED') {
            console.log('🎉 All tests passed! The system is working correctly.');
        } else {
            console.log('⚠️  Some tests failed. Please review the errors above.');
        }

        // Exit with appropriate code
        process.exit(this.failedTests === 0 ? 0 : 1);
    }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const runner = new TestRunner();
    runner.runAllTests().catch(error => {
        console.error('Fatal error running tests:', error);
        process.exit(1);
    });
}

export { TestRunner };