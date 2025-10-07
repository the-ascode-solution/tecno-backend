const mongoose = require('mongoose');
const { cacheService } = require('../config/redis');
const { updateErrorMetrics } = require('./metrics');

// Health check statuses
const HEALTH_STATUS = {
  HEALTHY: 'healthy',
  UNHEALTHY: 'unhealthy',
  DEGRADED: 'degraded'
};

// Health check results
class HealthCheckResult {
  constructor(service, status, message, details = {}) {
    this.service = service;
    this.status = status;
    this.message = message;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// Database health check
const checkDatabaseHealth = async () => {
  try {
    const start = Date.now();
    
    // Check connection status
    if (mongoose.connection.readyState !== 1) {
      return new HealthCheckResult(
        'database',
        HEALTH_STATUS.UNHEALTHY,
        'Database not connected',
        { readyState: mongoose.connection.readyState }
      );
    }

    // Ping database
    await mongoose.connection.db.admin().ping();
    const responseTime = Date.now() - start;

    // Check connection pool (try-catch for compatibility with different MongoDB driver versions)
    let poolStats = {};
    try {
      if (mongoose.connection.readyState === 1 && mongoose.connection.db?.serverConfig?.s?.pool) {
        poolStats = {
          connections: mongoose.connection.db.serverConfig.s.pool.totalConnectionCount || 0,
          availableConnections: mongoose.connection.db.serverConfig.s.pool.availableConnectionCount || 0
        };
      }
    } catch (e) {
      // Pool stats not available in this MongoDB driver version
      poolStats = { note: 'Pool stats not available' };
    }

    return new HealthCheckResult(
      'database',
      HEALTH_STATUS.HEALTHY,
      'Database is healthy',
      {
        responseTime: `${responseTime}ms`,
        ...poolStats
      }
    );
  } catch (error) {
    updateErrorMetrics('DatabaseHealthCheck', 'critical', 'health');
    return new HealthCheckResult(
      'database',
      HEALTH_STATUS.UNHEALTHY,
      'Database health check failed',
      { error: error.message }
    );
  }
};

// Redis health check
const checkCacheHealth = async () => {
  try {
    const start = Date.now();
    
    // Check if Redis is connected
    if (!cacheService.isConnected) {
      return new HealthCheckResult(
        'cache',
        HEALTH_STATUS.UNHEALTHY,
        'Redis not connected'
      );
    }

    // Ping Redis
    await cacheService.client.ping();
    const responseTime = Date.now() - start;

    // Get Redis info
    const info = await cacheService.getStats();
    
    return new HealthCheckResult(
      'cache',
      HEALTH_STATUS.HEALTHY,
      'Redis is healthy',
      {
        responseTime: `${responseTime}ms`,
        connected: true,
        ...info
      }
    );
  } catch (error) {
    updateErrorMetrics('CacheHealthCheck', 'critical', 'health');
    return new HealthCheckResult(
      'cache',
      HEALTH_STATUS.UNHEALTHY,
      'Redis health check failed',
      { error: error.message }
    );
  }
};

// Application health check
const checkApplicationHealth = async () => {
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Check memory usage
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    const isMemoryHealthy = memoryUsagePercent < 85;

    // Check uptime
    const uptime = process.uptime();
    const isUptimeHealthy = uptime > 60; // At least 1 minute uptime

    const status = isMemoryHealthy && isUptimeHealthy ? 
      HEALTH_STATUS.HEALTHY : HEALTH_STATUS.DEGRADED;

    return new HealthCheckResult(
      'application',
      status,
      status === HEALTH_STATUS.HEALTHY ? 'Application is healthy' : 'Application is degraded',
      {
        memoryUsage: {
          used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
          percentage: `${Math.round(memoryUsagePercent)}%`
        },
        uptime: `${Math.round(uptime)}s`,
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform
      }
    );
  } catch (error) {
    updateErrorMetrics('ApplicationHealthCheck', 'critical', 'health');
    return new HealthCheckResult(
      'application',
      HEALTH_STATUS.UNHEALTHY,
      'Application health check failed',
      { error: error.message }
    );
  }
};

// System health check
const checkSystemHealth = async () => {
  try {
    const os = require('os');
    
    // Check system resources
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsagePercent = ((totalMemory - freeMemory) / totalMemory) * 100;
    
    const loadAverage = os.loadavg();
    const cpuCount = os.cpus().length;
    const loadPercent = (loadAverage[0] / cpuCount) * 100;

    const isMemoryHealthy = memoryUsagePercent < 85;
    const isCpuHealthy = loadPercent < 80;

    const status = isMemoryHealthy && isCpuHealthy ? 
      HEALTH_STATUS.HEALTHY : HEALTH_STATUS.DEGRADED;

    return new HealthCheckResult(
      'system',
      status,
      status === HEALTH_STATUS.HEALTHY ? 'System is healthy' : 'System is degraded',
      {
        memory: {
          total: `${Math.round(totalMemory / 1024 / 1024)}MB`,
          free: `${Math.round(freeMemory / 1024 / 1024)}MB`,
          usage: `${Math.round(memoryUsagePercent)}%`
        },
        cpu: {
          load: loadAverage[0].toFixed(2),
          cores: cpuCount,
          usage: `${Math.round(loadPercent)}%`
        },
        uptime: `${Math.round(os.uptime())}s`
      }
    );
  } catch (error) {
    updateErrorMetrics('SystemHealthCheck', 'critical', 'health');
    return new HealthCheckResult(
      'system',
      HEALTH_STATUS.UNHEALTHY,
      'System health check failed',
      { error: error.message }
    );
  }
};

// External dependencies health check
const checkExternalDependencies = async () => {
  const results = [];
  
  try {
    // Check if we can make HTTP requests
    const https = require('https');
    const http = require('http');
    
    const checkUrl = (url) => {
      return new Promise((resolve) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, { timeout: 5000 }, (res) => {
          resolve({
            service: 'external-http',
            status: res.statusCode < 400 ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.DEGRADED,
            message: `HTTP requests working (status: ${res.statusCode})`,
            details: { statusCode: res.statusCode }
          });
        });
        
        req.on('error', () => {
          resolve({
            service: 'external-http',
            status: HEALTH_STATUS.DEGRADED,
            message: 'HTTP requests degraded',
            details: { error: 'Connection failed' }
          });
        });
        
        req.on('timeout', () => {
          req.destroy();
          resolve({
            service: 'external-http',
            status: HEALTH_STATUS.DEGRADED,
            message: 'HTTP requests timeout',
            details: { error: 'Timeout' }
          });
        });
      });
    };

