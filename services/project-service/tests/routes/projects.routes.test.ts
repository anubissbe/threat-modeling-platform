import { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app';
import { ProjectStatus, ProjectVisibility } from '../../src/types';
import { v4 as uuidv4 } from 'uuid';

// Mock the database module
jest.mock('../../src/database', () => ({
  connectDatabase: jest.fn(),
  closeDatabase: jest.fn(),
  query: jest.fn(),
  queryPaginated: jest.fn(),
  withTransaction: jest.fn(),
}));

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    })),
  },
  auditLogger: {
    projectCreated: jest.fn(),
    projectUpdated: jest.fn(),
    projectDeleted: jest.fn(),
  },
}));

// Mock the services
jest.mock('../../src/services/project.service');
jest.mock('../../src/services/threat-model.service');
jest.mock('../../src/services/collaboration.service');

import { ProjectService } from '../../src/services/project.service';
import { CollaborationService } from '../../src/services/collaboration.service';

const MockProjectService = ProjectService as jest.MockedClass<typeof ProjectService>;
const MockCollaborationService = CollaborationService as jest.MockedClass<typeof CollaborationService>;

describe('Project Routes', () => {
  let app: FastifyInstance;
  let mockProjectService: jest.Mocked<ProjectService>;
  let mockCollaborationService: jest.Mocked<CollaborationService>;

  const mockToken = 'Bearer mock-jwt-token';
  const mockUserId = uuidv4();
  const mockProjectId = uuidv4();
  const mockOrgId = uuidv4();

  beforeAll(async () => {
    app = await createApp();
    await app.ready();
  });

  beforeEach(() => {
    mockProjectService = new MockProjectService() as jest.Mocked<ProjectService>;
    mockCollaborationService = new MockCollaborationService() as jest.Mocked<CollaborationService>;
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/projects', () => {
    const createProjectDto = {
      name: 'Test Project',
      description: 'Test project description',
      organizationId: mockOrgId,
      visibility: ProjectVisibility.ORGANIZATION,
      tags: ['test'],
    };

    const mockProject = {
      id: mockProjectId,
      name: 'Test Project',
      description: 'Test project description',
      organizationId: mockOrgId,
      ownerId: mockUserId,
      status: ProjectStatus.DRAFT,
      visibility: ProjectVisibility.ORGANIZATION,
      tags: ['test'],
      metadata: { criticality: 'medium' as const, compliance: [], stakeholders: [] },
      settings: {
        allowComments: true,
        requireApproval: false,
        autoSave: true,
        versioningEnabled: true,
        collaborationMode: 'open' as const,
        notificationsEnabled: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create a project successfully', async () => {
      mockProjectService.createProject.mockResolvedValueOnce(mockProject);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: {
          authorization: mockToken,
        },
        payload: createProjectDto,
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockProject);
    });

    it('should return 401 when no authorization token provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        payload: createProjectDto,
      });

      expect(response.statusCode).toBe(401);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('Authorization required');
    });

    it('should return 400 when project creation fails', async () => {
      mockProjectService.createProject.mockRejectedValueOnce(new Error('Project name already exists'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: {
          authorization: mockToken,
        },
        payload: createProjectDto,
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('Project name already exists');
    });
  });

  describe('GET /api/v1/projects/:projectId', () => {
    const mockProject = {
      id: mockProjectId,
      name: 'Test Project',
      description: 'Test project description',
      organizationId: mockOrgId,
      ownerId: mockUserId,
      status: ProjectStatus.ACTIVE,
      visibility: ProjectVisibility.ORGANIZATION,
      tags: ['test'],
      metadata: { criticality: 'high' as const, compliance: [], stakeholders: [] },
      settings: {
        allowComments: true,
        requireApproval: false,
        autoSave: true,
        versioningEnabled: true,
        collaborationMode: 'open' as const,
        notificationsEnabled: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should get a project successfully', async () => {
      mockProjectService.getProject.mockResolvedValueOnce(mockProject);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${mockProjectId}`,
        headers: {
          authorization: mockToken,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockProject);
    });

    it('should return 404 when project not found', async () => {
      mockProjectService.getProject.mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${mockProjectId}`,
        headers: {
          authorization: mockToken,
        },
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('Project not found');
    });

    it('should return 400 when project ID is invalid', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/projects/invalid-id',
        headers: {
          authorization: mockToken,
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('Invalid project ID');
    });
  });

  describe('PATCH /api/v1/projects/:projectId', () => {
    const updateData = {
      name: 'Updated Project Name',
      status: ProjectStatus.ACTIVE,
    };

    const mockUpdatedProject = {
      id: mockProjectId,
      name: 'Updated Project Name',
      description: 'Test project description',
      organizationId: mockOrgId,
      ownerId: mockUserId,
      status: ProjectStatus.ACTIVE,
      visibility: ProjectVisibility.ORGANIZATION,
      tags: ['test'],
      metadata: { criticality: 'medium' as const, compliance: [], stakeholders: [] },
      settings: {
        allowComments: true,
        requireApproval: false,
        autoSave: true,
        versioningEnabled: true,
        collaborationMode: 'open' as const,
        notificationsEnabled: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should update a project successfully', async () => {
      mockCollaborationService.hasPermission.mockResolvedValueOnce(true);
      mockProjectService.updateProject.mockResolvedValueOnce(mockUpdatedProject);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${mockProjectId}`,
        headers: {
          authorization: mockToken,
        },
        payload: updateData,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe('Updated Project Name');
    });

    it('should return 403 when user has insufficient permissions', async () => {
      mockCollaborationService.hasPermission.mockResolvedValueOnce(false);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${mockProjectId}`,
        headers: {
          authorization: mockToken,
        },
        payload: updateData,
      });

      expect(response.statusCode).toBe(403);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('Insufficient permissions');
    });
  });

  describe('DELETE /api/v1/projects/:projectId', () => {
    it('should delete a project successfully', async () => {
      mockCollaborationService.hasPermission.mockResolvedValueOnce(true);
      mockProjectService.deleteProject.mockResolvedValueOnce(undefined);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${mockProjectId}`,
        headers: {
          authorization: mockToken,
        },
      });

      expect(response.statusCode).toBe(204);
    });

    it('should return 403 when user has insufficient permissions', async () => {
      mockCollaborationService.hasPermission.mockResolvedValueOnce(false);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${mockProjectId}`,
        headers: {
          authorization: mockToken,
        },
      });

      expect(response.statusCode).toBe(403);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('Insufficient permissions');
    });
  });

  describe('GET /api/v1/projects', () => {
    const mockProjects = [
      {
        id: mockProjectId,
        name: 'Test Project 1',
        description: 'Test description 1',
        organizationId: mockOrgId,
        ownerId: mockUserId,
        status: ProjectStatus.ACTIVE,
        visibility: ProjectVisibility.ORGANIZATION,
        tags: ['test'],
        metadata: { criticality: 'high' as const, compliance: [], stakeholders: [] },
        settings: {
          allowComments: true,
          requireApproval: false,
          autoSave: true,
          versioningEnabled: true,
          collaborationMode: 'open' as const,
          notificationsEnabled: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const mockPaginatedResponse = {
      data: mockProjects,
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      },
    };

    it('should list projects successfully', async () => {
      mockProjectService.listProjects.mockResolvedValueOnce(mockPaginatedResponse);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: {
          authorization: mockToken,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockProjects);
      expect(data.pagination).toEqual(mockPaginatedResponse.pagination);
    });

    it('should handle query parameters correctly', async () => {
      mockProjectService.listProjects.mockResolvedValueOnce(mockPaginatedResponse);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/projects?page=2&pageSize=10&search=test&status=active',
        headers: {
          authorization: mockToken,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockProjectService.listProjects).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'test',
          status: 'active',
        }),
        expect.objectContaining({
          page: 2,
          pageSize: 10,
        }),
        expect.any(String)
      );
    });
  });
});