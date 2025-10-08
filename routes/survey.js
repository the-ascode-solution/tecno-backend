const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Survey = require('../models/Survey');

// @route   POST /api/survey/submit
// @desc    Submit survey data
// @access  Public
router.post('/submit', async (req, res) => {
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
    console.log('📝 Survey submission received:', {
      timestamp: new Date().toISOString(),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      dataKeys: Object.keys(req.body)
    });

    // Whitelist and normalize input fields
    const allowedFields = new Set([
      'gender',
      'yearOfStudy',
      'fieldOfStudy',
      'university',
      'socialMediaPlatforms',
      'timeSpentOnSocialMedia',
      'followsTechContent',
      'techUpdateSources',
      'currentPhoneBrand',
      'topPhoneFunctions',
      'phoneChangeFrequency',
      'tecnoExperience',
      'tecnoExperienceRating',
      'learningSkills',
      'partTimeWork',
      'phoneFeaturesRanking',
      'phoneBudget',
      'preferredPhoneColors',
      'interestedInAmbassador',
      'ambassadorStrengths',
      'ambassadorBenefits',
      'name',
      'contactNumber',
      'socialMediaLink',
      'followerCount',
      'suggestions'
    ]);

    const arrayFields = new Set([
      'socialMediaPlatforms',
      'techUpdateSources',
      'topPhoneFunctions',
      'learningSkills',
      'partTimeWork',
      'phoneFeaturesRanking',
      'preferredPhoneColors',
      'ambassadorStrengths',
      'ambassadorBenefits'
    ]);

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const sanitized = {};
    for (const key of Object.keys(body)) {
      if (!allowedFields.has(key)) continue;
      const value = body[key];
      if (arrayFields.has(key)) {
        if (Array.isArray(value)) {
          sanitized[key] = value.filter(v => v != null).map(v => String(v));
        } else if (value != null && value !== '') {
          sanitized[key] = [String(value)];
        } else {
          sanitized[key] = [];
        }
      } else if (key === 'interestedInAmbassador') {
        sanitized[key] = Boolean(value);
      } else {
        sanitized[key] = value == null ? '' : String(value);
      }
    }

    // Add metadata to the survey data
    const surveyData = {
      ...sanitized,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      submittedAt: new Date()
    };

    // Validate required fields (optional - adjust based on your requirements)
    if (!surveyData.gender && !surveyData.yearOfStudy) {
      console.warn('⚠️ Survey submitted with minimal data');
    }

    // Create new survey document
    const survey = new Survey(surveyData);
    
    // Save to database
    await survey.save();

    console.log('✅ Survey saved successfully:', {
      id: survey._id,
      submittedAt: survey.submittedAt
    });

    res.status(201).json({
      success: true,
      message: 'Survey submitted successfully',
      data: {
        id: survey._id,
        submittedAt: survey.submittedAt
      }
    });

  } catch (error) {
    console.error('❌ Survey submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit survey',
      error: error.message
    });
  }
});

// @route   GET /api/survey/stats
// @desc    Get survey statistics (for admin purposes)
// @access  Public (you might want to add authentication)
router.get('/stats', async (req, res) => {
  try {
    const totalSurveys = await Survey.countDocuments();
    const ambassadorInterest = await Survey.countDocuments({ interestedInAmbassador: true });
    const universityStats = await Survey.aggregate([
      { $group: { _id: '$university', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        totalSurveys,
        ambassadorInterest,
        universityStats
      }
    });

  } catch (error) {
    console.error('Stats retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve statistics',
      error: error.message
    });
  }
});

// @route   GET /api/survey/recent
// @desc    Get recent survey submissions
// @access  Public (you might want to add authentication)
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const recentSurveys = await Survey.find()
      .sort({ submittedAt: -1 })
      .limit(limit)
      .select('-__v'); // Exclude version field

    res.json({
      success: true,
      data: recentSurveys
    });

  } catch (error) {
    console.error('Recent surveys retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve recent surveys',
      error: error.message
    });
  }
});

module.exports = router;


