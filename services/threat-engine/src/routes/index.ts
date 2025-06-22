import { FastifyInstance } from 'fastify';
import { analysisRoutes } from './analysis.routes';

export async function registerRoutes(fastify: FastifyInstance) {
  // Register API routes with /api prefix
  await fastify.register(analysisRoutes, { prefix: '/api' });
}