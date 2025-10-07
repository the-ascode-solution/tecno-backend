const os = require('os');
const { updateErrorMetrics } = require('./metrics');

// Performance monitoring and optimization
class PerformanceOptimizer {
  constructor() {
    this.maxConnections = parseInt(process.env.MAX_CONNECTIONS) || 10000;
    this.connectionTimeout = parseInt(process.env.CONNECTION_TIMEOUT) || 30000;
    this.keepAliveTimeout = parseInt(process.env.KEEP_ALIVE_TIMEOUT) || 65000;
    this.headersTimeout = parseInt(process.env.HEADERS_TIMEOUT) || 66000;
    this.requestTimeout = parseInt(process.env.REQUEST_TIMEOUT) || 30000;
    
    // Performance metrics
    this.metrics = {
      activeConnections: 0,
      totalRequests: 0,
      averageResponseTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };
    
    // Performance thresholds
    this.thresholds = {
      maxMemoryUsage: 0.95, // 95% of system memory (more reasonable)
      maxCpuUsage: 0.90, // 90% CPU usage
      maxResponseTime: 5000, // 5 seconds
      maxErrorRate: 0.05 // 5% error rate
    };
    
    this.startTime = Date.now();
    this.requestTimes = [];
    this.errorCount = 0;
    
    // Track intervals for cleanup
    this.intervals = [];
  }

  // Initialize performance monitoring
  initialize() {
    // Set up performance monitoring
    this.startPerformanceMonitoring();
    
    // Set up memory monitoring
    this.startMemoryMonitoring();
    
    // Set up CPU monitoring
    this.startCpuMonitoring();
    
    // Set up garbage collection monitoring
    this.startGarbageCollectionMonitoring();
    
    console.log('🚀 Performance optimizer initialized');
  }

  // Start performance monitoring
  startPerformanceMonitoring() {
    const interval = setInterval(() => {
      this.updatePerformanceMetrics();
      this.checkPerformanceThresholds();
    }, 60000); // Every 60 seconds (less aggressive)
    
    this.intervals.push(interval);
  }

