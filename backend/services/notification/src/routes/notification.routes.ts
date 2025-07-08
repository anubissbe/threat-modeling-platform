import { Router } from 'express';
import notificationController from '../controllers/notification.controller';
import { validateNotificationRequest, validateScheduleRequest } from '../validation/notification.validation';
import { authMiddleware } from '../middleware/auth.middleware';
import { rateLimitMiddleware } from '../middleware/rate-limiter';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Apply rate limiting
router.use(rateLimitMiddleware);

/**
 * @route POST /api/notifications/send
 * @desc Send immediate notification
 * @access Private
 */
router.post('/send', validateNotificationRequest, notificationController.sendNotification);

/**
 * @route POST /api/notifications/schedule
 * @desc Schedule future notification
 * @access Private
 */
router.post('/schedule', validateScheduleRequest, notificationController.scheduleNotification);

/**
 * @route POST /api/notifications/bulk
 * @desc Send multiple notifications at once
 * @access Private
 */
router.post('/bulk', notificationController.bulkSendNotifications);

/**
 * @route GET /api/notifications
 * @desc Get notifications for the authenticated user
 * @access Private
 */
router.get('/', notificationController.getNotifications);

/**
 * @route GET /api/notifications/:userId
 * @desc Get notifications for a specific user (admin only)
 * @access Private
 */
router.get('/:userId', notificationController.getNotifications);

/**
 * @route GET /api/notifications/:id/details
 * @desc Get specific notification details
 * @access Private
 */
router.get('/:id/details', notificationController.getNotificationById);

/**
 * @route DELETE /api/notifications/:id
 * @desc Cancel scheduled notification
 * @access Private
 */
router.delete('/:id', notificationController.cancelNotification);

/**
 * @route POST /api/notifications/:id/resend
 * @desc Resend failed notification
 * @access Private
 */
router.post('/:id/resend', notificationController.resendNotification);

/**
 * @route GET /api/notifications/:userId/stats
 * @desc Get notification statistics for user
 * @access Private
 */
router.get('/:userId/stats', notificationController.getNotificationStats);

/**
 * @route POST /api/notifications/events
 * @desc Process notification event (internal use)
 * @access Private
 */
router.post('/events', notificationController.processEvent);

export default router;