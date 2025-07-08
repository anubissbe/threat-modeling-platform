import { Router } from 'express';
import preferenceController from '../controllers/preference.controller';
import { validatePreferencesRequest, validateSubscriptionRequest } from '../validation/preference.validation';
import { authMiddleware } from '../middleware/auth.middleware';
import { rateLimitMiddleware } from '../middleware/rate-limiter';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Apply rate limiting
router.use(rateLimitMiddleware);

/**
 * @route POST /api/notifications/preferences
 * @desc Set user notification preferences
 * @access Private
 */
router.post('/', validatePreferencesRequest, preferenceController.setPreferences);

/**
 * @route GET /api/notifications/preferences/:userId
 * @desc Get user notification preferences
 * @access Private
 */
router.get('/:userId', preferenceController.getPreferences);

/**
 * @route PUT /api/notifications/preferences/:userId
 * @desc Update user notification preferences
 * @access Private
 */
router.put('/:userId', preferenceController.updatePreferences);

/**
 * @route GET /api/notifications/preferences/defaults
 * @desc Get default notification preferences
 * @access Private
 */
router.get('/defaults', preferenceController.getDefaultPreferences);

/**
 * @route POST /api/notifications/subscriptions
 * @desc Create notification subscription
 * @access Private
 */
router.post('/subscriptions', validateSubscriptionRequest, preferenceController.createSubscription);

/**
 * @route GET /api/notifications/subscriptions/:userId
 * @desc Get user notification subscriptions
 * @access Private
 */
router.get('/subscriptions/:userId', preferenceController.getSubscriptions);

/**
 * @route PUT /api/notifications/subscriptions/:id
 * @desc Update notification subscription
 * @access Private
 */
router.put('/subscriptions/:id', preferenceController.updateSubscription);

/**
 * @route DELETE /api/notifications/subscriptions/:id
 * @desc Delete notification subscription
 * @access Private
 */
router.delete('/subscriptions/:id', preferenceController.deleteSubscription);

/**
 * @route GET /api/notifications/event-types
 * @desc Get available event types for subscriptions
 * @access Private
 */
router.get('/event-types', preferenceController.getAvailableEventTypes);

export default router;