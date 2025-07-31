#!/usr/bin/env node

/**
 * Document Folder Manager
 * Central service for handling folder-based document operations
 * 
 * This class implements the folder-first architecture where each document
 * is a folder containing a main document file and an images subfolder.
 */

import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import { createErrorHandler, ErrorTypes, EnhancedError } from './error_handler.js';

/**
 * Document Folder Manager Class
 * Handles all folder-based document operations with atomic guarantees
 */
export class DocumentFolderManager {
    constructor(syncHubPath, options = {}) {
        this.syncHubPath = syncHubPath;
        this.options = {
            mainFileNames: ['main.md', 'document.md', 'index.md'],
            imagesSubfolderName: 'images',
            validDocumentExtensions: ['.md', '.txt'],
            ...options
        };

        // Initialize error handler
        this.errorHandler = createErrorHandler('DocumentFolderManager', {
            enableConsoleLogging: process.env.NODE_ENV !== 'production'
        });

        // Bind logging methods
        this.logError = this.errorHandler.logError.bind(this.errorHandler);
        this.logWarn = this.errorHandler.logWarn.bind(this.errorHandler);
        this.logInfo = this.errorHandler.logInfo.bind(this.errorHandler);
        this.logDebug = this.errorHandler.logDebug.bind(this.errorHandler);
    }

    /**
     * Check if a given path is a document folder
     * A document folder must contain a main document file and may have an images subfolder
     */
    async isDocumentFolder(folderPath) {
        return await this.errorHandler.wrapAsync(async () => {
            if (!existsSync(folderPath)) {
                return false;
            }

            const stats = await fs.stat(folderPath);
            if (!stats.isDirectory()) {
                return false;
            }

            // Check for main document file
            const mainFile = await this.getMainDocumentFile(folderPath);
            return mainFile !== null;
        }, {
            operation: 'isDocumentFolder',
            folderPath
        });
    }

    /**
     * Find the main document file within a document folder
     * Returns the full path to the main document file or null if not found
     */
    async getMainDocumentFile(folderPath) {
        return await this.errorHandler.wrapAsync(async () => {
            if (!existsSync(folderPath)) {
                return null;
            }

            const files = await fs.readdir(folderPath);
            const folderName = path.basename(folderPath);

            // First, look for a file that matches the folder name
            const expectedFileName = `${folderName}.md`;
            if (files.includes(expectedFileName)) {
                const mainFilePath = path.join(folderPath, expectedFileName);
                const stats = await fs.stat(mainFilePath);
                if (stats.isFile()) {
                    return mainFilePath;
                }
            }

            // Second, look for standard main file names
            for (const mainFileName of this.options.mainFileNames) {
                if (files.includes(mainFileName)) {
                    const mainFilePath = path.join(folderPath, mainFileName);
                    const stats = await fs.stat(mainFilePath);
                    if (stats.isFile()) {
                        // Rename to match folder name if it's a standard main file
                        await this.ensureDocumentNameMatchesFolder(folderPath, mainFilePath);
                        return path.join(folderPath, expectedFileName);
                    }
                }
            }

            // If no standard main file found, look for any markdown file
            const potentialMainFiles = files.filter(file => {
                const ext = path.extname(file).toLowerCase();
                return this.options.validDocumentExtensions.includes(ext);
            });

            // Sort by preference: folder name match first, then alphabetically
            potentialMainFiles.sort((a, b) => {
                const aMatchesFolder = path.basename(a, path.extname(a)).toLowerCase() === folderName.toLowerCase();
                const bMatchesFolder = path.basename(b, path.extname(b)).toLowerCase() === folderName.toLowerCase();

                if (aMatchesFolder && !bMatchesFolder) return -1;
                if (!aMatchesFolder && bMatchesFolder) return 1;
                return a.localeCompare(b);
            });

            if (potentialMainFiles.length > 0) {
                const selectedFile = path.join(folderPath, potentialMainFiles[0]);
                // Rename to match folder name if it doesn't already
                if (potentialMainFiles[0] !== expectedFileName) {
                    await this.ensureDocumentNameMatchesFolder(folderPath, selectedFile);
                    return path.join(folderPath, expectedFileName);
                }
                return selectedFile;
            }

            return null;
        }, {
            operation: 'getMainDocumentFile',
            folderPath
        });
    }

