#!/usr/bin/env node

/**
 * Module Loader Utility
 * Provides safe module import functionality with error handling and fallback behavior
 */

import { promises as fs } from 'fs';
import { accessSync, existsSync, constants as fsConstants } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ModuleLoader {
    constructor(options = {}) {
        // Detect project root first (most reliable)
        this.projectRoot = this.detectProjectRootFromFile();
        
        // Validate and set base directory
        if (options.baseDir) {
            // If baseDir is provided, ensure it's within the project root
            const resolvedBaseDir = path.resolve(options.baseDir);
            const expectedBaseDir = path.join(this.projectRoot, 'src', 'organize');
            
            // Only use provided baseDir if it's the correct organize directory
            if (resolvedBaseDir === expectedBaseDir) {
                this.baseDir = resolvedBaseDir;
            } else {
                console.warn(`[ModuleLoader] Invalid baseDir provided: ${resolvedBaseDir}`);
                console.warn(`[ModuleLoader] Expected: ${expectedBaseDir}`);
                console.warn(`[ModuleLoader] Using correct path instead`);
                this.baseDir = expectedBaseDir;
            }
        } else {
            // Default to organize folder within project root
            this.baseDir = path.join(this.projectRoot, 'src', 'organize');
        }
        
        this.retryAttempts = options.retryAttempts || 3;
        this.retryDelay = options.retryDelay || 1000;
        this.moduleCache = new Map();
        this.failedModules = new Set();
        
        console.log(`[ModuleLoader] Initialized with projectRoot: ${this.projectRoot}`);
        console.log(`[ModuleLoader] Base directory: ${this.baseDir}`);
    }
    
    /**
     * Detect project root from the current file's location
     * NEVER allows defaulting to system root (/) to prevent permission issues
     */
    detectProjectRootFromFile() {
        // Strategy 1: Use this file's location (most reliable)
        if (import.meta.url) {
            try {
                const currentFileDir = path.dirname(new URL(import.meta.url).pathname);
                // Navigate up from src/organize to project root
                const potentialRoot = path.resolve(currentFileDir, '../../');
                if (this.isProjectRoot(potentialRoot)) {
                    console.log(`[ModuleLoader] Detected project root via import.meta.url: ${potentialRoot}`);
                    return potentialRoot;
                }
            } catch (error) {
                console.warn(`[ModuleLoader] import.meta.url detection failed: ${error.message}`);
            }
        }
        
        // Strategy 2: Known absolute path (most reliable fallback)
        const knownProjectPath = '/Users/moatasimfarooque/Downloads/Programming/CascadeProjects/Drive_sync';
        if (this.isProjectRoot(knownProjectPath)) {
            console.log(`[ModuleLoader] Using known absolute path: ${knownProjectPath}`);
            return knownProjectPath;
        }
        
        // Strategy 3: Comprehensive fallback strategies (NEVER allow system root)
        const fallbacks = [
            '/Users/moatasimfarooque/Downloads/Programming/CascadeProjects/Drive_sync',
            path.join(os.homedir(), 'Downloads/Programming/CascadeProjects/Drive_sync'),
            path.join(os.homedir(), 'Downloads/Drive_sync'),
            path.join(os.homedir(), 'Drive_sync')
        ];
        
        console.warn(`[ModuleLoader] All detection strategies failed, trying fallbacks...`);
        
        for (const fallback of fallbacks) {
            if (this.isProjectRoot(fallback)) {
                console.log(`[ModuleLoader] Using fallback: ${fallback}`);
                return fallback;
            }
        }
        
        // CRITICAL: Never return system root - use first known good path
        const safeFallback = fallbacks[0];
        console.error(`[ModuleLoader] CRITICAL: All fallbacks failed, using safe default: ${safeFallback}`);
        return safeFallback;
    }
    
    /**
     * Check if a directory is likely the project root
     */
    isProjectRoot(dirPath) {
        try {
            // Primary indicators (any one of these is sufficient)
            const primaryIndicators = [
                path.join(dirPath, 'package.json'),
                path.join(dirPath, '.git'),
                path.join(dirPath, 'config', 'config.env')
            ];
            
            for (const indicator of primaryIndicators) {
                if (existsSync(indicator)) {
                    return true;
                }
            }
            
            // Secondary indicators (need multiple)
            const srcExists = existsSync(path.join(dirPath, 'src'));
            const organizeExists = existsSync(path.join(dirPath, 'src', 'organize'));
            
            return srcExists && organizeExists;
        } catch (error) {
            return false;
        }
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
     * Resolve module path with different strategies
     * Now uses project root for consistent resolution regardless of working directory
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

        // Try different resolution strategies, prioritizing project-root-based paths
        // Always use project root to avoid working directory issues
        const strategies = [
            // Relative to project root + src/organize (most reliable for organize modules)
            path.resolve(this.projectRoot, 'src', 'organize', modulePath),
            path.resolve(this.projectRoot, 'src', 'organize', `${modulePath}.js`),
            // Relative to project root for other modules
            path.resolve(this.projectRoot, 'src', modulePath),
            path.resolve(this.projectRoot, 'src', `${modulePath}.js`),
            // Only use baseDir if it's actually the organize directory (not when cwd is wrong)
            ...(this.baseDir.endsWith('src/organize') ? [
                path.resolve(this.baseDir, modulePath),
                path.resolve(this.baseDir, `${modulePath}.js`)
            ] : []),
            // Fallback to current directory (less reliable)
            path.resolve(process.cwd(), modulePath),
            // As-is (for node_modules)
            modulePath
        ];

        for (const strategy of strategies) {
            try {
                // For file paths, check if file exists using ES module compatible fs
                if (strategy.endsWith('.js') || strategy.endsWith('.mjs')) {
                    accessSync(strategy, fsConstants.F_OK);
                    return strategy;
                }
                // For non-JS paths, return as-is
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