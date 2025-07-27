import js from '@eslint/js';

export default [
  // Apply to all JavaScript files in relevant directories
  {
    files: [
      'src/**/*.js',
      'test/**/*.js', 
      'config/**/*.js',
      '*.config.js',
      'eslint.config.js'
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Core Node.js globals
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        console: 'readonly',
        
        // Module system (ESM + CommonJS compatibility)
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __esModule: 'readonly',
        
        // Timers
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
        
        // URL and TextEncoder/Decoder (Node.js 18+)
        URL: 'readonly',
        URLSearchParams: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        
        // AbortController (Node.js 16+)
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        
        // Fetch API (Node.js 18+)
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
      },
    },
    rules: {
      // Extend recommended rules
      ...js.configs.recommended.rules,
      
      // Code quality rules (more permissive during transition)
      'no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_|^error$|^e$', // Allow common error parameter names
        varsIgnorePattern: '^_|^error$|^errorInfo$|^details$|^result$|^content$|^data$',
        ignoreRestSiblings: true,
        caughtErrors: 'none' // Don't warn about unused catch parameters
      }],
      'no-console': 'off', // Allow console.log for this project
      'no-debugger': 'warn',
      'no-alert': 'warn',
      
      // Style rules (very relaxed for existing codebase)
      'indent': 'off', // Disable indentation checking for now
      'quotes': ['warn', 'single', { 
        avoidEscape: true,
        allowTemplateLiterals: true // Allow template literals to reduce warnings
      }],
      'semi': ['warn', 'always'], // Reduced from error to warning
      'comma-dangle': 'off', // Disable for now to reduce noise
      'no-trailing-spaces': 'off', // Disable for now
      'eol-last': 'off', // Disable for now
      
      // ES6+ rules
      'prefer-const': 'error',
      'no-var': 'error',
      'prefer-arrow-callback': 'warn',
      'arrow-spacing': 'error',
      'template-curly-spacing': 'error',
      
      // Best practices (relaxed for transition)
      'eqeqeq': ['warn', 'always'],
      'curly': 'off', // Disable curly brace enforcement temporarily
      'brace-style': 'off', // Disable brace style enforcement temporarily
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      
      // Error prevention
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-duplicate-case': 'error',
      'no-empty': 'warn',
      'no-extra-boolean-cast': 'warn',
      'no-extra-semi': 'error',
      'no-func-assign': 'error',
      'no-inner-declarations': 'error',
      'no-invalid-regexp': 'error',
      'no-irregular-whitespace': 'error',
      'no-obj-calls': 'error',
      'no-sparse-arrays': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
    },
  },
  
  // Specific configuration for test files
  {
    files: ['test/**/*.js', '**/*.test.js', '**/*.spec.js'],
    languageOptions: {
      globals: {
        // Test framework globals
        jest: 'readonly',
        mocha: 'readonly',
        chai: 'readonly',
        sinon: 'readonly',
        // Node.js test-specific globals
        __dirname: 'readonly',
        __filename: 'readonly',
        // Common test utilities
        assert: 'readonly',
      },
    },
    rules: {
      // Relaxed rules for test files
      'no-unused-expressions': 'off', // Allow chai assertions
      'max-lines-per-function': 'off', // Tests can be long
      'max-statements': 'off', // Tests can have many statements
      'no-magic-numbers': 'off', // Allow magic numbers in tests
      'max-nested-callbacks': 'off', // Allow nested describe/it blocks
      'no-console': 'off', // Allow console.log in tests for debugging
      'prefer-arrow-callback': 'off', // Allow function expressions in tests
      // More permissive unused variable rules for test files
      'no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_|^error$|^e$|^done$|^next$',
        varsIgnorePattern: '^_|^error$|^errorInfo$|^details$|^result$|^content$|^data$|^should$|^expect$',
        ignoreRestSiblings: true,
        caughtErrors: 'none'
      }],
    },
  },
  
  // Specific configuration for configuration files
  {
    files: ['eslint.config.js', '*.config.js', 'config/**/*.js', 'setup.js', 'build.js'],
    languageOptions: {
      globals: {
        // Node.js configuration globals
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
      },
    },
    rules: {
      // Relaxed rules for configuration files
      'no-console': 'off', // Allow console output in config files
      'no-process-env': 'off', // Allow process.env access
      'no-process-exit': 'off', // Allow process.exit in config files
      'no-sync': 'off', // Allow synchronous operations in config
      'import/no-dynamic-require': 'off', // Allow dynamic requires
      'global-require': 'off', // Allow require() anywhere
      // More permissive unused variables for config files
      'no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_|^error$|^e$|^options$|^config$',
        varsIgnorePattern: '^_|^error$|^errorInfo$|^details$|^result$|^content$|^data$|^config$|^options$',
        ignoreRestSiblings: true,
        caughtErrors: 'none'
      }],
    },
  },

  // Specific configuration for MCP server files
  {
    files: ['src/mcp/**/*.js'],
    languageOptions: {
      globals: {
        // MCP-specific globals
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        // Server-specific globals
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
      },
    },
    rules: {
      // Server-specific rules
      'no-console': 'off', // Allow logging in server files
      'no-process-exit': 'warn', // Warn but allow process.exit
      'no-sync': 'warn', // Warn about synchronous operations
      // More permissive for server callback patterns
      'no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_|^error$|^e$|^req$|^res$|^next$|^callback$|^cb$|^schema$',
        varsIgnorePattern: '^_|^error$|^errorInfo$|^details$|^result$|^content$|^data$|^server$|^client$',
        ignoreRestSiblings: true,
        caughtErrors: 'none'
      }],
    },
  },
  
  // Global ignores - comprehensive patterns based on .gitignore and project structure
  {
    ignores: [
      // Dependencies and build artifacts
      'node_modules/**',
      'src/mcp/node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '*.min.js',
      
      // Logs and temporary files
      'logs/**',
      '*.log',
      'temp/**',
      '.temp/**',
      'cache/**',
      '.cache/**',
      '*.tmp',
      '*.temp',
      '*.swp',
      '*~',
      
      // System and IDE files
      '.DS_Store',
      '.git/**',
      '.vscode/**',
      '.idea/**',
      '*.sublime-*',
      '.AppleDouble',
      '.LSOverride',
      'Icon?',
      '._*',
      
      // Personal sync directories (as per .gitignore)
      'Sync_*/**',
      'Sync_Hub_*/**',
      
      // Backup and archive directories
      '*_backup_*/**',
      'Manual_Backup_*/**',
      'backup_*/**',
      'archive_old_files/**',
      
      // Test data and temporary test files
      'test/test_data/**',
      'test/test_logs/**',
      'test/test_sync_hub/**',
      'test_*',
      '*_test.*',
      
      // Configuration and stats files
      'organization_stats_*.json',
      'organization_report_*.md',
      'sync_health_report.txt',
      'sync_metrics.json',
      '*_stats_*.json',
      '*_report_*.md',
      'claude_desktop_config.json',
      
      // Kiro internal files
      '.kiro/**',
      
      // Shell scripts and other non-JS files
      '*.sh',
      '*.prf',
      '*.prf.tmp',
      '*.sync-conflict-*',
      
      // Unison temporary files
      '.unison/**',
    ],
  },
];