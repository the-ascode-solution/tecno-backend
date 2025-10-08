const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { updateErrorMetrics, updateRateLimitMetrics } = require('./metrics');

// Security headers configuration
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Advanced rate limiting
const createAdvancedRateLimit = (options) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100,
    message = 'Too many requests',
    keyGenerator = (req) => req.ip,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    standardHeaders = true,
    legacyHeaders = false
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    keyGenerator,
    skipSuccessfulRequests,
    skipFailedRequests,
    standardHeaders,
    legacyHeaders,
    handler: (req, res) => {
      updateRateLimitMetrics(req.path, req.ip, true);
      res.status(429).json({
        success: false,
        message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    },
    // onLimitReached is deprecated in express-rate-limit v7
  });
};

// DDoS protection
const ddosProtection = createAdvancedRateLimit({
  windowMs: 60000, // 1 minute
  max: 200, // 200 requests per minute
  message: 'DDoS protection triggered',
  keyGenerator: (req) => `${req.ip}-${req.get('User-Agent')}`,
  skipSuccessfulRequests: true
});

// API rate limiting
const apiRateLimit = createAdvancedRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per 15 minutes
  message: 'API rate limit exceeded'
});

// Session creation rate limiting
const sessionRateLimit = createAdvancedRateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 session creations per 5 minutes
  message: 'Session creation rate limit exceeded'
});

// Survey submission rate limiting
const surveyRateLimit = createAdvancedRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 submissions per hour
  message: 'Survey submission rate limit exceeded'
});


// CORS configuration
const corsConfig = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS ? 
      process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'https://technotribe.site', 'https://www.technotribe.site'];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      updateErrorMetrics('CORSViolation', 'warning', 'security');
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Security middleware stack
const securityMiddleware = [
  securityHeaders,
  ddosProtection
];

module.exports = {
  securityHeaders,
  createAdvancedRateLimit,
  ddosProtection,
  apiRateLimit,
  sessionRateLimit,
  surveyRateLimit,
  corsConfig,
  securityMiddleware
};
