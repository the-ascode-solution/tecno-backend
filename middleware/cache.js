const { cacheService, CACHE_TTL } = require('../config/redis');

// Cache middleware for API responses
const cacheMiddleware = (ttl = CACHE_TTL.ANALYTICS, keyGenerator = null) => {
  return async (req, res, next) => {
    // Skip caching if Redis is disabled
    if (process.env.REDIS_DISABLED === 'true') {
      return next();
    }
    
    try {
      // Generate cache key
      const cacheKey = keyGenerator ? keyGenerator(req) : `api:${req.method}:${req.originalUrl}`;
      
      // Try to get cached response
      const cachedResponse = await cacheService.get(cacheKey);
      
      if (cachedResponse) {
        console.log(`📦 Cache hit for key: ${cacheKey}`);
        return res.json(cachedResponse);
      }
      
      // Store original res.json method
      const originalJson = res.json;
      
      // Override res.json to cache the response
      res.json = function(data) {
        // Cache the response
        cacheService.set(cacheKey, data, ttl).then(() => {
          console.log(`💾 Cached response for key: ${cacheKey} (TTL: ${ttl}s)`);
        }).catch(error => {
          console.error('❌ Cache set error:', error);
        });
        
        // Call original json method
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      console.error('❌ Cache middleware error:', error);
      next(); // Continue without caching
    }
  };
};

// Session cache middleware
const sessionCacheMiddleware = async (req, res, next) => {
  // Skip caching if Redis is disabled
  if (process.env.REDIS_DISABLED === 'true') {
    return next();
  }
  
  try {
    const sessionId = req.params.sessionId;
    
    if (sessionId) {
      const cacheKey = cacheService.buildSessionKey(sessionId);
      const cachedSession = await cacheService.get(cacheKey);
      
      if (cachedSession) {
        console.log(`📦 Session cache hit for: ${sessionId}`);
        req.cachedSession = cachedSession;
      }
    }
    
    next();
  } catch (error) {
    console.error('❌ Session cache middleware error:', error);
    next(); // Continue without caching
  }
};

// Survey cache middleware
const surveyCacheMiddleware = async (req, res, next) => {
  // Skip caching if Redis is disabled
  if (process.env.REDIS_DISABLED === 'true') {
    return next();
  }
  
  try {
    const surveyId = req.params.surveyId || req.body.surveyId;
    
    if (surveyId) {
      const cacheKey = cacheService.buildSurveyKey(surveyId);
      const cachedSurvey = await cacheService.get(cacheKey);
      
      if (cachedSurvey) {
        console.log(`📦 Survey cache hit for: ${surveyId}`);
        req.cachedSurvey = cachedSurvey;
      }
    }
    
    next();
  } catch (error) {
    console.error('❌ Survey cache middleware error:', error);
    next(); // Continue without caching
  }
};

// Analytics cache middleware
const analyticsCacheMiddleware = async (req, res, next) => {
  // Skip caching if Redis is disabled
  if (process.env.REDIS_DISABLED === 'true') {
    return next();
  }
  
  try {
    const type = req.params.type || req.query.type || 'daily';
    const date = req.params.date || req.query.date || new Date().toISOString().split('T')[0];
    
    const cacheKey = cacheService.buildAnalyticsKey(type, date);
    const cachedAnalytics = await cacheService.get(cacheKey);
    
    if (cachedAnalytics) {
      console.log(`📦 Analytics cache hit for: ${type}:${date}`);
      return res.json({
        success: true,
        data: cachedAnalytics,
        cached: true
      });
    }
    
    // Store original res.json method
    const originalJson = res.json;
    
    // Override res.json to cache the response
    res.json = function(data) {
      if (data.success && data.data) {
        // Cache the analytics data
        cacheService.set(cacheKey, data.data, CACHE_TTL.ANALYTICS).then(() => {
          console.log(`💾 Cached analytics for: ${type}:${date}`);
        }).catch(error => {
          console.error('❌ Analytics cache set error:', error);
        });
      }
      
      // Call original json method
      return originalJson.call(this, data);
    };
    
    next();
  } catch (error) {
    console.error('❌ Analytics cache middleware error:', error);
    next(); // Continue without caching
  }
};

// Rate limiting cache middleware
const rateLimitCacheMiddleware = async (req, res, next) => {
  // Skip caching if Redis is disabled
  if (process.env.REDIS_DISABLED === 'true') {
    req.rateLimitCount = 0; // Default to 0 when Redis is disabled
    return next();
  }
  
  try {
    const identifier = req.ip || req.connection.remoteAddress;
    const cacheKey = cacheService.buildRateLimitKey(identifier);
    
    // Check current rate limit count
    const currentCount = await cacheService.get(cacheKey) || 0;
    
    // Add to request for rate limiting logic
    req.rateLimitCount = currentCount;
    
    next();
  } catch (error) {
    console.error('❌ Rate limit cache middleware error:', error);
    req.rateLimitCount = 0; // Default to 0 on error
    next(); // Continue without caching
  }
};

// Cache invalidation middleware
const cacheInvalidationMiddleware = (patterns = []) => {
  return async (req, res, next) => {
    // Skip cache invalidation if Redis is disabled
    if (process.env.REDIS_DISABLED === 'true') {
      return next();
    }
    
    try {
      // Store original res.json method
      const originalJson = res.json;
      
      // Override res.json to invalidate cache after successful operations
      res.json = function(data) {
        if (data.success) {
          // Invalidate cache patterns
          patterns.forEach(pattern => {
            cacheService.delete(pattern).then(() => {
              console.log(`🗑️ Invalidated cache pattern: ${pattern}`);
            }).catch(error => {
              console.error('❌ Cache invalidation error:', error);
            });
          });
        }
        
        // Call original json method
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      console.error('❌ Cache invalidation middleware error:', error);
      next(); // Continue without cache invalidation
    }
  };
};

// Cache statistics middleware
const cacheStatsMiddleware = async (req, res, next) => {
  // Skip cache stats if Redis is disabled
  if (process.env.REDIS_DISABLED === 'true') {
    req.cacheStats = null; // No cache stats when Redis is disabled
    return next();
  }
  
  try {
    const stats = await cacheService.getStats();
    
    if (stats) {
      req.cacheStats = stats;
    }
    
    next();
  } catch (error) {
    console.error('❌ Cache stats middleware error:', error);
    req.cacheStats = null; // No cache stats on error
    next(); // Continue without cache stats
  }
};


module.exports = {
  cacheMiddleware,
  sessionCacheMiddleware,
  surveyCacheMiddleware,
  analyticsCacheMiddleware,
  rateLimitCacheMiddleware,
  cacheInvalidationMiddleware,
  cacheStatsMiddleware
};
