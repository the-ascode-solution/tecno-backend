const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { connectDB } = require('./config/database');
const { initializeCluster } = require('./config/cluster');
const { connectRedis, updateCacheService, redisHealthCheck } = require('./config/redis');

// Import routes
const surveyRoutes = require('./routes/survey');
const sessionRoutes = require('./routes/session');
const analyticsRoutes = require('./routes/analytics');
const statusRoutes = require('./routes/status');

// Import middleware
const { 
  generalLimiter, 
  sessionCreationLimiter, 
  surveySubmissionLimiter,
  progressSavingLimiter,
  statusCheckLimiter,
  addRateLimitHeaders,
  bypassRateLimit,
  rateLimitMonitor
} = require('./middleware/rateLimiting');
const { httpMetricsMiddleware, getMetricsAsString } = require('./middleware/metrics');
const { 
  performanceOptimizer, 
  performanceMiddleware, 
  requestTimeoutMiddleware, 
  connectionLimitMiddleware 
} = require('./middleware/performance');
const { 
  errorHandler, 
  notFound, 
  handleUnhandledRejection, 
  handleUncaughtException, 
  gracefulShutdown 
} = require('./middleware/errorHandler');
const { 
  healthCheckMiddleware, 
  readinessCheck, 
  livenessCheck 
} = require('./middleware/healthCheck');
const { 
  securityMiddleware, 
  corsConfig,
  apiRateLimit,
  sessionRateLimit,
  surveyRateLimit
} = require('./middleware/security');
const { 
  authManager, 
  requireAuth, 
  optionalAuth, 
  authRateLimit, 
  validateSession, 
  csrfProtection, 
  inputValidation 
} = require('./middleware/authentication');
const { 
  auditManager, 
  auditAuth, 
  auditDataAccess, 
  auditDataModification, 
  auditSystemChanges, 
  auditSecurityEvents 
} = require('./middleware/audit');

const app = express();
const PORT = process.env.PORT || 3001;

