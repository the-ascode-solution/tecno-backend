const redis = require('redis');

// Redis configuration
const REDIS_CONFIG = {
  // Connection settings
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || null,
  
  // Connection pool settings (optimized for high concurrency)
  maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES) || 5,
  retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY) || 50,
  enableReadyCheck: process.env.REDIS_ENABLE_READY_CHECK !== 'false',
  
  // Timeout settings
  connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT) || 10000,
  commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT) || 5000,
  lazyConnect: process.env.REDIS_LAZY_CONNECT === 'true' || process.env.NODE_ENV === 'development',
  
  // Compression settings
  compression: process.env.REDIS_COMPRESSION !== 'false',
  
  // Database selection
  db: parseInt(process.env.REDIS_DB) || 0,
  
  // Cluster settings (for Redis Cluster)
  enableCluster: process.env.REDIS_ENABLE_CLUSTER === 'true',
  clusterNodes: process.env.REDIS_CLUSTER_NODES ? process.env.REDIS_CLUSTER_NODES.split(',') : [],
  
  // Sentinel settings (for Redis Sentinel)
  enableSentinel: process.env.REDIS_ENABLE_SENTINEL === 'true',
  sentinelNodes: process.env.REDIS_SENTINEL_NODES ? process.env.REDIS_SENTINEL_NODES.split(',') : [],
  sentinelMasterName: process.env.REDIS_SENTINEL_MASTER_NAME || 'mymaster'
};

// Cache key prefixes
const CACHE_PREFIXES = {
  SESSION: 'session:',
  SURVEY: 'survey:',
  ANALYTICS: 'analytics:',
  USER: 'user:',
  RATE_LIMIT: 'rate_limit:',
  TEMP: 'temp:'
};

// Cache TTL (Time To Live) settings
const CACHE_TTL = {
  SESSION: parseInt(process.env.SESSION_CACHE_TTL) || 3600, // 1 hour
  SURVEY: parseInt(process.env.SURVEY_CACHE_TTL) || 1800, // 30 minutes
  ANALYTICS: parseInt(process.env.ANALYTICS_CACHE_TTL) || 900, // 15 minutes
  USER: parseInt(process.env.USER_CACHE_TTL) || 1800, // 30 minutes
  RATE_LIMIT: parseInt(process.env.RATE_LIMIT_CACHE_TTL) || 3600, // 1 hour
  TEMP: parseInt(process.env.TEMP_CACHE_TTL) || 300 // 5 minutes
};

// Redis client instance
let redisClient = null;
let isConnected = false;
let connectionAttempts = 0;
const maxConnectionAttempts = 5;

// Create Redis client
function createRedisClient() {
  try {
    let client;
    
    if (REDIS_CONFIG.enableCluster) {
      // Redis Cluster
      client = redis.createCluster({
        rootNodes: REDIS_CONFIG.clusterNodes.map(node => ({ url: `redis://${node}` })),
        defaults: {
          password: REDIS_CONFIG.password,
          socket: {
            connectTimeout: REDIS_CONFIG.connectTimeout,
            commandTimeout: REDIS_CONFIG.commandTimeout
          }
        }
      });
    } else if (REDIS_CONFIG.enableSentinel) {
      // Redis Sentinel
      client = redis.createClient({
        socket: {
          host: REDIS_CONFIG.host,
          port: REDIS_CONFIG.port,
          connectTimeout: REDIS_CONFIG.connectTimeout,
          commandTimeout: REDIS_CONFIG.commandTimeout
        },
        password: REDIS_CONFIG.password,
        database: REDIS_CONFIG.db
      });
    } else {
      // Standard Redis
      client = redis.createClient({
        socket: {
          host: REDIS_CONFIG.host,
          port: REDIS_CONFIG.port,
          connectTimeout: REDIS_CONFIG.connectTimeout,
          commandTimeout: REDIS_CONFIG.commandTimeout
        },
        password: REDIS_CONFIG.password,
        database: REDIS_CONFIG.db
      });
    }
    
    return client;
  } catch (error) {
    console.error('❌ Error creating Redis client:', error);
    throw error;
  }
}

// Setup Redis event handlers
function setupRedisEventHandlers(client) {
  client.on('connect', () => {
    console.log('🔄 Connecting to Redis...');
  });

  client.on('ready', () => {
    isConnected = true;
    connectionAttempts = 0;
    console.log('✅ Redis connected successfully');
    console.log(`📊 Redis Config:`, {
      host: REDIS_CONFIG.host,
      port: REDIS_CONFIG.port,
      db: REDIS_CONFIG.db,
      cluster: REDIS_CONFIG.enableCluster,
      sentinel: REDIS_CONFIG.enableSentinel
    });
  });

  client.on('error', (error) => {
    isConnected = false;
    connectionAttempts++;
    console.error('❌ Redis connection error:', error.message);
    
    if (connectionAttempts >= maxConnectionAttempts) {
      console.error('❌ Maximum Redis connection attempts reached');
      console.warn('⚠️ Continuing without Redis cache - application will work with reduced performance');
      // Don't exit process, continue without Redis
      return;
    }
  });

  client.on('end', () => {
    isConnected = false;
    console.log('🔌 Redis connection ended');
  });

  client.on('reconnecting', () => {
    console.log('🔄 Redis reconnecting...');
  });

  client.on('warning', (warning) => {
    console.warn('⚠️ Redis warning:', warning);
  });
}

