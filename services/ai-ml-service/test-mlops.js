/**
 * Simple test to check if MLOps components can be imported and instantiated
 */

// Test basic imports without TypeScript compilation
console.log('Testing MLOps infrastructure...');

try {
  // Test if core dependencies are available
  const fastify = require('fastify');
  const zod = require('zod');
  const pino = require('pino');
  
  console.log('✅ Core dependencies available');
  
  // Test Redis connection (optional)
  const redis = require('redis');
  console.log('✅ Redis client available');
  
  // Test AWS SDK
  const { S3Client } = require('@aws-sdk/client-s3');
  console.log('✅ AWS SDK available');
  
  // Test Bull queue
  const Bull = require('bull');
  console.log('✅ Bull queue available');
  
  // Test Prometheus client
  const promClient = require('prom-client');
  console.log('✅ Prometheus client available');
  
  console.log('\n🎉 All MLOps dependencies are properly installed!');
  
  // Test basic configuration
  const config = {
    storage: {
      type: 'local',
      localPath: './models'
    },
    serving: {
      maxModelsInMemory: 3,
      preloadModels: [],
      warmupOnLoad: true,
      enableGPU: false,
      cacheTTL: 3600,
      healthCheckInterval: 60
    },
    monitoring: {
      metricsPort: 9090,
      collectInterval: 30,
      driftDetection: {
        enabled: false, // Disabled for testing
        method: 'psi',
        threshold: 0.1,
        windowSize: 1000
      },
      performanceTracking: {
        latencyThreshold: 1000,
        errorRateThreshold: 5,
        throughputThreshold: 100
      },
      alerting: {
        enabled: false, // Disabled for testing
        channels: []
      },
      dataQuality: {
        enabled: false,
        checksumValidation: true,
        schemaValidation: true,
        rangeValidation: true
      }
    },
    training: {
      redisUrl: 'redis://localhost:6379'
    },
    api: {
      port: 3007,
      host: '0.0.0.0'
    }
  };
  
  console.log('✅ Configuration object created');
  
  // Test Fastify app creation
  const app = fastify({ logger: false });
  console.log('✅ Fastify app created');
  
  console.log('\n🚀 Basic MLOps infrastructure test PASSED!');
  console.log('Note: Full functionality requires TypeScript compilation and model files');
  
} catch (error) {
  console.error('❌ MLOps test failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}