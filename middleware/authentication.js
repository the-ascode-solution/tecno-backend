const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { updateErrorMetrics } = require('./metrics');

// Authentication and authorization middleware
class AuthenticationManager {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
    this.bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    this.maxLoginAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
    this.lockoutTime = parseInt(process.env.LOCKOUT_TIME) || 15 * 60 * 1000; // 15 minutes
    
    // Store failed login attempts
    this.failedAttempts = new Map();
    this.lockedAccounts = new Map();
  }

  // Generate JWT token
  generateToken(payload) {
    try {
      return jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.jwtExpiresIn,
        issuer: 'techno-tribe-survey',
        audience: 'survey-users'
      });
    } catch (error) {
      console.error('Token generation failed:', error);
      throw new Error('Token generation failed');
    }
  }

  // Generate refresh token
  generateRefreshToken(payload) {
    try {
      return jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.refreshTokenExpiresIn,
        issuer: 'techno-tribe-survey',
        audience: 'survey-users'
      });
    } catch (error) {
      console.error('Refresh token generation failed:', error);
      throw new Error('Refresh token generation failed');
    }
  }

  // Verify JWT token
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret, {
        issuer: 'techno-tribe-survey',
        audience: 'survey-users'
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  // Hash password
  async hashPassword(password) {
    try {
      const salt = await bcrypt.genSalt(this.bcryptRounds);
      return await bcrypt.hash(password, salt);
    } catch (error) {
      console.error('Password hashing failed:', error);
      throw new Error('Password hashing failed');
    }
  }

  // Verify password
  async verifyPassword(password, hashedPassword) {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      console.error('Password verification failed:', error);
      throw new Error('Password verification failed');
    }
  }

  // Generate secure random string
  generateSecureRandom(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Generate session ID
  generateSessionId() {
    return crypto.randomUUID();
  }

  // Check if account is locked
  isAccountLocked(identifier) {
    const lockInfo = this.lockedAccounts.get(identifier);
    if (!lockInfo) return false;
    
    if (Date.now() > lockInfo.until) {
      this.lockedAccounts.delete(identifier);
      this.failedAttempts.delete(identifier);
      return false;
    }
    
    return true;
  }

  // Record failed login attempt
  recordFailedAttempt(identifier) {
    const attempts = this.failedAttempts.get(identifier) || 0;
    const newAttempts = attempts + 1;
    
    this.failedAttempts.set(identifier, newAttempts);
    
    if (newAttempts >= this.maxLoginAttempts) {
      this.lockedAccounts.set(identifier, {
        until: Date.now() + this.lockoutTime,
        attempts: newAttempts
      });
      
      updateErrorMetrics('AccountLocked', 'warning', 'authentication');
      console.warn(`Account locked: ${identifier} (${newAttempts} failed attempts)`);
    }
    
    return newAttempts;
  }

  // Reset failed attempts
  resetFailedAttempts(identifier) {
    this.failedAttempts.delete(identifier);
    this.lockedAccounts.delete(identifier);
  }

  // Get remaining attempts
  getRemainingAttempts(identifier) {
    const attempts = this.failedAttempts.get(identifier) || 0;
    return Math.max(0, this.maxLoginAttempts - attempts);
  }

  // Get lockout time remaining
  getLockoutTimeRemaining(identifier) {
    const lockInfo = this.lockedAccounts.get(identifier);
    if (!lockInfo) return 0;
    
    return Math.max(0, lockInfo.until - Date.now());
  }

  // Validate password strength
  validatePasswordStrength(password) {
    const minLength = 8;
    const maxLength = 128;
    
    if (password.length < minLength) {
      return { valid: false, message: `Password must be at least ${minLength} characters long` };
    }
    
    if (password.length > maxLength) {
      return { valid: false, message: `Password must be no more than ${maxLength} characters long` };
    }
    
    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    
    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    
    // Check for at least one number
    if (!/\d/.test(password)) {
      return { valid: false, message: 'Password must contain at least one number' };
    }
    
    // Check for at least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one special character' };
    }
    
    // Check for common passwords
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
      'admin', 'letmein', 'welcome', 'monkey', '1234567890', 'password1'
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
      return { valid: false, message: 'Password is too common, please choose a stronger password' };
    }
    
    return { valid: true, message: 'Password is strong' };
  }

  // Sanitize user input
  sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
      .trim()
      .replace(/[<>\"'&]/g, '') // Remove HTML/XML characters
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .substring(0, 255); // Limit length
  }

  // Validate email format
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate session ID format
  validateSessionId(sessionId) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(sessionId);
  }

  // Create authentication middleware
  createAuthMiddleware(required = true) {
    return (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          if (required) {
            return res.status(401).json({
              success: false,
              message: 'Access token required'
            });
          }
          return next();
        }
        
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        const decoded = this.verifyToken(token);
        
        req.user = decoded;
        next();
        
      } catch (error) {
        if (required) {
          updateErrorMetrics('AuthenticationFailure', 'warning', 'authentication');
          return res.status(401).json({
            success: false,
            message: error.message
          });
        }
        next();
      }
    };
  }

  // Create role-based authorization middleware
  createRoleMiddleware(requiredRoles = []) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }
      
      if (requiredRoles.length > 0 && !requiredRoles.includes(req.user.role)) {
        updateErrorMetrics('AuthorizationFailure', 'warning', 'authentication');
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }
      
      next();
    };
  }

  // Create rate limiting middleware for authentication
  createAuthRateLimit() {
    const rateLimit = require('express-rate-limit');
    
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts per window
      message: {
        success: false,
        message: 'Too many authentication attempts, please try again later',
        retryAfter: 900 // 15 minutes
      },
      keyGenerator: (req) => req.ip,
      skipSuccessfulRequests: true,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        updateErrorMetrics('AuthRateLimitExceeded', 'warning', 'authentication');
        res.status(429).json({
          success: false,
          message: 'Too many authentication attempts, please try again later',
          retryAfter: 900
        });
      }
    });
  }

  // Create session validation middleware
  createSessionValidationMiddleware() {
    return (req, res, next) => {
      const sessionId = req.headers['x-session-id'] || req.body.sessionId || req.query.sessionId || req.params.sessionId;
      
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID required'
        });
      }
      
      if (!this.validateSessionId(sessionId)) {
        updateErrorMetrics('InvalidSessionId', 'warning', 'authentication');
        return res.status(400).json({
          success: false,
          message: 'Invalid session ID format'
        });
      }
      
      req.sessionId = sessionId;
      next();
    };
  }

  // Create CSRF protection middleware
  createCSRFProtectionMiddleware() {
    return (req, res, next) => {
      // Skip CSRF for GET requests
      if (req.method === 'GET') {
        return next();
      }
      
      // Skip CSRF for API routes (they use other authentication methods)
      if (req.path.startsWith('/api/')) {
        return next();
      }

      // Skip CSRF for status utility routes used by internal dashboard
      // Allows POSTs from the local status page (same-origin) without CSRF token
      if (req.path.startsWith('/status')) {
        return next();
      }
      
      const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
      const sessionCsrfToken = req.session?.csrfToken;
      
      if (!csrfToken || !sessionCsrfToken || csrfToken !== sessionCsrfToken) {
        updateErrorMetrics('CSRFViolation', 'critical', 'security');
        return res.status(403).json({
          success: false,
          message: 'CSRF token mismatch'
        });
      }
      
      next();
    };
  }

  // Generate CSRF token
  generateCSRFToken() {
    return this.generateSecureRandom(32);
  }

  // Create input validation middleware
  createInputValidationMiddleware() {
    return (req, res, next) => {
      // Sanitize request body
      if (req.body && typeof req.body === 'object') {
        req.body = this.sanitizeObject(req.body);
      }
      
      // Sanitize query parameters
      if (req.query && typeof req.query === 'object') {
        req.query = this.sanitizeObject(req.query);
      }
      
      // Sanitize URL parameters
      if (req.params && typeof req.params === 'object') {
        req.params = this.sanitizeObject(req.params);
      }
      
      next();
    };
  }

  // Sanitize object recursively
  sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return this.sanitizeInput(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[this.sanitizeInput(key)] = this.sanitizeObject(value);
    }
    
    return sanitized;
  }

  // Get authentication statistics
  getAuthStats() {
    return {
      failedAttempts: this.failedAttempts.size,
      lockedAccounts: this.lockedAccounts.size,
      maxLoginAttempts: this.maxLoginAttempts,
      lockoutTime: this.lockoutTime,
      timestamp: new Date().toISOString()
    };
  }

  // Cleanup expired data
  cleanupExpiredData() {
    const now = Date.now();
    
    // Remove expired lockouts
    for (const [identifier, lockInfo] of this.lockedAccounts.entries()) {
      if (now > lockInfo.until) {
        this.lockedAccounts.delete(identifier);
        this.failedAttempts.delete(identifier);
      }
    }
    
    console.log('🧹 Authentication data cleanup completed');
  }
}

// Export singleton instance
const authManager = new AuthenticationManager();

// Cleanup expired data every hour
setInterval(() => {
  authManager.cleanupExpiredData();
}, 60 * 60 * 1000);

// Middleware exports
const requireAuth = authManager.createAuthMiddleware(true);
const optionalAuth = authManager.createAuthMiddleware(false);
const requireRole = (roles) => authManager.createRoleMiddleware(roles);
const authRateLimit = authManager.createAuthRateLimit();
const validateSession = authManager.createSessionValidationMiddleware();
const csrfProtection = authManager.createCSRFProtectionMiddleware();
const inputValidation = authManager.createInputValidationMiddleware();

module.exports = {
  AuthenticationManager,
  authManager,
  requireAuth,
  optionalAuth,
  requireRole,
  authRateLimit,
  validateSession,
  csrfProtection,
  inputValidation
};
