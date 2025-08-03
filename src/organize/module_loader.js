#!/usr/bin/env node

/**
 * Module Loader Utility
 * Provides safe module import functionality with error handling and fallback behavior
 */

import { promises as fs } from 'fs';
import path from 'path';
import { SimplePathResolver, PathUtils } from './simple_path_resolver.js';

export class ModuleLoader {
    constructor(options = {}) {
        // Use simplified path resolver
        this.pathResolver = new SimplePathResolver(options);
        this.projectRoot = this.pathResolver.projectRoot;

        // Set up module directories for organize, sync, and mcp
        this.srcDir = this.pathResolver.joinPaths(this.projectRoot, 'src');
        this.moduleDirectories = {
            organize: this.pathResolver.joinPaths(this.srcDir, 'organize'),
            sync: this.pathResolver.joinPaths(this.srcDir, 'sync'),
            mcp: this.pathResolver.joinPaths(this.srcDir, 'mcp')
        };

        // Set default base directory (can be overridden)
        this.baseDir = options.baseDir
            ? this.pathResolver.getAbsolutePath(options.baseDir)
            : this.moduleDirectories.organize; // Default to organize for backward compatibility

        this.retryAttempts = options.retryAttempts || 3;
        this.retryDelay = options.retryDelay || 1000;
        this.moduleCache = new Map();
        this.failedModules = new Set();

        console.log(`[ModuleLoader] Initialized with projectRoot: ${this.projectRoot}`);
        console.log(`[ModuleLoader] Module directories:`, this.moduleDirectories);
        console.log(`[ModuleLoader] Base directory: ${this.baseDir}`);
    }

    /**
     * Detect project root from the current file's location
     * NEVER allows defaulting to system root (/) to prevent permission issues
     */
    detectProjectRootFromFile() {
        // Delegate to simplified path resolver
        return this.pathResolver.detectProjectRoot();
    }

    /**
     * Check if a directory is likely the project root
     */
    isProjectRoot(dirPath) {
        if (!dirPath) return false;

        // Check for package.json
        const packageJsonPath = this.pathResolver.joinPaths(dirPath, 'package.json');
        if (PathUtils.existsSync(packageJsonPath)) {
            return true;
        }

        // Check for config directory
        const configPath = this.pathResolver.joinPaths(dirPath, 'config', 'config.env');
        return PathUtils.existsSync(configPath);
    }

