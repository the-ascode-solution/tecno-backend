const fs = require('fs').promises;
const path = require('path');
const { updateErrorMetrics } = require('./metrics');

// Audit logging and monitoring
class AuditManager {
  constructor() {
    this.auditDir = process.env.AUDIT_DIR || './audit-logs';
    this.maxLogSize = parseInt(process.env.MAX_AUDIT_LOG_SIZE) || 10 * 1024 * 1024; // 10MB
    this.maxLogFiles = parseInt(process.env.MAX_AUDIT_LOG_FILES) || 10;
    this.retentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS) || 90;
    
    // Audit categories
    this.categories = {
      AUTHENTICATION: 'authentication',
      AUTHORIZATION: 'authorization',
      DATA_ACCESS: 'data_access',
      DATA_MODIFICATION: 'data_modification',
      SYSTEM_CHANGES: 'system_changes',
      SECURITY_EVENTS: 'security_events',
      PERFORMANCE: 'performance',
      ERROR: 'error'
    };
    
    // Audit levels
    this.levels = {
      INFO: 'info',
      WARNING: 'warning',
      ERROR: 'error',
      CRITICAL: 'critical'
    };
    
    this.initialize();
  }

  // Initialize audit system
  async initialize() {
    try {
      await fs.mkdir(this.auditDir, { recursive: true });
      console.log(`✅ Audit system initialized: ${this.auditDir}`);
    } catch (error) {
      console.error('❌ Failed to initialize audit system:', error);
    }
  }

  // Log audit event
  async logEvent(event) {
    try {
      const auditEntry = {
        timestamp: new Date().toISOString(),
        level: event.level || this.levels.INFO,
        category: event.category || this.categories.SYSTEM_CHANGES,
        action: event.action,
        resource: event.resource,
        user: event.user || 'system',
        ip: event.ip || 'unknown',
        userAgent: event.userAgent || 'unknown',
        details: event.details || {},
        outcome: event.outcome || 'success',
        risk: event.risk || 'low',
        ...event
      };

      // Write to audit log file
      await this.writeToLogFile(auditEntry);
      
      // Check for high-risk events
      if (auditEntry.risk === 'high' || auditEntry.level === this.levels.CRITICAL) {
        await this.handleHighRiskEvent(auditEntry);
      }
      
      // Update metrics
      updateErrorMetrics('AuditEvent', auditEntry.level, 'audit');
      
    } catch (error) {
      console.error('❌ Audit logging failed:', error);
    }
  }

  // Write to log file
  async writeToLogFile(auditEntry) {
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.auditDir, `audit-${date}.json`);
    
    try {
      // Check if log file exists and get its size
      let logData = [];
      try {
        const existingData = await fs.readFile(logFile, 'utf8');
        logData = JSON.parse(existingData);
      } catch (error) {
        // File doesn't exist or is empty, start with empty array
      }
      
      // Add new entry
      logData.push(auditEntry);
      
      // Check if file size exceeds limit
      const logContent = JSON.stringify(logData, null, 2);
      if (logContent.length > this.maxLogSize) {
        // Rotate log file
        await this.rotateLogFile(logFile);
        logData = [auditEntry];
      }
      
      // Write updated log data
      await fs.writeFile(logFile, JSON.stringify(logData, null, 2));
      
    } catch (error) {
      console.error('❌ Failed to write audit log:', error);
    }
  }

  // Rotate log file
  async rotateLogFile(logFile) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedFile = logFile.replace('.json', `-${timestamp}.json`);
      
      // Rename current file
      await fs.rename(logFile, rotatedFile);
      
      // Cleanup old log files
      await this.cleanupOldLogFiles();
      
      console.log(`📁 Audit log rotated: ${rotatedFile}`);
      
    } catch (error) {
      console.error('❌ Log rotation failed:', error);
    }
  }

  // Cleanup old log files
  async cleanupOldLogFiles() {
    try {
      const files = await fs.readdir(this.auditDir);
      const auditFiles = files
        .filter(file => file.startsWith('audit-') && file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: path.join(this.auditDir, file),
          mtime: fs.stat(path.join(this.auditDir, file)).then(stats => stats.mtime)
        }));
      
      // Sort by modification time (newest first)
      const sortedFiles = await Promise.all(
        auditFiles.map(async file => ({
          ...file,
          mtime: await file.mtime
        }))
      );
      
      sortedFiles.sort((a, b) => b.mtime - a.mtime);
      
      // Remove old files
      const filesToRemove = sortedFiles.slice(this.maxLogFiles);
      for (const file of filesToRemove) {
        await fs.unlink(file.path);
        console.log(`🗑️ Removed old audit log: ${file.name}`);
      }
      
      // Remove files older than retention period
      const cutoffDate = new Date(Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000));
      for (const file of sortedFiles) {
        if (file.mtime < cutoffDate) {
          await fs.unlink(file.path);
          console.log(`🗑️ Removed expired audit log: ${file.name}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Audit log cleanup failed:', error);
    }
  }

  // Handle high-risk events
  async handleHighRiskEvent(auditEntry) {
    try {
      console.warn('🚨 High-risk audit event detected:', {
        action: auditEntry.action,
        user: auditEntry.user,
        ip: auditEntry.ip,
        risk: auditEntry.risk,
        level: auditEntry.level
      });
      
      // Create high-risk event log
      const highRiskLog = path.join(this.auditDir, 'high-risk-events.json');
      let highRiskEvents = [];
      
      try {
        const existingData = await fs.readFile(highRiskLog, 'utf8');
        highRiskEvents = JSON.parse(existingData);
      } catch (error) {
        // File doesn't exist, start with empty array
      }
      
      highRiskEvents.push(auditEntry);
      
      // Keep only last 1000 high-risk events
      if (highRiskEvents.length > 1000) {
        highRiskEvents = highRiskEvents.slice(-1000);
      }
      
      await fs.writeFile(highRiskLog, JSON.stringify(highRiskEvents, null, 2));
      
      // Send alert (in production, this would integrate with alerting system)
      await this.sendHighRiskAlert(auditEntry);
      
    } catch (error) {
      console.error('❌ High-risk event handling failed:', error);
    }
  }

  // Send high-risk alert
  async sendHighRiskAlert(auditEntry) {
    // In production, this would integrate with:
    // - Email notifications
    // - Slack/Discord webhooks
    // - SMS alerts
    // - PagerDuty integration
    
    console.warn('🚨 HIGH-RISK ALERT:', {
      timestamp: auditEntry.timestamp,
      action: auditEntry.action,
      user: auditEntry.user,
      ip: auditEntry.ip,
      risk: auditEntry.risk,
      level: auditEntry.level,
      details: auditEntry.details
    });
  }

  // Create audit middleware
  createAuditMiddleware(category, action, resource) {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Override res.json to capture response
      const originalJson = res.json;
      res.json = function(data) {
        const responseTime = Date.now() - startTime;
        
        // Log audit event
        auditManager.logEvent({
          category: category,
          action: action,
          resource: resource,
          user: req.user?.id || 'anonymous',
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          details: {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            responseTime: responseTime,
            requestBody: req.method !== 'GET' ? req.body : undefined
          },
          outcome: res.statusCode < 400 ? 'success' : 'failure',
          risk: auditManager.calculateRisk(req, res, responseTime)
        });
        
        return originalJson.call(res, data);
      };
      
      next();
    };
  }

  // Calculate risk level
  calculateRisk(req, res, responseTime) {
    let risk = 'low';
    
    // High risk factors
    if (res.statusCode >= 500) risk = 'high';
    if (responseTime > 10000) risk = 'high'; // 10 seconds
    if (req.method === 'DELETE') risk = 'medium';
    if (req.method === 'POST' && req.url.includes('/admin')) risk = 'high';
    if (req.user?.role === 'admin') risk = 'medium';
    
    return risk;
  }

  // Get audit statistics
  async getAuditStats() {
    try {
      const files = await fs.readdir(this.auditDir);
      const auditFiles = files.filter(file => file.startsWith('audit-') && file.endsWith('.json'));
      
      let totalEvents = 0;
      let highRiskEvents = 0;
      let errorEvents = 0;
      
      for (const file of auditFiles) {
        try {
          const filePath = path.join(this.auditDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const events = JSON.parse(content);
          
          totalEvents += events.length;
          highRiskEvents += events.filter(e => e.risk === 'high').length;
          errorEvents += events.filter(e => e.level === 'error' || e.level === 'critical').length;
        } catch (error) {
          console.error(`Failed to read audit file ${file}:`, error);
        }
      }
      
      return {
        totalEvents,
        highRiskEvents,
        errorEvents,
        auditFiles: auditFiles.length,
        retentionDays: this.retentionDays,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Failed to get audit stats:', error);
      throw error;
    }
  }

  // Search audit logs
  async searchAuditLogs(query) {
    try {
      const files = await fs.readdir(this.auditDir);
      const auditFiles = files.filter(file => file.startsWith('audit-') && file.endsWith('.json'));
      
      const results = [];
      
      for (const file of auditFiles) {
        try {
          const filePath = path.join(this.auditDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const events = JSON.parse(content);
          
          const matchingEvents = events.filter(event => {
            return Object.values(event).some(value => {
              if (typeof value === 'string') {
                return value.toLowerCase().includes(query.toLowerCase());
              }
              return false;
            });
          });
          
          results.push(...matchingEvents);
        } catch (error) {
          console.error(`Failed to search audit file ${file}:`, error);
        }
      }
      
      // Sort by timestamp (newest first)
      results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      return results;
      
    } catch (error) {
      console.error('❌ Audit log search failed:', error);
      throw error;
    }
  }

  // Export audit logs
  async exportAuditLogs(startDate, endDate, format = 'json') {
    try {
      const files = await fs.readdir(this.auditDir);
      const auditFiles = files.filter(file => file.startsWith('audit-') && file.endsWith('.json'));
      
      const results = [];
      
      for (const file of auditFiles) {
        try {
          const filePath = path.join(this.auditDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const events = JSON.parse(content);
          
          const filteredEvents = events.filter(event => {
            const eventDate = new Date(event.timestamp);
            return eventDate >= startDate && eventDate <= endDate;
          });
          
          results.push(...filteredEvents);
        } catch (error) {
          console.error(`Failed to export audit file ${file}:`, error);
        }
      }
      
      // Sort by timestamp (newest first)
      results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      if (format === 'csv') {
        return this.convertToCSV(results);
      }
      
      return results;
      
    } catch (error) {
      console.error('❌ Audit log export failed:', error);
      throw error;
    }
  }

  // Convert to CSV
  convertToCSV(events) {
    if (events.length === 0) return '';
    
    const headers = Object.keys(events[0]);
    const csvRows = [headers.join(',')];
    
    for (const event of events) {
      const values = headers.map(header => {
        const value = event[header];
        if (typeof value === 'object') {
          return JSON.stringify(value).replace(/"/g, '""');
        }
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }
}

// Export singleton instance
const auditManager = new AuditManager();

// Cleanup old logs daily
setInterval(() => {
  auditManager.cleanupOldLogFiles();
}, 24 * 60 * 60 * 1000);

// Middleware exports
const auditAuth = auditManager.createAuditMiddleware('authentication', 'login', 'user');
const auditDataAccess = auditManager.createAuditMiddleware('data_access', 'read', 'data');
const auditDataModification = auditManager.createAuditMiddleware('data_modification', 'write', 'data');
const auditSystemChanges = auditManager.createAuditMiddleware('system_changes', 'modify', 'system');
const auditSecurityEvents = auditManager.createAuditMiddleware('security_events', 'security', 'system');

module.exports = {
  AuditManager,
  auditManager,
  auditAuth,
  auditDataAccess,
  auditDataModification,
  auditSystemChanges,
  auditSecurityEvents
};