    /**
     * Ensure document name matches folder name
     */
    async ensureDocumentNameMatchesFolder(folderPath, currentFilePath) {
        return await this.errorHandler.wrapAsync(async () => {
            const folderName = path.basename(folderPath);
            const expectedFileName = `${folderName}.md`;
            const expectedFilePath = path.join(folderPath, expectedFileName);

            // If the file already has the correct name, do nothing
            if (currentFilePath === expectedFilePath) {
                return expectedFilePath;
            }

            // Check if the expected file already exists
            if (existsSync(expectedFilePath)) {
                await this.errorHandler.logWarn('Expected document file already exists, keeping current file', {
                    folderPath,
                    currentFile: path.basename(currentFilePath),
                    expectedFile: expectedFileName
                });
                return currentFilePath;
            }

            // Rename the file to match the folder name
            await fs.rename(currentFilePath, expectedFilePath);

            await this.errorHandler.logInfo('Renamed document to match folder name', {
                folderPath,
                oldName: path.basename(currentFilePath),
                newName: expectedFileName
            });

            return expectedFilePath;
        }, {
            operation: 'ensureDocumentNameMatchesFolder',
            folderPath,
            currentFile: path.basename(currentFilePath)
        });
    }

    /**
     * Get the images subfolder path for a document folder
     * Creates the images folder if it doesn't exist
     */
    async getImagesFolder(folderPath, createIfMissing = true) {
        return await this.errorHandler.wrapAsync(async () => {
            const imagesPath = path.join(folderPath, this.options.imagesSubfolderName);

            if (createIfMissing && !existsSync(imagesPath)) {
                await fs.mkdir(imagesPath, { recursive: true });
                await this.logDebug('Created images subfolder', { imagesPath });
            }

            return imagesPath;
        }, {
            operation: 'getImagesFolder',
            folderPath,
            createIfMissing
        });
    }

    /**
     * Create a new document folder with proper structure
     * Returns the path to the created document folder
     */
    async createDocumentFolder(name, category, initialContent = '') {
        return await this.errorHandler.wrapAsync(async () => {
            // Sanitize folder name
            const sanitizedName = this.sanitizeFolderName(name);

            // Determine target path
            const categoryPath = path.join(this.syncHubPath, category);
            const documentFolderPath = path.join(categoryPath, sanitizedName);

            // Check if folder already exists
            if (existsSync(documentFolderPath)) {
                throw new EnhancedError(
                    `Document folder already exists: ${sanitizedName}`,
                    ErrorTypes.VALIDATION_ERROR,
                    {
                        operation: 'createDocumentFolder',
                        name: sanitizedName,
                        category,
                        documentFolderPath
                    }
                );
            }

            // Create category directory if it doesn't exist
            await fs.mkdir(categoryPath, { recursive: true });

            // Create document folder
            await fs.mkdir(documentFolderPath, { recursive: true });

            // Create main document file with name matching folder
            const mainFileName = `${name}.md`;
            const mainFilePath = path.join(documentFolderPath, mainFileName);
            const documentContent = initialContent || `# ${name}\n\n`;
            await fs.writeFile(mainFilePath, documentContent, 'utf8');

            // Create images subfolder
            await this.getImagesFolder(documentFolderPath, true);

            await this.logInfo('Created document folder', {
                name: sanitizedName,
                category,
                documentFolderPath,
                mainFilePath
            });

            return documentFolderPath;
        }, {
            operation: 'createDocumentFolder',
            name,
            category
        });
    }

