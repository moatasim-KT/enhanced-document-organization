# System Validation and Dependency Checking

The Enhanced Document Organization System includes comprehensive system validation to ensure all dependencies, configuration files, and system components are properly set up before operation.

## Overview

The system validation performs the following checks:

1. **Dependencies** - Verifies required system tools are installed
2. **Configuration** - Validates configuration files and settings
3. **Paths** - Ensures required directories exist and are accessible
4. **Permissions** - Checks file and directory permissions
5. **Modules** - Validates Node.js modules can be imported
6. **System Health** - Monitors disk space, memory, and compatibility

## Usage

### Command Line Interface

```bash
# Run basic system validation
./drive_sync.sh validate

# Run verbose validation with detailed output
./drive_sync.sh validate --verbose

# Run validation with additional options
./drive_sync.sh validate --skip-fast-fail

# Run standalone validation
node src/organize/startup_validator.js
node src/organize/startup_validator.js --verbose
```

### Programmatic Usage

```javascript
import { validateSystem, SystemValidator } from './src/organize/system_validator.js';
import { runStartupValidation } from './src/organize/startup_validator.js';

// Run complete system validation
const result = await validateSystem({
    verbose: true,
    skipFastFail: false,
    printReport: true
});

// Run startup validation
const startupResult = await runStartupValidation({
    verbose: false
});

// Create custom validator
const validator = new SystemValidator({
    projectRoot: '/path/to/project',
    verbose: true
});

const customResult = await validator.validateSystem();
```

## Validation Categories

### 1. Dependencies

Checks for required system tools:

- **Node.js** (required) - JavaScript runtime
- **npm** (required) - Package manager
- **Unison** (required) - File synchronization tool
- **flock** (optional) - File locking utility
- **Git** (optional) - Version control system

**Installation Help:**

```bash
# macOS with Homebrew
brew install node unison util-linux git

# Verify installations
node --version
npm --version
unison -version
```

### 2. Configuration

Validates configuration files:

- **config/config.env** - Main system configuration
- **config/organize_config.conf** - Organization rules
- **package.json** - Node.js project configuration
- **src/mcp/package.json** - MCP server configuration

**Auto-Creation:**
The validator can automatically create missing configuration files with default values.

### 3. Paths

Ensures required directories exist:

- Project root directory
- `config/` - Configuration files
- `src/` - Source code
- `src/organize/` - Organization modules
- `src/mcp/` - MCP server (optional)
- `logs/` - Log files (auto-created)
- Sync hub directory (auto-created)

### 4. Permissions

Checks file and directory permissions:

- Read/write access to project root
- Read/write access to config directory
- Read/write access to logs directory

### 5. Modules

Validates Node.js modules can be imported:

- Error Handler (required)
- Content Analyzer
- Content Consolidator
- Category Manager
- Batch Processor
- Module Loader
- MCP Server

### 6. System Health

Monitors system resources and compatibility:

- **Disk Space** - Warns if less than 1GB free
- **Memory Usage** - Warns if usage exceeds 95%
- **Node.js Compatibility** - Ensures version 14+
- **Platform Compatibility** - macOS-specific checks
- **Development Tools** - Xcode Command Line Tools

## Validation Results

### Status Types

- ✅ **PASS** - Check completed successfully
- ⚠️ **WARN** - Issue found but system can operate
- ❌ **FAIL** - Critical issue that prevents operation
- ⏭️ **SKIP** - Check could not be performed

### Exit Codes

- `0` - All validations passed (warnings allowed)
- `1` - Critical failures found, system cannot operate safely

### Output Format

```text
🔍 System Validation Report
==================================================

Overall Status: ✅ PASSED
Total Checks: 32
✅ Passed: 30
⚠️  Warnings: 2
❌ Failed: 0
⏭️  Skipped: 0
Success Rate: 93.8%

📊 Category Breakdown:
  DEPENDENCIES: 5/5 passed
  CONFIGURATION: 5/5 passed
  PATHS: 7/7 passed
  PERMISSIONS: 3/3 passed
  MODULES: 7/7 passed
  SYSTEM: 3/5 passed
    ⚠️  2 warnings
```

## Error Handling and Recovery

### Automatic Recovery

The validator attempts automatic recovery for common issues:

- **Missing directories** - Created automatically
- **Missing configuration** - Default files created
- **Permission issues** - Alternative approaches attempted
- **Module import failures** - Fallback implementations used

### Manual Recovery

For critical failures, the validator provides specific guidance:

```text
❌ Node.js:
   Problem: Node.js is required but not available
   Solution: Install Node.js from <https://nodejs.org/> or use: brew install node

❌ Main Configuration (config.env):
   Problem: Configuration file not found: config/config.env
   Solution: Run the setup script: ./setup.sh or create config/config.env manually
```

## Integration Points

### Main Entry Point

The validation is integrated into the main `drive_sync.sh` script:

```bash
# Configuration loading with validation
if [[ ! -f "$SCRIPT_DIR/config/config.env" ]]; then
    echo "❌ Configuration file not found"
    echo "💡 Run startup validation: node src/organize/startup_validator.js"
    exit 1
fi
```

### Organization Module

The `organize_module.sh` includes configuration validation:

```bash
# Validate critical configuration variables
validate_config() {
    local missing_vars=()
    
    if [[ -z "${SYNC_HUB:-}" ]]; then
        missing_vars+=("SYNC_HUB")
    fi
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        echo "❌ Missing required configuration variables: ${missing_vars[*]}"
        echo "💡 Run system validation: node $PROJECT_DIR/startup_validator.js"
        exit 1
    fi
}
```

