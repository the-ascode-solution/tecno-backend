const express = require('express');
const router = express.Router();
const AnalyticsService = require('../services/analyticsService');
const Survey = require('../models/Survey');
const { analyticsCacheMiddleware } = require('../middleware/cache');

// @route   GET /api/analytics/daily
// @desc    Get daily analytics
// @access  Public
router.get('/daily', analyticsCacheMiddleware, async (req, res) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const analytics = await AnalyticsService.getAggregatedStats(date, 'daily');
    
    res.json({
      success: true,
      data: analytics
    });
    
  } catch (error) {
    console.error('Daily analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get daily analytics',
      error: error.message
    });
  }
});

// @route   GET /api/analytics/weekly
// @desc    Get weekly analytics
// @access  Public
router.get('/weekly', analyticsCacheMiddleware, async (req, res) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const analytics = await AnalyticsService.getAggregatedStats(date, 'weekly');
    
    res.json({
      success: true,
      data: analytics
    });
    
  } catch (error) {
    console.error('Weekly analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get weekly analytics',
      error: error.message
    });
  }
});

// @route   GET /api/analytics/monthly
// @desc    Get monthly analytics
// @access  Public
router.get('/monthly', analyticsCacheMiddleware, async (req, res) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const analytics = await AnalyticsService.getAggregatedStats(date, 'monthly');
    
    res.json({
      success: true,
      data: analytics
    });
    
  } catch (error) {
    console.error('Monthly analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get monthly analytics',
      error: error.message
    });
  }
});

// @route   GET /api/analytics/trends
// @desc    Get trend data
// @access  Public
router.get('/trends', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const type = req.query.type || 'daily';
    
    const trends = await AnalyticsService.getTrendData(days, type);
    
    res.json({
      success: true,
      data: trends
    });
    
  } catch (error) {
    console.error('Trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get trend data',
      error: error.message
    });
  }
});

// @route   POST /api/analytics/generate
// @desc    Generate analytics for a specific period
// @access  Public
router.post('/generate', async (req, res) => {
  try {
    const { type, date } = req.body;
    
    if (!type || !['daily', 'weekly', 'monthly'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid analytics type. Must be daily, weekly, or monthly'
      });
    }
    
    const targetDate = date ? new Date(date) : new Date();
    let analytics;
    
    switch (type) {
      case 'daily':
        analytics = await AnalyticsService.generateDailyAnalytics(targetDate);
        break;
      case 'weekly':
        analytics = await AnalyticsService.generateWeeklyAnalytics(targetDate);
        break;
      case 'monthly':
        analytics = await AnalyticsService.generateMonthlyAnalytics(targetDate);
        break;
    }
    
    res.json({
      success: true,
      message: `${type} analytics generated successfully`,
      data: analytics
    });
    
  } catch (error) {
    console.error('Analytics generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate analytics',
      error: error.message
    });
  }
});

// @route   GET /api/analytics/overview
// @desc    Get overview statistics
// @access  Public
router.get('/overview', async (req, res) => {
  try {
    // Get total surveys
    const totalSurveys = await Survey.countDocuments();
    
    // Get today's surveys
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todaySurveys = await Survey.countDocuments({
      submittedAt: { $gte: today, $lt: tomorrow }
    });
    
    // Get this week's surveys
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const thisWeekSurveys = await Survey.countDocuments({
      submittedAt: { $gte: startOfWeek }
    });
    
    // Get this month's surveys
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const thisMonthSurveys = await Survey.countDocuments({
      submittedAt: { $gte: startOfMonth }
    });
    
    // Get ambassador interest
    const ambassadorInterest = await Survey.countDocuments({
      interestedInAmbassador: true
    });
    
    // Get top universities
    const topUniversities = await Survey.aggregate([
      { $group: { _id: '$university', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    // Get top phone brands
    const topPhoneBrands = await Survey.aggregate([
      { $group: { _id: '$currentPhoneBrand', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    res.json({
      success: true,
      data: {
        totalSurveys,
        todaySurveys,
        thisWeekSurveys,
        thisMonthSurveys,
        ambassadorInterest,
        topUniversities,
        topPhoneBrands
      }
    });
    
  } catch (error) {
    console.error('Overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get overview statistics',
      error: error.message
    });
  }
});

// @route   GET /api/analytics/demographics
// @desc    Get demographic breakdown
// @access  Public
router.get('/demographics', async (req, res) => {
  try {
    const { university, fieldOfStudy, yearOfStudy } = req.query;
    
    // Build match criteria
    const matchCriteria = {};
    if (university) matchCriteria.university = university;
    if (fieldOfStudy) matchCriteria.fieldOfStudy = fieldOfStudy;
    if (yearOfStudy) matchCriteria.yearOfStudy = yearOfStudy;
    
    // Get gender breakdown
    const genderBreakdown = await Survey.aggregate([
      { $match: matchCriteria },
      { $group: { _id: '$gender', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get year of study breakdown
    const yearBreakdown = await Survey.aggregate([
      { $match: matchCriteria },
      { $group: { _id: '$yearOfStudy', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get field of study breakdown
    const fieldBreakdown = await Survey.aggregate([
      { $match: matchCriteria },
      { $group: { _id: '$fieldOfStudy', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get university breakdown
    const universityBreakdown = await Survey.aggregate([
      { $match: matchCriteria },
      { $group: { _id: '$university', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        gender: genderBreakdown,
        yearOfStudy: yearBreakdown,
        fieldOfStudy: fieldBreakdown,
        university: universityBreakdown
      }
    });
    
  } catch (error) {
    console.error('Demographics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get demographic breakdown',
      error: error.message
    });
  }
});

// @route   GET /api/analytics/phone-usage
// @desc    Get phone usage analytics
// @access  Public
router.get('/phone-usage', async (req, res) => {
  try {
    // Get phone brand breakdown
    const phoneBrands = await Survey.aggregate([
      { $group: { _id: '$currentPhoneBrand', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get phone change frequency
    const changeFrequency = await Survey.aggregate([
      { $group: { _id: '$phoneChangeFrequency', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get top phone functions
    const topFunctions = await Survey.aggregate([
      { $unwind: '$topPhoneFunctions' },
      { $group: { _id: '$topPhoneFunctions', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Get TECNO experience
    const tecnoExperience = await Survey.aggregate([
      { $group: { _id: '$tecnoExperience', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        phoneBrands,
        changeFrequency,
        topFunctions,
        tecnoExperience
      }
    });
    
  } catch (error) {
    console.error('Phone usage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get phone usage analytics',
      error: error.message
    });
  }
});

// @route   GET /api/analytics/social-media
// @desc    Get social media analytics
// @access  Public
router.get('/social-media', async (req, res) => {
  try {
    // Get social media platforms
    const platforms = await Survey.aggregate([
      { $unwind: '$socialMediaPlatforms' },
      { $group: { _id: '$socialMediaPlatforms', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get time spent on social media
    const timeSpent = await Survey.aggregate([
      { $group: { _id: '$timeSpentOnSocialMedia', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get tech content following
    const techContent = await Survey.aggregate([
      { $group: { _id: '$followsTechContent', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        platforms,
        timeSpent,
        techContent
      }
    });
    
  } catch (error) {
    console.error('Social media error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get social media analytics',
      error: error.message
    });
  }
});

module.exports = router;
