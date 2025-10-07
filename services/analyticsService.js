const Survey = require('../models/Survey');
const Analytics = require('../models/Analytics');

class AnalyticsService {
  
  // Generate daily analytics
  static async generateDailyAnalytics(date = new Date()) {
    try {
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
      
      // Check if analytics already exist for this date
      let analytics = await Analytics.findOne({
        date: startOfDay,
        type: 'daily'
      });
      
      if (!analytics) {
        analytics = new Analytics({
          date: startOfDay,
          type: 'daily'
        });
      }
      
      // Get surveys for this date
      const surveys = await Survey.find({
        submittedAt: {
          $gte: startOfDay,
          $lt: endOfDay
        }
      });
      
      // Reset counters
      analytics.totalSurveys = 0;
      analytics.demographics = this.resetDemographics();
      analytics.phoneUsage = this.resetPhoneUsage();
      analytics.socialMedia = this.resetSocialMedia();
      analytics.skills = this.resetSkills();
      analytics.preferences = this.resetPreferences();
      analytics.ambassador = this.resetAmbassador();
      analytics.tecnoExperience = this.resetTecnoExperience();
      
      // Process each survey
      for (const survey of surveys) {
        await this.processSurveyData(analytics, survey);
      }
      
      // Calculate metadata
      analytics.metadata.totalResponses = surveys.length;
      analytics.metadata.completionRate = surveys.length > 0 ? 100 : 0;
      
      await analytics.save();
      
      console.log(`✅ Daily analytics generated for ${startOfDay.toISOString().split('T')[0]}: ${surveys.length} surveys`);
      
      return analytics;
      
    } catch (error) {
      console.error('❌ Error generating daily analytics:', error);
      throw error;
    }
  }
  
  // Generate weekly analytics
  static async generateWeeklyAnalytics(date = new Date()) {
    try {
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      
      // Check if analytics already exist for this week
      let analytics = await Analytics.findOne({
        date: startOfWeek,
        type: 'weekly'
      });
      
      if (!analytics) {
        analytics = new Analytics({
          date: startOfWeek,
          type: 'weekly'
        });
      }
      
      // Get surveys for this week
      const surveys = await Survey.find({
        submittedAt: {
          $gte: startOfWeek,
          $lt: endOfWeek
        }
      });
      
      // Reset counters
      analytics.totalSurveys = 0;
      analytics.demographics = this.resetDemographics();
      analytics.phoneUsage = this.resetPhoneUsage();
      analytics.socialMedia = this.resetSocialMedia();
      analytics.skills = this.resetSkills();
      analytics.preferences = this.resetPreferences();
      analytics.ambassador = this.resetAmbassador();
      analytics.tecnoExperience = this.resetTecnoExperience();
      
      // Process each survey
      for (const survey of surveys) {
        await this.processSurveyData(analytics, survey);
      }
      
      // Calculate metadata
      analytics.metadata.totalResponses = surveys.length;
      analytics.metadata.completionRate = surveys.length > 0 ? 100 : 0;
      
      await analytics.save();
      
      console.log(`✅ Weekly analytics generated for week starting ${startOfWeek.toISOString().split('T')[0]}: ${surveys.length} surveys`);
      
      return analytics;
      
    } catch (error) {
      console.error('❌ Error generating weekly analytics:', error);
      throw error;
    }
  }
  
  // Generate monthly analytics
  static async generateMonthlyAnalytics(date = new Date()) {
    try {
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      
      // Check if analytics already exist for this month
      let analytics = await Analytics.findOne({
        date: startOfMonth,
        type: 'monthly'
      });
      
      if (!analytics) {
        analytics = new Analytics({
          date: startOfMonth,
          type: 'monthly'
        });
      }
      
      // Get surveys for this month
      const surveys = await Survey.find({
        submittedAt: {
          $gte: startOfMonth,
          $lt: endOfMonth
        }
      });
      
      // Reset counters
      analytics.totalSurveys = 0;
      analytics.demographics = this.resetDemographics();
      analytics.phoneUsage = this.resetPhoneUsage();
      analytics.socialMedia = this.resetSocialMedia();
      analytics.skills = this.resetSkills();
      analytics.preferences = this.resetPreferences();
      analytics.ambassador = this.resetAmbassador();
      analytics.tecnoExperience = this.resetTecnoExperience();
      
      // Process each survey
      for (const survey of surveys) {
        await this.processSurveyData(analytics, survey);
      }
      
      // Calculate metadata
      analytics.metadata.totalResponses = surveys.length;
      analytics.metadata.completionRate = surveys.length > 0 ? 100 : 0;
      
      await analytics.save();
      
      console.log(`✅ Monthly analytics generated for ${startOfMonth.toISOString().split('T')[0]}: ${surveys.length} surveys`);
      
      return analytics;
      
    } catch (error) {
      console.error('❌ Error generating monthly analytics:', error);
      throw error;
    }
  }
  
