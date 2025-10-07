const cluster = require('cluster');
const os = require('os');

// Configuration for clustering
const CLUSTER_CONFIG = {
  // Number of worker processes (default: number of CPU cores)
  numWorkers: process.env.NUM_WORKERS || os.cpus().length,
  
  // Graceful shutdown timeout (in milliseconds)
  gracefulShutdownTimeout: process.env.GRACEFUL_SHUTDOWN_TIMEOUT || 10000,
  
  // Restart delay for crashed workers (in milliseconds)
  restartDelay: process.env.RESTART_DELAY || 1000,
  
  // Maximum restart attempts before giving up
  maxRestarts: process.env.MAX_RESTARTS || 5,
  
  // Enable clustering in production
  enableClustering: process.env.NODE_ENV === 'production' || process.env.ENABLE_CLUSTERING === 'true'
};

// Worker restart tracking
const workerRestarts = new Map();

// Initialize clustering
function initializeCluster() {
  if (!CLUSTER_CONFIG.enableClustering) {
    console.log('🚀 Running in single process mode');
    return false;
  }

  if (cluster.isMaster) {
    console.log(`🚀 Master process ${process.pid} is running`);
    console.log(`👥 Starting ${CLUSTER_CONFIG.numWorkers} worker processes`);
    
    // Fork workers
    for (let i = 0; i < CLUSTER_CONFIG.numWorkers; i++) {
      forkWorker();
    }
    
    // Handle worker events
    cluster.on('exit', handleWorkerExit);
    cluster.on('online', handleWorkerOnline);
    cluster.on('disconnect', handleWorkerDisconnect);
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    return true;
  } else {
    console.log(`👷 Worker process ${process.pid} is running`);
    return false;
  }
}

// Fork a new worker process
function forkWorker() {
  const worker = cluster.fork();
  workerRestarts.set(worker.id, 0);
  
  worker.on('message', (message) => {
    if (message.type === 'restart') {
      console.log(`🔄 Worker ${worker.id} requested restart`);
      restartWorker(worker);
    }
  });
  
  return worker;
}

// Handle worker exit
function handleWorkerExit(worker, code, signal) {
  const restarts = workerRestarts.get(worker.id) || 0;
  
  console.log(`👷 Worker ${worker.process.pid} died (code: ${code}, signal: ${signal})`);
  console.log(`📊 Worker ${worker.id} had ${restarts} restart attempts`);
  
  if (restarts < CLUSTER_CONFIG.maxRestarts) {
    console.log(`🔄 Restarting worker ${worker.id} in ${CLUSTER_CONFIG.restartDelay}ms`);
    
    setTimeout(() => {
      const newWorker = forkWorker();
      console.log(`✅ Worker ${newWorker.id} restarted successfully`);
    }, CLUSTER_CONFIG.restartDelay);
    
    workerRestarts.set(worker.id, restarts + 1);
  } else {
    console.error(`❌ Worker ${worker.id} exceeded maximum restart attempts (${CLUSTER_CONFIG.maxRestarts})`);
    console.error('🛑 Not restarting worker to prevent infinite restart loop');
  }
}

// Handle worker online
function handleWorkerOnline(worker) {
  console.log(`✅ Worker ${worker.process.pid} is online`);
}

// Handle worker disconnect
function handleWorkerDisconnect(worker) {
  console.log(`🔌 Worker ${worker.process.pid} disconnected`);
}

// Restart a specific worker
function restartWorker(worker) {
  console.log(`🔄 Restarting worker ${worker.id}`);
  worker.kill('SIGTERM');
}

// Graceful shutdown
function gracefulShutdown(signal) {
  console.log(`📡 Received ${signal}. Starting graceful shutdown...`);
  
  const workers = Object.values(cluster.workers);
  let shutdownCount = 0;
  
  if (workers.length === 0) {
    console.log('✅ No workers to shutdown');
    process.exit(0);
  }
  
  workers.forEach((worker) => {
    console.log(`📡 Sending ${signal} to worker ${worker.process.pid}`);
    worker.kill(signal);
    
    worker.on('exit', () => {
      shutdownCount++;
      console.log(`✅ Worker ${worker.process.pid} shutdown complete`);
      
      if (shutdownCount === workers.length) {
        console.log('✅ All workers shutdown. Master process exiting...');
        process.exit(0);
      }
    });
  });
  
  // Force shutdown after timeout
  setTimeout(() => {
    console.error('⏰ Graceful shutdown timeout reached. Force killing workers...');
    workers.forEach((worker) => {
      if (!worker.isDead()) {
        worker.kill('SIGKILL');
      }
    });
    process.exit(1);
  }, CLUSTER_CONFIG.gracefulShutdownTimeout);
}

// Health check for workers
function healthCheck() {
  const workers = Object.values(cluster.workers);
  const healthyWorkers = workers.filter(worker => !worker.isDead());
  
  console.log(`📊 Health Check: ${healthyWorkers.length}/${workers.length} workers healthy`);
  
  return {
    totalWorkers: workers.length,
    healthyWorkers: healthyWorkers.length,
    unhealthyWorkers: workers.length - healthyWorkers.length,
    uptime: process.uptime()
  };
}

// Get cluster statistics
function getClusterStats() {
  const workers = Object.values(cluster.workers);
  
  return {
    master: {
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    },
    workers: workers.map(worker => ({
      id: worker.id,
      pid: worker.process.pid,
      uptime: worker.uptime,
      memoryUsage: worker.process.memoryUsage(),
      cpuUsage: worker.process.cpuUsage(),
      isDead: worker.isDead(),
      restarts: workerRestarts.get(worker.id) || 0
    })),
    config: CLUSTER_CONFIG
  };
}

module.exports = {
  initializeCluster,
  healthCheck,
  getClusterStats,
  CLUSTER_CONFIG
};
