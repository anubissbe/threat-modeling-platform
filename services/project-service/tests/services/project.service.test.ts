import { ProjectService } from '../../src/services/project.service';
import { ProjectStatus, ProjectVisibility } from '../../src/types';
import { query } from '../../src/database';
import { v4 as uuidv4 } from 'uuid';

// Mock the database module
jest.mock('../../src/database', () => ({
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
  },
  auditLogger: {
    projectCreated: jest.fn(),
    projectUpdated: jest.fn(),
    projectDeleted: jest.fn(),
  },
}));

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('ProjectService', () => {
  let projectService: ProjectService;
  const mockUserId = uuidv4();
  const mockOrgId = uuidv4();
  const mockProjectId = uuidv4();

  beforeEach(() => {
    projectService = new ProjectService();
    jest.clearAllMocks();
  });

  describe('createProject', () => {
    const mockCreateProjectDto = {
      name: 'Test Project',
      description: 'Test project description',
      organizationId: mockOrgId,
      visibility: ProjectVisibility.ORGANIZATION,
      tags: ['test', 'project'],
    };

    const mockProjectRow = {
      id: mockProjectId,
      name: 'Test Project',
      description: 'Test project description',
      organization_id: mockOrgId,
      owner_id: mockUserId,
      status: ProjectStatus.DRAFT,
      visibility: ProjectVisibility.ORGANIZATION,
      tags: JSON.stringify(['test', 'project']),
      metadata: JSON.stringify({ criticality: 'medium', compliance: [], stakeholders: [] }),
      settings: JSON.stringify({
        allowComments: true,
        requireApproval: false,
        autoSave: true,
        versioningEnabled: true,
        collaborationMode: 'open',
        notificationsEnabled: true,
      }),
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should create a project successfully', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [mockProjectRow],
      });

      const result = await projectService.createProject(mockCreateProjectDto, mockUserId);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projects.projects'),
        expect.arrayContaining([
          mockCreateProjectDto.name,
          mockCreateProjectDto.description,
          mockCreateProjectDto.organizationId,
          mockUserId,
          ProjectStatus.DRAFT,
          mockCreateProjectDto.visibility,
          JSON.stringify(mockCreateProjectDto.tags),
          expect.any(String), // metadata JSON
          expect.any(String), // settings JSON
        ])
      );

      expect(result).toEqual({
        id: mockProjectId,
        name: mockCreateProjectDto.name,
        description: mockCreateProjectDto.description,
        organizationId: mockOrgId,
        ownerId: mockUserId,
        status: ProjectStatus.DRAFT,
        visibility: ProjectVisibility.ORGANIZATION,
        tags: ['test', 'project'],
        metadata: expect.any(Object),
        settings: expect.any(Object),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        deletedAt: undefined,
      });
    });

    it('should handle unique constraint violation', async () => {
      const error = new Error('Unique constraint violation');
      (error as any).code = '23505';
      mockQuery.mockRejectedValueOnce(error);

      await expect(projectService.createProject(mockCreateProjectDto, mockUserId))
        .rejects
        .toThrow('Project name already exists in organization');
    });

    it('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      mockQuery.mockRejectedValueOnce(error);

      await expect(projectService.createProject(mockCreateProjectDto, mockUserId))
        .rejects
        .toThrow('Database connection failed');
    });
  });

  describe('getProject', () => {
    const mockProjectRowWithJoins = {
      id: mockProjectId,
      name: 'Test Project',
      description: 'Test project description',
      organization_id: mockOrgId,
      owner_id: mockUserId,
      status: ProjectStatus.ACTIVE,
      visibility: ProjectVisibility.ORGANIZATION,
      tags: JSON.stringify(['test']),
      metadata: JSON.stringify({ criticality: 'high' }),
      settings: JSON.stringify({ allowComments: true }),
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      owner_email: 'test@example.com',
      owner_first_name: 'Test',
      owner_last_name: 'User',
      organization_name: 'Test Org',
    };

    it('should get a project successfully', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [mockProjectRowWithJoins],
      });

      const result = await projectService.getProject(mockProjectId);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT p.*'),
        [mockProjectId]
      );

      expect(result).toEqual({
        id: mockProjectId,
        name: 'Test Project',
        description: 'Test project description',
        organizationId: mockOrgId,
        ownerId: mockUserId,
        status: ProjectStatus.ACTIVE,
        visibility: ProjectVisibility.ORGANIZATION,
        tags: ['test'],
        metadata: { criticality: 'high' },
        settings: { allowComments: true },
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        deletedAt: null,
        ownerEmail: 'test@example.com',
        ownerName: 'Test User',
        organizationName: 'Test Org',
        threatModelCount: 0,
        collaboratorCount: 0,
      });
    });

    it('should return null when project not found', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
      });

      const result = await projectService.getProject(mockProjectId);

      expect(result).toBeNull();
    });
  });

  describe('updateProject', () => {
    const mockUpdateData = {
      name: 'Updated Project Name',
      status: ProjectStatus.ACTIVE,
    };

    const mockUpdatedProjectRow = {
      id: mockProjectId,
      name: 'Updated Project Name',
      description: 'Test description',
      organization_id: mockOrgId,
      owner_id: mockUserId,
      status: ProjectStatus.ACTIVE,
      visibility: ProjectVisibility.ORGANIZATION,
      tags: JSON.stringify(['test']),
      metadata: JSON.stringify({ criticality: 'medium' }),
      settings: JSON.stringify({ allowComments: true }),
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should update a project successfully', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [mockUpdatedProjectRow],
      });

      const result = await projectService.updateProject(mockProjectId, mockUpdateData, mockUserId);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE projects.projects'),
        expect.arrayContaining([
          mockUpdateData.name,
          mockUpdateData.status,
          mockProjectId,
        ])
      );

      expect(result.name).toBe('Updated Project Name');
      expect(result.status).toBe(ProjectStatus.ACTIVE);
    });

    it('should throw error when project not found', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
      });

      await expect(projectService.updateProject(mockProjectId, mockUpdateData, mockUserId))
        .rejects
        .toThrow('Project not found');
    });

    it('should throw error when no fields to update', async () => {
      await expect(projectService.updateProject(mockProjectId, {}, mockUserId))
        .rejects
        .toThrow('No fields to update');
    });
  });

  describe('hasProjectAccess', () => {
    it('should return true when user has access', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ '?column?': 1 }],
      });

      const result = await projectService.hasProjectAccess(mockProjectId, mockUserId);

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT 1 FROM projects.projects'),
        [mockProjectId, mockUserId]
      );
    });

    it('should return false when user has no access', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
      });

      const result = await projectService.hasProjectAccess(mockProjectId, mockUserId);

      expect(result).toBe(false);
    });
  });

  describe('getProjectStats', () => {
    it('should return project statistics', async () => {
      const mockStats = [
        { rows: [{ count: '5' }] },  // threat models
        { rows: [{ count: '15' }] }, // threats
        { rows: [{ count: '10' }] }, // mitigations
        { rows: [{ count: '3' }] },  // collaborators
      ];

      mockQuery
        .mockResolvedValueOnce(mockStats[0])
        .mockResolvedValueOnce(mockStats[1])
        .mockResolvedValueOnce(mockStats[2])
        .mockResolvedValueOnce(mockStats[3]);

      const result = await projectService.getProjectStats(mockProjectId);

      expect(result).toEqual({
        threatModelCount: 5,
        threatCount: 15,
        mitigationCount: 10,
        collaboratorCount: 3,
      });

      expect(mockQuery).toHaveBeenCalledTimes(4);
    });
  });
});