// Log environment information for debugging
console.log('🌍 Environment Information:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`   PORT: ${PORT}`);
console.log(`   RAILWAY_ENVIRONMENT: ${process.env.RAILWAY_ENVIRONMENT || 'not set'}`);
console.log(`   Platform: ${process.platform}`);
console.log(`   Node Version: ${process.version}`);

// Initialize clustering (only in master process)
// Disable clustering on Railway and other cloud platforms
const isMasterProcess = initializeCluster();

// Connect to MongoDB and Redis (only in worker processes or single process mode)
if (!isMasterProcess) {
  // Connect to database with optimization
  const dbOptions = performanceOptimizer.optimizeDatabase(require('mongoose'));
  connectDB();
  
  // Only connect to Redis if not disabled
  if (process.env.REDIS_DISABLED === 'true') {
    console.log('🟡 Redis disabled (REDIS_DISABLED=true) - continuing without cache');
  } else {
    connectRedis().then(() => {
      updateCacheService();
      console.log('✅ Redis cache service initialized');
    }).catch((error) => {
      console.error('❌ Redis connection failed:', error);
      console.warn('⚠️ Continuing without Redis cache - application will work with reduced performance');
      // Continue without Redis in all environments
    });
  }
}

// Security middleware (can be disabled via env for testing)
if (process.env.DISABLE_SECURITY === 'true') {
  console.log('🛡️ Security middleware disabled (DISABLE_SECURITY=true)');
} else {
  app.use(securityMiddleware);
}
app.use(inputValidation);
app.use(csrfProtection);

// CORS configuration for Railway deployment
const corsOptions = {
  origin: [
    'https://www.tecnotribe.site',
    'https://tecnotribe.site',
    'http://localhost:3000', // for development
    'http://localhost:3001'  // for development
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Logging middleware
app.use(morgan('combined'));

// Performance optimization
performanceOptimizer.initialize();
performanceOptimizer.enableCompression(app);
performanceOptimizer.optimizeJsonParsing(app);
performanceOptimizer.optimizeStaticFiles(app);

// Optional features controlled by environment flags
// RESPONSE CACHING
if (process.env.ENABLE_RESPONSE_CACHING === 'true') {
  performanceOptimizer.enableResponseCaching(app);
} else {
  console.log('🧠 Response caching disabled (ENABLE_RESPONSE_CACHING=false)');
}

// REQUEST QUEUING
if (process.env.ENABLE_REQUEST_QUEUE === 'true') {
  performanceOptimizer.enableRequestQueuing(app);
} else {
  console.log('🧵 Request queuing disabled (ENABLE_REQUEST_QUEUE=false)');
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from public directory
app.use(express.static('public'));

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Metrics middleware
app.use(httpMetricsMiddleware);
app.use(performanceMiddleware);
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '30000');
const CONNECTION_LIMIT = process.env.CONNECTION_LIMIT
  ? parseInt(process.env.CONNECTION_LIMIT)
  : 0; // 0 means disabled

app.use(requestTimeoutMiddleware(REQUEST_TIMEOUT));

if (CONNECTION_LIMIT > 0) {
  app.use(connectionLimitMiddleware(CONNECTION_LIMIT));
  console.log(`🔒 Connection limit enabled: ${CONNECTION_LIMIT}`);
} else {
  console.log('🔓 Connection limit disabled');
}

// Rate limiting middleware (can be disabled via env for testing)
if (process.env.DISABLE_RATE_LIMIT === 'true') {
  console.log('⏱️ Rate limiting disabled (DISABLE_RATE_LIMIT=true)');
} else {
  app.use(rateLimitMonitor);
  app.use(addRateLimitHeaders);
  app.use(bypassRateLimit);
  app.use(generalLimiter);
}

// Health check endpoints
app.get('/health', healthCheckMiddleware);
app.get('/health/ready', readinessCheck);
app.get('/health/live', livenessCheck);

// Status page route
app.use('/status', statusRoutes);

// Metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
  try {
    const metrics = await getMetricsAsString();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    res.status(500).send('Error generating metrics');
  }
});

// API routes with optional rate limiting
if (process.env.DISABLE_RATE_LIMIT === 'true') {
  app.use('/api/survey', auditDataModification, surveyRoutes);
  app.use('/api/session', auditDataAccess, sessionRoutes);
  app.use('/api/analytics', auditDataAccess, analyticsRoutes);
} else {
  app.use('/api/survey', apiRateLimit, authRateLimit, auditDataModification, surveyRoutes);
  app.use('/api/session', sessionRateLimit, authRateLimit, auditDataAccess, sessionRoutes);
  app.use('/api/analytics', apiRateLimit, authRateLimit, auditDataAccess, analyticsRoutes);
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Techno Tribe Survey API',
    version: '1.0.0',
    status: '/status',
    endpoints: {
      health: '/health',
      submitSurvey: 'POST /api/survey/submit',
      getStats: 'GET /api/survey/stats',
      getRecent: 'GET /api/survey/recent',
      createSession: 'POST /api/session/create',
      saveProgress: 'PUT /api/session/:sessionId/save-progress',
      getSessionStatus: 'GET /api/session/:sessionId/status',
      submitSession: 'POST /api/session/:sessionId/submit',
      sessionStats: 'GET /api/session/stats',
      getDailyAnalytics: 'GET /api/analytics/daily',
      getWeeklyAnalytics: 'GET /api/analytics/weekly',
      getMonthlyAnalytics: 'GET /api/analytics/monthly',
      getTrends: 'GET /api/analytics/trends',
      getOverview: 'GET /api/analytics/overview'
    }
  });
});

// 404 handler
app.use('*', notFound);

// Global error handler
app.use(errorHandler);

// Start server (only in worker processes or single process mode)
if (!isMasterProcess) {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 API available at http://localhost:${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`👷 Worker Process ID: ${process.pid}`);
  });

  // Optimize server performance
  performanceOptimizer.optimizeServer(server);

  // Log Redis status summary after server start
  (async () => {
    try {
      const status = await redisHealthCheck();
      if (status.connected) {
        console.log(`🟢 Redis Status: connected (${status.latency} latency) host=${status.config.host} port=${status.config.port} db=${status.config.db}`);
      } else {
        console.log('🟡 Redis Status: not connected (running without cache)');
      }
    } catch (e) {
      console.log('🟡 Redis Status: unknown (health check failed)');
    }
  })();

  // Setup error handlers
  handleUnhandledRejection();
  handleUncaughtException();
  gracefulShutdown(server);
}