  // Process individual survey data
  static async processSurveyData(analytics, survey) {
    analytics.totalSurveys++;
    
    // Demographics
    if (survey.gender) {
      analytics.demographics.gender[survey.gender] = (analytics.demographics.gender[survey.gender] || 0) + 1;
    }
    
    if (survey.yearOfStudy) {
      analytics.demographics.yearOfStudy[survey.yearOfStudy] = (analytics.demographics.yearOfStudy[survey.yearOfStudy] || 0) + 1;
    }
    
    if (survey.fieldOfStudy) {
      analytics.demographics.fieldOfStudy[survey.fieldOfStudy] = (analytics.demographics.fieldOfStudy[survey.fieldOfStudy] || 0) + 1;
    }
    
    if (survey.university) {
      analytics.demographics.university[survey.university] = (analytics.demographics.university[survey.university] || 0) + 1;
    }
    
    // Phone usage
    if (survey.currentPhoneBrand) {
      analytics.phoneUsage.brands[survey.currentPhoneBrand] = (analytics.phoneUsage.brands[survey.currentPhoneBrand] || 0) + 1;
    }
    
    if (survey.phoneChangeFrequency) {
      analytics.phoneUsage.changeFrequency[survey.phoneChangeFrequency] = (analytics.phoneUsage.changeFrequency[survey.phoneChangeFrequency] || 0) + 1;
    }
    
    if (survey.topPhoneFunctions && Array.isArray(survey.topPhoneFunctions)) {
      survey.topPhoneFunctions.forEach(func => {
        analytics.phoneUsage.topFunctions[func] = (analytics.phoneUsage.topFunctions[func] || 0) + 1;
      });
    }
    
    // Social media
    if (survey.socialMediaPlatforms && Array.isArray(survey.socialMediaPlatforms)) {
      survey.socialMediaPlatforms.forEach(platform => {
        analytics.socialMedia.platforms[platform] = (analytics.socialMedia.platforms[platform] || 0) + 1;
      });
    }
    
    if (survey.timeSpentOnSocialMedia) {
      analytics.socialMedia.timeSpent[survey.timeSpentOnSocialMedia] = (analytics.socialMedia.timeSpent[survey.timeSpentOnSocialMedia] || 0) + 1;
    }
    
    if (survey.followsTechContent) {
      analytics.socialMedia.techContentFollowing[survey.followsTechContent] = (analytics.socialMedia.techContentFollowing[survey.followsTechContent] || 0) + 1;
    }
    
    // Skills and work
    if (survey.learningSkills && Array.isArray(survey.learningSkills)) {
      survey.learningSkills.forEach(skill => {
        analytics.skills.learningSkills[skill] = (analytics.skills.learningSkills[skill] || 0) + 1;
      });
    }
    
    if (survey.partTimeWork && Array.isArray(survey.partTimeWork)) {
      survey.partTimeWork.forEach(work => {
        analytics.skills.partTimeWork[work] = (analytics.skills.partTimeWork[work] || 0) + 1;
      });
    }
    
    // Preferences
    if (survey.phoneBudget) {
      analytics.preferences.budget[survey.phoneBudget] = (analytics.preferences.budget[survey.phoneBudget] || 0) + 1;
    }
    
    if (survey.preferredPhoneColors && Array.isArray(survey.preferredPhoneColors)) {
      survey.preferredPhoneColors.forEach(color => {
        analytics.preferences.colors[color] = (analytics.preferences.colors[color] || 0) + 1;
      });
    }
    
    // Ambassador program
    if (survey.interestedInAmbassador) {
      analytics.ambassador.interested++;
    } else {
      analytics.ambassador.notInterested++;
    }
    
    if (survey.ambassadorStrengths && Array.isArray(survey.ambassadorStrengths)) {
      survey.ambassadorStrengths.forEach(strength => {
        analytics.ambassador.strengths[strength] = (analytics.ambassador.strengths[strength] || 0) + 1;
      });
    }
    
    if (survey.ambassadorBenefits && Array.isArray(survey.ambassadorBenefits)) {
      survey.ambassadorBenefits.forEach(benefit => {
        analytics.ambassador.benefits[benefit] = (analytics.ambassador.benefits[benefit] || 0) + 1;
      });
    }
    
    // TECNO experience
    if (survey.tecnoExperience) {
      analytics.tecnoExperience[survey.tecnoExperience] = (analytics.tecnoExperience[survey.tecnoExperience] || 0) + 1;
    }
  }
  