### MCP Server

The MCP server runs startup validation during initialization:

```javascript
async runStartupValidation() {
    const result = await runStartupValidation({
        verbose: false,
        skipFastFail: true,
        printReport: false
    });

    if (result.success) {
        this.validationPassed = true;
        await this.logInfo('Startup validation passed');
    } else {
        await this.logWarn('Startup validation failed, continuing with degraded functionality');
    }
}
```

## Testing

### Test Suite

Run the comprehensive test suite:

```bash
# Run all tests
node test/run_tests.js

# Run specific system validation tests
node test/organize/test_system_validation.js
```

The test suite includes:

- Basic system validation
- Verbose validation
- Startup validation
- Individual validator components
- Error handling
- Integration testing

### Manual Testing

Test specific scenarios:

```bash
# Test with missing dependencies
# (temporarily rename a required tool)

# Test with missing configuration
mv config/config.env config/config.env.backup
./drive_sync.sh validate
mv config/config.env.backup config/config.env

# Test with insufficient permissions
chmod 444 config/
./drive_sync.sh validate
chmod 755 config/
```

## Troubleshooting

### Common Issues

1. **Node.js not found**
   - Install Node.js from <https://nodejs.org/>
   - Or use package manager: `brew install node`

2. **Unison not found**
   - Install with: `brew install unison`
   - Verify with: `unison -version`

3. **Configuration file missing**
   - Run: `./setup.sh`
   - Or create manually: `cp config/config.env.example config/config.env`

4. **Permission denied**
   - Check file ownership: `ls -la config/`
   - Fix permissions: `chmod 755 config/`

5. **Module import failures**
   - Check Node.js version: `node --version`
   - Ensure ES modules are supported
   - Add `"type": "module"` to package.json

### Debug Mode

Enable verbose logging for debugging:

```bash
# Verbose validation
./drive_sync.sh validate --verbose

# Debug startup validation
node src/organize/startup_validator.js --verbose

# Skip fast-fail for complete diagnosis
node src/organize/startup_validator.js --skip-fast-fail
```

### Log Files

Check log files for detailed error information:

```bash
# Main log
tail -f logs/main.log

# Today's log
tail -f logs/main_$(date +%Y-%m-%d).log

# Error handler logs
grep ERROR logs/main.log
```

## Configuration Reference

### Environment Variables

The validator checks for these critical environment variables:

```bash
# Required
SYNC_HUB="/path/to/sync/hub"
ICLOUD_PATH="/path/to/icloud"
GOOGLE_DRIVE_PATH="/path/to/google/drive"

# Optional with defaults
LOG_LEVEL="INFO"
LOG_TO_CONSOLE="true"
LOG_TO_FILE="true"
ORGANIZATION_ENABLED="true"
SYNC_ENABLED="true"
```

### Validation Options

```javascript
const options = {
    // Show detailed output during validation
    verbose: false,
    
    // Continue validation even after critical failures
    skipFastFail: false,
    
    // Print validation report to console
    printReport: true,
    
    // Custom project root (auto-detected if not provided)
    projectRoot: '/path/to/project',
    
    // Enable console logging
    enableConsoleLogging: true
};
```

## Best Practices

1. **Run validation before first use**

   ```bash
   ./drive_sync.sh validate
   ```

2. **Include validation in deployment scripts**

   ```bash
   #!/bin/bash
   if ! ./drive_sync.sh validate; then
       echo "System validation failed, aborting deployment"
       exit 1
   fi
   ```

3. **Monitor system health regularly**

   ```bash
   # Add to cron job
   0 */6 * * * /path/to/drive_sync.sh validate --verbose >> /var/log/system-validation.log
   ```

4. **Use validation in CI/CD pipelines**

   ```yaml
   - name: Validate System
     run: |
       node src/organize/startup_validator.js
       if [ $? -ne 0 ]; then
         echo "System validation failed"
         exit 1
       fi
   ```

5. **Handle validation results programmatically**

   ```javascript
   const result = await validateSystem();
   if (!result.success) {
       console.error('Critical failures:', result.criticalFailures);
       process.exit(1);
   }
   ```

## API Reference

### SystemValidator Class

```javascript
class SystemValidator {
    constructor(options = {})
    async validateSystem()
    async validateDependencies()
    async validateConfiguration()
    async validatePaths()
    async validatePermissions()
    async validateModules()
    async validateSystemHealth()
    generateValidationSummary()
    printReport()
}
```

### Functions

```javascript
// Main validation function
async function validateSystem(options = {})

// Startup validation with user-friendly output
async function runStartupValidation(options = {})

// Create component-specific error handler
function createErrorHandler(component, options = {})
```

### Constants

```javascript
// Validation status types
const ValidationStatus = {
    PASS: 'PASS',
    WARN: 'WARN',
    FAIL: 'FAIL',
    SKIP: 'SKIP'
};

// Validation categories
const ValidationCategories = {
    DEPENDENCIES: 'dependencies',
    CONFIGURATION: 'configuration',
    PATHS: 'paths',
    PERMISSIONS: 'permissions',
    MODULES: 'modules',
    SYSTEM: 'system'
};
```

This comprehensive system validation ensures the Enhanced Document Organization System operates reliably with clear error messages and automatic recovery where possible.
