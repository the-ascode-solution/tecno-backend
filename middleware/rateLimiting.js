const rateLimit = require('express-rate-limit');

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  // General API rate limiting
  general: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per window
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health';
    }
  },

  // Session creation rate limiting (more restrictive)
  sessionCreation: {
    windowMs: parseInt(process.env.SESSION_RATE_LIMIT_WINDOW_MS) || 5 * 60 * 1000, // 5 minutes
    max: parseInt(process.env.SESSION_RATE_LIMIT_MAX_REQUESTS) || 10, // 10 session creations per window
    message: {
      success: false,
      message: 'Too many session creation attempts, please try again later.',
      retryAfter: Math.ceil((parseInt(process.env.SESSION_RATE_LIMIT_WINDOW_MS) || 5 * 60 * 1000) / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false
  },

  // Survey submission rate limiting (very restrictive)
  surveySubmission: {
    windowMs: parseInt(process.env.SURVEY_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000, // 1 hour
    max: parseInt(process.env.SURVEY_RATE_LIMIT_MAX_REQUESTS) || 5, // 5 submissions per hour
    message: {
      success: false,
      message: 'Too many survey submissions, please try again later.',
      retryAfter: Math.ceil((parseInt(process.env.SURVEY_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000) / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false
  }
};

// Create rate limiters
const generalLimiter = rateLimit(RATE_LIMIT_CONFIG.general);
const sessionCreationLimiter = rateLimit(RATE_LIMIT_CONFIG.sessionCreation);
const surveySubmissionLimiter = rateLimit(RATE_LIMIT_CONFIG.surveySubmission);

// Custom rate limiter for specific endpoints
const createCustomLimiter = (config) => {
  return rateLimit({
    ...config,
    keyGenerator: (req) => {
      // Use IP address and user agent for more specific rate limiting
      return `${req.ip}-${req.get('User-Agent')}`;
    },
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  });
};

// Rate limiter for progress saving (moderate restrictions)
const progressSavingLimiter = createCustomLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 progress saves per minute
  message: {
    success: false,
    message: 'Too many progress saves, please slow down.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for status checks (lenient)
const statusCheckLimiter = createCustomLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 status checks per minute
  message: {
    success: false,
    message: 'Too many status checks, please slow down.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware to add rate limit headers
const addRateLimitHeaders = (req, res, next) => {
  // Add custom headers for client-side rate limit awareness
  res.set({
    'X-RateLimit-Policy': 'sliding-window',
    'X-RateLimit-Version': '1.0'
  });
  next();
};

// Rate limit bypass for trusted IPs (optional)
const bypassRateLimit = (req, res, next) => {
  const trustedIPs = process.env.TRUSTED_IPS ? process.env.TRUSTED_IPS.split(',') : [];
  
  if (trustedIPs.includes(req.ip)) {
    console.log(`🔓 Rate limit bypassed for trusted IP: ${req.ip}`);
    return next();
  }
  
  next();
};

// Rate limit monitoring middleware
const rateLimitMonitor = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log rate limit hits
    if (res.statusCode === 429) {
      console.warn(`⚠️ Rate limit hit for IP: ${req.ip}, Path: ${req.path}, User-Agent: ${req.get('User-Agent')}`);
      
      // You could send this to a monitoring service
      // monitoringService.logRateLimitHit(req.ip, req.path, req.get('User-Agent'));
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  generalLimiter,
  sessionCreationLimiter,
  surveySubmissionLimiter,
  progressSavingLimiter,
  statusCheckLimiter,
  addRateLimitHeaders,
  bypassRateLimit,
  rateLimitMonitor,
  RATE_LIMIT_CONFIG
};
