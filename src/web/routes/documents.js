/**
 * Document Routes for Drive Sync Web Dashboard
 * Handles document management operations via REST API
 */

import { Router } from 'express';
import { ErrorHandler } from '../middleware/error-handler.js';
import multer from 'multer';
import path from 'path';

// Configure multer for file uploads
const upload = multer({
  dest: '/tmp/drive-sync-uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Max 5 files at once
  },
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedTypes = [
      'text/plain',
      'text/markdown',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/html',
      'application/json'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`), false);
    }
  }
});

export class DocumentRoutes {
  constructor(mcpBridge, wsManager = null) {
    this.mcpBridge = mcpBridge;
    this.wsManager = wsManager;
    this.router = Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // Search documents
    this.router.get('/search', ErrorHandler.asyncHandler(async (req, res) => {
      const { q: query, category, limit = 10 } = req.query;

      if (!query) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Query parameter "q" is required',
          timestamp: new Date().toISOString()
        });
      }

      try {
        const results = await this.mcpBridge.searchDocuments(query, category, parseInt(limit));
        res.json({
          success: true,
          data: results,
          query: { query, category, limit },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Search failed: ${error.message}`);
      }
    }));

    // Get document content
    this.router.get('/content', ErrorHandler.asyncHandler(async (req, res) => {
      const { path: filePath } = req.query;

      if (!filePath) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Path parameter is required',
          timestamp: new Date().toISOString()
        });
      }

      try {
        const content = await this.mcpBridge.getDocumentContent(filePath);
        res.json({
          success: true,
          data: content,
          path: filePath,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Failed to get document content: ${error.message}`);
      }
    }));

    // Create new document
    this.router.post('/', ErrorHandler.asyncHandler(async (req, res) => {
      const { title, content, category } = req.body;

      if (!title || !content) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Title and content are required',
          timestamp: new Date().toISOString()
        });
      }

      try {
        const result = await this.mcpBridge.createDocument(title, content, category);
        
        // Send real-time notification
        if (this.wsManager) {
          this.wsManager.notifyDocumentOperation('create', {
            title,
            category,
            size: content.length
          }, result);
        }
        
        res.status(201).json({
          success: true,
          message: 'Document created successfully',
          data: result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Failed to create document: ${error.message}`);
      }
    }));

    // Upload documents
    this.router.post('/upload', upload.array('files', 5), ErrorHandler.asyncHandler(async (req, res) => {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'No files uploaded',
          timestamp: new Date().toISOString()
        });
      }

      const { category } = req.body;
      const results = [];

      for (const file of req.files) {
        try {
          // Read file content
          const fs = await import('fs/promises');
          const content = await fs.readFile(file.path, 'utf8');
          
          // Create document
          const result = await this.mcpBridge.createDocument(
            file.originalname.replace(path.extname(file.originalname), ''),
            content,
            category
          );
          
          results.push({
            filename: file.originalname,
            result: result,
            success: true
          });

          // Clean up temp file
          await fs.unlink(file.path);
        } catch (error) {
          results.push({
            filename: file.originalname,
            error: error.message,
            success: false
          });
        }
      }

      res.status(201).json({
        success: true,
        message: `Processed ${req.files.length} files`,
        data: results,
        timestamp: new Date().toISOString()
      });
    }));

    // Delete document
    this.router.delete('/', ErrorHandler.asyncHandler(async (req, res) => {
      const { path: filePath } = req.query;

      if (!filePath) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Path parameter is required',
          timestamp: new Date().toISOString()
        });
      }

      try {
        const result = await this.mcpBridge.deleteDocument(filePath);
        res.json({
          success: true,
          message: 'Document deleted successfully',
          data: result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Failed to delete document: ${error.message}`);
      }
    }));

    // Rename document
    this.router.patch('/rename', ErrorHandler.asyncHandler(async (req, res) => {
      const { path: filePath, newName } = req.body;

      if (!filePath || !newName) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Path and newName are required',
          timestamp: new Date().toISOString()
        });
      }

      try {
        const result = await this.mcpBridge.renameDocument(filePath, newName);
        res.json({
          success: true,
          message: 'Document renamed successfully',
          data: result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Failed to rename document: ${error.message}`);
      }
    }));

    // Move document to different category
    this.router.patch('/move', ErrorHandler.asyncHandler(async (req, res) => {
      const { path: filePath, category } = req.body;

      if (!filePath || !category) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Path and category are required',
          timestamp: new Date().toISOString()
        });
      }

      try {
        const result = await this.mcpBridge.moveDocument(filePath, category);
        res.json({
          success: true,
          message: 'Document moved successfully',
          data: result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Failed to move document: ${error.message}`);
      }
    }));

    // Analyze document content
    this.router.post('/analyze', ErrorHandler.asyncHandler(async (req, res) => {
      const { paths, similarityThreshold = 0.8 } = req.body;

      if (!paths || !Array.isArray(paths) || paths.length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Paths array is required',
          timestamp: new Date().toISOString()
        });
      }

      try {
        const result = await this.mcpBridge.analyzeContent(paths, similarityThreshold);
        res.json({
          success: true,
          data: result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Failed to analyze content: ${error.message}`);
      }
    }));

    // Enhance document content with AI
    this.router.post('/enhance', ErrorHandler.asyncHandler(async (req, res) => {
      const { content, topic, enhancementType = 'comprehensive' } = req.body;

      if (!content || !topic) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Content and topic are required',
          timestamp: new Date().toISOString()
        });
      }

      try {
        const result = await this.mcpBridge.enhanceContent(content, topic, enhancementType);
        res.json({
          success: true,
          data: result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Failed to enhance content: ${error.message}`);
      }
    }));

    // Consolidate multiple documents
    this.router.post('/consolidate', ErrorHandler.asyncHandler(async (req, res) => {
      const { paths, topic, strategy = 'comprehensive_merge', dryRun = false } = req.body;

      if (!paths || !Array.isArray(paths) || paths.length === 0 || !topic) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Paths array and topic are required',
          timestamp: new Date().toISOString()
        });
      }

      try {
        const result = await this.mcpBridge.consolidateContent(paths, topic, strategy, dryRun);
        res.json({
          success: true,
          data: result,
          dryRun,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Failed to consolidate content: ${error.message}`);
      }
    }));

    // Find duplicate documents
    this.router.get('/duplicates', ErrorHandler.asyncHandler(async (req, res) => {
      const { directory, similarityThreshold = 0.8 } = req.query;

      try {
        const result = await this.mcpBridge.findDuplicates(directory, parseFloat(similarityThreshold));
        res.json({
          success: true,
          data: result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Failed to find duplicates: ${error.message}`);
      }
    }));

    // List files in category
    this.router.get('/category/:category', ErrorHandler.asyncHandler(async (req, res) => {
      const { category } = req.params;

      try {
        const result = await this.mcpBridge.listFilesInCategory(category);
        res.json({
          success: true,
          data: result,
          category,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Failed to list files in category: ${error.message}`);
      }
    }));
  }
}
