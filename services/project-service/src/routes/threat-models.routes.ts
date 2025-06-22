import { FastifyInstance, FastifyRequest } from 'fastify';
import { ThreatModelService, CreateThreatModelDto, UpdateThreatModelDto } from '../services/threat-model.service';
import { CollaborationService } from '../services/collaboration.service';
import { 
  ThreatModelFilters, 
  PaginationParams,
  CollaboratorPermission
} from '../types';
import { extractBearerToken, isValidUUID } from '../utils/helpers';
import { logger } from '../utils/logger';

// Type definitions for route parameters and queries
interface ThreatModelParams {
  threatModelId: string;
}

interface ProjectThreatModelParams {
  projectId: string;
  threatModelId?: string;
}

interface VersionParams {
  threatModelId: string;
  versionId?: string;
}

interface ThreatModelQuery {
  page?: string;
  pageSize?: string;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  projectId?: string;
  methodology?: string;
  status?: string;
  createdById?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

interface AuthenticatedRequest extends FastifyRequest {
  userId?: string;
}

export async function threatModelRoutes(fastify: FastifyInstance) {
  const threatModelService = new ThreatModelService();
  const collaborationService = new CollaborationService();

  // Authentication middleware
  fastify.addHook('preHandler', async (request: AuthenticatedRequest, reply) => {
    const authHeader = request.headers.authorization;
    const token = extractBearerToken(authHeader);

    if (!token) {
      reply.code(401).send({ error: 'Authorization required' });
      return;
    }

    try {
      // Mock JWT verification - replace with actual implementation
      const userId = 'mock-user-id'; // Extract from verified JWT
      request.userId = userId;
    } catch (error) {
      reply.code(401).send({ error: 'Invalid token' });
      return;
    }
  });

  // Create threat model
  fastify.post<{
    Params: { projectId: string };
    Body: CreateThreatModelDto;
  }>('/projects/:projectId/threat-models', async (request: AuthenticatedRequest, reply) => {
    try {
      const { projectId } = request.params;
      
      if (!isValidUUID(projectId)) {
        reply.code(400).send({ error: 'Invalid project ID' });
        return;
      }

      // Check if user has write permission
      const hasPermission = await collaborationService.hasPermission(
        projectId,
        request.userId!,
        CollaboratorPermission.WRITE
      );
      
      if (!hasPermission) {
        reply.code(403).send({ error: 'Insufficient permissions' });
        return;
      }

      const threatModel = await threatModelService.createThreatModel(
        projectId,
        request.body,
        request.userId!
      );
      
      reply.code(201).send({ success: true, data: threatModel });
    } catch (error: any) {
      logger.error('Failed to create threat model:', error);
      reply.code(400).send({ error: error.message });
    }
  });

  // Get threat model by ID
  fastify.get<{
    Params: ThreatModelParams;
  }>('/threat-models/:threatModelId', async (request: AuthenticatedRequest, reply) => {
    try {
      const { threatModelId } = request.params;
      
      if (!isValidUUID(threatModelId)) {
        reply.code(400).send({ error: 'Invalid threat model ID' });
        return;
      }

      const threatModel = await threatModelService.getThreatModel(threatModelId, request.userId);
      
      if (!threatModel) {
        reply.code(404).send({ error: 'Threat model not found' });
        return;
      }

      reply.send({ success: true, data: threatModel });
    } catch (error: any) {
      logger.error('Failed to get threat model:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update threat model
  fastify.patch<{
    Params: ThreatModelParams;
    Body: UpdateThreatModelDto;
    Querystring: { createVersion?: string };
  }>('/threat-models/:threatModelId', async (request: AuthenticatedRequest, reply) => {
    try {
      const { threatModelId } = request.params;
      const { createVersion } = request.query;
      
      if (!isValidUUID(threatModelId)) {
        reply.code(400).send({ error: 'Invalid threat model ID' });
        return;
      }

      // Get threat model to check project permissions
      const existingThreatModel = await threatModelService.getThreatModel(threatModelId);
      if (!existingThreatModel) {
        reply.code(404).send({ error: 'Threat model not found' });
        return;
      }

      // Check if user has write permission
      const hasPermission = await collaborationService.hasPermission(
        existingThreatModel.projectId,
        request.userId!,
        CollaboratorPermission.WRITE
      );
      
      if (!hasPermission) {
        reply.code(403).send({ error: 'Insufficient permissions' });
        return;
      }

      const shouldCreateVersion = createVersion === 'true';
      const threatModel = await threatModelService.updateThreatModel(
        threatModelId,
        request.body,
        request.userId!,
        shouldCreateVersion
      );
      
      reply.send({ success: true, data: threatModel });
    } catch (error: any) {
      logger.error('Failed to update threat model:', error);
      reply.code(400).send({ error: error.message });
    }
  });

  // Delete threat model
  fastify.delete<{
    Params: ThreatModelParams;
  }>('/threat-models/:threatModelId', async (request: AuthenticatedRequest, reply) => {
    try {
      const { threatModelId } = request.params;
      
      if (!isValidUUID(threatModelId)) {
        reply.code(400).send({ error: 'Invalid threat model ID' });
        return;
      }

      // Get threat model to check project permissions
      const existingThreatModel = await threatModelService.getThreatModel(threatModelId);
      if (!existingThreatModel) {
        reply.code(404).send({ error: 'Threat model not found' });
        return;
      }

      // Check if user has delete permission
      const hasPermission = await collaborationService.hasPermission(
        existingThreatModel.projectId,
        request.userId!,
        CollaboratorPermission.DELETE
      );
      
      if (!hasPermission) {
        reply.code(403).send({ error: 'Insufficient permissions' });
        return;
      }

      await threatModelService.deleteThreatModel(threatModelId, request.userId!);
      reply.code(204).send();
    } catch (error: any) {
      logger.error('Failed to delete threat model:', error);
      reply.code(400).send({ error: error.message });
    }
  });

  // List threat models
  fastify.get<{
    Querystring: ThreatModelQuery;
  }>('/threat-models', async (request: AuthenticatedRequest, reply) => {
    try {
      const {
        page = '1',
        pageSize = '20',
        orderBy = 'updated_at',
        orderDirection = 'DESC',
        projectId,
        methodology,
        status,
        createdById,
        search,
        startDate,
        endDate,
      } = request.query;

      const filters: ThreatModelFilters = {
        projectId,
        methodology: methodology as any,
        status: status as any,
        createdById,
        search,
        dateRange: startDate && endDate ? {
          start: new Date(startDate),
          end: new Date(endDate),
        } : undefined,
      };

      const pagination: PaginationParams = {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        orderBy,
        orderDirection,
      };

      const result = await threatModelService.listThreatModels(filters, pagination, request.userId);
      reply.send({ success: true, ...result });
    } catch (error: any) {
      logger.error('Failed to list threat models:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // List threat models for a project
  fastify.get<{
    Params: { projectId: string };
    Querystring: Omit<ThreatModelQuery, 'projectId'>;
  }>('/projects/:projectId/threat-models', async (request: AuthenticatedRequest, reply) => {
    try {
      const { projectId } = request.params;
      
      if (!isValidUUID(projectId)) {
        reply.code(400).send({ error: 'Invalid project ID' });
        return;
      }

      // Check if user has read permission
      const hasPermission = await collaborationService.hasPermission(
        projectId,
        request.userId!,
        CollaboratorPermission.READ
      );
      
      if (!hasPermission) {
        reply.code(403).send({ error: 'Insufficient permissions' });
        return;
      }

      const {
        page = '1',
        pageSize = '20',
        orderBy = 'updated_at',
        orderDirection = 'DESC',
        methodology,
        status,
        createdById,
        search,
        startDate,
        endDate,
      } = request.query;

      const filters: ThreatModelFilters = {
        projectId,
        methodology: methodology as any,
        status: status as any,
        createdById,
        search,
        dateRange: startDate && endDate ? {
          start: new Date(startDate),
          end: new Date(endDate),
        } : undefined,
      };

      const pagination: PaginationParams = {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        orderBy,
        orderDirection,
      };

      const result = await threatModelService.listThreatModels(filters, pagination, request.userId);
      reply.send({ success: true, ...result });
    } catch (error: any) {
      logger.error('Failed to list threat models:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get threat model versions
  fastify.get<{
    Params: VersionParams;
  }>('/threat-models/:threatModelId/versions', async (request: AuthenticatedRequest, reply) => {
    try {
      const { threatModelId } = request.params;
      
      if (!isValidUUID(threatModelId)) {
        reply.code(400).send({ error: 'Invalid threat model ID' });
        return;
      }

      // Get threat model to check project permissions
      const existingThreatModel = await threatModelService.getThreatModel(threatModelId);
      if (!existingThreatModel) {
        reply.code(404).send({ error: 'Threat model not found' });
        return;
      }

      // Check if user has read permission
      const hasPermission = await collaborationService.hasPermission(
        existingThreatModel.projectId,
        request.userId!,
        CollaboratorPermission.READ
      );
      
      if (!hasPermission) {
        reply.code(403).send({ error: 'Insufficient permissions' });
        return;
      }

      const versions = await threatModelService.getVersions(threatModelId);
      reply.send({ success: true, data: versions });
    } catch (error: any) {
      logger.error('Failed to get versions:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get specific version
  fastify.get<{
    Params: VersionParams & { versionId: string };
  }>('/threat-models/:threatModelId/versions/:versionId', async (request: AuthenticatedRequest, reply) => {
    try {
      const { threatModelId, versionId } = request.params;
      
      if (!isValidUUID(threatModelId) || !isValidUUID(versionId)) {
        reply.code(400).send({ error: 'Invalid threat model or version ID' });
        return;
      }

      // Get threat model to check project permissions
      const existingThreatModel = await threatModelService.getThreatModel(threatModelId);
      if (!existingThreatModel) {
        reply.code(404).send({ error: 'Threat model not found' });
        return;
      }

      // Check if user has read permission
      const hasPermission = await collaborationService.hasPermission(
        existingThreatModel.projectId,
        request.userId!,
        CollaboratorPermission.READ
      );
      
      if (!hasPermission) {
        reply.code(403).send({ error: 'Insufficient permissions' });
        return;
      }

      const version = await threatModelService.getVersion(versionId);
      
      if (!version) {
        reply.code(404).send({ error: 'Version not found' });
        return;
      }

      reply.send({ success: true, data: version });
    } catch (error: any) {
      logger.error('Failed to get version:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Create new version manually
  fastify.post<{
    Params: VersionParams;
    Body: {
      message: string;
      changeType?: 'major' | 'minor' | 'patch';
    };
  }>('/threat-models/:threatModelId/versions', async (request: AuthenticatedRequest, reply) => {
    try {
      const { threatModelId } = request.params;
      const { message, changeType = 'patch' } = request.body;
      
      if (!isValidUUID(threatModelId)) {
        reply.code(400).send({ error: 'Invalid threat model ID' });
        return;
      }

      // Get threat model to check project permissions
      const existingThreatModel = await threatModelService.getThreatModel(threatModelId);
      if (!existingThreatModel) {
        reply.code(404).send({ error: 'Threat model not found' });
        return;
      }

      // Check if user has write permission
      const hasPermission = await collaborationService.hasPermission(
        existingThreatModel.projectId,
        request.userId!,
        CollaboratorPermission.WRITE
      );
      
      if (!hasPermission) {
        reply.code(403).send({ error: 'Insufficient permissions' });
        return;
      }

      const version = await threatModelService.createVersion(
        threatModelId,
        {
          message,
          content: existingThreatModel.content,
          metadata: {
            changeType: changeType as any,
            changedComponents: [],
            addedThreats: 0,
            removedThreats: 0,
            modifiedThreats: 0,
            addedMitigations: 0,
            removedMitigations: 0,
            reviewRequired: false,
          },
        },
        request.userId!
      );
      
      reply.code(201).send({ success: true, data: version });
    } catch (error: any) {
      logger.error('Failed to create version:', error);
      reply.code(400).send({ error: error.message });
    }
  });
}