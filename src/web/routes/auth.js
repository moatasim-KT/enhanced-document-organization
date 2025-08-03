/**
 * Authentication Routes for Drive Sync Web Dashboard
 * Handles login, registration, and user management
 */

import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth.js';
import { ErrorHandler } from '../middleware/error-handler.js';

export class AuthRoutes {
  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // Login endpoint
    this.router.post('/login', ErrorHandler.asyncHandler(async (req, res) => {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Username and password are required',
          timestamp: new Date().toISOString()
        });
      }

      try {
        const result = await AuthMiddleware.login(username, password);
        res.json({
          success: true,
          message: 'Login successful',
          data: result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(401).json({
          error: 'Unauthorized',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }));

    // Register endpoint
    this.router.post('/register', ErrorHandler.asyncHandler(async (req, res) => {
      const { username, password, role = 'user' } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Username and password are required',
          timestamp: new Date().toISOString()
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Password must be at least 6 characters long',
          timestamp: new Date().toISOString()
        });
      }

      try {
        const result = await AuthMiddleware.register(username, password, role);
        res.status(201).json({
          success: true,
          message: 'Registration successful',
          data: result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(409).json({
          error: 'Conflict',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }));

    // Get current user info
    this.router.get('/me', AuthMiddleware.authenticate, (req, res) => {
      res.json({
        success: true,
        data: req.user,
        timestamp: new Date().toISOString()
      });
    });

    // Change password
    this.router.post('/change-password', AuthMiddleware.authenticate, ErrorHandler.asyncHandler(async (req, res) => {
      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Old password and new password are required',
          timestamp: new Date().toISOString()
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'New password must be at least 6 characters long',
          timestamp: new Date().toISOString()
        });
      }

      try {
        await AuthMiddleware.changePassword(req.user.username, oldPassword, newPassword);
        res.json({
          success: true,
          message: 'Password changed successfully',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(400).json({
          error: 'Bad Request',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }));

    // List users (admin only)
    this.router.get('/users', AuthMiddleware.authenticate, AuthMiddleware.requireRole('admin'), (req, res) => {
      const users = AuthMiddleware.listUsers();
      res.json({
        success: true,
        data: users,
        timestamp: new Date().toISOString()
      });
    });

    // Delete user (admin only)
    this.router.delete('/users/:username', AuthMiddleware.authenticate, AuthMiddleware.requireRole('admin'), ErrorHandler.asyncHandler(async (req, res) => {
      const { username } = req.params;

      try {
        const deleted = AuthMiddleware.deleteUser(username);
        if (deleted) {
          res.json({
            success: true,
            message: `User ${username} deleted successfully`,
            timestamp: new Date().toISOString()
          });
        } else {
          res.status(404).json({
            error: 'Not Found',
            message: 'User not found',
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        res.status(400).json({
          error: 'Bad Request',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }));

    // Logout endpoint (client-side token removal, but we can log it)
    this.router.post('/logout', AuthMiddleware.authenticate, (req, res) => {
      console.log(`User ${req.user.username} logged out at ${new Date().toISOString()}`);
      res.json({
        success: true,
        message: 'Logout successful',
        timestamp: new Date().toISOString()
      });
    });
  }
}
