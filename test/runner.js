#!/usr/bin/env node

/**
 * Standardized Test Runner for Drive Sync Project
 * Runs all tests in the proper order with comprehensive reporting
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { TestReporter, TEST_CONFIG } from './setup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DriveSyncTestRunner {
    constructor() {
        this.reporter = new TestReporter();
        this.testSuites = {
            unit: [],
            integration: []
        };
    }

    async discoverTests() {
        console.log('🔍 Discovering test files...');
        
        // Discover unit tests
        const unitDir = path.join(__dirname, 'unit');
        await this.discoverTestsInDirectory(unitDir, 'unit');
        
        // Discover integration tests
        const integrationDir = path.join(__dirname, 'integration');
        await this.discoverTestsInDirectory(integrationDir, 'integration');
        
        const totalTests = this.testSuites.unit.length + this.testSuites.integration.length;
        console.log(`📋 Found ${totalTests} test files (${this.testSuites.unit.length} unit, ${this.testSuites.integration.length} integration)`);
    }

    async discoverTestsInDirectory(dir, type) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    await this.discoverTestsInDirectory(fullPath, type);
                } else if (entry.name.endsWith('.test.js')) {
                    this.testSuites[type].push({
                        name: entry.name.replace('.test.js', ''),
                        path: fullPath,
                        category: path.relative(path.join(__dirname, type), path.dirname(fullPath))
                    });
                }
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.warn(`Warning: Could not read directory ${dir}: ${error.message}`);
            }
        }
    }

    async runTestFile(testFile) {
        const { name, path: testPath, category } = testFile;
        const displayName = category ? `${category}/${name}` : name;
        
        console.log(`\n🧪 Running: ${displayName}`);
        console.log('─'.repeat(60));

        try {
            // Import and run the test
            const testModule = await import(testPath);
            
            if (testModule.default && typeof testModule.default.runAllTests === 'function') {
                const testInstance = new testModule.default();
                const success = await testInstance.runAllTests();
                
                if (success) {
                    this.reporter.logSuccess(displayName);
                } else {
                    this.reporter.logFailure(displayName, 'Test suite reported failures');
                }
            } else {
                // Try to execute as a script
                const result = execSync(`node "${testPath}"`, {
                    encoding: 'utf8',
                    timeout: TEST_CONFIG.DEFAULT_TIMEOUT
                });
                
                // If no exception was thrown, consider it a success
                this.reporter.logSuccess(displayName);
            }
            
        } catch (error) {
            this.reporter.logFailure(displayName, error.message);
        }
    }

    async runUnitTests() {
        if (this.testSuites.unit.length === 0) {
            this.reporter.logInfo('No unit tests found');
            return;
        }

        console.log('\n🔬 Running Unit Tests');
        console.log('='.repeat(50));

        for (const testFile of this.testSuites.unit) {
            await this.runTestFile(testFile);
        }
    }

    async runIntegrationTests() {
        if (this.testSuites.integration.length === 0) {
            this.reporter.logInfo('No integration tests found');
            return;
        }

        console.log('\n🔗 Running Integration Tests');
        console.log('='.repeat(50));

        for (const testFile of this.testSuites.integration) {
            await this.runTestFile(testFile);
        }
    }

    async runSpecificTest(testPattern) {
        console.log(`\n🎯 Running tests matching pattern: ${testPattern}`);
        console.log('='.repeat(50));

        const allTests = [...this.testSuites.unit, ...this.testSuites.integration];
        const matchingTests = allTests.filter(test => 
            test.name.includes(testPattern) || 
            test.path.includes(testPattern) ||
            test.category.includes(testPattern)
        );

        if (matchingTests.length === 0) {
            this.reporter.logWarning(`No tests found matching pattern: ${testPattern}`);
            return;
        }

        console.log(`Found ${matchingTests.length} matching tests`);
        for (const testFile of matchingTests) {
            await this.runTestFile(testFile);
        }
    }

    async runAllTests() {
        console.log('🚀 Drive Sync Test Suite');
        console.log('='.repeat(50));
        console.log(`📅 Started at: ${new Date().toISOString()}`);
        console.log(`🖥️ Platform: ${process.platform}`);
        console.log(`📦 Node.js: ${process.version}`);

        await this.discoverTests();

        // Run unit tests first
        await this.runUnitTests();

        // Then run integration tests
        await this.runIntegrationTests();

        // Generate final report
        const success = this.reporter.generateSummary();
        
        console.log('\n' + '='.repeat(50));
        console.log(`🏁 Test run completed at: ${new Date().toISOString()}`);
        
        return success;
    }

    async generateReport() {
        const results = this.reporter.getResults();
        const reportPath = path.join(__dirname, 'reports', `test-report-${Date.now()}.json`);
        
        // Ensure reports directory exists
        await fs.mkdir(path.dirname(reportPath), { recursive: true });
        
        const report = {
            timestamp: new Date().toISOString(),
            platform: process.platform,
            nodeVersion: process.version,
            results,
            testSuites: this.testSuites
        };

        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        console.log(`📄 Test report saved to: ${reportPath}`);
        
        return reportPath;
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const runner = new DriveSyncTestRunner();

    try {
        if (args.length === 0) {
            // Run all tests
            const success = await runner.runAllTests();
            await runner.generateReport();
            process.exit(success ? 0 : 1);
        } else if (args[0] === '--unit') {
            // Run only unit tests
            await runner.discoverTests();
            await runner.runUnitTests();
            const success = runner.reporter.generateSummary();
            process.exit(success ? 0 : 1);
        } else if (args[0] === '--integration') {
            // Run only integration tests
            await runner.discoverTests();
            await runner.runIntegrationTests();
            const success = runner.reporter.generateSummary();
            process.exit(success ? 0 : 1);
        } else if (args[0] === '--pattern' && args[1]) {
            // Run tests matching pattern
            await runner.discoverTests();
            await runner.runSpecificTest(args[1]);
            const success = runner.reporter.generateSummary();
            process.exit(success ? 0 : 1);
        } else {
            console.log('Usage:');
            console.log('  node runner.js                    # Run all tests');
            console.log('  node runner.js --unit             # Run unit tests only');
            console.log('  node runner.js --integration      # Run integration tests only');
            console.log('  node runner.js --pattern <name>   # Run tests matching pattern');
            process.exit(1);
        }
    } catch (error) {
        console.error('Test runner failed:', error);
        process.exit(1);
    }
}

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export default DriveSyncTestRunner;
