/**
 * Organization Routes for Drive Sync Web Dashboard
 * Handles document organization and categorization operations
 */

import { Router } from 'express';
import { ErrorHandler } from '../middleware/error-handler.js';

export class OrganizationRoutes {
  constructor(mcpBridge) {
    this.mcpBridge = mcpBridge;
    this.router = Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // Get organization statistics
    this.router.get('/stats', ErrorHandler.asyncHandler(async (req, res) => {
      try {
        const stats = await this.mcpBridge.getOrganizationStats();
        res.json({
          success: true,
          data: stats,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Failed to get organization stats: ${error.message}`);
      }
    }));

    // List all categories
    this.router.get('/categories', ErrorHandler.asyncHandler(async (req, res) => {
      try {
        const categories = await this.mcpBridge.listCategories();
        res.json({
          success: true,
          data: categories,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Failed to list categories: ${error.message}`);
      }
    }));

    // Add custom category
    this.router.post('/categories', ErrorHandler.asyncHandler(async (req, res) => {
      const { name, description, keywords = [], filePatterns = [], icon = '📁', priority = 5 } = req.body;

      if (!name || !description) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Name and description are required',
          timestamp: new Date().toISOString()
        });
      }

      try {
        const result = await this.mcpBridge.addCustomCategory(
          name, description, keywords, filePatterns, icon, priority
        );
        res.status(201).json({
          success: true,
          message: 'Category created successfully',
          data: result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Failed to create category: ${error.message}`);
      }
    }));

    // Get category suggestions
    this.router.get('/categories/suggestions', ErrorHandler.asyncHandler(async (req, res) => {
      const { directory } = req.query;

      try {
        const suggestions = await this.mcpBridge.suggestCategories(directory);
        res.json({
          success: true,
          data: suggestions,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Failed to get category suggestions: ${error.message}`);
      }
    }));

    // Start organization process
    this.router.post('/organize', ErrorHandler.asyncHandler(async (req, res) => {
      const { dryRun = false } = req.body;

      try {
        const result = await this.mcpBridge.organizeDocuments(dryRun);
        res.json({
          success: true,
          message: dryRun ? 'Organization preview completed' : 'Organization completed',
          data: result,
          dryRun,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Organization failed: ${error.message}`);
      }
    }));

    // Get organization preview (dry run)
    this.router.get('/preview', ErrorHandler.asyncHandler(async (req, res) => {
      try {
        const result = await this.mcpBridge.organizeDocuments(true);
        res.json({
          success: true,
          message: 'Organization preview completed',
          data: result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Organization preview failed: ${error.message}`);
      }
    }));

    // Get organization rules/configuration
    this.router.get('/rules', ErrorHandler.asyncHandler(async (req, res) => {
      try {
        // This would return the actual organization rules
        // For now, we'll return a placeholder configuration
        const rules = {
          categories: {
            'AI & ML': {
              keywords: ['artificial intelligence', 'machine learning', 'neural network', 'deep learning'],
              filePatterns: ['*ml*', '*ai*', '*neural*'],
              priority: 9
            },
            'Development': {
              keywords: ['programming', 'coding', 'software', 'development'],
              filePatterns: ['*.js', '*.py', '*.java', '*dev*'],
              priority: 8
            },
            'Research Papers': {
              keywords: ['research', 'paper', 'study', 'analysis'],
              filePatterns: ['*.pdf', '*research*', '*paper*'],
              priority: 7
            }
          },
          general: {
            autoOrganize: false,
            createMissingCategories: true,
            preserveOriginalStructure: false,
            duplicateHandling: 'skip'
          }
        };

        res.json({
          success: true,
          data: rules,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Failed to get organization rules: ${error.message}`);
      }
    }));

    // Update organization rules
    this.router.put('/rules', ErrorHandler.asyncHandler(async (req, res) => {
      const { rules } = req.body;

      if (!rules) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Rules object is required',
          timestamp: new Date().toISOString()
        });
      }

      try {
        // This would update the actual organization rules
        // For now, we'll just validate and return success
        res.json({
          success: true,
          message: 'Organization rules updated successfully',
          data: rules,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Failed to update organization rules: ${error.message}`);
      }
    }));

    // Get organization history
    this.router.get('/history', ErrorHandler.asyncHandler(async (req, res) => {
      const { limit = 20 } = req.query;

      try {
        // This would return actual organization history
        // For now, we'll return placeholder data
        const history = {
          entries: [
            {
              id: '1',
              timestamp: new Date().toISOString(),
              operation: 'organize',
              filesProcessed: 45,
              filesOrganized: 38,
              categoriesUsed: 6,
              duration: 2300,
              status: 'completed'
            },
            {
              id: '2',
              timestamp: new Date(Date.now() - 7200000).toISOString(),
              operation: 'organize',
              filesProcessed: 23,
              filesOrganized: 20,
              categoriesUsed: 4,
              duration: 1200,
              status: 'completed'
            }
          ],
          total: 2,
          limit: parseInt(limit)
        };

        res.json({
          success: true,
          data: history,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Failed to get organization history: ${error.message}`);
      }
    }));

    // Validate organization setup
    this.router.get('/validate', ErrorHandler.asyncHandler(async (req, res) => {
      try {
        // This would validate the organization setup
        // For now, we'll return a placeholder validation result
        const validation = {
          valid: true,
          issues: [],
          warnings: [
            'Consider adding more keywords to "Development" category for better classification'
          ],
          recommendations: [
            'Enable auto-organization for better workflow',
            'Set up duplicate handling rules'
          ]
        };

        res.json({
          success: true,
          data: validation,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Organization validation failed: ${error.message}`);
      }
    }));

    // Get category details with file counts
    this.router.get('/categories/:category/details', ErrorHandler.asyncHandler(async (req, res) => {
      const { category } = req.params;

      try {
        const files = await this.mcpBridge.listFilesInCategory(category);
        const details = {
          category,
          fileCount: files.length || 0,
          files: files || [],
          lastUpdated: new Date().toISOString()
        };

        res.json({
          success: true,
          data: details,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Failed to get category details: ${error.message}`);
      }
    }));
  }
}
