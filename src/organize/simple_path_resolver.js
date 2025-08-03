#!/usr/bin/env node

/**
 * Simplified Path Resolution Utility
 * Replaces complex path resolution chains with simple, reliable methods
 * Removes Unicode normalization complexity and uses Node.js built-in handling
 */

import { promises as fs } from 'fs';
import { existsSync, statSync } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Simple Path Resolver
 * Provides straightforward path resolution without complex fallback chains
 */
export class SimplePathResolver {
    constructor(options = {}) {
        this.projectRoot = options.projectRoot || this.detectProjectRoot();
        this.syncHubPath = options.syncHubPath || this.getDefaultSyncHubPath();
    }

    /**
     * Detect project root using simple, reliable method
     * No complex fallback chains - just check common indicators
     */
    detectProjectRoot() {
        // Start from current file location
        const currentDir = path.dirname(new URL(import.meta.url).pathname);
        const projectRoot = path.resolve(currentDir, '../../');

        // Simple validation - check for package.json
        if (existsSync(path.join(projectRoot, 'package.json'))) {
            return projectRoot;
        }

        // Fallback to known location if available
        const knownPath = '/Users/moatasimfarooque/Downloads/Programming/CascadeProjects/Drive_sync';
        if (existsSync(path.join(knownPath, 'package.json'))) {
            return knownPath;
        }

        // Final fallback to current working directory
        return process.cwd();
    }

    /**
     * Get default sync hub path
     */
    getDefaultSyncHubPath() {
        const defaultPath = '/Users/moatasimfarooque/Sync_Hub_New';
        return existsSync(defaultPath) ? defaultPath : path.join(os.homedir(), 'Sync_Hub');
    }

    /**
     * Resolve path with simple logic
     * No complex chains or multiple fallbacks
     */
    resolvePath(inputPath, basePath = null) {
        if (!inputPath) {
            throw new Error('Path cannot be empty or null');
        }

        // If already absolute, return as-is
        if (path.isAbsolute(inputPath)) {
            return path.normalize(inputPath);
        }

        // Use provided base path or project root
        const base = basePath || this.projectRoot;
        return path.resolve(base, inputPath);
    }

