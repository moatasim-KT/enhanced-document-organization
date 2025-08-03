#!/usr/bin/env node

/**
 * Drive Sync Web Dashboard - Express.js API Server
 * Provides REST API endpoints for the web-based management dashboard
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Import our MCP server integration
import { MCPBridge } from './mcp-bridge.js';
import { AuthMiddleware } from './middleware/auth.js';
import { ErrorHandler } from './middleware/error-handler.js';

// Import route handlers
import { DocumentRoutes } from './routes/documents.js';
import { SyncRoutes } from './routes/sync.js';
import { OrganizationRoutes } from './routes/organization.js';
import { SystemRoutes } from './routes/system.js';
import { AuthRoutes } from './routes/auth.js';
import { WebSocketManager } from './websocket-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../config/.env') });

class DriveWebServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.wss = null;
    this.wsManager = new WebSocketManager(); // Initialize early
    this.mcpBridge = null;
    this.port = process.env.WEB_PORT || 3000;
    this.host = process.env.WEB_HOST || 'localhost';
    
    this.setupMiddleware();
    this.setupWebSocket();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"]
        }
      }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production' 
        ? ['http://localhost:3000', 'https://your-domain.com']
        : true,
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.'
    });
    this.app.use('/api/', limiter);

    // Body parsing and compression
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Static file serving (for frontend assets)
    this.app.use(express.static(path.join(__dirname, 'public')));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // Initialize MCP bridge
    this.mcpBridge = new MCPBridge();

    // Initialize route handlers with WebSocket manager for real-time updates
    const authRoutes = new AuthRoutes();
    const documentRoutes = new DocumentRoutes(this.mcpBridge, this.wsManager);
    const syncRoutes = new SyncRoutes(this.mcpBridge, this.wsManager);
    const organizationRoutes = new OrganizationRoutes(this.mcpBridge, this.wsManager);
    const systemRoutes = new SystemRoutes(this.mcpBridge, this.wsManager);

    // API routes
    this.app.use('/api/auth', authRoutes.router);
    this.app.use('/api/documents', AuthMiddleware.authenticate, documentRoutes.router);
    this.app.use('/api/sync', AuthMiddleware.authenticate, syncRoutes.router);
    this.app.use('/api/organization', AuthMiddleware.authenticate, organizationRoutes.router);
    this.app.use('/api/system', AuthMiddleware.authenticate, systemRoutes.router);

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });

    // Serve frontend app for all other routes (SPA support)
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
  }

  setupWebSocket() {
    this.server = createServer(this.app);
    
    this.wss = new WebSocketServer({ 
      server: this.server,
      path: '/ws'
    });

    // Initialize WebSocket manager with the WebSocket server
    this.wsManager.initialize(this.wss);
  }



  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
        timestamp: new Date().toISOString()
      });
    });

    // Global error handler
    this.app.use(ErrorHandler.handle);
  }

  async start() {
    try {
      // Initialize MCP bridge
      await this.mcpBridge.initialize();

      // Start the server
      this.server.listen(this.port, this.host, () => {
        console.log(`🚀 Drive Sync Web Server running on http://${this.host}:${this.port}`);
        console.log(`📡 WebSocket server available at ws://${this.host}:${this.port}/ws`);
        console.log(`🔗 API endpoints available at http://${this.host}:${this.port}/api`);
      });

      // Graceful shutdown handling
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());

    } catch (error) {
      console.error('Failed to start web server:', error);
      process.exit(1);
    }
  }

  async shutdown() {
    console.log('Shutting down web server...');
    
    if (this.wsManager) {
      this.wsManager.shutdown();
    }
    
    if (this.wss) {
      this.wss.close();
    }
    
    if (this.server) {
      this.server.close();
    }

    if (this.mcpBridge) {
      await this.mcpBridge.cleanup();
    }

    process.exit(0);
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const webServer = new DriveWebServer();
  webServer.start();
}

export { DriveWebServer };