  // Start memory monitoring
  startMemoryMonitoring() {
    const interval = setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      
      // Calculate actual system memory usage percentage
      this.metrics.memoryUsage = usedMemory / totalMemory;
      
      // Also track heap usage for Node.js specific monitoring
      const heapUsage = memoryUsage.heapUsed / memoryUsage.heapTotal;
      
      // Trigger garbage collection if heap usage is high (not system memory)
      if (heapUsage > 0.9) { // 90% heap usage
        if (global.gc) {
          global.gc();
          console.log('🗑️ Garbage collection triggered due to high heap usage');
        }
      }
    }, 30000); // Every 30 seconds (less aggressive)
    
    this.intervals.push(interval);
  }

  // Start CPU monitoring
  startCpuMonitoring() {
    let lastCpuUsage = process.cpuUsage();
    let lastTime = Date.now();
    
    const interval = setInterval(() => {
      const currentCpuUsage = process.cpuUsage(lastCpuUsage);
      const currentTime = Date.now();
      const timeDiff = currentTime - lastTime;
      
      // Calculate CPU usage percentage
      const cpuUsagePercent = (currentCpuUsage.user + currentCpuUsage.system) / (timeDiff * 1000);
      this.metrics.cpuUsage = Math.min(cpuUsagePercent, 1);
      
      lastCpuUsage = process.cpuUsage();
      lastTime = currentTime;
    }, 30000); // Every 30 seconds (less aggressive)
    
    this.intervals.push(interval);
  }

  // Start garbage collection monitoring
  startGarbageCollectionMonitoring() {
    if (global.gc) {
      const interval = setInterval(() => {
        const memoryBefore = process.memoryUsage();
        global.gc();
        const memoryAfter = process.memoryUsage();
        
        const freedMemory = memoryBefore.heapUsed - memoryAfter.heapUsed;
        if (freedMemory > 1024 * 1024) { // Only log if more than 1MB freed
          console.log(`🗑️ Garbage collection freed ${(freedMemory / 1024 / 1024).toFixed(2)} MB`);
        }
      }, 300000); // Every 5 minutes (less aggressive)
      
      this.intervals.push(interval);
    }
  }

  // Update performance metrics
  updatePerformanceMetrics() {
    const uptime = Date.now() - this.startTime;
    const requestsPerSecond = this.metrics.totalRequests / (uptime / 1000);
    
    // Calculate average response time
    if (this.requestTimes.length > 0) {
      const sum = this.requestTimes.reduce((a, b) => a + b, 0);
      this.metrics.averageResponseTime = sum / this.requestTimes.length;
    }
    
    // Calculate error rate
    this.metrics.errorRate = this.errorCount / Math.max(this.metrics.totalRequests, 1);
    
    // Log performance metrics
    console.log('📊 Performance Metrics:', {
      activeConnections: this.metrics.activeConnections,
      totalRequests: this.metrics.totalRequests,
      requestsPerSecond: requestsPerSecond.toFixed(2),
      averageResponseTime: `${this.metrics.averageResponseTime.toFixed(2)}ms`,
      errorRate: `${(this.metrics.errorRate * 100).toFixed(2)}%`,
      memoryUsage: `${(this.metrics.memoryUsage * 100).toFixed(2)}%`,
      cpuUsage: `${(this.metrics.cpuUsage * 100).toFixed(2)}%`
    });
  }

  // Check performance thresholds
  checkPerformanceThresholds() {
    const alerts = [];
    
    if (this.metrics.memoryUsage > this.thresholds.maxMemoryUsage) {
      alerts.push('High memory usage detected');
      updateErrorMetrics('HighMemoryUsage', 'warning', 'performance');
    }
    
    if (this.metrics.cpuUsage > this.thresholds.maxCpuUsage) {
      alerts.push('High CPU usage detected');
      updateErrorMetrics('HighCpuUsage', 'warning', 'performance');
    }
    
    if (this.metrics.averageResponseTime > this.thresholds.maxResponseTime) {
      alerts.push('High response time detected');
      updateErrorMetrics('HighResponseTime', 'warning', 'performance');
    }
    
    if (this.metrics.errorRate > this.thresholds.maxErrorRate) {
      alerts.push('High error rate detected');
      updateErrorMetrics('HighErrorRate', 'critical', 'performance');
    }
    
    if (alerts.length > 0) {
      console.warn('⚠️ Performance alerts:', alerts);
    }
  }

  // Get performance metrics snapshot
  getMetrics() {
    return {
      ...this.metrics,
      uptimeMs: Date.now() - this.startTime,
      processId: process.pid,
      platform: process.platform,
      nodeVersion: process.version
    };
  }

  // Record request metrics
  recordRequest(startTime, success = true) {
    const responseTime = Date.now() - startTime;
    
    this.metrics.totalRequests++;
    this.requestTimes.push(responseTime);
    
    // Keep only last 1000 request times for average calculation
    if (this.requestTimes.length > 1000) {
      this.requestTimes.shift();
    }
    
    if (!success) {
      this.errorCount++;
    }
  }

  // Optimize server settings
  optimizeServer(server) {
    // Set connection limits
    server.maxConnections = this.maxConnections;
    
    // Set timeouts
    server.timeout = this.requestTimeout;
    server.keepAliveTimeout = this.keepAliveTimeout;
    server.headersTimeout = this.headersTimeout;
    
    // Enable keep-alive
    server.keepAlive = true;
    
    console.log('⚡ Server performance optimized');
  }

  // Optimize database connections
  optimizeDatabase(mongoose) {
    // Set connection pool options
    mongoose.set('bufferCommands', false);
    
    // Optimize connection settings
    const options = {
      maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE) || 20,
      minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE) || 5,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4
      compressors: ['zlib'],
      zlibCompressionLevel: 6
    };
    
    console.log('⚡ Database performance optimized');
    return options;
  }

  // Enable compression
  enableCompression(app) {
    const compression = require('compression');
    
    app.use(compression({
      level: 6,
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      }
    }));
    
    console.log('⚡ Compression enabled');
  }

  // Enable response caching
  enableResponseCaching(app) {
    const cache = require('memory-cache');
    
    app.use((req, res, next) => {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }
      
      const key = req.originalUrl;
      const cachedResponse = cache.get(key);
      
      if (cachedResponse) {
        res.set('X-Cache', 'HIT');
        return res.json(cachedResponse);
      }
      
      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = function(data) {
        // Cache for 5 minutes
        cache.put(key, data, 5 * 60 * 1000);
        res.set('X-Cache', 'MISS');
        return originalJson.call(this, data);
      };
      
      next();
    });
    
    console.log('⚡ Response caching enabled');
  }

  // Optimize JSON parsing
  optimizeJsonParsing(app) {
    const bodyParser = require('body-parser');
    
    // Increase JSON payload limit
    app.use(bodyParser.json({ 
      limit: '10mb',
      type: 'application/json'
    }));
    
    // Optimize URL-encoded parsing
    app.use(bodyParser.urlencoded({ 
      extended: true, 
      limit: '10mb',
      parameterLimit: 10000
    }));
    
    console.log('⚡ JSON parsing optimized');
  }

  // Enable request queuing
  enableRequestQueuing(app) {
    const queue = [];
    let processing = false;
    const maxConcurrentRequests = parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 100;
    
    app.use((req, res, next) => {
      if (queue.length >= maxConcurrentRequests) {
        return res.status(503).json({
          success: false,
          message: 'Server is busy, please try again later',
          retryAfter: 5
        });
      }
      
      queue.push({ req, res, next });
      processQueue();
    });
    
    function processQueue() {
      if (processing || queue.length === 0) {
        return;
      }
      
      processing = true;
      const { req, res, next } = queue.shift();
      
      next();
      
      res.on('finish', () => {
        processing = false;
        processQueue();
      });
    }
    
    console.log('⚡ Request queuing enabled');
  }

  // Optimize static file serving
  optimizeStaticFiles(app) {
    const express = require('express');
    const path = require('path');
    
    // Serve static files with caching
    app.use('/static', express.static(path.join(__dirname, '../public'), {
      maxAge: '1d',
      etag: true,
      lastModified: true,
      setHeaders: (res, path) => {
        if (path.endsWith('.js') || path.endsWith('.css')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
        }
      }
    }));
    
    console.log('⚡ Static file serving optimized');
  }

  
}

