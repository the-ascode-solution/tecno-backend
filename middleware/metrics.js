const prometheus = require('prom-client');

// Create a Registry to register the metrics
const register = new prometheus.Registry();

// Add default metrics (CPU, memory, etc.)
prometheus.collectDefaultMetrics({ register });

// Custom metrics for the survey application

// HTTP request metrics
const httpRequestsTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'endpoint', 'status'],
  registers: [register]
});

const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'endpoint', 'status'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  registers: [register]
});

// Session metrics
const sessionsActive = new prometheus.Gauge({
  name: 'sessions_active_total',
  help: 'Number of active sessions',
  registers: [register]
});

const sessionsCreated = new prometheus.Counter({
  name: 'sessions_created_total',
  help: 'Total number of sessions created',
  labelNames: ['status'],
  registers: [register]
});

const sessionsAbandoned = new prometheus.Counter({
  name: 'sessions_abandoned_total',
  help: 'Total number of abandoned sessions',
  registers: [register]
});

const sessionCreationFailures = new prometheus.Counter({
  name: 'session_creation_failures_total',
  help: 'Total number of session creation failures',
  registers: [register]
});

// Survey metrics
const surveySubmissions = new prometheus.Counter({
  name: 'survey_submissions_total',
  help: 'Total number of survey submissions',
  labelNames: ['status'],
  registers: [register]
});

const surveySubmissionDuration = new prometheus.Histogram({
  name: 'survey_submission_duration_seconds',
  help: 'Duration of survey submissions in seconds',
  labelNames: ['status'],
  buckets: [0.5, 1, 2, 5, 10, 30],
  registers: [register]
});

// Database metrics
const databaseConnections = new prometheus.Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections',
  labelNames: ['state'],
  registers: [register]
});

const databaseQueryDuration = new prometheus.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'collection'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register]
});

const databaseOperations = new prometheus.Counter({
  name: 'database_operations_total',
  help: 'Total number of database operations',
  labelNames: ['operation', 'collection', 'status'],
  registers: [register]
});

// Redis metrics
const redisOperations = new prometheus.Counter({
  name: 'redis_operations_total',
  help: 'Total number of Redis operations',
  labelNames: ['operation', 'status'],
  registers: [register]
});

const redisOperationDuration = new prometheus.Histogram({
  name: 'redis_operation_duration_seconds',
  help: 'Duration of Redis operations in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register]
});

const redisMemoryUsage = new prometheus.Gauge({
  name: 'redis_memory_usage_bytes',
  help: 'Redis memory usage in bytes',
  registers: [register]
});

const redisKeyCount = new prometheus.Gauge({
  name: 'redis_keys_total',
  help: 'Total number of Redis keys',
  labelNames: ['database'],
  registers: [register]
});

// Rate limiting metrics
const rateLimitHits = new prometheus.Counter({
  name: 'rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['endpoint', 'ip'],
  registers: [register]
});

const rateLimitRequests = new prometheus.Counter({
  name: 'rate_limit_requests_total',
  help: 'Total number of rate limit requests',
  labelNames: ['endpoint'],
  registers: [register]
});

// Business metrics
const userEngagement = new prometheus.Counter({
  name: 'user_engagement_total',
  help: 'Total user engagement events',
  labelNames: ['event_type', 'page'],
  registers: [register]
});

const surveyCompletionRate = new prometheus.Gauge({
  name: 'survey_completion_rate',
  help: 'Survey completion rate',
  labelNames: ['time_period'],
  registers: [register]
});

const averageSessionDuration = new prometheus.Gauge({
  name: 'average_session_duration_seconds',
  help: 'Average session duration in seconds',
  registers: [register]
});

// Error metrics
const errorsTotal = new prometheus.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'severity', 'component'],
  registers: [register]
});

// Performance metrics
const responseTimePercentiles = new prometheus.Summary({
  name: 'response_time_percentiles',
  help: 'Response time percentiles',
  labelNames: ['endpoint'],
  percentiles: [0.5, 0.9, 0.95, 0.99],
  registers: [register]
});

const throughput = new prometheus.Gauge({
  name: 'throughput_requests_per_second',
  help: 'Requests per second',
  labelNames: ['endpoint'],
  registers: [register]
});

// Middleware function to collect HTTP metrics
const httpMetricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // Increment request counter
  httpRequestsTotal.inc({
    method: req.method,
    endpoint: req.route?.path || req.path,
    status: res.statusCode
  });
  
  // Record request duration
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.observe({
      method: req.method,
      endpoint: req.route?.path || req.path,
      status: res.statusCode
    }, duration);
    
    // Record response time percentiles
    responseTimePercentiles.observe({
      endpoint: req.route?.path || req.path
    }, duration);
  });
  
  next();
};