    /**
     * Move a document folder atomically from source to target location
     */
    async moveDocumentFolder(sourcePath, targetPath) {
        return await this.errorHandler.wrapAsync(async () => {
            // Validate source exists and is a document folder
            if (!existsSync(sourcePath)) {
                throw new EnhancedError(
                    `Source document folder does not exist: ${sourcePath}`,
                    ErrorTypes.FILE_NOT_FOUND,
                    {
                        operation: 'moveDocumentFolder',
                        sourcePath,
                        targetPath
                    }
                );
            }

            const isDocFolder = await this.isDocumentFolder(sourcePath);
            if (!isDocFolder) {
                throw new EnhancedError(
                    `Source is not a valid document folder: ${sourcePath}`,
                    ErrorTypes.VALIDATION_ERROR,
                    {
                        operation: 'moveDocumentFolder',
                        sourcePath,
                        targetPath
                    }
                );
            }

            // Ensure target directory exists
            const targetDir = path.dirname(targetPath);
            await fs.mkdir(targetDir, { recursive: true });

            // Check if target already exists
            if (existsSync(targetPath)) {
                throw new EnhancedError(
                    `Target document folder already exists: ${targetPath}`,
                    ErrorTypes.VALIDATION_ERROR,
                    {
                        operation: 'moveDocumentFolder',
                        sourcePath,
                        targetPath
                    }
                );
            }

            // Perform atomic move
            await fs.rename(sourcePath, targetPath);

            await this.logInfo('Moved document folder', {
                sourcePath,
                targetPath
            });

            return targetPath;
        }, {
            operation: 'moveDocumentFolder',
            sourcePath,
            targetPath
        });
    }

    /**
     * Delete a document folder atomically
     * Removes the entire folder and all its contents
     */
    async deleteDocumentFolder(folderPath) {
        return await this.errorHandler.wrapAsync(async () => {
            // Validate folder exists and is a document folder
            if (!existsSync(folderPath)) {
                throw new EnhancedError(
                    `Document folder does not exist: ${folderPath}`,
                    ErrorTypes.FILE_NOT_FOUND,
                    {
                        operation: 'deleteDocumentFolder',
                        folderPath
                    }
                );
            }

            const isDocFolder = await this.isDocumentFolder(folderPath);
            if (!isDocFolder) {
                throw new EnhancedError(
                    `Path is not a valid document folder: ${folderPath}`,
                    ErrorTypes.VALIDATION_ERROR,
                    {
                        operation: 'deleteDocumentFolder',
                        folderPath
                    }
                );
            }

            // Perform atomic deletion
            await fs.rm(folderPath, { recursive: true, force: true });

            await this.logInfo('Deleted document folder', {
                folderPath
            });

            return true;
        }, {
            operation: 'deleteDocumentFolder',
            folderPath
        });
    }

    /**
     * Get the content of a document folder's main file
     */
    async getDocumentContent(folderPath) {
        return await this.errorHandler.wrapAsync(async () => {
            const mainFilePath = await this.getMainDocumentFile(folderPath);

            if (!mainFilePath) {
                throw new EnhancedError(
                    `No main document file found in folder: ${folderPath}`,
                    ErrorTypes.FILE_NOT_FOUND,
                    {
                        operation: 'getDocumentContent',
                        folderPath
                    }
                );
            }

            const content = await fs.readFile(mainFilePath, 'utf8');
            return content;
        }, {
            operation: 'getDocumentContent',
            folderPath
        });
    }

    /**
     * Update the content of a document folder's main file
     */
    async updateDocumentContent(folderPath, content) {
        return await this.errorHandler.wrapAsync(async () => {
            const mainFilePath = await this.getMainDocumentFile(folderPath);

            if (!mainFilePath) {
                throw new EnhancedError(
                    `No main document file found in folder: ${folderPath}`,
                    ErrorTypes.FILE_NOT_FOUND,
                    {
                        operation: 'updateDocumentContent',
                        folderPath
                    }
                );
            }

            await fs.writeFile(mainFilePath, content, 'utf8');

            await this.logDebug('Updated document content', {
                folderPath,
                mainFilePath,
                contentLength: content.length
            });

            return mainFilePath;
        }, {
            operation: 'updateDocumentContent',
            folderPath
        });
    }

    /**
     * List all document folders in a category path
     */
    async listDocumentFolders(categoryPath) {
        return await this.errorHandler.wrapAsync(async () => {
            if (!existsSync(categoryPath)) {
                return [];
            }

            const items = await fs.readdir(categoryPath);
            const documentFolders = [];

            for (const item of items) {
                const itemPath = path.join(categoryPath, item);
                const stats = await fs.stat(itemPath);

                if (stats.isDirectory()) {
                    const isDocFolder = await this.isDocumentFolder(itemPath);
                    if (isDocFolder) {
                        documentFolders.push(itemPath);
                    }
                }
            }

            return documentFolders;
        }, {
            operation: 'listDocumentFolders',
            categoryPath
        });
    }

