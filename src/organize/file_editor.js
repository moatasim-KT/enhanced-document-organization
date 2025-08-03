#!/usr/bin/env node

/**
 * File Editor Tool
 * Provides safe and efficient file editing capabilities with backup, validation, and rollback features
 */

import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import { createErrorHandler, ErrorTypes, EnhancedError } from './error_handler.js';
import { SimplePathResolver, PathUtils } from './simple_path_resolver.js';

/**
 * Edit operation types
 */
export const EditOperations = {
    REPLACE_TEXT: 'REPLACE_TEXT',
    REPLACE_LINES: 'REPLACE_LINES',
    INSERT_LINES: 'INSERT_LINES',
    DELETE_LINES: 'DELETE_LINES',
    APPEND_CONTENT: 'APPEND_CONTENT',
    PREPEND_CONTENT: 'PREPEND_CONTENT',
    FIND_AND_REPLACE: 'FIND_AND_REPLACE'
};

/**
 * File Editor Class
 * Handles various file editing operations with safety features
 */
export class FileEditor {
    constructor(options = {}) {
        this.options = {
            createBackup: true,
            backupSuffix: '.backup',
            validateChanges: true,
            dryRun: false,
            encoding: 'utf8',
            ...options
        };

        // Initialize error handler
        this.errorHandler = createErrorHandler('FileEditor', {
            enableConsoleLogging: process.env.NODE_ENV !== 'production'
        });

        // Initialize path resolver
        this.pathResolver = new SimplePathResolver();

        // Bind logging methods
        this.logError = this.errorHandler.logError.bind(this.errorHandler);
        this.logWarn = this.errorHandler.logWarn.bind(this.errorHandler);
        this.logInfo = this.errorHandler.logInfo.bind(this.errorHandler);
        this.logDebug = this.errorHandler.logDebug.bind(this.errorHandler);
    }

    /**
     * Main file editing function
     * @param {string} filePath - Path to the file to edit
     * @param {Array} operations - Array of edit operations to perform
     * @param {Object} options - Additional options
     */
    async editFile(filePath, operations, options = {}) {
        return await this.errorHandler.wrapAsync(async () => {
            const resolvedPath = this.pathResolver.resolvePath(filePath);
            const editOptions = { ...this.options, ...options };

            await this.logInfo('Starting file edit operation', {
                filePath: resolvedPath,
                operationCount: operations.length,
                dryRun: editOptions.dryRun
            });

            // Validate file exists
            if (!this.pathResolver.fileExistsSync(resolvedPath)) {
                throw new EnhancedError(
                    `File not found: ${resolvedPath}`,
                    ErrorTypes.FILE_NOT_FOUND,
                    { filePath: resolvedPath }
                );
            }

            // Read original content
            const originalContent = await fs.readFile(resolvedPath, editOptions.encoding);
            let backupPath = null;

            try {
                // Create backup if enabled
                if (editOptions.createBackup && !editOptions.dryRun) {
                    backupPath = await this.createBackup(resolvedPath, editOptions.backupSuffix);
                }

                // Apply operations
                let modifiedContent = originalContent;
                const appliedOperations = [];

                for (let i = 0; i < operations.length; i++) {
                    const operation = operations[i];
                    const result = await this.applyOperation(modifiedContent, operation, resolvedPath);
                    modifiedContent = result.content;
                    appliedOperations.push({
                        operation: operation.type,
                        success: true,
                        details: result.details
                    });

                    await this.logDebug(`Applied operation ${i + 1}/${operations.length}`, {
                        type: operation.type,
                        details: result.details
                    });
                }

                // Validate changes if enabled
                if (editOptions.validateChanges) {
                    await this.validateChanges(originalContent, modifiedContent, resolvedPath);
                }

                // Write modified content (unless dry run)
                if (!editOptions.dryRun) {
                    await fs.writeFile(resolvedPath, modifiedContent, editOptions.encoding);
                    await this.logInfo('File edit completed successfully', {
                        filePath: resolvedPath,
                        operationsApplied: appliedOperations.length,
                        backupCreated: !!backupPath
                    });
                } else {
                    await this.logInfo('Dry run completed - no changes written', {
                        filePath: resolvedPath,
                        operationsApplied: appliedOperations.length
                    });
                }

                return {
                    success: true,
                    filePath: resolvedPath,
                    backupPath,
                    operationsApplied: appliedOperations,
                    originalSize: originalContent.length,
                    modifiedSize: modifiedContent.length,
                    dryRun: editOptions.dryRun,
                    preview: editOptions.dryRun ? this.generatePreview(originalContent, modifiedContent) : null
                };

            } catch (error) {
                // Rollback if backup exists and not dry run
                if (backupPath && !editOptions.dryRun) {
                    await this.rollbackFromBackup(resolvedPath, backupPath);
                }
                throw error;
            }
        }, {
            operation: 'editFile',
            filePath,
            operationCount: operations.length
        });
    }