// Export singleton instance
const performanceOptimizer = new PerformanceOptimizer();

// Performance middleware
const performanceMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // Record request start
  performanceOptimizer.metrics.activeConnections++;
  
  // Override res.end to record metrics
  const originalEnd = res.end;
  res.end = function(...args) {
    const success = res.statusCode < 400;
    performanceOptimizer.recordRequest(startTime, success);
    performanceOptimizer.metrics.activeConnections--;
    
    return originalEnd.apply(this, args);
  };
  
  next();
};

// Request timeout middleware
const requestTimeoutMiddleware = (timeout = 30000) => {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          message: 'Request timeout'
        });
      }
    }, timeout);
    
    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    
    next();
  };
};

// Connection limit middleware
const connectionLimitMiddleware = (maxConnections = 1000) => {
  let activeConnections = 0;
  
  return (req, res, next) => {
    if (activeConnections >= maxConnections) {
      return res.status(503).json({
        success: false,
        message: 'Too many connections',
        retryAfter: 5
      });
    }
    
    activeConnections++;
    
    res.on('finish', () => activeConnections--);
    res.on('close', () => activeConnections--);
    
    next();
  };
};

module.exports = {
  PerformanceOptimizer,
  performanceOptimizer,
  performanceMiddleware,
  requestTimeoutMiddleware,
  connectionLimitMiddleware
};
