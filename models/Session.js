const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: false
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'expired', 'abandoned'],
    default: 'active'
  },
  currentPage: {
    type: Number,
    default: 0
  },
  totalPages: {
    type: Number,
    default: 8
  },
  surveyData: {
    // Basic Information
    gender: { type: String, default: '' },
    yearOfStudy: { type: String, default: '' },
    fieldOfStudy: { type: String, default: '' },
    university: { type: String, default: '' },
    
    // Social Media Habits
    socialMediaPlatforms: [{ type: String }],
    timeSpentOnSocialMedia: { type: String, default: '' },
    followsTechContent: { type: String, default: '' },
    techUpdateSources: [{ type: String }],
    
    // Mobile Phone Usage
    currentPhoneBrand: { type: String, default: '' },
    topPhoneFunctions: [{ type: String }],
    phoneChangeFrequency: { type: String, default: '' },
    tecnoExperience: { type: String, default: '' },
    tecnoExperienceRating: { type: String, default: '' },
    
    // Skills & Work
    learningSkills: [{ type: String }],
    partTimeWork: [{ type: String }],
    
    // What Matters Most in a New Phone
    phoneFeaturesRanking: [{ type: String }],
    phoneBudget: { type: String, default: '' },
    preferredPhoneColors: [{ type: String }],
    
    // TECNO Campus Brand Ambassador Program
    interestedInAmbassador: { type: Boolean, default: false },
    ambassadorStrengths: [{ type: String }],
    ambassadorBenefits: [{ type: String }],
    name: { type: String, default: '' },
    contactNumber: { type: String, default: '' },
    socialMediaLink: { type: String, default: '' },
    followerCount: { type: String, default: '' },
    
    // Suggestions
    suggestions: { type: String, default: '' }
  },
  metadata: {
    ipAddress: { type: String },
    userAgent: { type: String },
    deviceType: { type: String },
    browser: { type: String }
  },
  timestamps: {
    createdAt: { type: Date, default: Date.now },
    lastActivity: { type: Date, default: Date.now },
    completedAt: { type: Date },
    expiredAt: { type: Date }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
sessionSchema.index({ sessionId: 1 });
sessionSchema.index({ status: 1 });
sessionSchema.index({ 'timestamps.createdAt': 1 });

// TTL index for automatic cleanup of expired sessions (24 hours)
sessionSchema.index({ 'timestamps.lastActivity': 1 }, { expireAfterSeconds: 86400 });

// Methods
sessionSchema.methods.updateActivity = function() {
  this.timestamps.lastActivity = new Date();
  return this.save();
};

sessionSchema.methods.completeSession = function() {
  this.status = 'completed';
  this.timestamps.completedAt = new Date();
  return this.save();
};

sessionSchema.methods.expireSession = function() {
  this.status = 'expired';
  this.timestamps.expiredAt = new Date();
  return this.save();
};

// Static methods
sessionSchema.statics.findActiveSessions = function() {
  return this.find({ status: 'active' });
};

sessionSchema.statics.cleanupExpiredSessions = function() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return this.updateMany(
    { 
      status: 'active',
      'timestamps.lastActivity': { $lt: oneHourAgo }
    },
    { 
      $set: { 
        status: 'expired',
        'timestamps.expiredAt': new Date()
      }
    }
  );
};

module.exports = mongoose.model('Session', sessionSchema);
