const mongoose = require('mongoose');

// Connection pool configuration
const CONNECTION_CONFIG = {
  // Maximum number of connections in the pool (increased for high concurrency)
  maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE) || 50,
  
  // Minimum number of connections in the pool
  minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE) || 10,
  
  // Maximum time to wait for a connection (in milliseconds)
  maxIdleTimeMS: parseInt(process.env.MONGODB_MAX_IDLE_TIME) || 30000,
  
  // Connection timeout (in milliseconds)
  connectTimeoutMS: parseInt(process.env.MONGODB_CONNECT_TIMEOUT) || 10000,
  
  // Socket timeout (in milliseconds)
  socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT) || 45000,
  
  // Server selection timeout (in milliseconds)
  serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT) || 5000,
  
  // Retry configuration
  retryWrites: process.env.MONGODB_RETRY_WRITES !== 'false',
  retryReads: process.env.MONGODB_RETRY_READS !== 'false',
  
  // Compression
  compressors: ['zlib'],
  
  // Read preference
  readPreference: process.env.MONGODB_READ_PREFERENCE || 'primary',
  
  // Write concern
  writeConcern: {
    w: process.env.MONGODB_WRITE_CONCERN || 'majority',
    j: process.env.MONGODB_JOURNAL !== 'false'
  }
};

// Connection state tracking
let connectionState = {
  isConnected: false,
  isConnecting: false,
  connectionCount: 0,
  lastConnectionTime: null,
  lastError: null
};

// Connection event handlers
function setupConnectionHandlers() {
  mongoose.connection.on('connected', () => {
    connectionState.isConnected = true;
    connectionState.isConnecting = false;
    connectionState.lastConnectionTime = new Date();
    connectionState.lastError = null;
    
    console.log(`✅ MongoDB Connected: ${mongoose.connection.host}:${mongoose.connection.port}`);
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(`🔗 Connection Pool Size: ${CONNECTION_CONFIG.maxPoolSize}`);
  });

  mongoose.connection.on('error', (error) => {
    connectionState.isConnected = false;
    connectionState.isConnecting = false;
    connectionState.lastError = error;
    
    console.error('❌ MongoDB Connection Error:', error.message);
  });

  mongoose.connection.on('disconnected', () => {
    connectionState.isConnected = false;
    connectionState.isConnecting = false;
    
    console.log('🔌 MongoDB Disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    connectionState.isConnected = true;
    connectionState.isConnecting = false;
    connectionState.lastConnectionTime = new Date();
    
    console.log('🔄 MongoDB Reconnected');
  });

  mongoose.connection.on('connecting', () => {
    connectionState.isConnecting = true;
    console.log('🔄 Connecting to MongoDB...');
  });

  mongoose.connection.on('open', () => {
    console.log('🚀 MongoDB Connection Opened');
  });

  mongoose.connection.on('close', () => {
    console.log('🔒 MongoDB Connection Closed');
  });
}

// Connect to MongoDB with optimized configuration
const connectDB = async () => {
  try {
    if (connectionState.isConnected || connectionState.isConnecting) {
      console.log('⚠️ MongoDB connection already established or in progress');
      return;
    }

    setupConnectionHandlers();

    console.log('🔄 Establishing MongoDB connection...');
    console.log(`📋 Connection Config:`, {
      maxPoolSize: CONNECTION_CONFIG.maxPoolSize,
      minPoolSize: CONNECTION_CONFIG.minPoolSize,
      connectTimeoutMS: CONNECTION_CONFIG.connectTimeoutMS,
      socketTimeoutMS: CONNECTION_CONFIG.socketTimeoutMS
    });

    const conn = await mongoose.connect(process.env.MONGODB_URI, CONNECTION_CONFIG);

    connectionState.connectionCount++;
    connectionState.isConnected = true;
    connectionState.isConnecting = false;
    connectionState.lastConnectionTime = new Date();

    console.log(`✅ MongoDB Connected Successfully: ${conn.connection.host}`);
    console.log(`📊 Connection Pool Status:`, {
      readyState: conn.connection.readyState,
      host: conn.connection.host,
      port: conn.connection.port,
      name: conn.connection.name
    });

  } catch (error) {
    connectionState.isConnected = false;
    connectionState.isConnecting = false;
    connectionState.lastError = error;
    
    console.error('❌ Database connection error:', error);
    console.error('🔧 Connection Config:', CONNECTION_CONFIG);
    
    // Don't exit process in production, let the application handle the error
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
    
    throw error;
  }
};

// Graceful disconnect
const disconnectDB = async () => {
  try {
    if (!connectionState.isConnected) {
      console.log('⚠️ MongoDB not connected, skipping disconnect');
      return;
    }

    console.log('🔄 Disconnecting from MongoDB...');
    await mongoose.connection.close();
    console.log('✅ MongoDB disconnected successfully');
    
  } catch (error) {
    console.error('❌ Error disconnecting from MongoDB:', error);
    throw error;
  }
};

// Health check
const healthCheck = async () => {
  try {
    if (!connectionState.isConnected) {
      return {
        status: 'disconnected',
        message: 'MongoDB not connected',
        connectionState
      };
    }

    // Ping the database
    await mongoose.connection.db.admin().ping();
    
    return {
      status: 'healthy',
      message: 'MongoDB connection is healthy',
      connectionState: {
        ...connectionState,
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
      }
    };
    
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'MongoDB health check failed',
      error: error.message,
      connectionState
    };
  }
};

// Get connection statistics
const getConnectionStats = () => {
  const connection = mongoose.connection;
  
  return {
    connectionState,
    config: CONNECTION_CONFIG,
    stats: {
      readyState: connection.readyState,
      host: connection.host,
      port: connection.port,
      name: connection.name,
      collections: connection.collections ? Object.keys(connection.collections).length : 0,
      models: connection.models ? Object.keys(connection.models).length : 0
    }
  };
};

module.exports = {
  connectDB,
  disconnectDB,
  healthCheck,
  getConnectionStats,
  CONNECTION_CONFIG
};