// Connect to Redis
async function connectRedis() {
  try {
    if (redisClient && isConnected) {
      console.log('⚠️ Redis already connected');
      return redisClient;
    }

    redisClient = createRedisClient();
    setupRedisEventHandlers(redisClient);

    if (!REDIS_CONFIG.lazyConnect) {
      await redisClient.connect();
    } else {
      console.log('⚠️ Redis lazy connect enabled - connection will be established on first use');
    }

    return redisClient;
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    console.warn('⚠️ Continuing without Redis - application will work with reduced performance');
    return null;
  }
}

// Disconnect from Redis
async function disconnectRedis() {
  try {
    if (redisClient && isConnected) {
      await redisClient.quit();
      isConnected = false;
      console.log('✅ Redis disconnected successfully');
    }
  } catch (error) {
    console.error('❌ Error disconnecting from Redis:', error);
    throw error;
  }
}

// Health check
async function redisHealthCheck() {
  try {
    if (!redisClient || !isConnected) {
      return {
        status: 'disconnected',
        message: 'Redis not connected',
        connected: false
      };
    }

    // Ping Redis
    const start = Date.now();
    await redisClient.ping();
    const latency = Date.now() - start;

    return {
      status: 'healthy',
      message: 'Redis connection is healthy',
      connected: true,
      latency: `${latency}ms`,
      config: {
        host: REDIS_CONFIG.host,
        port: REDIS_CONFIG.port,
        db: REDIS_CONFIG.db
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'Redis health check failed',
      error: error.message,
      connected: false
    };
  }
}

// Cache utility functions
class CacheService {
  constructor() {
    this.client = redisClient;
    this.isConnected = isConnected;
  }

  // Set cache with TTL
  async set(key, value, ttl = null) {
    try {
      if (!this.isConnected) {
        console.warn('⚠️ Redis not connected, skipping cache set');
        return false;
      }

      const serializedValue = JSON.stringify(value);
      const cacheKey = this.buildKey(key);
      
      if (ttl) {
        await this.client.setEx(cacheKey, ttl, serializedValue);
      } else {
        await this.client.set(cacheKey, serializedValue);
      }

      return true;
    } catch (error) {
      console.error('❌ Cache set error:', error);
      return false;
    }
  }

  // Get cache value
  async get(key) {
    try {
      if (!this.isConnected) {
        console.warn('⚠️ Redis not connected, skipping cache get');
        return null;
      }

      const cacheKey = this.buildKey(key);
      const value = await this.client.get(cacheKey);
      
      if (value) {
        return JSON.parse(value);
      }
      
      return null;
    } catch (error) {
      console.error('❌ Cache get error:', error);
      return null;
    }
  }

  // Delete cache
  async delete(key) {
    try {
      if (!this.isConnected) {
        console.warn('⚠️ Redis not connected, skipping cache delete');
        return false;
      }

      const cacheKey = this.buildKey(key);
      const result = await this.client.del(cacheKey);
      return result > 0;
    } catch (error) {
      console.error('❌ Cache delete error:', error);
      return false;
    }
  }

  // Check if key exists
  async exists(key) {
    try {
      if (!this.isConnected) {
        return false;
      }

      const cacheKey = this.buildKey(key);
      const result = await this.client.exists(cacheKey);
      return result === 1;
    } catch (error) {
      console.error('❌ Cache exists error:', error);
      return false;
    }
  }

  // Set expiration for existing key
  async expire(key, ttl) {
    try {
      if (!this.isConnected) {
        return false;
      }

      const cacheKey = this.buildKey(key);
      const result = await this.client.expire(cacheKey, ttl);
      return result === 1;
    } catch (error) {
      console.error('❌ Cache expire error:', error);
      return false;
    }
  }

  // Get TTL for key
  async ttl(key) {
    try {
      if (!this.isConnected) {
        return -1;
      }

      const cacheKey = this.buildKey(key);
      return await this.client.ttl(cacheKey);
    } catch (error) {
      console.error('❌ Cache TTL error:', error);
      return -1;
    }
  }

  // Increment counter
  async increment(key, value = 1) {
    try {
      if (!this.isConnected) {
        return null;
      }

      const cacheKey = this.buildKey(key);
      return await this.client.incrBy(cacheKey, value);
    } catch (error) {
      console.error('❌ Cache increment error:', error);
      return null;
    }
  }

  // Decrement counter
  async decrement(key, value = 1) {
    try {
      if (!this.isConnected) {
        return null;
      }

      const cacheKey = this.buildKey(key);
      return await this.client.decrBy(cacheKey, value);
    } catch (error) {
      console.error('❌ Cache decrement error:', error);
      return null;
    }
  }

  // Set hash field
  async hset(key, field, value) {
    try {
      if (!this.isConnected) {
        return false;
      }

      const cacheKey = this.buildKey(key);
      const serializedValue = JSON.stringify(value);
      const result = await this.client.hSet(cacheKey, field, serializedValue);
      return result === 1;
    } catch (error) {
      console.error('❌ Cache hset error:', error);
      return false;
    }
  }

  // Get hash field
  async hget(key, field) {
    try {
      if (!this.isConnected) {
        return null;
      }

      const cacheKey = this.buildKey(key);
      const value = await this.client.hGet(cacheKey, field);
      
      if (value) {
        return JSON.parse(value);
      }
      
      return null;
    } catch (error) {
      console.error('❌ Cache hget error:', error);
      return null;
    }
  }

  // Get all hash fields
  async hgetall(key) {
    try {
      if (!this.isConnected) {
        return {};
      }

      const cacheKey = this.buildKey(key);
      const hash = await this.client.hGetAll(cacheKey);
      
      const result = {};
      for (const [field, value] of Object.entries(hash)) {
        try {
          result[field] = JSON.parse(value);
        } catch {
          result[field] = value;
        }
      }
      
      return result;
    } catch (error) {
      console.error('❌ Cache hgetall error:', error);
      return {};
    }
  }

  // Delete hash field
  async hdel(key, field) {
    try {
      if (!this.isConnected) {
        return false;
      }

      const cacheKey = this.buildKey(key);
      const result = await this.client.hDel(cacheKey, field);
      return result > 0;
    } catch (error) {
      console.error('❌ Cache hdel error:', error);
      return false;
    }
  }

  // Add to set
  async sadd(key, ...members) {
    try {
      if (!this.isConnected) {
        return 0;
      }

      const cacheKey = this.buildKey(key);
      return await this.client.sAdd(cacheKey, members);
    } catch (error) {
      console.error('❌ Cache sadd error:', error);
      return 0;
    }
  }

  // Get set members
  async smembers(key) {
    try {
      if (!this.isConnected) {
        return [];
      }

      const cacheKey = this.buildKey(key);
      return await this.client.sMembers(cacheKey);
    } catch (error) {
      console.error('❌ Cache smembers error:', error);
      return [];
    }
  }

  // Remove from set
  async srem(key, ...members) {
    try {
      if (!this.isConnected) {
        return 0;
      }

      const cacheKey = this.buildKey(key);
      return await this.client.sRem(cacheKey, members);
    } catch (error) {
      console.error('❌ Cache srem error:', error);
      return 0;
    }
  }

  // Check if member in set
  async sismember(key, member) {
    try {
      if (!this.isConnected) {
        return false;
      }

      const cacheKey = this.buildKey(key);
      const result = await this.client.sIsMember(cacheKey, member);
      return result === 1;
    } catch (error) {
      console.error('❌ Cache sismember error:', error);
      return false;
    }
  }

  // Clear all cache
  async clear() {
    try {
      if (!this.isConnected) {
        return false;
      }

      await this.client.flushDb();
      return true;
    } catch (error) {
      console.error('❌ Cache clear error:', error);
      return false;
    }
  }

  // Get cache statistics
  async getStats() {
    try {
      if (!this.isConnected) {
        return null;
      }

      const info = await this.client.info('memory');
      const keyspace = await this.client.info('keyspace');
      
      return {
        memory: info,
        keyspace: keyspace,
        connected: this.isConnected
      };
    } catch (error) {
      console.error('❌ Cache stats error:', error);
      return null;
    }
  }

  // Build cache key with prefix
  buildKey(key) {
    return `${CACHE_PREFIXES.TEMP}${key}`;
  }

  // Build session cache key
  buildSessionKey(sessionId) {
    return `${CACHE_PREFIXES.SESSION}${sessionId}`;
  }

  // Build survey cache key
  buildSurveyKey(surveyId) {
    return `${CACHE_PREFIXES.SURVEY}${surveyId}`;
  }

  // Build analytics cache key
  buildAnalyticsKey(type, date) {
    return `${CACHE_PREFIXES.ANALYTICS}${type}:${date}`;
  }

  // Build rate limit cache key
  buildRateLimitKey(identifier) {
    return `${CACHE_PREFIXES.RATE_LIMIT}${identifier}`;
  }
}

// Create cache service instance
const cacheService = new CacheService();

// Update cache service when Redis connects
function updateCacheService() {
  cacheService.client = redisClient;
  cacheService.isConnected = isConnected;
}

// Export functions and service
module.exports = {
  connectRedis,
  disconnectRedis,
  redisHealthCheck,
  cacheService,
  CACHE_PREFIXES,
  CACHE_TTL,
  REDIS_CONFIG,
  updateCacheService
};
