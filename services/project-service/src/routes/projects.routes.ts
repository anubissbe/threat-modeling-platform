import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ProjectService } from '../services/project.service';
import { ThreatModelService } from '../services/threat-model.service';
import { CollaborationService } from '../services/collaboration.service';
import { 
  CreateProjectDto, 
  UpdateProjectDto, 
  ProjectFilters, 
  PaginationParams,
  CollaboratorRole,
  CollaboratorPermission
} from '../types';
import { extractBearerToken, isValidUUID, getPaginationOffset } from '../utils/helpers';
import { logger } from '../utils/logger';

// Type definitions for route parameters and queries
interface ProjectParams {
  projectId: string;
}

interface CollaboratorParams {
  projectId: string;
  userId: string;
}

interface ProjectQuery {
  page?: string;
  pageSize?: string;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  organizationId?: string;
  ownerId?: string;
  status?: string;
  visibility?: string;
  tags?: string;
  industry?: string;
  criticality?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

interface AuthenticatedRequest extends FastifyRequest {
  userId?: string;
}

export async function projectRoutes(fastify: FastifyInstance) {
  const projectService = new ProjectService();
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

    // In a real application, you'd verify the JWT token here
    // For now, we'll extract userId from a mock implementation
    try {
      // Mock JWT verification - replace with actual implementation
      const userId = 'mock-user-id'; // Extract from verified JWT
      request.userId = userId;
    } catch (error) {
      reply.code(401).send({ error: 'Invalid token' });
      return;
    }
  });

  // Create project
  fastify.post<{
    Body: CreateProjectDto;
  }>('/projects', async (request: AuthenticatedRequest, reply) => {
    try {
      const project = await projectService.createProject(request.body as CreateProjectDto, request.userId!);
      reply.code(201).send({ success: true, data: project });
    } catch (error: any) {
      logger.error('Failed to create project:', error);
      reply.code(400).send({ error: error.message });
    }
  });

  // Get project by ID
  fastify.get<{
    Params: ProjectParams;
  }>('/projects/:projectId', async (request: AuthenticatedRequest, reply) => {
    try {
      const { projectId } = (request.params as ProjectParams);
      
      if (!isValidUUID(projectId)) {
        reply.code(400).send({ error: 'Invalid project ID' });
        return;
      }

      const project = await projectService.getProject(projectId, request.userId);
      
      if (!project) {
        reply.code(404).send({ error: 'Project not found' });
        return;
      }

      reply.send({ success: true, data: project });
    } catch (error: any) {
      logger.error('Failed to get project:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update project
  fastify.patch<{
    Params: ProjectParams;
    Body: UpdateProjectDto;
  }>('/projects/:projectId', async (request: AuthenticatedRequest, reply) => {
    try {
      const { projectId } = (request.params as ProjectParams);
      
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

      const project = await projectService.updateProject(projectId, request.body as UpdateProjectDto, request.userId!);
      reply.send({ success: true, data: project });
    } catch (error: any) {
      logger.error('Failed to update project:', error);
      reply.code(400).send({ error: error.message });
    }
  });

  // Delete project
  fastify.delete<{
    Params: ProjectParams;
  }>('/projects/:projectId', async (request: AuthenticatedRequest, reply) => {
    try {
      const { projectId } = (request.params as ProjectParams);
      
      if (!isValidUUID(projectId)) {
        reply.code(400).send({ error: 'Invalid project ID' });
        return;
      }

      // Check if user has delete permission
      const hasPermission = await collaborationService.hasPermission(
        projectId,
        request.userId!,
        CollaboratorPermission.DELETE
      );
      
      if (!hasPermission) {
        reply.code(403).send({ error: 'Insufficient permissions' });
        return;
      }

      await projectService.deleteProject(projectId, request.userId!);
      reply.code(204).send();
    } catch (error: any) {
      logger.error('Failed to delete project:', error);
      reply.code(400).send({ error: error.message });
    }
  });

  // List projects
  fastify.get<{
    Querystring: ProjectQuery;
  }>('/projects', async (request: AuthenticatedRequest, reply) => {
    try {
      const query = request.query as ProjectQuery;
      const {
        page = '1',
        pageSize = '20',
        orderBy = 'updated_at',
        orderDirection = 'DESC',
        organizationId,
        ownerId,
        status,
        visibility,
        tags,
        industry,
        criticality,
        search,
        startDate,
        endDate,
      } = query;

      const filters: ProjectFilters = {
        organizationId,
        ownerId,
        status: status as any,
        visibility: visibility as any,
        tags: tags ? tags.split(',') : undefined,
        industry,
        criticality,
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

      const result = await projectService.listProjects(filters, pagination, request.userId);
      reply.send({ success: true, ...result });
    } catch (error: any) {
      logger.error('Failed to list projects:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get project statistics
  fastify.get<{
    Params: ProjectParams;
  }>('/projects/:projectId/stats', async (request: AuthenticatedRequest, reply) => {
    try {
      const { projectId } = (request.params as ProjectParams);
      
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

      const stats = await projectService.getProjectStats(projectId);
      reply.send({ success: true, data: stats });
    } catch (error: any) {
      logger.error('Failed to get project stats:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Add collaborator
  fastify.post<{
    Params: ProjectParams;
    Body: {
      userId: string;
      role: CollaboratorRole;
      permissions?: CollaboratorPermission[];
    };
  }>('/projects/:projectId/collaborators', async (request: AuthenticatedRequest, reply) => {
    try {
      const { projectId } = (request.params as ProjectParams);
      
      if (!isValidUUID(projectId)) {
        reply.code(400).send({ error: 'Invalid project ID' });
        return;
      }

      // Check if user has manage collaborators permission
      const hasPermission = await collaborationService.hasPermission(
        projectId,
        request.userId!,
        CollaboratorPermission.MANAGE_COLLABORATORS
      );
      
      if (!hasPermission) {
        reply.code(403).send({ error: 'Insufficient permissions' });
        return;
      }

      const collaborator = await collaborationService.addCollaborator(
        projectId,
        request.body as any,
        request.userId!
      );
      
      reply.code(201).send({ success: true, data: collaborator });
    } catch (error: any) {
      logger.error('Failed to add collaborator:', error);
      reply.code(400).send({ error: error.message });
    }
  });

  // Update collaborator
  fastify.patch<{
    Params: CollaboratorParams;
    Body: {
      role?: CollaboratorRole;
      permissions?: CollaboratorPermission[];
    };
  }>('/projects/:projectId/collaborators/:userId', async (request: AuthenticatedRequest, reply) => {
    try {
      const { projectId, userId } = request.params;
      
      if (!isValidUUID(projectId) || !isValidUUID(userId)) {
        reply.code(400).send({ error: 'Invalid project or user ID' });
        return;
      }

      // Check if user has manage collaborators permission
      const hasPermission = await collaborationService.hasPermission(
        projectId,
        request.userId!,
        CollaboratorPermission.MANAGE_COLLABORATORS
      );
      
      if (!hasPermission) {
        reply.code(403).send({ error: 'Insufficient permissions' });
        return;
      }

      const collaborator = await collaborationService.updateCollaborator(
        projectId,
        userId,
        request.body,
        request.userId!
      );
      
      reply.send({ success: true, data: collaborator });
    } catch (error: any) {
      logger.error('Failed to update collaborator:', error);
      reply.code(400).send({ error: error.message });
    }
  });

  // Remove collaborator
  fastify.delete<{
    Params: CollaboratorParams;
  }>('/projects/:projectId/collaborators/:userId', async (request: AuthenticatedRequest, reply) => {
    try {
      const { projectId, userId } = request.params;
      
      if (!isValidUUID(projectId) || !isValidUUID(userId)) {
        reply.code(400).send({ error: 'Invalid project or user ID' });
        return;
      }

      // Check if user has manage collaborators permission
      const hasPermission = await collaborationService.hasPermission(
        projectId,
        request.userId!,
        CollaboratorPermission.MANAGE_COLLABORATORS
      );
      
      if (!hasPermission) {
        reply.code(403).send({ error: 'Insufficient permissions' });
        return;
      }

      await collaborationService.removeCollaborator(projectId, userId, request.userId!);
      reply.code(204).send();
    } catch (error: any) {
      logger.error('Failed to remove collaborator:', error);
      reply.code(400).send({ error: error.message });
    }
  });

  // List collaborators
  fastify.get<{
    Params: ProjectParams;
  }>('/projects/:projectId/collaborators', async (request: AuthenticatedRequest, reply) => {
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

      const collaborators = await collaborationService.listCollaborators(projectId);
      reply.send({ success: true, data: collaborators });
    } catch (error: any) {
      logger.error('Failed to list collaborators:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Accept collaboration invitation
  fastify.post<{
    Params: ProjectParams;
  }>('/projects/:projectId/collaborators/accept', async (request: AuthenticatedRequest, reply) => {
    try {
      const { projectId } = request.params;
      
      if (!isValidUUID(projectId)) {
        reply.code(400).send({ error: 'Invalid project ID' });
        return;
      }

      await collaborationService.acceptInvitation(projectId, request.userId!);
      reply.send({ success: true, message: 'Invitation accepted' });
    } catch (error: any) {
      logger.error('Failed to accept invitation:', error);
      reply.code(400).send({ error: error.message });
    }
  });

  // Update user's last active timestamp
  fastify.post<{
    Params: ProjectParams;
  }>('/projects/:projectId/activity', async (request: AuthenticatedRequest, reply) => {
    try {
      const { projectId } = request.params;
      
      if (!isValidUUID(projectId)) {
        reply.code(400).send({ error: 'Invalid project ID' });
        return;
      }

      await collaborationService.updateLastActive(projectId, request.userId!);
      reply.send({ success: true });
    } catch (error: any) {
      logger.error('Failed to update activity:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });
}