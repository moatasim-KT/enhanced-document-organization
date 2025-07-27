#!/usr/bin/env node

/**
 * Startup Validation Script
 * Validates system before startup and provides clear error messages
 */

import { validateSystem } from './system_validator.js';
import { createErrorHandler } from './error_handler.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main startup validation function
 */
async function runStartupValidation(options = {}) {
    const errorHandler = createErrorHandler('StartupValidator', {
        enableConsoleLogging: true
    });

    try {
        console.log('🚀 Enhanced Document Organization System');
        console.log('🔍 Running startup validation...\n');

        const validationOptions = {
            verbose: options.verbose || false,
            skipFastFail: options.skipFastFail || false,
            printReport: true
        };

        const result = await validateSystem(validationOptions);

        if (result.success) {
            console.log('✅ System validation passed! The system is ready to use.');
            
            if (result.warnings.length > 0) {
                console.log(`⚠️  Note: ${result.warnings.length} warnings were found but don't prevent system operation.`);
            }

            // Provide next steps
            console.log('\n📋 Next Steps:');
            console.log('  1. Run: ./drive_sync.sh status');
            console.log('  2. Test with: ./drive_sync.sh organize dry-run');
            console.log('  3. When ready: ./drive_sync.sh all');
            
            return { success: true, result };

        } else {
            console.log('❌ System validation failed! Critical issues must be resolved before the system can operate safely.');
            
            // Provide specific guidance for critical failures
            if (result.criticalFailures.length > 0) {
                console.log('\n🔧 Required Actions:');
                
                for (const failure of result.criticalFailures) {
                    console.log(`\n❌ ${failure.name}:`);
                    console.log(`   Problem: ${failure.message}`);
                    
                    if (failure.details.installHint) {
                        console.log(`   Solution: ${failure.details.installHint}`);
                    } else {
                        // Provide generic solutions based on failure type
                        const solution = getFailureSolution(failure);
                        if (solution) {
                            console.log(`   Solution: ${solution}`);
                        }
                    }
                }
            }

            console.log('\n💡 After resolving these issues, run the validation again:');
            console.log('   node src/organize/startup_validator.js');
            
            return { success: false, result };
        }

    } catch (error) {
        await errorHandler.handleCriticalError(error, {
            operation: 'runStartupValidation'
        });

        console.log('\n💥 Startup validation encountered a critical error!');
        console.log(`Error: ${error.message}`);
        
        if (error.stack && options.verbose) {
            console.log('\nStack trace:');
            console.log(error.stack);
        }

        console.log('\n🆘 Emergency Recovery:');
        console.log('  1. Check that you are in the correct project directory');
        console.log('  2. Ensure Node.js is properly installed');
        console.log('  3. Try running: npm install (if package.json exists)');
        console.log('  4. Contact support if the issue persists');

        return { success: false, error };
    }
}

/**
 * Get solution suggestion for specific failure types
 */
function getFailureSolution(failure) {
    const { category, name, details } = failure;

    // Dependency failures
    if (category === 'dependencies') {
        if (name.toLowerCase().includes('node')) {
            return 'Install Node.js from https://nodejs.org/ or use: brew install node';
        }
        if (name.toLowerCase().includes('unison')) {
            return 'Install Unison with: brew install unison';
        }
        if (name.toLowerCase().includes('npm')) {
            return 'npm should come with Node.js. Try reinstalling Node.js.';
        }
    }

    // Configuration failures
    if (category === 'configuration') {
        if (name.includes('config.env')) {
            return 'Run the setup script: ./setup.sh or create config/config.env manually';
        }
        if (name.includes('Configuration Variables')) {
            return 'Edit config/config.env and add the missing variables';
        }
    }

    // Path failures
    if (category === 'paths') {
        if (name.includes('Sync Hub')) {
            return 'The sync hub directory will be created automatically, or check SYNC_HUB in config.env';
        }
        if (name.includes('Config Directory')) {
            return 'Create the config directory: mkdir -p config';
        }
    }

    // Permission failures
    if (category === 'permissions') {
        return 'Check file/directory permissions and ensure you have read/write access';
    }

    // Module failures
    if (category === 'modules') {
        return 'Ensure all source files are present and check for syntax errors';
    }

    return null;
}

/**
 * Parse command line arguments
 */
function parseArguments() {
    const args = process.argv.slice(2);
    const options = {
        verbose: false,
        skipFastFail: false,
        help: false
    };

    for (const arg of args) {
        switch (arg) {
            case '--verbose':
            case '-v':
                options.verbose = true;
                break;
            case '--skip-fast-fail':
                options.skipFastFail = true;
                break;
            case '--help':
            case '-h':
                options.help = true;
                break;
            default:
                console.log(`Unknown argument: ${arg}`);
                options.help = true;
                break;
        }
    }

    return options;
}

/**
 * Show help message
 */
function showHelp() {
    console.log(`
Enhanced Document Organization System - Startup Validator

Usage: node src/organize/startup_validator.js [options]

Options:
  --verbose, -v         Show detailed validation output
  --skip-fast-fail      Continue validation even after critical failures
  --help, -h           Show this help message

Examples:
  node src/organize/startup_validator.js
  node src/organize/startup_validator.js --verbose
  node src/organize/startup_validator.js --skip-fast-fail

This script validates that all system dependencies, configuration files,
and required components are properly set up before the system starts.
`);
}

/**
 * Main execution
 */
async function main() {
    const options = parseArguments();

    if (options.help) {
        showHelp();
        process.exit(0);
    }

    const result = await runStartupValidation(options);

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
}

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('Fatal error during startup validation:', error);
        process.exit(1);
    });
}

export { runStartupValidation, getFailureSolution };