    /**
     * Safely import a module with error handling and retry logic
     */
    async safeImport(modulePath, options = {}) {
        const {
            fallback = null,
            required = true,
            timeout = 10000,
            context = 'unknown'
        } = options;

        // Check if module previously failed
        if (this.failedModules.has(modulePath)) {
            if (required) {
                throw new Error(`Module ${modulePath} previously failed to load and is marked as failed`);
            }
            return fallback;
        }

        // Check cache first
        if (this.moduleCache.has(modulePath)) {
            return this.moduleCache.get(modulePath);
        }

        const resolvedPath = this.resolvePath(modulePath);

        // Convert to file:// URL for consistent import behavior
        const importPath = path.isAbsolute(resolvedPath)
            ? `file://${resolvedPath}`
            : resolvedPath;

        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                console.log(`[ModuleLoader] Attempting to import ${modulePath} (attempt ${attempt}/${this.retryAttempts}) for context: ${context}`);
                console.log(`[ModuleLoader] Resolved path: ${resolvedPath}`);
                console.log(`[ModuleLoader] Import path: ${importPath}`);

                // Validate module before import
                await this.validateModule(resolvedPath);

                // Create timeout promise
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error(`Import timeout after ${timeout}ms`)), timeout);
                });

                // Import with timeout using absolute file:// URL
                const importPromise = import(importPath);
                const module = await Promise.race([importPromise, timeoutPromise]);

                // Cache successful import
                this.moduleCache.set(modulePath, module);
                console.log(`[ModuleLoader] Successfully imported ${modulePath}`);

                return module;

            } catch (error) {
                console.warn(`[ModuleLoader] Import attempt ${attempt} failed for ${modulePath}: ${error.message}`);

                if (attempt === this.retryAttempts) {
                    // Mark as failed after all attempts
                    this.failedModules.add(modulePath);

                    if (required) {
                        throw new Error(`Failed to import required module ${modulePath} after ${this.retryAttempts} attempts: ${error.message}`);
                    } else {
                        console.warn(`[ModuleLoader] Using fallback for optional module ${modulePath}`);
                        return fallback;
                    }
                } else {
                    // Wait before retry
                    await this.delay(this.retryDelay);
                }
            }
        }
    }

    /**
     * Import module with timeout
     */
    async importWithTimeout(modulePath, timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Module import timeout after ${timeout}ms: ${modulePath}`));
            }, timeout);

            import(modulePath)
                .then(module => {
                    clearTimeout(timer);
                    resolve(module);
                })
                .catch(error => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }

    /**
     * Enhanced module path resolution supporting organize, sync, and mcp directories
     */
    resolvePath(modulePath) {
        // If already absolute or starts with protocol, return as-is
        if (PathUtils.isAbsolute(modulePath) || modulePath.startsWith('file://') || modulePath.startsWith('http')) {
            return modulePath;
        }

        // If starts with './', resolve relative to base directory
        if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
            return this.pathResolver.resolvePath(modulePath, this.baseDir);
        }

        // Check for module directory prefix (e.g., 'organize/error_handler', 'mcp/server')
        const parts = modulePath.split('/');
        const firstPart = parts[0];

        if (this.moduleDirectories[firstPart]) {
            // Module path specifies directory (e.g., 'mcp/server' or 'sync/sync_module')
            const remainingPath = parts.slice(1).join('/');
            const strategies = [
                this.pathResolver.joinPaths(this.moduleDirectories[firstPart], remainingPath),
                this.pathResolver.joinPaths(this.moduleDirectories[firstPart], `${remainingPath}.js`)
            ];

            for (const strategy of strategies) {
                if (PathUtils.existsSync(strategy)) {
                    return strategy;
                }
            }
        }

        // Try resolution strategies across all module directories
        const strategies = [
            // Current base directory first
            this.pathResolver.joinPaths(this.baseDir, modulePath),
            this.pathResolver.joinPaths(this.baseDir, `${modulePath}.js`),

            // Then try all module directories
            ...Object.values(this.moduleDirectories).flatMap(dir => [
                this.pathResolver.joinPaths(dir, modulePath),
                this.pathResolver.joinPaths(dir, `${modulePath}.js`)
            ]),

            // General src directory
            this.pathResolver.joinPaths(this.srcDir, modulePath),
            this.pathResolver.joinPaths(this.srcDir, `${modulePath}.js`),

            // As-is (for node_modules)
            modulePath
        ];

        for (const strategy of strategies) {
            try {
                // For file paths, check if file exists
                if (strategy.endsWith('.js') || strategy.endsWith('.mjs')) {
                    if (PathUtils.existsSync(strategy)) {
                        return strategy;
                    }
                } else {
                    return strategy;
                }
            } catch (error) {
                // Continue to next strategy
            }
        }

        // Return original path as last resort
        return modulePath;
    }

    /**
     * Simple module validation
     */
    async validateModule(modulePath) {
        try {
            const resolvedPath = this.resolvePath(modulePath);

            // For file paths, check if file exists
            if (resolvedPath.endsWith('.js') || resolvedPath.endsWith('.mjs')) {
                if (!(await this.pathResolver.fileExists(resolvedPath))) {
                    throw new Error(`Module file not found: ${resolvedPath}`);
                }

                // Basic syntax check by reading file
                const content = await fs.readFile(resolvedPath, 'utf8');
                if (content.trim().length === 0) {
                    throw new Error('Module file is empty');
                }
            }

            return true;
        } catch (error) {
            throw new Error(`Module validation failed: ${error.message}`);
        }
    }

    /**
     * Import multiple modules with dependency resolution
     */
    async importModules(moduleSpecs) {
        const results = new Map();
        const errors = [];

        for (const spec of moduleSpecs) {
            const { name, path: modulePath, required = true, fallback = null } = spec;

            try {
                const module = await this.safeImport(modulePath, {
                    required,
                    fallback,
                    context: name
                });
                results.set(name, module);
            } catch (error) {
                errors.push({ name, error: error.message });
                if (required) {
                    throw new Error(`Failed to load required module ${name}: ${error.message}`);
                }
            }
        }

        return { results, errors };
    }

    /**
     * Create a module factory with error handling
     */
    createModuleFactory(modulePath, options = {}) {
        return async (...args) => {
            const module = await this.safeImport(modulePath, options);

            if (!module) {
                throw new Error(`Module factory failed: module ${modulePath} not available`);
            }

            // If module has a default export that's a class, instantiate it
            if (module.default && typeof module.default === 'function') {
                return new module.default(...args);
            }

            // If module has named exports, return the module
            return module;
        };
    }

    /**
     * Load module from organize directory
     */
    async loadOrganizeModule(moduleName, options = {}) {
        const modulePath = `organize/${moduleName}`;
        return this.safeImport(modulePath, {
            ...options,
            context: `organize-${moduleName}`
        });
    }

    /**
     * Load module from sync directory
     */
    async loadSyncModule(moduleName, options = {}) {
        const modulePath = `sync/${moduleName}`;
        return this.safeImport(modulePath, {
            ...options,
            context: `sync-${moduleName}`
        });
    }

    /**
     * Load module from mcp directory
     */
    async loadMcpModule(moduleName, options = {}) {
        const modulePath = `mcp/${moduleName}`;
        return this.safeImport(modulePath, {
            ...options,
            context: `mcp-${moduleName}`
        });
    }

    /**
     * Load modules from all directories
     */
    async loadModulesFromAllDirectories(moduleSpecs) {
        const results = new Map();
        const errors = [];

        for (const [name, spec] of Object.entries(moduleSpecs)) {
            try {
                let module;

                // Determine which directory to load from
                if (spec.directory && this.moduleDirectories[spec.directory]) {
                    const modulePath = `${spec.directory}/${spec.path || name}`;
                    module = await this.safeImport(modulePath, {
                        required: spec.required !== false,
                        fallback: spec.fallback || null,
                        context: `${spec.directory}-${name}`
                    });
                } else {
                    // Use standard resolution
                    module = await this.safeImport(spec.path || name, {
                        required: spec.required !== false,
                        fallback: spec.fallback || null,
                        context: name
                    });
                }

                if (module) {
                    // Create instance if it's a class
                    if (spec.instantiate && module[spec.className]) {
                        results.set(name, new module[spec.className](spec.options || {}));
                    } else if (spec.instantiate && module.default) {
                        results.set(name, new module.default(spec.options || {}));
                    } else {
                        results.set(name, module);
                    }
                }
            } catch (error) {
                errors.push({ name, error: error.message });
                console.error(`[ModuleLoader] Failed to load ${name}: ${error.message}`);

                if (spec.required !== false) {
                    throw new Error(`Required module ${name} failed to load: ${error.message}`);
                }
            }
        }

        return { results, errors };
    }

    /**
     * Get module loading statistics
     */
    getStats() {
        return {
            cached: this.moduleCache.size,
            failed: this.failedModules.size,
            cachedModules: Array.from(this.moduleCache.keys()),
            failedModules: Array.from(this.failedModules),
            moduleDirectories: this.moduleDirectories,
            baseDir: this.baseDir
        };
    }

    /**
     * Clear module cache
     */
    clearCache() {
        this.moduleCache.clear();
        this.failedModules.clear();
    }

    /**
     * Utility delay function
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Path resolution utilities
 */
export class PathResolver {
    static resolveProjectRoot(startPath = process.cwd()) {
        const resolver = new SimplePathResolver();
        return resolver.detectProjectRoot();
    }

    static resolveModulePath(modulePath, baseDir = process.cwd()) {
        const resolver = new SimplePathResolver();
        return resolver.resolvePath(modulePath, baseDir);
    }

    static getAbsolutePath(relativePath, baseDir = process.cwd()) {
        const resolver = new SimplePathResolver();
        return resolver.getAbsolutePath(relativePath, baseDir);
    }
}

/**
 * Environment-aware module loader for shell script integration
 */
export class ShellModuleLoader extends ModuleLoader {
    constructor(options = {}) {
        super(options);
    }

    /**
     * Load modules for shell script execution with support for all directories
     */
    async loadForShell(moduleSpecs, environment = {}) {
        // Set up environment variables
        Object.entries(environment).forEach(([key, value]) => {
            process.env[key] = value;
        });

        return this.loadModulesFromAllDirectories(moduleSpecs);
    }

    /**
     * Resolve module path for shell context with environment variable support
     */
    resolveShellModulePath(modulePath) {
        // Handle environment variable substitution
        const expandedPath = modulePath.replace(/\$\{(\w+)\}/g, (match, varName) => {
            return process.env[varName] || match;
        });

        // Use the enhanced resolution from parent class
        return this.resolvePath(expandedPath);
    }
}

// Export default instance for convenience
export const moduleLoader = new ModuleLoader();
export const pathResolver = PathResolver;

export default ModuleLoader;