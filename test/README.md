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

### 1. Comprehensive Test Suite (`comprehensive_test_suite.js`)
- **Primary test suite covering all critical functionality**
- ContentConsolidator path management fixes
- Complete organization workflow integration
- MCP server tool functionality
- Dry-run functionality validation
- End-to-end testing with real scenarios

### 2. ContentConsolidator Path Management Tests (`organize/test_content_consolidator_paths.js`)
- Constructor accepts syncHubPath parameter
- createConsolidatedFolder uses provided path
- Path construction methods use configurable paths
- Error handling for missing syncHubPath
- Path validation and sanitization
- Dry-run path behavior
- Multiple sync hub configurations
- Path resolution edge cases

### 3. Complete Workflow Integration Tests (`organize/test_complete_workflow_integration.js`)
- Configuration loading and validation
- Content analysis workflow
- Batch processing workflow
- Organization workflow execution
- Content consolidation workflow
- End-to-end workflow integration
- Error recovery and resilience

### 4. Enhanced MCP Server Tests (`mcp/test_mcp_tools.js`)
- All 18 MCP tools functionality
- Tool validation and argument checking
- Individual tool functions
- Error handling in tools
- Tool response formatting
- Tool execution safety wrapper

### 5. Dry-Run Functionality Tests (`organize/test_dry_run_functionality.js`)
- organize_module.sh dry-run functionality
- ContentConsolidator dry-run mode
- BatchProcessor dry-run functionality
- File system state verification
- Dry-run output validation

### 6. System Validation Tests (`organize/test_system_validation.js`)
- Comprehensive system validation
- Dependency checking
- Configuration validation
- Integration testing

### 7. Error Handling Tests (`organize/test_enhanced_error_system.js`)
- Error classification and handling
- Async error handling
- Recovery strategies
- Logging functionality

### 8. Module Import Tests (`organize/test_module_imports.js`)
- Module loading and resolution
- Import path validation
- Fallback mechanisms

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

The comprehensive test suite covers:
- ✅ **ContentConsolidator path management fixes** (Task requirement 1)
- ✅ **Complete organization workflow integration** (Task requirement 2)
- ✅ **MCP server tool functionality verification** (Task requirement 3)
- ✅ **Dry-run functionality validation** (Task requirement 4)
- ✅ System validation and dependency checking
- ✅ Error handling and recovery
- ✅ Module loading and imports
- ✅ Configuration validation
- ✅ End-to-end workflow testing
- ✅ Error recovery and resilience
- ✅ Path validation and sanitization
- ✅ Batch processing workflows

## Running Specific Test Categories

### Run the main comprehensive test suite (recommended):
```bash
node test/comprehensive_test_suite.js
```

### Run specific test categories:
```bash
# ContentConsolidator path management tests
node test/organize/test_content_consolidator_paths.js

# Complete workflow integration tests
node test/organize/test_complete_workflow_integration.js

# Enhanced MCP server tests
node test/mcp/test_mcp_tools.js

# Dry-run functionality tests
node test/organize/test_dry_run_functionality.js
```

For detailed test results and coverage reports, run the test suite with verbose output.