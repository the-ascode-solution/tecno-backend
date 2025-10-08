const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Session = require('../models/Session');
const Survey = require('../models/Survey');
const { 
  sessionCreationLimiter, 
  surveySubmissionLimiter,
  progressSavingLimiter,
  statusCheckLimiter
} = require('../middleware/rateLimiting');
const { auditManager } = require('../middleware/audit');
const { validateSession } = require('../middleware/authentication');
const { 
  sessionCacheMiddleware,
  cacheInvalidationMiddleware
} = require('../middleware/cache');
const { cacheService, CACHE_TTL } = require('../config/redis');

// @route   POST /api/session/create
// @desc    Create a new survey session
// @access  Public
router.post('/create', sessionCreationLimiter, async (req, res) => {
  try {
    // Check if database is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ Database not ready, waiting for connection...');
      // Wait for connection with timeout
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Database connection timeout')), 5000);
        mongoose.connection.once('connected', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    const sessionId = uuidv4();
    const sessionData = {
      sessionId,
      userId: req.body.userId || null,
      metadata: {
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        deviceType: req.body.deviceType || 'unknown',
        browser: req.body.browser || 'unknown'
      }
    };

    const session = new Session(sessionData);
    await session.save();

    // Cache the session data
    const cacheKey = cacheService.buildSessionKey(sessionId);
    await cacheService.set(cacheKey, session.toObject(), CACHE_TTL.SESSION);

    res.status(201).json({
      success: true,
      message: 'Session created successfully',
      data: {
        sessionId,
        currentPage: session.currentPage,
        totalPages: session.totalPages,
        createdAt: session.timestamps.createdAt
      }
    });

  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create session',
      error: error.message
    });
  }
});

// @route   PUT /api/session/:sessionId/save-progress
// @desc    Save progress for a specific page
// @access  Public
router.put('/:sessionId/save-progress', progressSavingLimiter, validateSession, sessionCacheMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { page, data } = req.body;

    if (page === undefined || page < 0 || page >= 8) {
      return res.status(400).json({
        success: false,
        message: 'Invalid page number'
      });
    }

    // Try to get session from cache first
    let session = req.cachedSession;
    
    if (!session) {
      session = await Session.findOne({ sessionId, status: 'active' });
    } else {
      // Convert cached session back to Mongoose document
      session = new Session(session);
    }
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or expired'
      });
    }

    // Update session data
    session.surveyData = { ...session.surveyData, ...data };
    session.currentPage = Math.max(session.currentPage, page);
    await session.updateActivity();

    // Update cache
    const cacheKey = cacheService.buildSessionKey(sessionId);
    await cacheService.set(cacheKey, session.toObject(), CACHE_TTL.SESSION);

    res.json({
      success: true,
      message: 'Progress saved successfully',
      data: {
        sessionId,
        currentPage: session.currentPage,
        lastActivity: session.timestamps.lastActivity
      }
    });

  } catch (error) {
    console.error('Progress save error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save progress',
      error: error.message
    });
  }
});

// @route   GET /api/session/:sessionId/status
// @desc    Get session status and progress
// @access  Public
router.get('/:sessionId/status', statusCheckLimiter, validateSession, sessionCacheMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Try to get session from cache first
    let session = req.cachedSession;
    
    if (!session) {
      session = await Session.findOne({ sessionId });
      
      if (session) {
        // Cache the session data
        const cacheKey = cacheService.buildSessionKey(sessionId);
        await cacheService.set(cacheKey, session.toObject(), CACHE_TTL.SESSION);
      }
    }
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        status: session.status,
        currentPage: session.currentPage,
        totalPages: session.totalPages,
        createdAt: session.timestamps.createdAt,
        lastActivity: session.timestamps.lastActivity,
        surveyData: session.surveyData
      }
    });

  } catch (error) {
    console.error('Session status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get session status',
      error: error.message
    });
  }
});

// @route   POST /api/session/:sessionId/submit
// @desc    Submit completed survey
// @access  Public
router.post('/:sessionId/submit', surveySubmissionLimiter, validateSession, sessionCacheMiddleware, cacheInvalidationMiddleware(['analytics:*', 'survey:stats']), async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Try to get session from cache first
    let session = req.cachedSession;
    
    if (!session) {
      session = await Session.findOne({ sessionId, status: 'active' });
    } else {
      // Convert cached session back to Mongoose document
      session = new Session(session);
    }
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or expired'
      });
    }

    // Create survey document
    const surveyData = {
      ...session.surveyData,
      ipAddress: session.metadata.ipAddress,
      userAgent: session.metadata.userAgent,
      submittedAt: new Date()
    };

    const survey = new Survey(surveyData);
    await survey.save();

    // Cache the survey data
    const surveyCacheKey = cacheService.buildSurveyKey(survey._id);
    await cacheService.set(surveyCacheKey, survey.toObject(), CACHE_TTL.SURVEY);

    // Remove session document from database after successful submission
    await Session.deleteOne({ sessionId });

    // Remove session from cache
    const sessionCacheKey = cacheService.buildSessionKey(sessionId);
    await cacheService.delete(sessionCacheKey);

    // Audit explicit session deletion after submission
    try {
      await auditManager.logEvent({
        category: 'data_modification',
        action: 'delete',
        resource: 'session',
        user: req.user?.id || 'anonymous',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        details: {
          method: req.method,
          url: req.originalUrl,
          sessionId: sessionId,
          surveyId: survey._id,
          submittedAt: survey.submittedAt
        },
        outcome: 'success',
        risk: 'low'
      });
    } catch (e) {
      // Best-effort audit logging; do not fail submission if audit write fails
      console.warn('Audit log failed for session deletion:', e.message);
    }

    res.status(201).json({
      success: true,
      message: 'Survey submitted successfully',
      data: {
        sessionId,
        surveyId: survey._id,
        submittedAt: survey.submittedAt
      }
    });

  } catch (error) {
    console.error('Survey submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit survey',
      error: error.message
    });
  }
});

// @route   DELETE /api/session/:sessionId
// @desc    Delete/abandon a session
// @access  Public
router.delete('/:sessionId', validateSession, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findOne({ sessionId });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    if (session.status === 'active') {
      session.status = 'abandoned';
      await session.save();
    }

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });

  } catch (error) {
    console.error('Session deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete session',
      error: error.message
    });
  }
});

// @route   GET /api/session/stats
// @desc    Get session statistics
// @access  Public
router.get('/stats', async (req, res) => {
  try {
    const activeSessions = await Session.countDocuments({ status: 'active' });
    const completedSessions = await Session.countDocuments({ status: 'completed' });
    const abandonedSessions = await Session.countDocuments({ status: 'abandoned' });
    
    const recentSessions = await Session.find()
      .sort({ 'timestamps.createdAt': -1 })
      .limit(10)
      .select('sessionId status currentPage timestamps.createdAt');

    res.json({
      success: true,
      data: {
        activeSessions,
        completedSessions,
        abandonedSessions,
        recentSessions
      }
    });

  } catch (error) {
    console.error('Session stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get session statistics',
      error: error.message
    });
  }
});

module.exports = router;
