/**
 * Error Handler Middleware for Drive Sync Web Dashboard
 * Provides centralized error handling and logging
 */

export class ErrorHandler {
  static handle(error, req, res, next) {
    console.error('API Error:', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // Default error response
    let statusCode = 500;
    let message = 'Internal Server Error';
    let details = null;

    // Handle different error types
    if (error.name === 'ValidationError') {
      statusCode = 400;
      message = 'Validation Error';
      details = error.details;
    } else if (error.name === 'UnauthorizedError') {
      statusCode = 401;
      message = 'Unauthorized';
    } else if (error.name === 'ForbiddenError') {
      statusCode = 403;
      message = 'Forbidden';
    } else if (error.name === 'NotFoundError') {
      statusCode = 404;
      message = 'Not Found';
    } else if (error.name === 'ConflictError') {
      statusCode = 409;
      message = 'Conflict';
    } else if (error.statusCode) {
      statusCode = error.statusCode;
      message = error.message;
    }

    // Don't expose internal error details in production
    const response = {
      error: message,
      timestamp: new Date().toISOString(),
      path: req.path
    };

    if (process.env.NODE_ENV !== 'production') {
      response.details = details || error.message;
      response.stack = error.stack;
    }

    res.status(statusCode).json(response);
  }

  static asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  static notFound(req, res, next) {
    const error = new Error(`Route ${req.method} ${req.path} not found`);
    error.name = 'NotFoundError';
    next(error);
  }
}
