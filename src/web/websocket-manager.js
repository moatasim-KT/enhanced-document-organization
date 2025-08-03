/**
 * WebSocket Manager for Drive Sync Web Dashboard
 * Handles real-time updates for document operations, sync status, and system monitoring
 */

import { EventEmitter } from 'events';

export class WebSocketManager extends EventEmitter {
  constructor() {
    super();
    this.clients = new Map();
    this.subscriptions = new Map();
    this.heartbeatInterval = null;
    this.systemMonitorInterval = null;
    this.isActive = false;
  }

  initialize(wss) {
    this.wss = wss;
    this.setupWebSocketServer();
    this.startHeartbeat();
    this.startSystemMonitoring();
    this.isActive = true;
    console.log('📡 WebSocket Manager initialized');
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      const clientInfo = {
        id: clientId,
        ws,
        subscriptions: new Set(),
        lastPing: Date.now(),
        userAgent: req.headers['user-agent'],
        ip: req.socket.remoteAddress,
        connectedAt: new Date().toISOString()
      };

      this.clients.set(clientId, clientInfo);
      console.log(`🔗 WebSocket client connected: ${clientId} (${this.clients.size} total)`);

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connection',
        message: 'Connected to Drive Sync WebSocket server',
        clientId,
        serverTime: new Date().toISOString(),
        features: [
          'real_time_sync_status',
          'document_operations',
          'system_monitoring',
          'organization_updates',
          'error_notifications'
        ]
      });

      // Handle incoming messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(clientId, message);
        } catch (error) {
          this.sendToClient(clientId, {
            type: 'error',
            message: 'Invalid JSON message',
            error: error.message
          });
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        this.handleClientDisconnect(clientId);
      });

      // Handle WebSocket errors
      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.handleClientDisconnect(clientId);
      });
    });
  }

  handleClientMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'subscribe':
        this.handleSubscription(clientId, message.channels || []);
        break;

      case 'unsubscribe':
        this.handleUnsubscription(clientId, message.channels || []);
        break;

      case 'ping':
        client.lastPing = Date.now();
        this.sendToClient(clientId, {
          type: 'pong',
          timestamp: new Date().toISOString()
        });
        break;

      case 'get_status':
        this.sendSystemStatus(clientId);
        break;

      case 'get_clients':
        this.sendClientList(clientId);
        break;

      default:
        this.sendToClient(clientId, {
          type: 'error',
          message: `Unknown message type: ${message.type}`
        });
    }
  }

  handleSubscription(clientId, channels) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const validChannels = [
      'sync_status',
      'document_operations',
      'system_monitoring',
      'organization_updates',
      'error_notifications',
      'all'
    ];

    const subscribedChannels = [];
    
    for (const channel of channels) {
      if (validChannels.includes(channel) || channel === 'all') {
        if (channel === 'all') {
          // Subscribe to all channels
          validChannels.forEach(ch => {
            if (ch !== 'all') {
              client.subscriptions.add(ch);
              subscribedChannels.push(ch);
            }
          });
        } else {
          client.subscriptions.add(channel);
          subscribedChannels.push(channel);
        }
      }
    }

    this.sendToClient(clientId, {
      type: 'subscribed',
      channels: subscribedChannels,
      totalSubscriptions: client.subscriptions.size
    });

    console.log(`📺 Client ${clientId} subscribed to: ${subscribedChannels.join(', ')}`);
  }

  handleUnsubscription(clientId, channels) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const unsubscribedChannels = [];
    
    for (const channel of channels) {
      if (client.subscriptions.has(channel)) {
        client.subscriptions.delete(channel);
        unsubscribedChannels.push(channel);
      }
    }

    this.sendToClient(clientId, {
      type: 'unsubscribed',
      channels: unsubscribedChannels,
      remainingSubscriptions: Array.from(client.subscriptions)
    });

    console.log(`📺 Client ${clientId} unsubscribed from: ${unsubscribedChannels.join(', ')}`);
  }

  handleClientDisconnect(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      console.log(`🔌 WebSocket client disconnected: ${clientId} (${this.clients.size} remaining)`);
    }
  }

  // Broadcasting methods
  broadcastToChannel(channel, data) {
    let sentCount = 0;
    
    this.clients.forEach((client, clientId) => {
      if (client.subscriptions.has(channel)) {
        this.sendToClient(clientId, {
          type: 'broadcast',
          channel,
          data,
          timestamp: new Date().toISOString()
        });
        sentCount++;
      }
    });

    if (sentCount > 0) {
      console.log(`📡 Broadcast to ${sentCount} clients on channel: ${channel}`);
    }
  }

  broadcastToAll(data) {
    this.clients.forEach((client, clientId) => {
      this.sendToClient(clientId, {
        type: 'broadcast',
        channel: 'global',
        data,
        timestamp: new Date().toISOString()
      });
    });
  }

  sendToClient(clientId, data) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === 1) { // WebSocket.OPEN
      try {
        client.ws.send(JSON.stringify({
          ...data,
          timestamp: data.timestamp || new Date().toISOString()
        }));
      } catch (error) {
        console.error(`Failed to send message to client ${clientId}:`, error);
        this.handleClientDisconnect(clientId);
      }
    }
  }

  // Real-time update methods
  notifyDocumentOperation(operation, document, result) {
    this.broadcastToChannel('document_operations', {
      operation,
      document,
      result,
      timestamp: new Date().toISOString()
    });
  }

  notifySyncStatusUpdate(service, status, progress = null) {
    this.broadcastToChannel('sync_status', {
      service,
      status,
      progress,
      timestamp: new Date().toISOString()
    });
  }

  notifyOrganizationUpdate(type, data) {
    this.broadcastToChannel('organization_updates', {
      type,
      data,
      timestamp: new Date().toISOString()
    });
  }

  notifyError(error, context = {}) {
    this.broadcastToChannel('error_notifications', {
      error: {
        message: error.message,
        type: error.name || 'Error',
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      },
      context,
      severity: context.severity || 'medium',
      timestamp: new Date().toISOString()
    });
  }

  notifySystemUpdate(data) {
    this.broadcastToChannel('system_monitoring', {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  // System monitoring
  startSystemMonitoring() {
    this.systemMonitorInterval = setInterval(() => {
      if (this.hasSubscribers('system_monitoring')) {
        this.sendSystemMetrics();
      }
    }, 10000); // Every 10 seconds
  }

  async sendSystemMetrics() {
    try {
      const metrics = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: {
          usage: process.cpuUsage(),
          loadAverage: require('os').loadavg()
        },
        clients: {
          total: this.clients.size,
          active: Array.from(this.clients.values()).filter(c => 
            Date.now() - c.lastPing < 60000
          ).length
        },
        timestamp: new Date().toISOString()
      };

      this.notifySystemUpdate(metrics);
    } catch (error) {
      console.error('Failed to send system metrics:', error);
    }
  }

  // Heartbeat mechanism
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeat();
    }, 30000); // Every 30 seconds
  }

  performHeartbeat() {
    const now = Date.now();
    const deadClients = [];

    this.clients.forEach((client, clientId) => {
      if (now - client.lastPing > 90000) { // 90 seconds timeout
        deadClients.push(clientId);
      } else {
        // Send ping to active clients
        this.sendToClient(clientId, {
          type: 'ping',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Remove dead clients
    deadClients.forEach(clientId => {
      console.log(`💀 Removing dead client: ${clientId}`);
      this.handleClientDisconnect(clientId);
    });
  }

  // Helper methods
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  hasSubscribers(channel) {
    return Array.from(this.clients.values()).some(client => 
      client.subscriptions.has(channel)
    );
  }

  sendSystemStatus(clientId) {
    const status = {
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        clients: this.clients.size,
        isActive: this.isActive
      },
      clients: Array.from(this.clients.values()).map(client => ({
        id: client.id,
        connectedAt: client.connectedAt,
        subscriptions: Array.from(client.subscriptions),
        lastPing: client.lastPing
      }))
    };

    this.sendToClient(clientId, {
      type: 'system_status',
      data: status
    });
  }

  sendClientList(clientId) {
    const clientList = Array.from(this.clients.values()).map(client => ({
      id: client.id,
      connectedAt: client.connectedAt,
      subscriptions: Array.from(client.subscriptions),
      userAgent: client.userAgent,
      ip: client.ip
    }));

    this.sendToClient(clientId, {
      type: 'client_list',
      data: clientList,
      total: clientList.length
    });
  }

  // Cleanup
  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.systemMonitorInterval) {
      clearInterval(this.systemMonitorInterval);
    }

    // Close all client connections
    this.clients.forEach((client, clientId) => {
      this.sendToClient(clientId, {
        type: 'server_shutdown',
        message: 'Server is shutting down'
      });
      client.ws.close();
    });

    this.clients.clear();
    this.isActive = false;
    console.log('🔌 WebSocket Manager shut down');
  }
}
