# Test Suite - Enhanced Document Organization System

This directory contains all test files for the Enhanced Document Organization System.

## Directory Structure

```
test/
├── organize/           # Tests for organization modules
│   ├── test_system_validation.js
│   ├── test_enhanced_error_system.js
│   ├── test_error_handling_system.js
│   └── test_module_imports.js
├── mcp/               # Tests for MCP server
│   ├── test_mcp_tools.js
│   └── test_error_handling.js
├── test_data/         # Test data and temporary files
├── run_tests.js       # Main test runner
└── README.md          # This file
```

## Running Tests

### Run All Tests

```bash
# From project root
node test/run_tests.js

# Or make it executable and run directly
chmod +x test/run_tests.js
./test/run_tests.js
```

### Run Individual Test Suites

```bash
# System validation tests
node test/organize/test_system_validation.js

# Error handling tests
node test/organize/test_enhanced_error_system.js

# MCP server tests
node test/mcp/test_mcp_tools.js
```

### Run Tests via Main Script

```bash
# The main script also supports running tests
./drive_sync.sh test  # (if implemented)
```

## Test Categories

### 1. System Validation Tests (`organize/test_system_validation.js`)
- Comprehensive system validation
- Dependency checking
- Configuration validation
- Integration testing

### 2. Error Handling Tests (`organize/test_enhanced_error_system.js`)
- Error classification and handling
- Async error handling
- Recovery strategies
- Logging functionality

### 3. Module Import Tests (`organize/test_module_imports.js`)
- Module loading and resolution
- Import path validation
- Fallback mechanisms

### 4. MCP Server Tests (`mcp/test_mcp_tools.js`)
- MCP tool functionality
- Server initialization
- Tool execution and responses

## Test Data

The `test_data/` directory contains:
- Temporary test files
- Mock configuration files
- Test logs
- Sample documents for testing

## Writing New Tests

When adding new tests:

1. Place them in the appropriate subdirectory (`organize/` or `mcp/`)
2. Use the naming convention `test_*.js`
3. Import modules using relative paths from the test directory
4. Add the test to the test runner in `run_tests.js`

Example test structure:

```javascript
#!/usr/bin/env node

import { someModule } from '../../src/organize/some_module.js';

async function testSomething() {
    console.log('🧪 Testing Something...');
    
    try {
        // Test implementation
        console.log('✅ Test passed');
        return true;
    } catch (error) {
        console.log('❌ Test failed:', error.message);
        return false;
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    testSomething().then(success => {
        process.exit(success ? 0 : 1);
    });
}
```

## Continuous Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: |
    node test/run_tests.js
    if [ $? -ne 0 ]; then
      echo "Tests failed"
      exit 1
    fi
```

## Test Coverage

The test suite covers:
- ✅ System validation and dependency checking
- ✅ Error handling and recovery
- ✅ Module loading and imports
- ✅ MCP server functionality
- ✅ Configuration validation
- ✅ Integration testing

For detailed test results and coverage reports, run the test suite with verbose output.