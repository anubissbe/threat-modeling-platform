import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  ThreatAnalysisRequest,
  ThreatAnalysisResponse,
  ThreatModelingMethodology,
  Component,
} from '../types';
import { ThreatAnalysisService } from '../services/threat-analysis.service';
import { logger, auditLogger } from '../utils/logger';

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
}

const analysisService = new ThreatAnalysisService();

// Analysis request schema
const analysisRequestSchema = {
  type: 'object',
  required: ['threatModelId', 'methodology', 'components'],
  properties: {
    threatModelId: { type: 'string' },
    methodology: { 
      type: 'string', 
      enum: Object.values(ThreatModelingMethodology) 
    },
    components: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'type'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string' },
          description: { type: 'string' },
          properties: { type: 'object' },
          connections: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    dataFlows: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'source', 'destination'],
        properties: {
          id: { type: 'string' },
          source: { type: 'string' },
          destination: { type: 'string' },
          data: { type: 'string' },
          protocol: { type: 'string' },
          properties: { type: 'object' },
        },
      },
    },
    securityRequirements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          requirement: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string' },
        },
      },
    },
    options: {
      type: 'object',
      properties: {
        enablePatternMatching: { type: 'boolean' },
        enableDreadScoring: { type: 'boolean' },
        includeDetailedRecommendations: { type: 'boolean' },
        confidenceThreshold: { type: 'number', minimum: 0, maximum: 1 },
        includeCommonThreats: { type: 'boolean' },
        includeDomainSpecificThreats: { type: 'boolean' },
        enableMlPredictions: { type: 'boolean' },
        riskCalculationMethod: { type: 'string' },
        maxThreatsPerComponent: { type: 'number' },
        includeAssetValuation: { type: 'boolean' },
        considerComplianceRequirements: { type: 'boolean' },
      },
    },
  },
};

// Component analysis schema
const componentAnalysisSchema = {
  type: 'object',
  required: ['component'],
  properties: {
    component: {
      type: 'object',
      required: ['id', 'name', 'type'],
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        type: { type: 'string' },
        description: { type: 'string' },
        properties: { type: 'object' },
        connections: { type: 'array', items: { type: 'string' } },
      },
    },
    methodology: {
      type: 'string',
      enum: Object.values(ThreatModelingMethodology),
      default: ThreatModelingMethodology.STRIDE,
    },
  },
};

