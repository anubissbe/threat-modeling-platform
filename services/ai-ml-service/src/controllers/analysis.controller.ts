import { FastifyRequest, FastifyReply } from 'fastify';
import { AIOrchestrator } from '../services/ai-orchestrator.service';
import { logger } from '../utils/logger';
import { AnalysisRequest, PredictionRequest, ModelType } from '../types';

export class AnalysisController {
  private aiOrchestrator: AIOrchestrator;

  constructor(aiOrchestrator: AIOrchestrator) {
    this.aiOrchestrator = aiOrchestrator;
  }

  /**
   * Perform comprehensive AI analysis
   */
  async analyze(
    request: FastifyRequest<{ Body: AnalysisRequest }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const analysisRequest = request.body;
      
      // Validate request
      if (!analysisRequest.projectId || !analysisRequest.components) {
        reply.status(400).send({
          success: false,
          error: 'Invalid request',
          message: 'projectId and components are required',
        });
        return;
      }

      // Perform analysis
      const result = await this.aiOrchestrator.analyze(analysisRequest);
      
      reply.send(result);
    } catch (error: any) {
      logger.error('Analysis failed:', error);
      reply.status(500).send({
        success: false,
        error: 'Analysis failed',
        message: error.message,
      });
    }
  }

  /**
   * Predict threats using specific model
   */
  async predictThreats(
    request: FastifyRequest<{ Body: PredictionRequest }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const predictionRequest = {
        ...request.body,
        modelType: ModelType.THREAT_CLASSIFIER,
      };

      // Directly use threat classifier
      const result = await this.aiOrchestrator.analyze({
        projectId: predictionRequest.context?.projectId || 'direct-prediction',
        components: Array.isArray(predictionRequest.input) 
          ? predictionRequest.input 
          : [predictionRequest.input],
        options: {
          includeVulnerabilityPrediction: false,
          includePatternRecognition: false,
          includeMitigationRecommendations: false,
        },
      });

      reply.send(result.analysis.threats);
    } catch (error: any) {
      logger.error('Threat prediction failed:', error);
      reply.status(500).send({
        success: false,
        error: 'Threat prediction failed',
        message: error.message,
      });
    }
  }

  /**
   * Predict vulnerabilities
   */
  async predictVulnerabilities(
    request: FastifyRequest<{ Body: PredictionRequest }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const predictionRequest = {
        ...request.body,
        modelType: ModelType.VULNERABILITY_PREDICTOR,
      };

      const result = await this.aiOrchestrator.analyze({
        projectId: predictionRequest.context?.projectId || 'direct-prediction',
        components: Array.isArray(predictionRequest.input) 
          ? predictionRequest.input 
          : [predictionRequest.input],
        options: {
          includeVulnerabilityPrediction: true,
          includePatternRecognition: false,
          includeMitigationRecommendations: false,
          includeThreatIntelligence: false,
        },
      });

      reply.send(result.analysis.vulnerabilities);
    } catch (error: any) {
      logger.error('Vulnerability prediction failed:', error);
      reply.status(500).send({
        success: false,
        error: 'Vulnerability prediction failed',
        message: error.message,
      });
    }
  }

  /**
   * Get mitigation recommendations
   */
  async getMitigations(
    request: FastifyRequest<{ Body: { threats: any[] } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      // Create a synthetic analysis request
      const result = await this.aiOrchestrator.analyze({
        projectId: 'mitigation-request',
        components: [],
        threatModel: { threats: request.body.threats },
        options: {
          includeVulnerabilityPrediction: false,
          includePatternRecognition: false,
          includeMitigationRecommendations: true,
          includeThreatIntelligence: false,
        },
      });

      reply.send(result.analysis.mitigations);
    } catch (error: any) {
      logger.error('Mitigation recommendation failed:', error);
      reply.status(500).send({
        success: false,
        error: 'Mitigation recommendation failed',
        message: error.message,
      });
    }
  }

  /**
   * Recognize patterns
   */
  async recognizePatterns(
    request: FastifyRequest<{ Body: PredictionRequest }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const result = await this.aiOrchestrator.analyze({
        projectId: request.body.context?.projectId || 'pattern-recognition',
        components: Array.isArray(request.body.input) 
          ? request.body.input 
          : [request.body.input],
        options: {
          includeVulnerabilityPrediction: false,
          includePatternRecognition: true,
          includeMitigationRecommendations: false,
          includeThreatIntelligence: false,
        },
      });

      reply.send(result.analysis.patterns);
    } catch (error: any) {
      logger.error('Pattern recognition failed:', error);
      reply.status(500).send({
        success: false,
        error: 'Pattern recognition failed',
        message: error.message,
      });
    }
  }

  /**
   * Query threat intelligence
   */
  async queryIntelligence(
    request: FastifyRequest<{ Body: { query: string; indicators?: string[] } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const result = await this.aiOrchestrator.analyze({
        projectId: 'intelligence-query',
        components: [{
          id: 'query',
          type: 'query',
          description: request.body.query,
          indicators: request.body.indicators,
        }],
        options: {
          includeVulnerabilityPrediction: false,
          includePatternRecognition: false,
          includeMitigationRecommendations: false,
          includeThreatIntelligence: true,
        },
      });

      reply.send(result.analysis.intelligence);
    } catch (error: any) {
      logger.error('Intelligence query failed:', error);
      reply.status(500).send({
        success: false,
        error: 'Intelligence query failed',
        message: error.message,
      });
    }
  }

  /**
   * Get model health status
   */
  async getHealth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const health = this.aiOrchestrator.getHealth();
      reply.send(health);
    } catch (error: any) {
      logger.error('Health check failed:', error);
      reply.status(500).send({
        success: false,
        error: 'Health check failed',
        message: error.message,
      });
    }
  }
}