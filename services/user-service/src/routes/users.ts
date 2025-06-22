import { FastifyPluginAsync } from 'fastify';
import { UserService } from '../services/user.service';
import { CacheManager } from '../redis';
import { 
  CreateUserDto, 
  UpdateUserDto, 
  UserFilters,
  PaginationParams 
} from '../types';
import { getPaginationDefaults } from '../config';
import { isValidUUID, isValidEmail } from '../utils/helpers';
import { NotFoundError, BadRequestError, ConflictError } from '../middleware/error-handler';

const userRoutes: FastifyPluginAsync = async (fastify) => {
  const cache = new CacheManager(await fastify.redis);
  const userService = new UserService(cache);
  const paginationDefaults = getPaginationDefaults();

  // List users
  fastify.get('/', {
    preHandler: [fastify.authenticate, fastify.requirePermissions(['users:read'])],
    schema: {
      tags: ['Users'],
      summary: 'List users',
      description: 'Get a paginated list of users with filtering options',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          pageSize: { type: 'integer', minimum: 1, maximum: paginationDefaults.maxPageSize, default: paginationDefaults.defaultPageSize },
          orderBy: { type: 'string', enum: ['created_at', 'updated_at', 'email', 'first_name', 'last_name'], default: 'created_at' },
          orderDirection: { type: 'string', enum: ['ASC', 'DESC'], default: 'DESC' },
          organizationId: { type: 'string', format: 'uuid' },
          teamId: { type: 'string', format: 'uuid' },
          roleId: { type: 'string', format: 'uuid' },
          isActive: { type: 'boolean' },
          emailVerified: { type: 'boolean' },
          search: { type: 'string', maxLength: 100 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/User' },
            },
            pagination: { $ref: '#/components/schemas/Pagination' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const filters: UserFilters = {
      organizationId: request.query.organizationId,
      teamId: request.query.teamId,
      roleId: request.query.roleId,
      isActive: request.query.isActive,
      emailVerified: request.query.emailVerified,
      search: request.query.search,
    };

    const pagination: PaginationParams = {
      page: request.query.page || 1,
      pageSize: request.query.pageSize || paginationDefaults.defaultPageSize,
      orderBy: request.query.orderBy || 'created_at',
      orderDirection: request.query.orderDirection || 'DESC',
    };

    // If not system admin, filter by user's organization
    if (!request.user?.roles.includes('system_admin') && request.user?.org) {
      filters.organizationId = request.user.org;
    }

    const result = await userService.listUsers(filters, pagination);
    return reply.send(result);
  });

  // Get user by ID
  fastify.get('/:userId', {
    preHandler: [fastify.authenticate, fastify.selfOrAdmin('userId')],
    schema: {
      tags: ['Users'],
      summary: 'Get user by ID',
      description: 'Get a specific user by their ID',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: { $ref: '#/components/schemas/User' },
        404: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  }, async (request, reply) => {
    const { userId } = request.params;

    if (!isValidUUID(userId)) {
      throw new BadRequestError('Invalid user ID format');
    }

    const user = await userService.getUser(userId);
    
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // If not admin and different org, check organization access
    if (!request.user?.roles.includes('system_admin') && 
        request.user?.org && 
        user.organizationId !== request.user.org) {
      throw new NotFoundError('User not found');
    }

    return reply.send(user);
  });

  // Create user
  fastify.post('/', {
    preHandler: [fastify.authenticate, fastify.requirePermissions(['users:create'])],
    schema: {
      tags: ['Users'],
      summary: 'Create user',
      description: 'Create a new user',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8, maxLength: 128 },
          firstName: { type: 'string', maxLength: 100 },
          lastName: { type: 'string', maxLength: 100 },
          organizationId: { type: 'string', format: 'uuid' },
          roles: { 
            type: 'array', 
            items: { type: 'string' },
            default: ['user'],
          },
        },
      },
      response: {
        201: { $ref: '#/components/schemas/User' },
        400: { $ref: '#/components/schemas/ErrorResponse' },
        409: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  }, async (request, reply) => {
    const data = request.body as CreateUserDto;

    // Validate email format
    if (!isValidEmail(data.email)) {
      throw new BadRequestError('Invalid email format');
    }

    // If not system admin, force organization to user's org
    if (!request.user?.roles.includes('system_admin') && request.user?.org) {
      data.organizationId = request.user.org;
    }

    // Validate organization access
    if (data.organizationId && 
        !request.user?.roles.includes('system_admin') && 
        data.organizationId !== request.user?.org) {
      throw new BadRequestError('Cannot create user in different organization');
    }

    try {
      const user = await userService.createUser(data, request.user?.sub);
      return reply.status(201).send(user);
    } catch (error) {
      if (error.message === 'Email already exists') {
        throw new ConflictError('Email already exists');
      }
      throw error;
    }
  });

  // Update user
  fastify.put('/:userId', {
    preHandler: [fastify.authenticate, fastify.selfOrAdmin('userId')],
    schema: {
      tags: ['Users'],
      summary: 'Update user',
      description: 'Update an existing user',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        properties: {
          firstName: { type: 'string', maxLength: 100 },
          lastName: { type: 'string', maxLength: 100 },
          avatar: { type: 'string', format: 'uri' },
          isActive: { type: 'boolean' },
        },
      },
      response: {
        200: { $ref: '#/components/schemas/User' },
        400: { $ref: '#/components/schemas/ErrorResponse' },
        404: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  }, async (request, reply) => {
    const { userId } = request.params;
    const data = request.body as UpdateUserDto;

    if (!isValidUUID(userId)) {
      throw new BadRequestError('Invalid user ID format');
    }

    // Regular users can only update certain fields
    if (!request.user?.roles.includes('admin') && 
        !request.user?.roles.includes('system_admin')) {
      delete data.isActive;
    }

    try {
      const user = await userService.updateUser(userId, data, request.user!.sub);
      return reply.send(user);
    } catch (error) {
      if (error.message === 'User not found') {
        throw new NotFoundError('User not found');
      }
      throw error;
    }
  });

  // Delete user
  fastify.delete('/:userId', {
    preHandler: [fastify.authenticate, fastify.requirePermissions(['users:delete'])],
    schema: {
      tags: ['Users'],
      summary: 'Delete user',
      description: 'Soft delete a user',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        204: { type: 'null' },
        404: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  }, async (request, reply) => {
    const { userId } = request.params;

    if (!isValidUUID(userId)) {
      throw new BadRequestError('Invalid user ID format');
    }

    // Prevent self-deletion
    if (userId === request.user?.sub) {
      throw new BadRequestError('Cannot delete your own account');
    }

    try {
      await userService.deleteUser(userId, request.user!.sub);
      return reply.status(204).send();
    } catch (error) {
      if (error.message === 'User not found') {
        throw new NotFoundError('User not found');
      }
      throw error;
    }
  });

  // Assign role to user
  fastify.post('/:userId/roles/:roleId', {
    preHandler: [fastify.authenticate, fastify.requirePermissions(['users:manage-roles'])],
    schema: {
      tags: ['Users'],
      summary: 'Assign role to user',
      description: 'Assign a role to a user',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['userId', 'roleId'],
        properties: {
          userId: { type: 'string', format: 'uuid' },
          roleId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        204: { type: 'null' },
        400: { $ref: '#/components/schemas/ErrorResponse' },
        404: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  }, async (request, reply) => {
    const { userId, roleId } = request.params;

    if (!isValidUUID(userId) || !isValidUUID(roleId)) {
      throw new BadRequestError('Invalid ID format');
    }

    await userService.assignRole(userId, roleId, request.user!.sub);
    return reply.status(204).send();
  });

  // Revoke role from user
  fastify.delete('/:userId/roles/:roleId', {
    preHandler: [fastify.authenticate, fastify.requirePermissions(['users:manage-roles'])],
    schema: {
      tags: ['Users'],
      summary: 'Revoke role from user',
      description: 'Remove a role from a user',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['userId', 'roleId'],
        properties: {
          userId: { type: 'string', format: 'uuid' },
          roleId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        204: { type: 'null' },
        404: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  }, async (request, reply) => {
    const { userId, roleId } = request.params;

    if (!isValidUUID(userId) || !isValidUUID(roleId)) {
      throw new BadRequestError('Invalid ID format');
    }

    try {
      await userService.revokeRole(userId, roleId, request.user!.sub);
      return reply.status(204).send();
    } catch (error) {
      if (error.message === 'User role assignment not found') {
        throw new NotFoundError('Role assignment not found');
      }
      throw error;
    }
  });

  // Get user permissions
  fastify.get('/:userId/permissions', {
    preHandler: [fastify.authenticate, fastify.selfOrAdmin('userId')],
    schema: {
      tags: ['Users'],
      summary: 'Get user permissions',
      description: 'Get all permissions for a user',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            permissions: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { userId } = request.params;

    if (!isValidUUID(userId)) {
      throw new BadRequestError('Invalid user ID format');
    }

    const permissions = await userService.getUserPermissions(userId);
    return reply.send({ permissions });
  });

  // Check user permission
  fastify.post('/:userId/permissions/check', {
    preHandler: [fastify.authenticate, fastify.selfOrAdmin('userId')],
    schema: {
      tags: ['Users'],
      summary: 'Check user permission',
      description: 'Check if a user has a specific permission',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        required: ['permission'],
        properties: {
          permission: { type: 'string' },
          resourceId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            hasPermission: { type: 'boolean' },
            permission: { type: 'string' },
            resourceId: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { userId } = request.params;
    const { permission, resourceId } = request.body;

    if (!isValidUUID(userId)) {
      throw new BadRequestError('Invalid user ID format');
    }

    const hasPermission = await userService.hasPermission(userId, permission, resourceId);
    return reply.send({ hasPermission, permission, resourceId });
  });
};

export { userRoutes };