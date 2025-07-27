#!/usr/bin/env node

/**
 * Module Loader Utility
 * Provides safe module import functionality with error handling and fallback behavior
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ModuleLoader {
    constructor(options = {}) {
        this.baseDir = options.baseDir || __dirname;
        this.retryAttempts = options.retryAttempts || 3;
        this.retryDelay = options.retryDelay || 1000;
        this.moduleCache = new Map();
        this.failedModules = new Set();
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

        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                console.log(`[ModuleLoader] Attempting to import ${modulePath} (attempt ${attempt}/${this.retryAttempts}) for context: ${context}`);

                const module = await this.importWithTimeout(resolvedPath, timeout);

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
     * Resolve module path with different strategies
     */
    resolvePath(modulePath) {
        // If already absolute or starts with protocol, return as-is
        if (path.isAbsolute(modulePath) || modulePath.startsWith('file://') || modulePath.startsWith('http')) {
            return modulePath;
        }

        // If starts with './', resolve relative to base directory
        if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
            return path.resolve(this.baseDir, modulePath);
        }

        // Try different resolution strategies
        const strategies = [
            // Relative to current directory
            path.resolve(process.cwd(), modulePath),
            // Relative to base directory
            path.resolve(this.baseDir, modulePath),
            // Relative to project root (assuming base is in src/organize)
            path.resolve(this.baseDir, '../../', modulePath),
            // As-is (for node_modules)
            modulePath
        ];

        for (const strategy of strategies) {
            try {
                // For file paths, check if file exists
                if (strategy.endsWith('.js') || strategy.endsWith('.mjs')) {
                    require('fs').accessSync(strategy);
                }
                return strategy;
            } catch (error) {
                // Continue to next strategy
            }
        }

        // Return original path as last resort
        return modulePath;
    }

    /**
     * Validate module before import
     */
    async validateModule(modulePath) {
        try {
            const resolvedPath = this.resolvePath(modulePath);

            // For file paths, check if file exists and is readable
            if (resolvedPath.endsWith('.js') || resolvedPath.endsWith('.mjs')) {
                await fs.access(resolvedPath, fs.constants.R_OK);

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
     * Get module loading statistics
     */
    getStats() {
        return {
            cached: this.moduleCache.size,
            failed: this.failedModules.size,
            cachedModules: Array.from(this.moduleCache.keys()),
            failedModules: Array.from(this.failedModules)
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
        let currentPath = startPath;
        const maxDepth = 10;

        for (let i = 0; i < maxDepth; i++) {
            // Look for package.json or config directory
            const packageJsonPath = path.join(currentPath, 'package.json');
            const configPath = path.join(currentPath, 'config');

            try {
                require('fs').accessSync(packageJsonPath);
                return currentPath;
            } catch (error) {
                try {
                    require('fs').accessSync(configPath);
                    return currentPath;
                } catch (error) {
                    // Continue searching
                }
            }

            const parentPath = path.dirname(currentPath);
            if (parentPath === currentPath) {
                // Reached filesystem root
                break;
            }
            currentPath = parentPath;
        }

        // Fallback to current working directory
        return process.cwd();
    }

    static resolveModulePath(modulePath, baseDir = process.cwd()) {
        if (path.isAbsolute(modulePath)) {
            return modulePath;
        }

        // Handle relative paths
        if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
            return path.resolve(baseDir, modulePath);
        }

        // Handle module names (try different locations)
        const possiblePaths = [
            path.resolve(baseDir, modulePath),
            path.resolve(baseDir, 'src', modulePath),
            path.resolve(baseDir, 'lib', modulePath),
            path.resolve(baseDir, 'node_modules', modulePath)
        ];

        for (const possiblePath of possiblePaths) {
            try {
                require('fs').accessSync(possiblePath);
                return possiblePath;
            } catch (error) {
                // Continue to next path
            }
        }

        // Return original path as fallback
        return modulePath;
    }

    static getAbsolutePath(relativePath, baseDir = process.cwd()) {
        if (path.isAbsolute(relativePath)) {
            return relativePath;
        }
        return path.resolve(baseDir, relativePath);
    }
}

/**
 * Environment-aware module loader for shell script integration
 */
export class ShellModuleLoader extends ModuleLoader {
    constructor(options = {}) {
        super(options);
        this.projectRoot = options.projectRoot || PathResolver.resolveProjectRoot();
    }

    /**
     * Load modules for shell script execution
     */
    async loadForShell(moduleSpecs, environment = {}) {
        const loader = this;

        // Set up environment variables
        Object.entries(environment).forEach(([key, value]) => {
            process.env[key] = value;
        });

        const results = {};
        const errors = [];

        for (const [name, spec] of Object.entries(moduleSpecs)) {
            try {
                const modulePath = this.resolveShellModulePath(spec.path);
                const module = await loader.safeImport(modulePath, {
                    required: spec.required !== false,
                    fallback: spec.fallback || null,
                    context: `shell-${name}`
                });

                if (module) {
                    // Create instance if it's a class
                    if (spec.instantiate && module[spec.className]) {
                        results[name] = new module[spec.className](spec.options || {});
                    } else if (spec.instantiate && module.default) {
                        results[name] = new module.default(spec.options || {});
                    } else {
                        results[name] = module;
                    }
                }
            } catch (error) {
                errors.push({ name, error: error.message });
                console.error(`[ShellModuleLoader] Failed to load ${name}: ${error.message}`);

                if (spec.required !== false) {
                    throw new Error(`Required module ${name} failed to load: ${error.message}`);
                }
            }
        }

        return { results, errors };
    }

    /**
     * Resolve module path for shell context
     */
    resolveShellModulePath(modulePath) {
        // Handle environment variable substitution
        const expandedPath = modulePath.replace(/\$\{(\w+)\}/g, (match, varName) => {
            return process.env[varName] || match;
        });

        // For relative paths starting with './', resolve relative to the organize directory
        if (expandedPath.startsWith('./')) {
            return path.resolve(this.baseDir, expandedPath);
        }

        return PathResolver.resolveModulePath(expandedPath, this.baseDir);
    }
}

// Export default instance for convenience
export const moduleLoader = new ModuleLoader();
export const pathResolver = PathResolver;

export default ModuleLoader;