    /**
     * Find document folders recursively from a search path
     */
    async findDocumentFolders(searchPath, recursive = true) {
        return await this.errorHandler.wrapAsync(async () => {
            const documentFolders = [];

            if (!existsSync(searchPath)) {
                return documentFolders;
            }

            const stats = await fs.stat(searchPath);
            if (!stats.isDirectory()) {
                return documentFolders;
            }

            // Check if current path is a document folder
            const isDocFolder = await this.isDocumentFolder(searchPath);
            if (isDocFolder) {
                documentFolders.push(searchPath);
                // If it's a document folder, don't recurse into it
                return documentFolders;
            }

            // If not a document folder and recursive is enabled, search subdirectories
            if (recursive) {
                const items = await fs.readdir(searchPath);

                for (const item of items) {
                    const itemPath = path.join(searchPath, item);
                    const itemStats = await fs.stat(itemPath);

                    if (itemStats.isDirectory()) {
                        const subFolders = await this.findDocumentFolders(itemPath, recursive);
                        documentFolders.push(...subFolders);
                    }
                }
            }

            return documentFolders;
        }, {
            operation: 'findDocumentFolders',
            searchPath,
            recursive
        });
    }

    /**
     * Get metadata about a document folder
     */
    async getDocumentFolderMetadata(folderPath) {
        return await this.errorHandler.wrapAsync(async () => {
            if (!existsSync(folderPath)) {
                throw new EnhancedError(
                    `Document folder does not exist: ${folderPath}`,
                    ErrorTypes.FILE_NOT_FOUND,
                    {
                        operation: 'getDocumentFolderMetadata',
                        folderPath
                    }
                );
            }

            const stats = await fs.stat(folderPath);
            const mainFilePath = await this.getMainDocumentFile(folderPath);
            const imagesPath = path.join(folderPath, this.options.imagesSubfolderName);

            let imageCount = 0;
            if (existsSync(imagesPath)) {
                const imageFiles = await fs.readdir(imagesPath);
                imageCount = imageFiles.filter(file => {
                    const ext = path.extname(file).toLowerCase();
                    return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext);
                }).length;
            }

            return {
                folderPath,
                name: path.basename(folderPath),
                category: path.basename(path.dirname(folderPath)),
                mainFile: mainFilePath,
                imagesFolder: imagesPath,
                metadata: {
                    created: stats.birthtime,
                    modified: stats.mtime,
                    size: stats.size,
                    imageCount
                }
            };
        }, {
            operation: 'getDocumentFolderMetadata',
            folderPath
        });
    }

    /**
     * Sanitize folder name to be filesystem-safe
     */
    sanitizeFolderName(name) {
        return name
            .replace(/[<>:"/\\|?*]/g, '-')  // Replace invalid characters
            .replace(/\s+/g, '-')           // Replace spaces with hyphens
            .replace(/-+/g, '-')            // Replace multiple hyphens with single
            .replace(/^-|-$/g, '')          // Remove leading/trailing hyphens
            .substring(0, 255);             // Limit length
    }

    /**
     * Validate that a path is within the sync hub (security check)
     */
    validatePathWithinSyncHub(targetPath) {
        const resolvedTarget = path.resolve(targetPath);
        const resolvedSyncHub = path.resolve(this.syncHubPath);

        if (!resolvedTarget.startsWith(resolvedSyncHub)) {
            throw new EnhancedError(
                `Path is outside sync hub: ${targetPath}`,
                ErrorTypes.VALIDATION_ERROR,
                {
                    operation: 'validatePathWithinSyncHub',
                    targetPath,
                    syncHubPath: this.syncHubPath
                }
            );
        }
    }
}

/**
 * Factory function to create DocumentFolderManager instance
 */
export function createDocumentFolderManager(syncHubPath, options = {}) {
    return new DocumentFolderManager(syncHubPath, options);
}

export default DocumentFolderManager;