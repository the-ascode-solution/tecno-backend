const mongoose = require('mongoose');

// Analytics aggregation model for better performance
const analyticsSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    required: true,
    index: true
  },
  
  // Survey statistics
  totalSurveys: {
    type: Number,
    default: 0
  },
  
  // Demographic breakdown
  demographics: {
    gender: {
      male: { type: Number, default: 0 },
      female: { type: Number, default: 0 },
      'prefer-not-to-say': { type: Number, default: 0 }
    },
    yearOfStudy: {
      'first-year': { type: Number, default: 0 },
      'second-year': { type: Number, default: 0 },
      'third-year': { type: Number, default: 0 },
      'fourth-year': { type: Number, default: 0 },
      'post-graduate': { type: Number, default: 0 }
    },
    fieldOfStudy: {
      'liberal-arts': { type: Number, default: 0 },
      'science': { type: Number, default: 0 },
      'engineering': { type: Number, default: 0 },
      'arts': { type: Number, default: 0 },
      'other': { type: Number, default: 0 }
    },
    university: {
      'uol': { type: Number, default: 0 },
      'ucp': { type: Number, default: 0 },
      'umt': { type: Number, default: 0 },
      'iac': { type: Number, default: 0 },
      'bnu': { type: Number, default: 0 },
      'fccu': { type: Number, default: 0 },
      'gc': { type: Number, default: 0 },
      'other': { type: Number, default: 0 }
    }
  },
  
  // Mobile phone usage
  phoneUsage: {
    brands: {
      'apple': { type: Number, default: 0 },
      'samsung': { type: Number, default: 0 },
      'oppo': { type: Number, default: 0 },
      'vivo': { type: Number, default: 0 },
      'tecno': { type: Number, default: 0 },
      'infinix': { type: Number, default: 0 },
      'realme': { type: Number, default: 0 },
      'redmi': { type: Number, default: 0 },
      'other': { type: Number, default: 0 }
    },
    changeFrequency: {
      'less-than-1-year': { type: Number, default: 0 },
      '1-2-years': { type: Number, default: 0 },
      '2-3-years': { type: Number, default: 0 },
      'more-than-3-years': { type: Number, default: 0 }
    },
    topFunctions: {
      'camera-video': { type: Number, default: 0 },
      'gaming': { type: Number, default: 0 },
      'communication': { type: Number, default: 0 },
      'study-work': { type: Number, default: 0 },
      'social-media': { type: Number, default: 0 },
      'watching-videos': { type: Number, default: 0 },
      'other': { type: Number, default: 0 }
    }
  },
  
  // Social media habits
  socialMedia: {
    platforms: {
      'facebook': { type: Number, default: 0 },
      'instagram': { type: Number, default: 0 },
      'tiktok': { type: Number, default: 0 },
      'youtube': { type: Number, default: 0 },
      'snapchat': { type: Number, default: 0 },
      'other': { type: Number, default: 0 }
    },
    timeSpent: {
      '0-1-hour': { type: Number, default: 0 },
      '2-3-hours': { type: Number, default: 0 },
      '4-5-hours': { type: Number, default: 0 },
      '6-plus-hours': { type: Number, default: 0 }
    },
    techContentFollowing: {
      'often': { type: Number, default: 0 },
      'sometimes': { type: Number, default: 0 },
      'rarely': { type: Number, default: 0 },
      'never': { type: Number, default: 0 }
    }
  },
  
  // Skills and work
  skills: {
    learningSkills: {
      'none': { type: Number, default: 0 },
      'web-development': { type: Number, default: 0 },
      'graphic-design': { type: Number, default: 0 },
      'video-editing': { type: Number, default: 0 },
      'trading': { type: Number, default: 0 },
      'programming': { type: Number, default: 0 },
      'digital-marketing': { type: Number, default: 0 },
      'ecommerce': { type: Number, default: 0 },
      'english-learning': { type: Number, default: 0 },
      'other': { type: Number, default: 0 }
    },
    partTimeWork: {
      'none': { type: Number, default: 0 },
      'freelancing-it': { type: Number, default: 0 },
      'freelancing-design': { type: Number, default: 0 },
      'content-creation': { type: Number, default: 0 },
      'video-creation': { type: Number, default: 0 },
      'online-trading': { type: Number, default: 0 },
      'teaching': { type: Number, default: 0 },
      'business': { type: Number, default: 0 },
      'food-delivery': { type: Number, default: 0 },
      'ride-hailing': { type: Number, default: 0 },
      'sales-marketing': { type: Number, default: 0 },
      'call-center': { type: Number, default: 0 },
      'other': { type: Number, default: 0 }
    }
  },
  
  // Phone preferences
  preferences: {
    budget: {
      '20-30k': { type: Number, default: 0 },
      '31-45k': { type: Number, default: 0 },
      '46-60k': { type: Number, default: 0 },
      '61-80k': { type: Number, default: 0 },
      '81-100k': { type: Number, default: 0 },
      'above-100k': { type: Number, default: 0 }
    },
    colors: {
      'black': { type: Number, default: 0 },
      'white': { type: Number, default: 0 },
      'blue': { type: Number, default: 0 },
      'red': { type: Number, default: 0 },
      'green': { type: Number, default: 0 },
      'purple': { type: Number, default: 0 },
      'gold': { type: Number, default: 0 },
      'silver': { type: Number, default: 0 },
      'pink': { type: Number, default: 0 },
      'gray': { type: Number, default: 0 }
    }
  },
  
  // Ambassador program
  ambassador: {
    interested: { type: Number, default: 0 },
    notInterested: { type: Number, default: 0 },
    strengths: {
      'large-social-circle': { type: Number, default: 0 },
      'content-creation': { type: Number, default: 0 },
      'sharing-engaging': { type: Number, default: 0 },
      'tech-interested': { type: Number, default: 0 },
      'campus-events': { type: Number, default: 0 },
      'other': { type: Number, default: 0 }
    },
    benefits: {
      'free-trial': { type: Number, default: 0 },
      'merchandise': { type: Number, default: 0 },
      'training': { type: Number, default: 0 },
      'internship': { type: Number, default: 0 },
      'certificates': { type: Number, default: 0 },
      'other': { type: Number, default: 0 }
    }
  },
  
  // TECNO experience
  tecnoExperience: {
    'yes-used': { type: Number, default: 0 },
    'heard-of': { type: Number, default: 0 },
    'never-heard': { type: Number, default: 0 }
  },
  
  // Metadata
  metadata: {
    totalResponses: { type: Number, default: 0 },
    averageCompletionTime: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
analyticsSchema.index({ date: -1, type: 1 });
analyticsSchema.index({ type: 1, date: -1 });

// Compound indexes for complex queries
analyticsSchema.index({ 
  type: 1, 
  date: -1, 
  totalSurveys: -1 
});

// Methods
analyticsSchema.methods.updateStats = function(surveyData) {
  this.totalSurveys++;
  
  // Update demographic stats
  if (surveyData.gender) {
    this.demographics.gender[surveyData.gender] = (this.demographics.gender[surveyData.gender] || 0) + 1;
  }
  
  if (surveyData.yearOfStudy) {
    this.demographics.yearOfStudy[surveyData.yearOfStudy] = (this.demographics.yearOfStudy[surveyData.yearOfStudy] || 0) + 1;
  }
  
  if (surveyData.fieldOfStudy) {
    this.demographics.fieldOfStudy[surveyData.fieldOfStudy] = (this.demographics.fieldOfStudy[surveyData.fieldOfStudy] || 0) + 1;
  }
  
  if (surveyData.university) {
    this.demographics.university[surveyData.university] = (this.demographics.university[surveyData.university] || 0) + 1;
  }
  
  // Update phone usage stats
  if (surveyData.currentPhoneBrand) {
    this.phoneUsage.brands[surveyData.currentPhoneBrand] = (this.phoneUsage.brands[surveyData.currentPhoneBrand] || 0) + 1;
  }
  
  if (surveyData.phoneChangeFrequency) {
    this.phoneUsage.changeFrequency[surveyData.phoneChangeFrequency] = (this.phoneUsage.changeFrequency[surveyData.phoneChangeFrequency] || 0) + 1;
  }
  
  // Update social media stats
  if (surveyData.socialMediaPlatforms && Array.isArray(surveyData.socialMediaPlatforms)) {
    surveyData.socialMediaPlatforms.forEach(platform => {
      this.socialMedia.platforms[platform] = (this.socialMedia.platforms[platform] || 0) + 1;
    });
  }
  
  if (surveyData.timeSpentOnSocialMedia) {
    this.socialMedia.timeSpent[surveyData.timeSpentOnSocialMedia] = (this.socialMedia.timeSpent[surveyData.timeSpentOnSocialMedia] || 0) + 1;
  }
  
  // Update ambassador stats
  if (surveyData.interestedInAmbassador) {
    this.ambassador.interested++;
  } else {
    this.ambassador.notInterested++;
  }
  
  return this.save();
};

// Static methods
analyticsSchema.statics.getDailyStats = function(date) {
  return this.findOne({ 
    date: { 
      $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
    },
    type: 'daily'
  });
};

analyticsSchema.statics.getWeeklyStats = function(date) {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  
  return this.findOne({ 
    date: { 
      $gte: startOfWeek,
      $lt: endOfWeek
    },
    type: 'weekly'
  });
};

analyticsSchema.statics.getMonthlyStats = function(date) {
  return this.findOne({ 
    date: { 
      $gte: new Date(date.getFullYear(), date.getMonth(), 1),
      $lt: new Date(date.getFullYear(), date.getMonth() + 1, 1)
    },
    type: 'monthly'
  });
};

module.exports = mongoose.model('Analytics', analyticsSchema);
