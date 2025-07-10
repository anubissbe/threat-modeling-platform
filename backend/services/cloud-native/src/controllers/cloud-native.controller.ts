import { Response } from 'express';
import { z } from 'zod';
import { CloudNativeService } from '../services/cloud-native.service';
import { logger } from '../utils/logger';
import {
  CloudNativeRequest,
  CloudNativeResponse
} from '../types/cloud-native';

// Validation schemas
const deployRequestSchema = z.object({
  name: z.string().min(1),
  namespace: z.string().min(1),
  image: z.string().min(1),
  replicas: z.number().int().positive().optional(),
  resources: z.object({
    requests: z.object({
      cpu: z.string().optional(),
      memory: z.string().optional()
    }).optional(),
    limits: z.object({
      cpu: z.string().optional(),
      memory: z.string().optional()
    }).optional()
  }).optional(),
  env: z.record(z.string()).optional(),
  ports: z.array(z.number().int().positive()).optional(),
  volumes: z.array(z.object({
    name: z.string(),
    mountPath: z.string(),
    type: z.enum(['configMap', 'secret', 'persistentVolume']),
    source: z.string()
  })).optional()
});

const scaleRequestSchema = z.object({
  name: z.string().min(1),
  namespace: z.string().min(1),
  replicas: z.number().int().min(0)
});

const rolloutRequestSchema = z.object({
  name: z.string().min(1),
  namespace: z.string().min(1),
  image: z.string().min(1),
  strategy: z.enum(['rolling', 'blue-green', 'canary']).optional(),
  canaryWeight: z.number().int().min(0).max(100).optional()
});

export class CloudNativeController {
  constructor(
    private cloudNativeService: CloudNativeService
  ) {}

  /**
   * Deploy application
   */
  public async deployApplication(
    req: CloudNativeRequest,
    res: Response
  ): Promise<void> {
    try {
      const validatedData = deployRequestSchema.parse(req.body);
      
      const result = await this.cloudNativeService.deployApplication(validatedData);
      
      const response: CloudNativeResponse = {
        success: true,
        data: result,
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Failed to deploy application', error);
      
      const response: CloudNativeResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Scale deployment
   */
  public async scaleDeployment(
    req: CloudNativeRequest,
    res: Response
  ): Promise<void> {
    try {
      const validatedData = scaleRequestSchema.parse(req.body);
      
      const result = await this.cloudNativeService.scaleDeployment(validatedData);
      
      const response: CloudNativeResponse = {
        success: true,
        data: result,
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Failed to scale deployment', error);
      
      const response: CloudNativeResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Perform rollout
   */
  public async performRollout(
    req: CloudNativeRequest,
    res: Response
  ): Promise<void> {
    try {
      const validatedData = rolloutRequestSchema.parse(req.body);
      
      const result = await this.cloudNativeService.performRollout(validatedData);
      
      const response: CloudNativeResponse = {
        success: true,
        data: result,
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Failed to perform rollout', error);
      
      const response: CloudNativeResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Get deployment status
   */
  public async getDeploymentStatus(
    req: CloudNativeRequest,
    res: Response
  ): Promise<void> {
    try {
      const { name, namespace } = req.params;
      
      const result = await this.cloudNativeService.getDeploymentStatus(name, namespace);
      
      const response: CloudNativeResponse = {
        success: true,
        data: result,
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Failed to get deployment status', error);
      
      const response: CloudNativeResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Get service status
   */
  public async getServiceStatus(
    req: CloudNativeRequest,
    res: Response
  ): Promise<void> {
    try {
      const { name, namespace } = req.params;
      
      const result = await this.cloudNativeService.getServiceStatus(name, namespace);
      
      const response: CloudNativeResponse = {
        success: true,
        data: result,
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Failed to get service status', error);
      
      const response: CloudNativeResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Get pod status
   */
  public async getPodStatus(
    req: CloudNativeRequest,
    res: Response
  ): Promise<void> {
    try {
      const { namespace } = req.params;
      const { labelSelector } = req.query;
      
      const result = await this.cloudNativeService.getPodStatus(
        namespace,
        labelSelector as string
      );
      
      const response: CloudNativeResponse = {
        success: true,
        data: result,
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Failed to get pod status', error);
      
      const response: CloudNativeResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Build Docker image
   */
  public async buildDockerImage(
    req: CloudNativeRequest,
    res: Response
  ): Promise<void> {
    try {
      const { dockerfile, context, tag, buildArgs } = req.body;
      
      await this.cloudNativeService.buildDockerImage(
        dockerfile,
        context,
        tag,
        buildArgs
      );
      
      const response: CloudNativeResponse = {
        success: true,
        data: { message: `Docker image ${tag} built successfully` },
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Failed to build Docker image', error);
      
      const response: CloudNativeResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Push Docker image
   */
  public async pushDockerImage(
    req: CloudNativeRequest,
    res: Response
  ): Promise<void> {
    try {
      const { tag } = req.body;
      
      await this.cloudNativeService.pushDockerImage(tag);
      
      const response: CloudNativeResponse = {
        success: true,
        data: { message: `Docker image ${tag} pushed successfully` },
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Failed to push Docker image', error);
      
      const response: CloudNativeResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Apply YAML manifest
   */
  public async applyManifest(
    req: CloudNativeRequest,
    res: Response
  ): Promise<void> {
    try {
      const { yaml } = req.body;
      
      await this.cloudNativeService.applyManifest(yaml);
      
      const response: CloudNativeResponse = {
        success: true,
        data: { message: 'YAML manifest applied successfully' },
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Failed to apply YAML manifest', error);
      
      const response: CloudNativeResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Get events
   */
  public async getEvents(
    req: CloudNativeRequest,
    res: Response
  ): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      
      const result = this.cloudNativeService.getEvents(limit);
      
      const response: CloudNativeResponse = {
        success: true,
        data: result,
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Failed to get events', error);
      
      const response: CloudNativeResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Get all deployments
   */
  public async getAllDeployments(
    req: CloudNativeRequest,
    res: Response
  ): Promise<void> {
    try {
      const result = this.cloudNativeService.getAllDeployments();
      
      const response: CloudNativeResponse = {
        success: true,
        data: result,
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Failed to get all deployments', error);
      
      const response: CloudNativeResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Get all services
   */
  public async getAllServices(
    req: CloudNativeRequest,
    res: Response
  ): Promise<void> {
    try {
      const result = this.cloudNativeService.getAllServices();
      
      const response: CloudNativeResponse = {
        success: true,
        data: result,
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Failed to get all services', error);
      
      const response: CloudNativeResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Health check
   */
  public async healthCheck(
    req: CloudNativeRequest,
    res: Response
  ): Promise<void> {
    try {
      const result = await this.cloudNativeService.healthCheck();
      
      const response: CloudNativeResponse = {
        success: true,
        data: result,
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Health check failed', error);
      
      const response: CloudNativeResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        requestId: req.requestId
      };
      
      res.status(500).json(response);
    }
  }
}