export async function analysisRoutes(fastify: FastifyInstance) {
  // Analyze threat model
  fastify.post<{
    Body: ThreatAnalysisRequest;
  }>('/analyze', {
    schema: {
      description: 'Perform comprehensive threat analysis on a threat model',
      tags: ['Analysis'],
      body: analysisRequestSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }, // ThreatAnalysisResponse
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = request.user?.id;
      
      logger.info('Threat analysis requested', {
        userId,
        threatModelId: request.body.threatModelId,
        methodology: request.body.methodology,
      });

      const result = await analysisService.analyzeThreatModel(
        request.body,
        userId
      );

      reply.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Analysis failed', {
        userId: request.user?.id,
        threatModelId: request.body.threatModelId,
        error: error.message,
      });

      reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Analyze single component
  fastify.post<{
    Body: {
      component: Component;
      methodology?: ThreatModelingMethodology;
    };
  }>('/analyze/component', {
    schema: {
      description: 'Analyze threats for a single component',
      tags: ['Analysis'],
      body: componentAnalysisSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                threats: { type: 'array', items: { type: 'object' } },
                component: { type: 'object' },
              },
            },
          },
        },
      },
    },
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = request.user?.id;
      const { component, methodology = ThreatModelingMethodology.STRIDE } = request.body;

      logger.info('Component analysis requested', {
        userId,
        componentId: component.id,
        componentName: component.name,
        methodology,
      });

      const threats = await analysisService.analyzeComponent(
        component,
        methodology,
        userId
      );

      reply.send({
        success: true,
        data: {
          threats,
          component,
        },
      });
    } catch (error: any) {
      logger.error('Component analysis failed', {
        userId: request.user?.id,
        componentId: request.body.component?.id,
        error: error.message,
      });

      reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Get available threat patterns
  fastify.get('/patterns', {
    schema: {
      description: 'Get available threat patterns',
      tags: ['Patterns'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                patterns: { type: 'array', items: { type: 'object' } },
                categoryCounts: { type: 'object' },
              },
            },
          },
        },
      },
    },
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = request.user?.id;

      logger.debug('Patterns requested', { userId });

      const result = await analysisService.getAvailablePatterns();

      reply.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Failed to get patterns', {
        userId: request.user?.id,
        error: error.message,
      });

      reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Add custom threat pattern
  fastify.post<{
    Body: any; // ThreatPattern
  }>('/patterns', {
    schema: {
      description: 'Add custom threat pattern',
      tags: ['Patterns'],
      body: {
        type: 'object',
        required: ['id', 'name', 'category', 'applicableComponents', 'threatTemplate'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
          applicableComponents: { type: 'array', items: { type: 'string' } },
          conditions: { type: 'array', items: { type: 'object' } },
          threatTemplate: { type: 'object' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      logger.info('Custom pattern addition requested', {
        userId,
        patternId: request.body.id,
        patternName: request.body.name,
      });

      await analysisService.addCustomPattern(request.body, userId);

      reply.status(201).send({
        success: true,
        message: 'Custom pattern added successfully',
      });
    } catch (error: any) {
      logger.error('Failed to add custom pattern', {
        userId: request.user?.id,
        patternId: request.body?.id,
        error: error.message,
      });

      reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Generate mitigations for threats
  fastify.post<{
    Body: {
      threats: any[]; // IdentifiedThreat[]
      components: Component[];
    };
  }>('/mitigations', {
    schema: {
      description: 'Generate mitigation recommendations for threats',
      tags: ['Mitigations'],
      body: {
        type: 'object',
        required: ['threats', 'components'],
        properties: {
          threats: { type: 'array', items: { type: 'object' } },
          components: { type: 'array', items: { type: 'object' } },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                recommendations: { type: 'array', items: { type: 'object' } },
              },
            },
          },
        },
      },
    },
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = request.user?.id;
      const { threats, components } = request.body;

      logger.info('Mitigation generation requested', {
        userId,
        threatsCount: threats.length,
        componentsCount: components.length,
      });

      const recommendations = await analysisService.generateMitigations(
        threats,
        components,
        userId
      );

      reply.send({
        success: true,
        data: {
          recommendations,
        },
      });
    } catch (error: any) {
      logger.error('Mitigation generation failed', {
        userId: request.user?.id,
        error: error.message,
      });

      reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Calculate risk metrics
  fastify.post<{
    Body: {
      threats: any[]; // IdentifiedThreat[]
      components: Component[];
    };
  }>('/risk/calculate', {
    schema: {
      description: 'Calculate risk metrics for threats and components',
      tags: ['Risk'],
      body: {
        type: 'object',
        required: ['threats', 'components'],
        properties: {
          threats: { type: 'array', items: { type: 'object' } },
          components: { type: 'array', items: { type: 'object' } },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }, // RiskAssessment
          },
        },
      },
    },
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = request.user?.id;
      const { threats, components } = request.body;

      logger.info('Risk calculation requested', {
        userId,
        threatsCount: threats.length,
        componentsCount: components.length,
      });

      const riskAssessment = await analysisService.calculateRiskMetrics(
        threats,
        components
      );

      if (userId) {
        auditLogger.riskCalculated(
          userId,
          'manual-calculation',
          riskAssessment.overallRiskScore,
          riskAssessment.criticalThreats.length
        );
      }

      reply.send({
        success: true,
        data: riskAssessment,
      });
    } catch (error: any) {
      logger.error('Risk calculation failed', {
        userId: request.user?.id,
        error: error.message,
      });

      reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Health check endpoint
  fastify.get('/health', {
    schema: {
      description: 'Engine health check',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            version: { type: 'string' },
            engines: { type: 'object' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const patterns = await analysisService.getAvailablePatterns();

      reply.send({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        engines: {
          stride: 'available',
          pasta: 'available',
          patternMatcher: 'available',
          dreadCalculator: 'available',
          mitigationEngine: 'available',
          patternCount: patterns.patterns.length,
        },
      });
    } catch (error: any) {
      logger.error('Health check failed', { error: error.message });
      
      reply.status(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  });
}