    // Check localhost connectivity
    const httpResult = await checkUrl('http://localhost:3001/health');
    results.push(httpResult);

  } catch (error) {
    results.push({
      service: 'external-http',
      status: HEALTH_STATUS.UNHEALTHY,
      message: 'External dependencies check failed',
      details: { error: error.message },
      timestamp: new Date().toISOString()
    });
  }

  return results;
};

// Comprehensive health check
const performHealthCheck = async (includeExternal = false) => {
  const startTime = Date.now();
  const results = [];
  
  try {
    // Check core services
    const [databaseResult, cacheResult, applicationResult, systemResult] = await Promise.allSettled([
      checkDatabaseHealth(),
      checkCacheHealth(),
      checkApplicationHealth(),
      checkSystemHealth()
    ]);

    // Build results with optional cache override
    const dbVal = databaseResult.status === 'fulfilled' ? databaseResult.value : new HealthCheckResult('database', HEALTH_STATUS.UNHEALTHY, 'Database check failed');
    let cacheVal = cacheResult.status === 'fulfilled' ? cacheResult.value : new HealthCheckResult('cache', HEALTH_STATUS.UNHEALTHY, 'Cache check failed');
    const appVal = applicationResult.status === 'fulfilled' ? applicationResult.value : new HealthCheckResult('application', HEALTH_STATUS.UNHEALTHY, 'Application check failed');
    const sysVal = systemResult.status === 'fulfilled' ? systemResult.value : new HealthCheckResult('system', HEALTH_STATUS.UNHEALTHY, 'System check failed');

    if (process.env.IGNORE_CACHE_HEALTH === 'true') {
      cacheVal = new HealthCheckResult('cache', HEALTH_STATUS.HEALTHY, 'Redis health ignored by configuration', { ignored: true });
    }

    results.push(dbVal, cacheVal, appVal, sysVal);

    // Check external dependencies if requested
    if (includeExternal) {
      const externalResults = await checkExternalDependencies();
      results.push(...externalResults);
    }

    // Determine overall health
    const unhealthyCount = results.filter(r => r.status === HEALTH_STATUS.UNHEALTHY).length;
    const degradedCount = results.filter(r => r.status === HEALTH_STATUS.DEGRADED).length;
    
    let overallStatus = HEALTH_STATUS.HEALTHY;
    if (unhealthyCount > 0) {
      overallStatus = HEALTH_STATUS.UNHEALTHY;
    } else if (degradedCount > 0) {
      overallStatus = HEALTH_STATUS.DEGRADED;
    }

    const totalTime = Date.now() - startTime;

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: `${totalTime}ms`,
      checks: results,
      summary: {
        total: results.length,
        healthy: results.filter(r => r.status === HEALTH_STATUS.HEALTHY).length,
        degraded: degradedCount,
        unhealthy: unhealthyCount
      }
    };

  } catch (error) {
    updateErrorMetrics('HealthCheck', 'critical', 'health');
    return {
      status: HEALTH_STATUS.UNHEALTHY,
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`,
      error: error.message,
      checks: []
    };
  }
};

// Health check middleware
const healthCheckMiddleware = async (req, res, next) => {
  try {
    const includeExternal = req.query.external === 'true';
    const healthData = await performHealthCheck(includeExternal);
    
    // Set appropriate status code
    const statusCode = healthData.status === HEALTH_STATUS.HEALTHY ? 200 : 
                      healthData.status === HEALTH_STATUS.DEGRADED ? 200 : 503;
    
    res.status(statusCode).json({
      success: healthData.status !== HEALTH_STATUS.UNHEALTHY,
      ...healthData
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: HEALTH_STATUS.UNHEALTHY,
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
};

// Readiness check (for Kubernetes)
const readinessCheck = async (req, res, next) => {
  try {
    const [databaseResult, cacheResult] = await Promise.allSettled([
      checkDatabaseHealth(),
      checkCacheHealth()
    ]);

    const isDatabaseReady = databaseResult.status === 'fulfilled' && 
                           databaseResult.value.status === HEALTH_STATUS.HEALTHY;
    const isCacheReady = cacheResult.status === 'fulfilled' && 
                        cacheResult.value.status === HEALTH_STATUS.HEALTHY;

    if (isDatabaseReady && isCacheReady) {
      res.status(200).json({
        success: true,
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        success: false,
        status: 'not ready',
        timestamp: new Date().toISOString(),
        details: {
          database: isDatabaseReady,
          cache: isCacheReady
        }
      });
    }
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
};

// Liveness check (for Kubernetes)
const livenessCheck = async (req, res, next) => {
  try {
    const applicationResult = await checkApplicationHealth();
    
    if (applicationResult.status !== HEALTH_STATUS.UNHEALTHY) {
      res.status(200).json({
        success: true,
        status: 'alive',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: applicationResult.details
      });
    }
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
};

module.exports = {
  HEALTH_STATUS,
  HealthCheckResult,
  checkDatabaseHealth,
  checkCacheHealth,
  checkApplicationHealth,
  checkSystemHealth,
  checkExternalDependencies,
  performHealthCheck,
  healthCheckMiddleware,
  readinessCheck,
  livenessCheck
};
