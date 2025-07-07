import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { validateRequest } from '../validation/auth.validation';
import { loginSchema, registerSchema, refreshTokenSchema, updateRoleSchema } from '../validation/auth.validation';
import { authRateLimiter, registerRateLimiter } from '../middleware/rate-limiter';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error-handler';
import { logger } from '../utils/logger';

export function createAuthRouter(): Router {
  const router = Router();
  const authService = new AuthService();
  const userService = new UserService();

  // Login endpoint
  router.post('/login', 
    // Skip rate limiting in development
    process.env['NODE_ENV'] === 'development' ? (req: any, res: any, next: any) => next() : authRateLimiter,
    validateRequest(loginSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { email, password } = req.body;
      
      try {
        const tokens = await authService.login({ email, password });
        
        res.json({
          success: true,
          data: tokens,
          message: 'Login successful'
        });
      } catch (error) {
        logger.warn(`Login attempt failed for email: ${email}`, { error: (error as Error).message });
        res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }
    })
  );

  // Register endpoint
  router.post('/register',
    // Skip rate limiting in development
    process.env['NODE_ENV'] === 'development' ? (req: any, res: any, next: any) => next() : registerRateLimiter,
    validateRequest(registerSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { email, password, firstName, lastName, organization } = req.body;
      
      try {
        const tokens = await authService.register({
          email,
          password,
          firstName,
          lastName,
          organization
        });
        
        res.status(201).json({
          success: true,
          data: tokens,
          message: 'Registration successful'
        });
      } catch (error) {
        const message = (error as Error).message;
        if (message.includes('already exists')) {
          res.status(409).json({
            success: false,
            error: 'User with this email already exists'
          });
        } else if (message.includes('Password validation failed')) {
          res.status(400).json({
            success: false,
            error: message
          });
        } else {
          throw error;
        }
      }
    })
  );

  // Refresh token endpoint
  router.post('/refresh',
    validateRequest(refreshTokenSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { refreshToken } = req.body;
      
      try {
        const tokens = await authService.refreshToken({ refreshToken });
        
        res.json({
          success: true,
          data: tokens,
          message: 'Token refreshed successfully'
        });
      } catch (error) {
        res.status(401).json({
          success: false,
          error: 'Invalid refresh token'
        });
      }
    })
  );

  // Logout endpoint
  router.post('/logout',
    authenticateToken,
    asyncHandler(async (req: Request, res: Response) => {
      const { refreshToken } = req.body;
      const userId = req.user!.id;
      
      try {
        await authService.logout(userId, refreshToken);
        
        res.json({
          success: true,
          message: 'Logged out successfully'
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: 'Logout failed'
        });
      }
    })
  );

  // Logout all sessions endpoint
  router.post('/logout-all',
    authenticateToken,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      
      try {
        await authService.logoutAll(userId);
        
        res.json({
          success: true,
          message: 'All sessions logged out successfully'
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: 'Logout all failed'
        });
      }
    })
  );

  // Get current user profile
  router.get('/profile',
    authenticateToken,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      
      try {
        const user = await userService.getUserById(userId);
        
        if (!user) {
          res.status(404).json({
            success: false,
            error: 'User not found'
          });
          return;
        }
        
        res.json({
          success: true,
          data: user
        });
      } catch (error) {
        throw error;
      }
    })
  );

  // Update user role (admin only)
  router.patch('/users/:userId/role',
    authenticateToken,
    requireAdmin,
    validateRequest(updateRoleSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { userId } = req.params;
      const { role } = req.body;
      
      try {
        await userService.updateUserRole(userId, role);
        
        res.json({
          success: true,
          message: 'User role updated successfully'
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: 'Failed to update user role'
        });
      }
    })
  );

  // Get user by ID (admin only)
  router.get('/users/:userId',
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { userId } = req.params;
      
      try {
        const user = await userService.getUserById(userId);
        
        if (!user) {
          res.status(404).json({
            success: false,
            error: 'User not found'
          });
          return;
        }
        
        res.json({
          success: true,
          data: user
        });
      } catch (error) {
        throw error;
      }
    })
  );

  return router;
}