    /**
     * Simple file existence check
     * No multiple fallbacks - just check if file exists
     */
    async fileExists(filePath) {
        try {
            const resolvedPath = this.resolvePath(filePath);
            await fs.access(resolvedPath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Synchronous file existence check
     */
    fileExistsSync(filePath) {
        try {
            const resolvedPath = this.resolvePath(filePath);
            return existsSync(resolvedPath);
        } catch {
            return false;
        }
    }

    /**
     * Simple directory existence check
     */
    async directoryExists(dirPath) {
        try {
            const resolvedPath = this.resolvePath(dirPath);
            const stats = await fs.stat(resolvedPath);
            return stats.isDirectory();
        } catch {
            return false;
        }
    }

    /**
     * Synchronous directory existence check
     */
    directoryExistsSync(dirPath) {
        try {
            const resolvedPath = this.resolvePath(dirPath);
            if (!existsSync(resolvedPath)) {
                return false;
            }
            const stats = statSync(resolvedPath);
            return stats.isDirectory();
        } catch {
            return false;
        }
    }

    /**
     * Get absolute path with clear error message
     */
    getAbsolutePath(inputPath, basePath = null) {
        if (!inputPath) {
            throw new Error('Cannot resolve absolute path: input path is empty or null');
        }

        try {
            return this.resolvePath(inputPath, basePath);
        } catch (error) {
            throw new Error(`Failed to resolve absolute path for "${inputPath}": ${error.message}`);
        }
    }

    /**
     * Validate path exists and provide clear error message
     */
    async validatePath(inputPath, type = 'any') {
        const resolvedPath = this.resolvePath(inputPath);

        try {
            const stats = await fs.stat(resolvedPath);

            switch (type) {
                case 'file':
                    if (!stats.isFile()) {
                        throw new Error(`Path exists but is not a file: ${resolvedPath}`);
                    }
                    break;
                case 'directory':
                    if (!stats.isDirectory()) {
                        throw new Error(`Path exists but is not a directory: ${resolvedPath}`);
                    }
                    break;
                case 'any':
                    // Path exists, type doesn't matter
                    break;
                default:
                    throw new Error(`Invalid validation type: ${type}`);
            }

            return resolvedPath;
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Path does not exist: ${resolvedPath}`);
            }
            if (error.code === 'EACCES') {
                throw new Error(`Permission denied accessing path: ${resolvedPath}`);
            }
            throw error;
        }
    }

    /**
     * Join paths with simple logic
     */
    joinPaths(...pathSegments) {
        if (pathSegments.length === 0) {
            throw new Error('No path segments provided');
        }

        const filteredSegments = pathSegments.filter(segment =>
            segment !== null && segment !== undefined && segment !== ''
        );

        if (filteredSegments.length === 0) {
            throw new Error('All path segments are empty or null');
        }

        return path.join(...filteredSegments);
    }

    /**
     * Get relative path between two paths
     */
    getRelativePath(fromPath, toPath) {
        if (!fromPath || !toPath) {
            throw new Error('Both fromPath and toPath must be provided');
        }

        const resolvedFrom = this.resolvePath(fromPath);
        const resolvedTo = this.resolvePath(toPath);

        return path.relative(resolvedFrom, resolvedTo);
    }

    /**
     * Ensure directory exists with simple logic
     */
    async ensureDirectory(dirPath) {
        const resolvedPath = this.resolvePath(dirPath);

        try {
            await fs.mkdir(resolvedPath, { recursive: true });
            return resolvedPath;
        } catch (error) {
            throw new Error(`Failed to create directory "${resolvedPath}": ${error.message}`);
        }
    }

    /**
     * Get parent directory
     */
    getParentDirectory(filePath) {
        if (!filePath) {
            throw new Error('File path cannot be empty');
        }

        const resolvedPath = this.resolvePath(filePath);
        return path.dirname(resolvedPath);
    }

    /**
     * Get file extension
     */
    getFileExtension(filePath) {
        if (!filePath) {
            throw new Error('File path cannot be empty');
        }

        return path.extname(filePath);
    }

    /**
     * Get filename without extension
     */
    getBaseName(filePath, includeExtension = true) {
        if (!filePath) {
            throw new Error('File path cannot be empty');
        }

        return includeExtension ? path.basename(filePath) : path.basename(filePath, path.extname(filePath));
    }

    /**
     * Check if path is within another path
     */
    isPathWithin(childPath, parentPath) {
        if (!childPath || !parentPath) {
            throw new Error('Both child and parent paths must be provided');
        }

        const resolvedChild = this.resolvePath(childPath);
        const resolvedParent = this.resolvePath(parentPath);

        const relativePath = path.relative(resolvedParent, resolvedChild);
        return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
    }
}

/**
 * Static utility methods for simple path operations
 */
export class PathUtils {
    /**
     * Simple path normalization using Node.js built-in
     */
    static normalize(inputPath) {
        if (!inputPath) {
            throw new Error('Path cannot be empty or null');
        }
        return path.normalize(inputPath);
    }

    /**
     * Check if path is absolute
     */
    static isAbsolute(inputPath) {
        if (!inputPath) {
            return false;
        }
        return path.isAbsolute(inputPath);
    }

    /**
     * Simple file existence check without fallbacks
     */
    static existsSync(filePath) {
        if (!filePath) {
            return false;
        }
        return existsSync(filePath);
    }

    /**
     * Get file stats with clear error message
     */
    static async getStats(filePath) {
        if (!filePath) {
            throw new Error('File path cannot be empty');
        }

        try {
            return await fs.stat(filePath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`File or directory not found: ${filePath}`);
            }
            if (error.code === 'EACCES') {
                throw new Error(`Permission denied accessing: ${filePath}`);
            }
            throw new Error(`Failed to get stats for "${filePath}": ${error.message}`);
        }
    }

    /**
     * Create error message for missing file/directory
     */
    static createNotFoundError(filePath, type = 'file') {
        return new Error(`${type.charAt(0).toUpperCase() + type.slice(1)} not found: ${filePath}`);
    }

    /**
     * Create error message for permission denied
     */
    static createPermissionError(filePath, operation = 'access') {
        return new Error(`Permission denied to ${operation}: ${filePath}`);
    }
}

// Export default instance for convenience
export const simplePathResolver = new SimplePathResolver();

export default SimplePathResolver;