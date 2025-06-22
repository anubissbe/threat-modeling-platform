import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import sensible from '@fastify/sensible';
import multipart from '@fastify/multipart';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';

import { config, getCorsOrigins, getJwtConfig } from './config';
import { connectDatabase } from './database';
import { connectRedis } from './redis';
import { authRoutes } from './routes/auth';
import { healthRoutes } from './routes/health';
import { userRoutes } from './routes/user';
import { mfaRoutes } from './routes/mfa';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { authMiddleware } from './middleware/auth';

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
    skipSuccessfulRequests: config.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS,
  });

  // JWT plugin
  const jwtConfig = getJwtConfig();
  await app.register(jwt, {
    secret: jwtConfig.secret,
    sign: jwtConfig.sign,
    verify: jwtConfig.verify,
  });

  // Cookie support
  await app.register(cookie, {
    secret: config.JWT_SECRET,
    parseOptions: {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
    },
  });

  // Multipart support
  await app.register(multipart);

  // Swagger documentation
  if (config.NODE_ENV !== 'production') {
    await app.register(swagger, {
      openapi: {
        openapi: '3.0.0',
        info: {
          title: 'Authentication Service API',
          description: 'Threat Modeling Application - Authentication Service',
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
      },
    });

    await app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'full',
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
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(userRoutes, { prefix: '/users' });
  await app.register(mfaRoutes, { prefix: '/mfa' });

  // Global error handler
  app.setErrorHandler(async (error, request, reply) => {
    app.log.error(error);
    
    if (error.validation) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'Request validation failed',
        details: error.validation,
      });
    }

    if (error.statusCode) {
      return reply.status(error.statusCode).send({
        error: error.name || 'Error',
        message: error.message,
      });
    }

    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
  });

  // 404 handler
  app.setNotFoundHandler(async (request, reply) => {
    return reply.status(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  return app;
}