  // Reset helper methods
  static resetDemographics() {
    return {
      gender: { male: 0, female: 0, 'prefer-not-to-say': 0 },
      yearOfStudy: { 'first-year': 0, 'second-year': 0, 'third-year': 0, 'fourth-year': 0, 'post-graduate': 0 },
      fieldOfStudy: { 'liberal-arts': 0, 'science': 0, 'engineering': 0, 'arts': 0, 'other': 0 },
      university: { 'uol': 0, 'ucp': 0, 'umt': 0, 'iac': 0, 'bnu': 0, 'fccu': 0, 'gc': 0, 'other': 0 }
    };
  }
  
  static resetPhoneUsage() {
    return {
      brands: { 'apple': 0, 'samsung': 0, 'oppo': 0, 'vivo': 0, 'tecno': 0, 'infinix': 0, 'realme': 0, 'redmi': 0, 'other': 0 },
      changeFrequency: { 'less-than-1-year': 0, '1-2-years': 0, '2-3-years': 0, 'more-than-3-years': 0 },
      topFunctions: { 'camera-video': 0, 'gaming': 0, 'communication': 0, 'study-work': 0, 'social-media': 0, 'watching-videos': 0, 'other': 0 }
    };
  }
  
  static resetSocialMedia() {
    return {
      platforms: { 'facebook': 0, 'instagram': 0, 'tiktok': 0, 'youtube': 0, 'snapchat': 0, 'other': 0 },
      timeSpent: { '0-1-hour': 0, '2-3-hours': 0, '4-5-hours': 0, '6-plus-hours': 0 },
      techContentFollowing: { 'often': 0, 'sometimes': 0, 'rarely': 0, 'never': 0 }
    };
  }
  
  static resetSkills() {
    return {
      learningSkills: { 'none': 0, 'web-development': 0, 'graphic-design': 0, 'video-editing': 0, 'trading': 0, 'programming': 0, 'digital-marketing': 0, 'ecommerce': 0, 'english-learning': 0, 'other': 0 },
      partTimeWork: { 'none': 0, 'freelancing-it': 0, 'freelancing-design': 0, 'content-creation': 0, 'video-creation': 0, 'online-trading': 0, 'teaching': 0, 'business': 0, 'food-delivery': 0, 'ride-hailing': 0, 'sales-marketing': 0, 'call-center': 0, 'other': 0 }
    };
  }
  
  static resetPreferences() {
    return {
      budget: { '20-30k': 0, '31-45k': 0, '46-60k': 0, '61-80k': 0, '81-100k': 0, 'above-100k': 0 },
      colors: { 'black': 0, 'white': 0, 'blue': 0, 'red': 0, 'green': 0, 'purple': 0, 'gold': 0, 'silver': 0, 'pink': 0, 'gray': 0 }
    };
  }
  
  static resetAmbassador() {
    return {
      interested: 0,
      notInterested: 0,
      strengths: { 'large-social-circle': 0, 'content-creation': 0, 'sharing-engaging': 0, 'tech-interested': 0, 'campus-events': 0, 'other': 0 },
      benefits: { 'free-trial': 0, 'merchandise': 0, 'training': 0, 'internship': 0, 'certificates': 0, 'other': 0 }
    };
  }
  
  static resetTecnoExperience() {
    return { 'yes-used': 0, 'heard-of': 0, 'never-heard': 0 };
  }
  
  // Get aggregated statistics
  static async getAggregatedStats(date = new Date(), type = 'daily') {
    try {
      let analytics;
      
      switch (type) {
        case 'daily':
          analytics = await Analytics.getDailyStats(date);
          break;
        case 'weekly':
          analytics = await Analytics.getWeeklyStats(date);
          break;
        case 'monthly':
          analytics = await Analytics.getMonthlyStats(date);
          break;
        default:
          throw new Error('Invalid analytics type');
      }
      
      if (!analytics) {
        // Generate analytics if they don't exist
        switch (type) {
          case 'daily':
            analytics = await this.generateDailyAnalytics(date);
            break;
          case 'weekly':
            analytics = await this.generateWeeklyAnalytics(date);
            break;
          case 'monthly':
            analytics = await this.generateMonthlyAnalytics(date);
            break;
        }
      }
      
      return analytics;
      
    } catch (error) {
      console.error('❌ Error getting aggregated stats:', error);
      throw error;
    }
  }
  
  // Get trend data
  static async getTrendData(days = 30, type = 'daily') {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
      
      const analytics = await Analytics.find({
        date: { $gte: startDate, $lte: endDate },
        type: type
      }).sort({ date: 1 });
      
      return analytics;
      
    } catch (error) {
      console.error('❌ Error getting trend data:', error);
      throw error;
    }
  }
}

module.exports = AnalyticsService;
