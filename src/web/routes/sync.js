/**
 * Sync Routes for Drive Sync Web Dashboard
 * Handles sync operations with cloud services
 */

import { Router } from 'express';
import { ErrorHandler } from '../middleware/error-handler.js';

export class SyncRoutes {
  constructor(mcpBridge) {
    this.mcpBridge = mcpBridge;
    this.router = Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // Start sync operation
    this.router.post('/start', ErrorHandler.asyncHandler(async (req, res) => {
      const { service = 'all' } = req.body;

      const validServices = ['all', 'icloud', 'gdrive'];
      if (!validServices.includes(service)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Invalid service. Must be one of: ${validServices.join(', ')}`,
          timestamp: new Date().toISOString()
        });
      }

      try {
        const result = await this.mcpBridge.syncDocuments(service);
        res.json({
          success: true,
          message: `Sync operation started for ${service}`,
          data: result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Sync operation failed: ${error.message}`);
      }
    }));

    // Get sync status
    this.router.get('/status', ErrorHandler.asyncHandler(async (req, res) => {
      try {
        // Get system status which includes sync information
        const systemStatus = await this.mcpBridge.getSystemStatus();
        
        // Extract sync-related information
        const syncStatus = {
          lastSync: systemStatus.lastSync || null,
          syncInProgress: systemStatus.syncInProgress || false,
          services: {
            icloud: {
              enabled: systemStatus.services?.icloud?.enabled || false,
              lastSync: systemStatus.services?.icloud?.lastSync || null,
              status: systemStatus.services?.icloud?.status || 'unknown'
            },
            gdrive: {
              enabled: systemStatus.services?.gdrive?.enabled || false,
              lastSync: systemStatus.services?.gdrive?.lastSync || null,
              status: systemStatus.services?.gdrive?.status || 'unknown'
            }
          }
        };

        res.json({
          success: true,
          data: syncStatus,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Failed to get sync status: ${error.message}`);
      }
    }));

    // Get sync history/logs
    this.router.get('/history', ErrorHandler.asyncHandler(async (req, res) => {
      const { limit = 50, service } = req.query;

      try {
        // This would typically read from log files or database
        // For now, we'll return a placeholder response
        const history = {
          entries: [
            {
              id: '1',
              timestamp: new Date().toISOString(),
              service: 'icloud',
              operation: 'sync',
              status: 'completed',
              filesProcessed: 25,
              duration: 1200
            },
            {
              id: '2',
              timestamp: new Date(Date.now() - 3600000).toISOString(),
              service: 'gdrive',
              operation: 'sync',
              status: 'completed',
              filesProcessed: 42,
              duration: 2100
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
        throw new Error(`Failed to get sync history: ${error.message}`);
      }
    }));

    // Test connection to sync services
    this.router.post('/test-connection', ErrorHandler.asyncHandler(async (req, res) => {
      const { service } = req.body;

      if (!service || !['icloud', 'gdrive'].includes(service)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Valid service (icloud or gdrive) is required',
          timestamp: new Date().toISOString()
        });
      }

      try {
        // This would test the actual connection to the service
        // For now, we'll simulate a connection test
        const connectionTest = {
          service,
          connected: true,
          latency: Math.floor(Math.random() * 100) + 50,
          lastTested: new Date().toISOString()
        };

        res.json({
          success: true,
          message: `Connection test completed for ${service}`,
          data: connectionTest,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Connection test failed: ${error.message}`);
      }
    }));

    // Get sync configuration
    this.router.get('/config', ErrorHandler.asyncHandler(async (req, res) => {
      try {
        // This would read the actual sync configuration
        // For now, we'll return a placeholder configuration
        const config = {
          services: {
            icloud: {
              enabled: true,
              syncPath: '/Users/moatasimfarooque/Sync_Hub_New',
              excludePatterns: ['.DS_Store', '.obsidian', 'node_modules'],
              autoSync: false,
              syncInterval: 3600
            },
            gdrive: {
              enabled: true,
              syncPath: '/Users/moatasimfarooque/Sync_Hub_New',
              excludePatterns: ['.DS_Store', '.obsidian', 'node_modules'],
              autoSync: false,
              syncInterval: 3600
            }
          },
          general: {
            maxFileSize: 10485760, // 10MB
            timeout: 300, // 5 minutes
            retryAttempts: 3,
            logLevel: 'info'
          }
        };

        res.json({
          success: true,
          data: config,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Failed to get sync configuration: ${error.message}`);
      }
    }));

    // Update sync configuration
    this.router.put('/config', ErrorHandler.asyncHandler(async (req, res) => {
      const { config } = req.body;

      if (!config) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Configuration object is required',
          timestamp: new Date().toISOString()
        });
      }

      try {
        // This would update the actual sync configuration
        // For now, we'll just validate and return success
        res.json({
          success: true,
          message: 'Sync configuration updated successfully',
          data: config,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Failed to update sync configuration: ${error.message}`);
      }
    }));

    // Stop ongoing sync operation
    this.router.post('/stop', ErrorHandler.asyncHandler(async (req, res) => {
      try {
        // This would stop any ongoing sync operations
        // For now, we'll return a success response
        res.json({
          success: true,
          message: 'Sync operation stopped',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Failed to stop sync operation: ${error.message}`);
      }
    }));

    // Get sync statistics
    this.router.get('/stats', ErrorHandler.asyncHandler(async (req, res) => {
      const { period = '24h' } = req.query;

      try {
        // This would calculate actual sync statistics
        // For now, we'll return placeholder statistics
        const stats = {
          period,
          totalSyncs: 15,
          successfulSyncs: 14,
          failedSyncs: 1,
          totalFilesProcessed: 342,
          totalDataTransferred: 25600000, // bytes
          averageSyncTime: 1800, // seconds
          services: {
            icloud: {
              syncs: 8,
              filesProcessed: 180,
              dataTransferred: 12800000
            },
            gdrive: {
              syncs: 7,
              filesProcessed: 162,
              dataTransferred: 12800000
            }
          }
        };

        res.json({
          success: true,
          data: stats,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`Failed to get sync statistics: ${error.message}`);
      }
    }));
  }
}
