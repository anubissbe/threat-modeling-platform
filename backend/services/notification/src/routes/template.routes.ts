import { Router } from 'express';
import templateController from '../controllers/template.controller';
import { validateTemplateRequest, validateTemplateUpdate } from '../validation/template.validation';
import { authMiddleware } from '../middleware/auth.middleware';
import { rateLimitMiddleware } from '../middleware/rate-limiter';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Apply rate limiting
router.use(rateLimitMiddleware);

/**
 * @route POST /api/notifications/templates
 * @desc Create new notification template
 * @access Private
 */
router.post('/', validateTemplateRequest, templateController.createTemplate);

/**
 * @route GET /api/notifications/templates
 * @desc Get all notification templates
 * @access Private
 */
router.get('/', templateController.getTemplates);

/**
 * @route GET /api/notifications/templates/:id
 * @desc Get specific notification template
 * @access Private
 */
router.get('/:id', templateController.getTemplate);

/**
 * @route PUT /api/notifications/templates/:id
 * @desc Update notification template
 * @access Private
 */
router.put('/:id', validateTemplateUpdate, templateController.updateTemplate);

/**
 * @route DELETE /api/notifications/templates/:id
 * @desc Delete notification template (soft delete)
 * @access Private
 */
router.delete('/:id', templateController.deleteTemplate);

/**
 * @route POST /api/notifications/templates/:id/preview
 * @desc Preview template with variables
 * @access Private
 */
router.post('/:id/preview', templateController.previewTemplate);

/**
 * @route POST /api/notifications/templates/:id/clone
 * @desc Clone existing template
 * @access Private
 */
router.post('/:id/clone', templateController.cloneTemplate);

export default router;