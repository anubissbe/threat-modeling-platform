import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import sensible from '@fastify/sensible';
import jwt from '@fastify/jwt';

import { config, getCorsOrigins } from './config';
import { connectDatabase } from './database';
import { connectRedis } from './redis';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { authMiddleware } from './middleware/auth';
import { healthRoutes } from './routes/health';
import { userRoutes } from './routes/users';
import { organizationRoutes } from './routes/organizations';
import { teamRoutes } from './routes/teams';
import { roleRoutes } from './routes/roles';
import { permissionRoutes } from './routes/permissions';

export interface AppOptions {
  logger?: any;
  disableRequestLogging?: boolean;
  requestIdHeader?: string;
  requestIdLogLabel?: string;
}

export async function build(opts: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger || logger,
    disableRequestLogging: opts.disableRequestLogging,
    requestIdHeader: opts.requestIdHeader,
    requestIdLogLabel: opts.requestIdLogLabel,
    trustProxy: true,
  });

  // Register plugins
  await app.register(sensible);
  
  // Security plugins
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  });

  await app.register(cors, {
    origin: getCorsOrigins(),
    credentials: config.CORS_CREDENTIALS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  });

  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
    skipOnError: false,
  });

  // JWT plugin
  await app.register(jwt, {
    secret: config.JWT_SECRET,
    verify: {
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
    },
  });

  // Swagger documentation
  if (config.NODE_ENV !== 'production') {
    await app.register(swagger, {
      openapi: {
        openapi: '3.0.0',
        info: {
          title: 'User Management Service API',
          description: 'Threat Modeling Application - User Management Service',
          version: config.SERVICE_VERSION,
        },
        servers: [
          {
            url: `http://${config.HOST}:${config.PORT}`,
            description: 'Development server',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
        tags: [
          { name: 'Health', description: 'Health check endpoints' },
          { name: 'Users', description: 'User management operations' },
          { name: 'Organizations', description: 'Organization management' },
          { name: 'Teams', description: 'Team management' },
          { name: 'Roles', description: 'Role management' },
          { name: 'Permissions', description: 'Permission management' },
        ],
      },
    });

    await app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
    });
  }

  // Database and Redis connections
  await connectDatabase();
  await connectRedis();

  // Middleware
  await app.register(requestLogger);
  await app.register(authMiddleware);
  await app.register(errorHandler);

  // Routes
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(userRoutes, { prefix: '/users' });
  await app.register(organizationRoutes, { prefix: '/organizations' });
  await app.register(teamRoutes, { prefix: '/teams' });
  await app.register(roleRoutes, { prefix: '/roles' });
  await app.register(permissionRoutes, { prefix: '/permissions' });

  // 404 handler
  app.setNotFoundHandler(async (request, reply) => {
    return reply.status(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  return app;
}