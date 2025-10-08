const express = require('express');
const path = require('path');
const { performHealthCheck } = require('../middleware/healthCheck');
const { getConnectionStats, connectDB, disconnectDB } = require('../config/database');
const { cacheService } = require('../config/redis');

const router = express.Router();

// Serve the status page
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/status.html'));
});

// API endpoint for status data
router.get('/api', async (req, res) => {
  try {
    console.log('Status API endpoint called');
    const startTime = Date.now();
    
    // Get comprehensive health check data
    const healthData = await performHealthCheck();
    
    // Get MongoDB connection stats
    const mongoStats = getConnectionStats();
    
    // Get Redis status
    let redisStatus = {
      connected: false,
      status: 'disconnected',
      message: 'Redis not available'
    };
    
    try {
      if (cacheService && cacheService.isConnected) {
        await cacheService.client.ping();
        redisStatus = {
          connected: true,
          status: 'connected',
          message: 'Redis is healthy'
        };
      }
    } catch (error) {
      redisStatus = {
        connected: false,
        status: 'disconnected',
        message: `Redis error: ${error.message}`
      };
    }
    
    // Determine backend status for Railway semantics
    // 'active' when healthy or degraded; 'crashed' when unhealthy
    const backendStatus = (healthData.status === 'healthy' || healthData.status === 'degraded')
      ? 'active'
      : 'crashed';
    
    // Determine MongoDB status
    const mongoStatus = mongoStats.connectionState.isConnected ? 'connected' : 'disconnected';
    
    const responseTime = Date.now() - startTime;
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      backend: {
        status: backendStatus,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid,
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development'
      },
      mongodb: {
        status: mongoStatus,
        connected: mongoStats.connectionState.isConnected,
        host: mongoStats.stats.host,
        port: mongoStats.stats.port,
        database: mongoStats.stats.name,
        collections: mongoStats.stats.collections,
        models: mongoStats.stats.models,
        lastConnectionTime: mongoStats.connectionState.lastConnectionTime,
        connectionCount: mongoStats.connectionState.connectionCount
      },
      redis: redisStatus,
      system: {
        platform: process.platform,
        arch: process.arch,
        loadAverage: require('os').loadavg(),
        totalMemory: require('os').totalmem(),
        freeMemory: require('os').freemem(),
        uptime: require('os').uptime()
      },
      health: healthData
    });
    
  } catch (error) {
    console.error('Error in status API:', error);
    res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error.message,
      backend: {
        status: 'crashed',
        message: 'Failed to get backend status'
      },
      mongodb: {
        status: 'error',
        message: 'Failed to get MongoDB status'
      },
      redis: {
        status: 'error',
        message: 'Failed to get Redis status'
      }
    });
  }
});

// Reconnect MongoDB: gracefully disconnect then reconnect
router.post('/reconnect-mongo', async (req, res) => {
  try {
    await disconnectDB();
    await connectDB();
    const mongoStats = getConnectionStats();
    return res.json({
      success: true,
      message: 'MongoDB reconnected',
      mongodb: {
        connected: mongoStats.connectionState.isConnected,
        host: mongoStats.stats.host,
        port: mongoStats.stats.port,
        database: mongoStats.stats.name,
        connectionCount: mongoStats.connectionState.connectionCount,
        lastConnectionTime: mongoStats.connectionState.lastConnectionTime
      }
    });
  } catch (error) {
    console.error('MongoDB reconnect error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Restart backend server (Railway will bring it back up)
router.post('/restart', async (req, res) => {
  try {
    // Respond first so client gets confirmation
    res.json({ success: true, message: 'Server will restart in 1s' });
    // Give the response a moment to flush
    setTimeout(() => {
      console.log('♻️ Restart requested via /status/restart — exiting process');
      // Exit with non-zero to ensure platform restarts
      process.exit(1);
    }, 1000);
  } catch (error) {
    console.error('Server restart error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
