import { FastifyInstance } from 'fastify';
import { AnalysisController } from '../controllers/analysis.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  AnalysisRequest,
  PredictionRequest,
  AnalysisResponse,
  PredictedThreat,
  VulnerabilityPrediction,
  MitigationRecommendation,
  ThreatPattern,
  ThreatIntelligence,
} from '../types';

export async function analysisRoutes(
  fastify: FastifyInstance,
  controller: AnalysisController
): Promise<void> {
  
  // Comprehensive analysis endpoint
  fastify.post<{ Body: AnalysisRequest; Reply: AnalysisResponse }>(
    '/analyze',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'Perform comprehensive AI-powered threat analysis',
        tags: ['Analysis'],
        body: {
          type: 'object',
          required: ['projectId', 'components'],
          properties: {
            projectId: { type: 'string' },
            components: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                  description: { type: 'string' },
                  dataFlow: { type: 'array', items: { type: 'string' } },
                  technologies: { type: 'array', items: { type: 'string' } },
                  interfaces: { type: 'array', items: { type: 'string' } },
                },
              },
            },
            threatModel: { type: 'object' },
            options: {
              type: 'object',
              properties: {
                includePatternRecognition: { type: 'boolean' },
                includeVulnerabilityPrediction: { type: 'boolean' },
                includeMitigationRecommendations: { type: 'boolean' },
                includeThreatIntelligence: { type: 'boolean' },
                confidenceThreshold: { type: 'number' },
              },
            },
          },
        },
        response: {
          200: {
            description: 'Successful analysis',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              projectId: { type: 'string' },
              analysis: {
                type: 'object',
                properties: {
                  threats: { type: 'array' },
                  vulnerabilities: { type: 'array' },
                  patterns: { type: 'array' },
                  mitigations: { type: 'array' },
                  intelligence: { type: 'array' },
                },
              },
              summary: {
                type: 'object',
                properties: {
                  totalThreats: { type: 'number' },
                  criticalThreats: { type: 'number' },
                  highRiskComponents: { type: 'array', items: { type: 'string' } },
                  overallRiskLevel: { type: 'string' },
                  topRecommendations: { type: 'array', items: { type: 'string' } },
                  confidenceScore: { type: 'number' },
                },
              },
              timestamp: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => controller.analyze(request, reply)
  );

  // Threat prediction endpoint
  fastify.post<{ Body: PredictionRequest; Reply: PredictedThreat[] }>(
    '/predict/threats',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'Predict threats using AI classifier',
        tags: ['Prediction'],
        body: {
          type: 'object',
          required: ['input'],
          properties: {
            input: { type: 'object' },
            context: {
              type: 'object',
              properties: {
                projectId: { type: 'string' },
                componentType: { type: 'string' },
                threatHistory: { type: 'array', items: { type: 'string' } },
              },
            },
            options: {
              type: 'object',
              properties: {
                threshold: { type: 'number' },
                topK: { type: 'number' },
              },
            },
          },
        },
      },
    },
    async (request, reply) => controller.predictThreats(request, reply)
  );

  // Vulnerability prediction endpoint
  fastify.post<{ Body: PredictionRequest; Reply: VulnerabilityPrediction[] }>(
    '/predict/vulnerabilities',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'Predict vulnerabilities in components',
        tags: ['Prediction'],
        body: {
          type: 'object',
          required: ['input'],
          properties: {
            input: { type: 'object' },
            context: { type: 'object' },
            options: { type: 'object' },
          },
        },
      },
    },
    async (request, reply) => controller.predictVulnerabilities(request, reply)
  );

  // Mitigation recommendations endpoint
  fastify.post<{ Body: { threats: any[] }; Reply: MitigationRecommendation[] }>(
    '/mitigations',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'Get AI-powered mitigation recommendations',
        tags: ['Mitigation'],
        body: {
          type: 'object',
          required: ['threats'],
          properties: {
            threats: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                  description: { type: 'string' },
                  probability: { type: 'number' },
                  impact: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => controller.getMitigations(request, reply)
  );

  // Pattern recognition endpoint
  fastify.post<{ Body: PredictionRequest; Reply: ThreatPattern[] }>(
    '/patterns',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'Recognize threat patterns',
        tags: ['Pattern Recognition'],
        body: {
          type: 'object',
          required: ['input'],
          properties: {
            input: { type: 'object' },
            context: { type: 'object' },
            options: { type: 'object' },
          },
        },
      },
    },
    async (request, reply) => controller.recognizePatterns(request, reply)
  );

  // Threat intelligence endpoint
  fastify.post<{ Body: { query: string; indicators?: string[] }; Reply: ThreatIntelligence[] }>(
    '/intelligence',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'Query threat intelligence',
        tags: ['Intelligence'],
        body: {
          type: 'object',
          required: ['query'],
          properties: {
            query: { type: 'string' },
            indicators: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => controller.queryIntelligence(request, reply)
  );

  // Health check endpoint
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Get AI/ML service health status',
        tags: ['Health'],
        response: {
          200: {
            description: 'Service health status',
            type: 'object',
            properties: {
              status: { type: 'string' },
              models: { type: 'object' },
              cache: {
                type: 'object',
                properties: {
                  size: { type: 'number' },
                  hitRate: { type: 'number' },
                },
              },
              timestamp: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => controller.getHealth(request, reply)
  );
}