    /**
     * Replace text in file
     */
    async replaceText(filePath, searchText, replaceText, options = {}) {
        const operation = {
            type: EditOperations.FIND_AND_REPLACE,
            searchText,
            replaceText,
            global: options.global !== false,
            caseSensitive: options.caseSensitive || false,
            useRegex: options.useRegex || false
        };

        return await this.editFile(filePath, [operation], options);
    }

    /**
     * Insert lines at specific position
     */
    async insertLines(filePath, lineNumber, lines, options = {}) {
        const operation = {
            type: EditOperations.INSERT_LINES,
            lineNumber,
            lines: Array.isArray(lines) ? lines : [lines]
        };

        return await this.editFile(filePath, [operation], options);
    }

    /**
     * Delete lines in range
     */
    async deleteLines(filePath, startLine, endLine, options = {}) {
        const operation = {
            type: EditOperations.DELETE_LINES,
            startLine,
            endLine: endLine || startLine
        };

        return await this.editFile(filePath, [operation], options);
    }

    /**
     * Replace specific lines
     */
    async replaceLines(filePath, startLine, endLine, newLines, options = {}) {
        const operation = {
            type: EditOperations.REPLACE_LINES,
            startLine,
            endLine: endLine || startLine,
            newLines: Array.isArray(newLines) ? newLines : [newLines]
        };

        return await this.editFile(filePath, [operation], options);
    }

    /**
     * Append content to file
     */
    async appendToFile(filePath, content, options = {}) {
        const operation = {
            type: EditOperations.APPEND_CONTENT,
            content
        };

        return await this.editFile(filePath, [operation], options);
    }

    /**
     * Prepend content to file
     */
    async prependToFile(filePath, content, options = {}) {
        const operation = {
            type: EditOperations.PREPEND_CONTENT,
            content
        };

        return await this.editFile(filePath, [operation], options);
    }

    /**
     * Apply a single operation to content
     */
    async applyOperation(content, operation, filePath) {
        return await this.errorHandler.wrapAsync(async () => {
            const lines = content.split('\n');

            switch (operation.type) {
                case EditOperations.FIND_AND_REPLACE:
                    return this.applyFindAndReplace(content, operation);

                case EditOperations.INSERT_LINES:
                    return this.applyInsertLines(lines, operation);

                case EditOperations.DELETE_LINES:
                    return this.applyDeleteLines(lines, operation);

                case EditOperations.REPLACE_LINES:
                    return this.applyReplaceLines(lines, operation);

                case EditOperations.APPEND_CONTENT:
                    return {
                        content: content + operation.content,
                        details: { contentAdded: operation.content.length }
                    };

                case EditOperations.PREPEND_CONTENT:
                    return {
                        content: operation.content + content,
                        details: { contentAdded: operation.content.length }
                    };

                default:
                    throw new EnhancedError(
                        `Unknown operation type: ${operation.type}`,
                        ErrorTypes.VALIDATION_ERROR,
                        { operation, filePath }
                    );
            }
        }, {
            operation: 'applyOperation',
            operationType: operation.type,
            filePath
        });
    }

    /**
     * Apply find and replace operation
     */
    applyFindAndReplace(content, operation) {
        const { searchText, replaceText, global, caseSensitive, useRegex } = operation;
        let searchPattern;

        if (useRegex) {
            const flags = (global ? 'g' : '') + (caseSensitive ? '' : 'i');
            searchPattern = new RegExp(searchText, flags);
        } else {
            const escapedSearch = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const flags = (global ? 'g' : '') + (caseSensitive ? '' : 'i');
            searchPattern = new RegExp(escapedSearch, flags);
        }

        const originalLength = content.length;
        const modifiedContent = content.replace(searchPattern, replaceText);
        const replacements = (content.match(searchPattern) || []).length;

        return {
            content: modifiedContent,
            details: {
                replacements,
                originalLength,
                modifiedLength: modifiedContent.length
            }
        };
    }

    /**
     * Apply insert lines operation
     */
    applyInsertLines(lines, operation) {
        const { lineNumber, lines: newLines } = operation;
        const insertIndex = Math.max(0, Math.min(lineNumber - 1, lines.length));

        const modifiedLines = [
            ...lines.slice(0, insertIndex),
            ...newLines,
            ...lines.slice(insertIndex)
        ];

        return {
            content: modifiedLines.join('\n'),
            details: {
                insertedAt: insertIndex + 1,
                linesInserted: newLines.length
            }
        };
    }

    /**
     * Apply delete lines operation
     */
    applyDeleteLines(lines, operation) {
        const { startLine, endLine } = operation;
        const startIndex = Math.max(0, startLine - 1);
        const endIndex = Math.min(lines.length, endLine);

        if (startIndex >= lines.length) {
            return {
                content: lines.join('\n'),
                details: { linesDeleted: 0, reason: 'Start line beyond file end' }
            };
        }

        const modifiedLines = [
            ...lines.slice(0, startIndex),
            ...lines.slice(endIndex)
        ];

        return {
            content: modifiedLines.join('\n'),
            details: {
                deletedRange: `${startLine}-${endLine}`,
                linesDeleted: endIndex - startIndex
            }
        };
    }

