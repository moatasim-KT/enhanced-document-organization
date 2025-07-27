# ESLint Configuration

This document describes the ESLint setup for the Enhanced Document Organization System.

## Overview

ESLint is configured to provide static code analysis for JavaScript files in this Node.js project that uses ES modules. The configuration is designed to be practical for the existing codebase while gradually improving code quality.

## Configuration Files

### `eslint.config.js`

The main ESLint configuration file using the new flat config format (ESLint v9+). This file:

- Uses ES modules syntax
- Extends recommended ESLint rules
- Configures Node.js globals
- Sets up specific rules for different file types
- Defines ignore patterns

### Key Configuration Features

1. **ES Module Support**: Configured for `"type": "module"` projects
2. **Node.js Environment**: Includes Node.js globals like `process`, `Buffer`, etc.
3. **Relaxed Style Rules**: Adapted to existing codebase formatting
4. **Test File Overrides**: Special rules for test files
5. **Ignore Patterns**: Excludes build outputs, logs, and data directories

## Available Scripts

The following npm scripts are available for linting:

```bash
# Lint all source and test files
npm run lint

# Lint and automatically fix issues
npm run lint:fix

# Lint with zero warnings tolerance (for CI)
npm run lint:check

# Lint specific files
npm run lint -- src/organize/system_validator.js

# Show ESLint version
npm run lint -- --version
```

## Usage Examples

### Basic Linting

```bash
# Lint all files
npm run lint

# Lint with automatic fixes
npm run lint:fix
```

### Targeted Linting

```bash
# Lint specific directory
npm run lint -- src/organize/

# Lint specific file
npm run lint -- src/organize/system_validator.js

# Lint with maximum warnings
npm run lint -- src/ --max-warnings 10
```

### CI/CD Integration

```bash
# For continuous integration (fails on any warnings)
npm run lint:check
```

## Rule Configuration

### Current Rule Set

The configuration uses a relaxed approach suitable for the existing codebase:

- **Indentation**: Disabled (to be enabled gradually)
- **Quotes**: Single quotes preferred (warning level)
- **Semicolons**: Required (error level)
- **Trailing Spaces**: Disabled (to be enabled gradually)
- **Curly Braces**: Recommended (warning level)
- **Unused Variables**: Warning with `_` prefix exception

### Error vs Warning Strategy

- **Errors**: Critical issues that should block commits
  - Missing semicolons
  - Undefined variables
  - Syntax errors

- **Warnings**: Style and best practice issues
  - Unused variables
  - Missing curly braces
  - Quote style inconsistencies

## File-Specific Rules

### Test Files

Test files (`test/**/*.js`, `**/*.test.js`, `**/*.spec.js`) have relaxed rules:

- Unused expressions allowed
- No line/statement limits
- Additional test globals available

### Configuration Files

Configuration files have special allowances:

- Console logging permitted
- Relaxed style rules

## Ignored Files and Directories

The following are ignored by ESLint:

```
node_modules/
dist/
build/
coverage/
*.min.js
logs/
temp*/
.git/
.DS_Store
Sync_Hub_New/
test/test_data/
test/test_logs/
test/test_sync_hub/
.kiro/
*.sh
```

## Gradual Improvement Strategy

The ESLint configuration is designed for gradual improvement:

1. **Phase 1** (Current): Focus on critical errors only
2. **Phase 2**: Enable indentation and trailing space rules
3. **Phase 3**: Enforce stricter style consistency
4. **Phase 4**: Add additional best practice rules

### Enabling Stricter Rules

To gradually improve code quality, you can:

1. **Enable indentation checking**:
   ```javascript
   'indent': ['warn', 4, { SwitchCase: 1 }],
   ```

2. **Enable trailing space removal**:
   ```javascript
   'no-trailing-spaces': 'warn',
   ```

3. **Require end-of-file newlines**:
   ```javascript
   'eol-last': 'warn',
   ```

## Integration with Development Workflow

### Pre-commit Hooks

Consider adding ESLint to pre-commit hooks:

```bash
# Install husky and lint-staged
npm install --save-dev husky lint-staged

# Add to package.json
{
  "lint-staged": {
    "*.js": ["eslint --fix", "git add"]
  }
}
```

### Editor Integration

Most editors support ESLint integration:

- **VS Code**: Install ESLint extension
- **WebStorm**: Built-in ESLint support
- **Vim**: Use ALE or similar plugins

### CI/CD Integration

Example GitHub Actions workflow:

```yaml
- name: Lint Code
  run: |
    npm install
    npm run lint:check
```

## Troubleshooting

### Common Issues

1. **"No ESLint configuration found"**
   - Ensure `eslint.config.js` exists in project root
   - Check that ESLint v9+ is installed

2. **"Module not found" errors**
   - Install missing dependencies: `npm install --save-dev @eslint/js`
   - Check import paths in configuration

3. **Too many warnings**
   - Use `--max-warnings` flag to set tolerance
   - Focus on fixing errors first

### Performance Issues

If ESLint is slow:

1. Add more specific ignore patterns
2. Use `--cache` flag for repeated runs
3. Limit file patterns in scripts

### Rule Conflicts

If rules conflict with existing code:

1. Temporarily disable problematic rules
2. Use `// eslint-disable-next-line` for specific lines
3. Gradually fix issues over time

## Customization

### Adding New Rules

To add new rules, edit `eslint.config.js`:

```javascript
rules: {
  // Add new rule
  'new-rule-name': 'error',
  
  // Modify existing rule
  'existing-rule': ['warn', { option: 'value' }],
}
```

### Project-Specific Overrides

For specific file patterns:

```javascript
{
  files: ['src/specific/**/*.js'],
  rules: {
    'specific-rule': 'off',
  },
},
```

### Environment-Specific Configuration

For different environments:

```javascript
{
  files: ['src/browser/**/*.js'],
  languageOptions: {
    globals: {
      window: 'readonly',
      document: 'readonly',
    },
  },
},
```

## Best Practices

1. **Start with errors only**: Fix critical issues first
2. **Gradual improvement**: Enable stricter rules over time
3. **Team consistency**: Agree on rule preferences
4. **Documentation**: Keep this document updated
5. **Regular reviews**: Periodically review and update rules

## Resources

- [ESLint Documentation](https://eslint.org/docs/)
- [ESLint Rules Reference](https://eslint.org/docs/rules/)
- [Flat Config Migration Guide](https://eslint.org/docs/latest/use/configure/migration-guide)
- [Node.js ESLint Configuration](https://github.com/eslint/eslint/blob/main/docs/src/use/configure/language-options.md)

This ESLint setup provides a solid foundation for maintaining code quality while being practical for the existing codebase.