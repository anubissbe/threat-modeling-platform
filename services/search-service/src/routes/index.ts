import { FastifyInstance } from 'fastify';
import { searchRoutes } from './search.routes';
import { analyticsRoutes } from './analytics.routes';
import { adminRoutes } from './admin.routes';

export async function routes(fastify: FastifyInstance) {
  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    return {
      status: 'healthy',
      service: 'search-service',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    };
  });

  // API routes
  await fastify.register(searchRoutes, { prefix: '/api/v1' });
  await fastify.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
  await fastify.register(adminRoutes, { prefix: '/api/v1/admin' });
}