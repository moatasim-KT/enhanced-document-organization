/**
 * Authentication Middleware for Drive Sync Web Dashboard
 * Provides JWT-based authentication and authorization
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AuthMiddleware {
  static JWT_SECRET = process.env.JWT_SECRET || 'drive-sync-default-secret-change-in-production';
  static JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

  // For now, we'll use a simple in-memory user store
  // In production, this should be replaced with a proper database
  static users = new Map([
    ['admin', {
      id: 'admin',
      username: 'admin',
      password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // "password"
      role: 'admin',
      createdAt: new Date().toISOString()
    }]
  ]);

  static async authenticate(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'No token provided or invalid format',
          timestamp: new Date().toISOString()
        });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      try {
        const decoded = jwt.verify(token, AuthMiddleware.JWT_SECRET);
        
        // Check if user still exists
        const user = AuthMiddleware.users.get(decoded.username);
        if (!user) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'User no longer exists',
            timestamp: new Date().toISOString()
          });
        }

        // Add user info to request
        req.user = {
          id: decoded.id,
          username: decoded.username,
          role: decoded.role
        };

        next();
      } catch (jwtError) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or expired token',
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Authentication failed',
        timestamp: new Date().toISOString()
      });
    }
  }

  static async login(username, password) {
    const user = AuthMiddleware.users.get(username);
    
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role
      },
      AuthMiddleware.JWT_SECRET,
      { expiresIn: AuthMiddleware.JWT_EXPIRES_IN }
    );

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt
      }
    };
  }

  static async register(username, password, role = 'user') {
    if (AuthMiddleware.users.has(username)) {
      throw new Error('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: username, // Simple ID for now
      username,
      password: hashedPassword,
      role,
      createdAt: new Date().toISOString()
    };

    AuthMiddleware.users.set(username, user);

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role
      },
      AuthMiddleware.JWT_SECRET,
      { expiresIn: AuthMiddleware.JWT_EXPIRES_IN }
    );

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt
      }
    };
  }

  static requireRole(requiredRole) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        });
      }

      if (req.user.role !== requiredRole && req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Role '${requiredRole}' required`,
          timestamp: new Date().toISOString()
        });
      }

      next();
    };
  }

  static async changePassword(username, oldPassword, newPassword) {
    const user = AuthMiddleware.users.get(username);
    
    if (!user) {
      throw new Error('User not found');
    }

    const isValidPassword = await bcrypt.compare(oldPassword, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid current password');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    
    AuthMiddleware.users.set(username, user);
    return true;
  }

  static listUsers() {
    return Array.from(AuthMiddleware.users.values()).map(user => ({
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt
    }));
  }

  static deleteUser(username) {
    if (username === 'admin') {
      throw new Error('Cannot delete admin user');
    }
    
    return AuthMiddleware.users.delete(username);
  }
}
