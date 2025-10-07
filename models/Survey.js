const mongoose = require('mongoose');

const surveySchema = new mongoose.Schema({
  // Basic Information
  gender: {
    type: String,
    required: false
  },
  yearOfStudy: {
    type: String,
    required: false
  },
  fieldOfStudy: {
    type: String,
    required: false
  },
  university: {
    type: String,
    required: false
  },
  
  // Social Media Habits
  socialMediaPlatforms: [{
    type: String
  }],
  timeSpentOnSocialMedia: {
    type: String,
    required: false
  },
  followsTechContent: {
    type: String,
    required: false
  },
  techUpdateSources: [{
    type: String
  }],
  
  // Mobile Phone Usage
  currentPhoneBrand: {
    type: String,
    required: false
  },
  topPhoneFunctions: [{
    type: String
  }],
  phoneChangeFrequency: {
    type: String,
    required: false
  },
  tecnoExperience: {
    type: String,
    required: false
  },
  tecnoExperienceRating: {
    type: String,
    required: false
  },
  
  // Skills & Work
  learningSkills: [{
    type: String
  }],
  partTimeWork: [{
    type: String
  }],
  
  // What Matters Most in a New Phone
  phoneFeaturesRanking: [{
    type: String
  }],
  phoneBudget: {
    type: String,
    required: false
  },
  preferredPhoneColors: [{
    type: String
  }],
  
  // TECNO Campus Brand Ambassador Program
  interestedInAmbassador: {
    type: Boolean,
    default: false
  },
  ambassadorStrengths: [{
    type: String
  }],
  ambassadorBenefits: [{
    type: String
  }],
  name: {
    type: String,
    required: false
  },
  contactNumber: {
    type: String,
    required: false
  },
  socialMediaLink: {
    type: String,
    required: false
  },
  followerCount: {
    type: String,
    required: false
  },
  
  // Suggestions
  suggestions: {
    type: String,
    required: false
  },
  
  // Metadata
  submittedAt: {
    type: Date,
    default: Date.now
  },
  ipAddress: {
    type: String,
    required: false
  },
  userAgent: {
    type: String,
    required: false
  }
}, {
  timestamps: true
});

// Create indexes for better query performance
surveySchema.index({ submittedAt: -1 });
surveySchema.index({ university: 1 });
surveySchema.index({ interestedInAmbassador: 1 });

// Additional performance indexes
surveySchema.index({ ipAddress: 1 });
surveySchema.index({ userAgent: 1 });
surveySchema.index({ gender: 1, yearOfStudy: 1 });
surveySchema.index({ currentPhoneBrand: 1 });
surveySchema.index({ fieldOfStudy: 1, university: 1 });
surveySchema.index({ phoneBudget: 1 });
surveySchema.index({ 'socialMediaPlatforms': 1 });
surveySchema.index({ 'learningSkills': 1 });
surveySchema.index({ 'partTimeWork': 1 });

// Compound indexes for complex queries
surveySchema.index({ 
  university: 1, 
  fieldOfStudy: 1, 
  submittedAt: -1 
});

surveySchema.index({ 
  interestedInAmbassador: 1, 
  submittedAt: -1 
});

surveySchema.index({ 
  currentPhoneBrand: 1, 
  phoneBudget: 1 
});

// Text index for search functionality
surveySchema.index({ 
  name: 'text', 
  suggestions: 'text' 
});

// Sparse indexes for optional fields
surveySchema.index({ contactNumber: 1 }, { sparse: true });
surveySchema.index({ socialMediaLink: 1 }, { sparse: true });

module.exports = mongoose.model('Survey', surveySchema);
