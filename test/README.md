# Drive Sync Test Suite

This directory contains the standardized test suite for the Drive Sync project, organized according to industry best practices.

## 📁 Directory Structure

```
test/
├── unit/                    # Unit tests (isolated component testing)
│   ├── organize/           # Tests for src/organize modules
│   │   ├── path-resolution.test.js
│   │   └── content-consolidation.test.js
│   ├── sync/              # Tests for src/sync modules
│   │   └── profile-validator.test.js
│   └── mcp/               # Tests for src/mcp modules
├── integration/            # Integration tests (module interactions)
│   └── comprehensive.test.js
├── fixtures/              # Test data and mock files
├── helpers/               # Test utilities and shared functions
├── reports/               # Test output reports (gitignored)
├── setup.js               # Test configuration and setup utilities
├── runner.js              # Standardized test runner
└── README.md              # This file
```

## 🚀 Running Tests

### Run All Tests
```bash
cd test
node runner.js
```

### Run Specific Test Types
```bash
# Unit tests only
node runner.js --unit

# Integration tests only
node runner.js --integration

# Tests matching a pattern
node runner.js --pattern path-resolution
```

### Run Individual Tests
```bash
# Run a specific test file
node unit/organize/path-resolution.test.js
```

## 📋 Test Categories

### Unit Tests
- **Organize Module**: Path resolution, content consolidation, file management
- **Sync Module**: Profile validation, sync configuration, error handling
- **MCP Module**: Server functionality, tool validation, API responses

### Integration Tests
- **Comprehensive**: End-to-end workflow testing
- **Cross-module**: Testing interactions between different modules

## 🔧 Test Configuration

The `setup.js` file provides:
- **TestEnvironment**: Isolated test environment setup and cleanup
- **TestReporter**: Standardized test result reporting
- **TEST_CONFIG**: Global test configuration and constants
- **Utility functions**: Module importing, mock configuration, etc.

## 📊 Test Reports

Test reports are automatically generated in the `reports/` directory:
- JSON format with detailed results
- Timestamped for historical tracking
- Platform and environment information included

## 🏗️ Adding New Tests

### Unit Test Template
```javascript
#!/usr/bin/env node

import { TestEnvironment, TestReporter } from '../../setup.js';

class MyModuleTests {
    constructor() {
        this.reporter = new TestReporter();
        this.env = new TestEnvironment('my-module-test');
    }

    async setup() {
        await this.env.setup();
        // Additional setup...
    }

    async testSomething() {
        try {
            // Test logic...
            this.reporter.logSuccess('Test name');
        } catch (error) {
            this.reporter.logFailure('Test name', error.message);
        }
    }

    async runAllTests() {
        console.log('🧪 My Module Tests');
        console.log('='.repeat(50));

        try {
            await this.setup();
            await this.testSomething();
        } finally {
            await this.env.cleanup();
        }

        return this.reporter.generateSummary();
    }
}

// Export for test runner
export default MyModuleTests;

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const tests = new MyModuleTests();
    tests.runAllTests();
}
```

## 🧹 Cleanup

The test suite automatically cleans up:
- Temporary test files and directories
- Generated test data
- Process cleanup on exit

## 📈 Best Practices

1. **Isolation**: Each test should be independent and not rely on others
2. **Cleanup**: Always clean up test artifacts
3. **Naming**: Use descriptive test names that explain what is being tested
4. **Structure**: Follow the established directory structure
5. **Reporting**: Use the standardized reporter for consistent output
6. **Mocking**: Use mock configurations to avoid affecting real data

## 🔍 Troubleshooting

### Common Issues
- **Module import errors**: Check that paths are correct relative to project root
- **Permission errors**: Ensure test has write access to temp directories
- **Timeout errors**: Increase timeout in TEST_CONFIG for slow operations

### Debug Mode
Set environment variable for verbose output:
```bash
DEBUG=true node runner.js
```

## 📝 Migration Notes

This test suite replaces the previous unstructured test files:
- **Consolidated**: 44 redundant test files → 6 focused test files
- **Standardized**: Consistent structure and naming conventions
- **Improved**: Better error handling and reporting
- **Maintainable**: Clear separation of concerns and reusable utilities

The old test files have been backed up to `test_old_backup/` and can be removed once the new structure is validated.