// Middleware function to collect database metrics
const databaseMetricsMiddleware = (operation, collection) => {
  return (req, res, next) => {
    const start = Date.now();
    
    // Record database operation
    databaseOperations.inc({
      operation,
      collection,
      status: 'started'
    });
    
    // Override res.json to capture completion
    const originalJson = res.json;
    res.json = function(data) {
      const duration = (Date.now() - start) / 1000;
      
      // Record operation completion
      databaseOperations.inc({
        operation,
        collection,
        status: 'completed'
      });
      
      // Record operation duration
      databaseQueryDuration.observe({
        operation,
        collection
      }, duration);
      
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Middleware function to collect Redis metrics
const redisMetricsMiddleware = (operation) => {
  return (req, res, next) => {
    const start = Date.now();
    
    // Record Redis operation
    redisOperations.inc({
      operation,
      status: 'started'
    });
    
    // Override res.json to capture completion
    const originalJson = res.json;
    res.json = function(data) {
      const duration = (Date.now() - start) / 1000;
      
      // Record operation completion
      redisOperations.inc({
        operation,
        status: 'completed'
      });
      
      // Record operation duration
      redisOperationDuration.observe({
        operation
      }, duration);
      
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Function to update session metrics
const updateSessionMetrics = (activeCount, createdCount = 0, abandonedCount = 0) => {
  sessionsActive.set(activeCount);
  if (createdCount > 0) {
    sessionsCreated.inc({ status: 'success' }, createdCount);
  }
  if (abandonedCount > 0) {
    sessionsAbandoned.inc(abandonedCount);
  }
};

// Function to update survey metrics
const updateSurveyMetrics = (submittedCount = 0, duration = 0) => {
  if (submittedCount > 0) {
    surveySubmissions.inc({ status: 'success' }, submittedCount);
  }
  if (duration > 0) {
    surveySubmissionDuration.observe({ status: 'success' }, duration);
  }
};

// Function to update database metrics
const updateDatabaseMetrics = (activeConnections, operation, collection, duration, status) => {
  if (activeConnections !== undefined) {
    databaseConnections.set({ state: 'active' }, activeConnections);
  }
  if (operation && collection && duration !== undefined) {
    databaseQueryDuration.observe({ operation, collection }, duration);
  }
  if (operation && collection && status) {
    databaseOperations.inc({ operation, collection, status });
  }
};

// Function to update Redis metrics
const updateRedisMetrics = (operation, duration, status, memoryUsage, keyCount) => {
  if (operation && duration !== undefined) {
    redisOperationDuration.observe({ operation }, duration);
  }
  if (operation && status) {
    redisOperations.inc({ operation, status });
  }
  if (memoryUsage !== undefined) {
    redisMemoryUsage.set(memoryUsage);
  }
  if (keyCount !== undefined) {
    redisKeyCount.set({ database: '0' }, keyCount);
  }
};

// Function to update rate limiting metrics
const updateRateLimitMetrics = (endpoint, ip, hit = false) => {
  rateLimitRequests.inc({ endpoint });
  if (hit) {
    rateLimitHits.inc({ endpoint, ip });
  }
};

// Function to update business metrics
const updateBusinessMetrics = (eventType, page, completionRate, sessionDuration) => {
  if (eventType && page) {
    userEngagement.inc({ eventType, page });
  }
  if (completionRate !== undefined) {
    surveyCompletionRate.set({ time_period: 'current' }, completionRate);
  }
  if (sessionDuration !== undefined) {
    averageSessionDuration.set(sessionDuration);
  }
};

// Function to update error metrics
const updateErrorMetrics = (type, severity, component) => {
  errorsTotal.inc({ type, severity, component });
};

// Function to update performance metrics
const updatePerformanceMetrics = (endpoint, requestsPerSecond) => {
  if (endpoint && requestsPerSecond !== undefined) {
    throughput.set({ endpoint }, requestsPerSecond);
  }
};

// Function to get metrics
const getMetrics = async () => {
  return register.metrics();
};

// Function to get metrics in Prometheus format
const getMetricsAsString = async () => {
  return register.metrics();
};

// Health check function
const healthCheck = async () => {
  try {
    const metrics = await register.metrics();
    return {
      status: 'healthy',
      metrics: metrics.length > 0
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};

module.exports = {
  register,
  httpRequestsTotal,
  httpRequestDuration,
  sessionsActive,
  sessionsCreated,
  sessionsAbandoned,
  sessionCreationFailures,
  surveySubmissions,
  surveySubmissionDuration,
  databaseConnections,
  databaseQueryDuration,
  databaseOperations,
  redisOperations,
  redisOperationDuration,
  redisMemoryUsage,
  redisKeyCount,
  rateLimitHits,
  rateLimitRequests,
  userEngagement,
  surveyCompletionRate,
  averageSessionDuration,
  errorsTotal,
  responseTimePercentiles,
  throughput,
  httpMetricsMiddleware,
  databaseMetricsMiddleware,
  redisMetricsMiddleware,
  updateSessionMetrics,
  updateSurveyMetrics,
  updateDatabaseMetrics,
  updateRedisMetrics,
  updateRateLimitMetrics,
  updateBusinessMetrics,
  updateErrorMetrics,
  updatePerformanceMetrics,
  getMetrics,
  getMetricsAsString,
  healthCheck
};