    /**
     * Apply replace lines operation
     */
    applyReplaceLines(lines, operation) {
        const { startLine, endLine, newLines } = operation;
        const startIndex = Math.max(0, startLine - 1);
        const endIndex = Math.min(lines.length, endLine);

        const modifiedLines = [
            ...lines.slice(0, startIndex),
            ...newLines,
            ...lines.slice(endIndex)
        ];

        return {
            content: modifiedLines.join('\n'),
            details: {
                replacedRange: `${startLine}-${endLine}`,
                linesReplaced: endIndex - startIndex,
                newLinesAdded: newLines.length
            }
        };
    }

    /**
     * Create backup of file
     */
    async createBackup(filePath, suffix = '.backup') {
        return await this.errorHandler.wrapAsync(async () => {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `${filePath}${suffix}.${timestamp}`;

            await fs.copyFile(filePath, backupPath);

            await this.logDebug('Backup created', {
                originalFile: filePath,
                backupFile: backupPath
            });

            return backupPath;
        }, {
            operation: 'createBackup',
            filePath
        });
    }

    /**
     * Rollback from backup
     */
    async rollbackFromBackup(filePath, backupPath) {
        return await this.errorHandler.wrapAsync(async () => {
            if (this.pathResolver.fileExistsSync(backupPath)) {
                await fs.copyFile(backupPath, filePath);
                await this.logInfo('File rolled back from backup', {
                    filePath,
                    backupPath
                });
            }
        }, {
            operation: 'rollbackFromBackup',
            filePath,
            backupPath
        });
    }

    /**
     * Validate changes
     */
    async validateChanges(originalContent, modifiedContent, filePath) {
        return await this.errorHandler.wrapAsync(async () => {
            // Basic validation checks
            const validations = [];

            // Check if file is completely empty (might be unintended)
            if (modifiedContent.trim().length === 0 && originalContent.trim().length > 0) {
                validations.push({
                    type: 'warning',
                    message: 'File content is now empty'
                });
            }

            // Check for very large size changes
            const sizeChange = Math.abs(modifiedContent.length - originalContent.length);
            const sizeChangePercent = (sizeChange / originalContent.length) * 100;

            if (sizeChangePercent > 50) {
                validations.push({
                    type: 'warning',
                    message: `Large size change detected: ${sizeChangePercent.toFixed(1)}%`
                });
            }

            // Log validation results
            if (validations.length > 0) {
                await this.logWarn('File validation warnings', {
                    filePath,
                    validations
                });
            }

            return validations;
        }, {
            operation: 'validateChanges',
            filePath
        });
    }

    /**
     * Generate preview of changes for dry run
     */
    generatePreview(originalContent, modifiedContent) {
        const originalLines = originalContent.split('\n');
        const modifiedLines = modifiedContent.split('\n');

        const preview = {
            originalLineCount: originalLines.length,
            modifiedLineCount: modifiedLines.length,
            sizeChange: modifiedContent.length - originalContent.length,
            firstDifference: null
        };

        // Find first difference
        for (let i = 0; i < Math.max(originalLines.length, modifiedLines.length); i++) {
            const originalLine = originalLines[i] || '';
            const modifiedLine = modifiedLines[i] || '';

            if (originalLine !== modifiedLine) {
                preview.firstDifference = {
                    lineNumber: i + 1,
                    original: originalLine,
                    modified: modifiedLine
                };
                break;
            }
        }

        return preview;
    }

    /**
     * Clean up old backup files
     */
    async cleanupBackups(filePath, keepCount = 5) {
        return await this.errorHandler.wrapAsync(async () => {
            const dir = path.dirname(filePath);
            const baseName = path.basename(filePath);
            const backupPattern = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.backup\\..+$`);

            const files = await fs.readdir(dir);
            const backupFiles = files
                .filter(file => backupPattern.test(file))
                .map(file => ({
                    name: file,
                    path: path.join(dir, file),
                    stat: null
                }));

            // Get file stats for sorting by creation time
            for (const backup of backupFiles) {
                try {
                    backup.stat = await fs.stat(backup.path);
                } catch (error) {
                    // Skip files that can't be accessed
                }
            }

            // Sort by creation time (newest first) and remove old backups
            const validBackups = backupFiles
                .filter(backup => backup.stat)
                .sort((a, b) => b.stat.birthtime - a.stat.birthtime);

            const toDelete = validBackups.slice(keepCount);

            for (const backup of toDelete) {
                try {
                    await fs.unlink(backup.path);
                    await this.logDebug('Old backup deleted', { backupPath: backup.path });
                } catch (error) {
                    await this.logWarn('Failed to delete old backup', {
                        backupPath: backup.path,
                        error: error.message
                    });
                }
            }

            return {
                totalBackups: validBackups.length,
                deletedBackups: toDelete.length,
                remainingBackups: validBackups.length - toDelete.length
            };
        }, {
            operation: 'cleanupBackups',
            filePath,
            keepCount
        });
    }
}

/**
 * Factory function to create FileEditor instance
 */
export function createFileEditor(options = {}) {
    return new FileEditor(options);
}

export default FileEditor;