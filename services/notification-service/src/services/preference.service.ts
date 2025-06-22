import Redis from 'ioredis';
import { config } from '../config';
import { logger, notificationLogger } from '../utils/logger';
import {
  NotificationPreference,
  NotificationChannel,
  NotificationEvent,
  UserPreferences,
} from '../types';

export class PreferenceService {
  private redis: Redis;
  private keyPrefix = 'notification:preferences';

  constructor() {
    this.redis = new Redis(config.REDIS_URL);
  }

  async getUserPreferences(userId: string): Promise<UserPreferences> {
    const key = `${this.keyPrefix}:${userId}`;
    const data = await this.redis.get(key);

    if (!data) {
      // Return default preferences
      return this.getDefaultPreferences(userId);
    }

    return JSON.parse(data);
  }

  async setUserPreferences(
    userId: string,
    preferences: UserPreferences
  ): Promise<void> {
    const key = `${this.keyPrefix}:${userId}`;
    const ttl = config.NOTIFICATION_TTL_DAYS * 24 * 60 * 60;

    await this.redis.set(
      key,
      JSON.stringify(preferences),
      'EX',
      ttl
    );

    logger.info(`Updated preferences for user ${userId}`);
  }

  async updateChannelPreference(
    userId: string,
    channel: NotificationChannel,
    enabled: boolean
  ): Promise<void> {
    const preferences = await this.getUserPreferences(userId);
    
    if (!preferences.channels) {
      preferences.channels = {};
    }

    preferences.channels[channel] = enabled;
    preferences.updatedAt = new Date();

    await this.setUserPreferences(userId, preferences);
    notificationLogger.preferenceUpdated(userId, channel, enabled);
  }

  async updateEventPreference(
    userId: string,
    event: NotificationEvent,
    channels: NotificationChannel[]
  ): Promise<void> {
    const preferences = await this.getUserPreferences(userId);
    
    if (!preferences.events) {
      preferences.events = {};
    }

    preferences.events[event] = channels;
    preferences.updatedAt = new Date();

    await this.setUserPreferences(userId, preferences);
    logger.info(`Updated event preferences for user ${userId}`, { event, channels });
  }

  async isChannelEnabled(
    userId: string,
    channel: NotificationChannel
  ): Promise<boolean> {
    const preferences = await this.getUserPreferences(userId);
    
    // Check if channel is explicitly disabled
    if (preferences.channels && preferences.channels[channel] === false) {
      return false;
    }

    // Default to enabled if not specified
    return true;
  }

  async getEnabledChannelsForEvent(
    userId: string,
    event: NotificationEvent
  ): Promise<NotificationChannel[]> {
    const preferences = await this.getUserPreferences(userId);
    
    // Get event-specific channels
    const eventChannels = preferences.events?.[event] || this.getDefaultChannelsForEvent(event);
    
    // Filter by enabled channels
    const enabledChannels = await Promise.all(
      eventChannels.map(async (channel) => {
        const enabled = await this.isChannelEnabled(userId, channel);
        return enabled ? channel : null;
      })
    );

    return enabledChannels.filter((channel): channel is NotificationChannel => channel !== null);
  }

  async addToUnsubscribeList(
    userId: string,
    channel: NotificationChannel,
    event?: NotificationEvent
  ): Promise<void> {
    const key = event
      ? `${this.keyPrefix}:unsubscribe:${channel}:${event}`
      : `${this.keyPrefix}:unsubscribe:${channel}:all`;

    await this.redis.sadd(key, userId);
    notificationLogger.unsubscribed(userId, channel, event);
  }

  async removeFromUnsubscribeList(
    userId: string,
    channel: NotificationChannel,
    event?: NotificationEvent
  ): Promise<void> {
    const key = event
      ? `${this.keyPrefix}:unsubscribe:${channel}:${event}`
      : `${this.keyPrefix}:unsubscribe:${channel}:all`;

    await this.redis.srem(key, userId);
    logger.info(`User ${userId} resubscribed to ${channel}${event ? ` for ${event}` : ''}`);
  }

  async isUnsubscribed(
    userId: string,
    channel: NotificationChannel,
    event?: NotificationEvent
  ): Promise<boolean> {
    // Check global unsubscribe first
    const globalKey = `${this.keyPrefix}:unsubscribe:${channel}:all`;
    const isGloballyUnsubscribed = await this.redis.sismember(globalKey, userId);
    
    if (isGloballyUnsubscribed) {
      return true;
    }

    // Check event-specific unsubscribe
    if (event) {
      const eventKey = `${this.keyPrefix}:unsubscribe:${channel}:${event}`;
      return Boolean(await this.redis.sismember(eventKey, userId));
    }

    return false;
  }

  async getUnsubscribeToken(userId: string, channel: NotificationChannel): Promise<string> {
    const token = Buffer.from(
      JSON.stringify({ userId, channel, timestamp: Date.now() })
    ).toString('base64url');

    // Store token for verification
    const key = `${this.keyPrefix}:unsubscribe:token:${token}`;
    await this.redis.set(key, userId, 'EX', 30 * 24 * 60 * 60); // 30 days

    return token;
  }

  async verifyUnsubscribeToken(token: string): Promise<{ userId: string; channel: NotificationChannel } | null> {
    const key = `${this.keyPrefix}:unsubscribe:token:${token}`;
    const userId = await this.redis.get(key);

    if (!userId) {
      return null;
    }

    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64url').toString());
      return { userId, channel: decoded.channel };
    } catch (error) {
      logger.error('Invalid unsubscribe token:', error);
      return null;
    }
  }

  async setDoNotDisturb(
    userId: string,
    enabled: boolean,
    until?: Date
  ): Promise<void> {
    const preferences = await this.getUserPreferences(userId);
    
    preferences.doNotDisturb = {
      enabled,
      until: until || null,
    };
    preferences.updatedAt = new Date();

    await this.setUserPreferences(userId, preferences);
    logger.info(`Do Not Disturb ${enabled ? 'enabled' : 'disabled'} for user ${userId}`);
  }

  async isDoNotDisturb(userId: string): Promise<boolean> {
    const preferences = await this.getUserPreferences(userId);
    
    if (!preferences.doNotDisturb?.enabled) {
      return false;
    }

    // Check if DND has expired
    if (preferences.doNotDisturb.until) {
      const now = new Date();
      const until = new Date(preferences.doNotDisturb.until);
      
      if (now > until) {
        // DND has expired, disable it
        await this.setDoNotDisturb(userId, false);
        return false;
      }
    }

    return true;
  }

  async setQuietHours(
    userId: string,
    startHour: number,
    endHour: number,
    timezone: string = 'UTC'
  ): Promise<void> {
    const preferences = await this.getUserPreferences(userId);
    
    preferences.quietHours = {
      enabled: true,
      startHour,
      endHour,
      timezone,
    };
    preferences.updatedAt = new Date();

    await this.setUserPreferences(userId, preferences);
    logger.info(`Quiet hours set for user ${userId}: ${startHour}-${endHour} ${timezone}`);
  }

  async isInQuietHours(userId: string): Promise<boolean> {
    const preferences = await this.getUserPreferences(userId);
    
    if (!preferences.quietHours?.enabled) {
      return false;
    }

    const { startHour, endHour, timezone } = preferences.quietHours;
    
    // Get current hour in user's timezone
    const now = new Date();
    const userTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const currentHour = userTime.getHours();

    // Handle cases where quiet hours span midnight
    if (startHour <= endHour) {
      return currentHour >= startHour && currentHour < endHour;
    } else {
      return currentHour >= startHour || currentHour < endHour;
    }
  }

  async shouldSendNotification(
    userId: string,
    channel: NotificationChannel,
    event: NotificationEvent
  ): Promise<boolean> {
    // Check if user is unsubscribed
    if (await this.isUnsubscribed(userId, channel, event)) {
      return false;
    }

    // Check if channel is enabled
    if (!(await this.isChannelEnabled(userId, channel))) {
      return false;
    }

    // Check if event is enabled for this channel
    const enabledChannels = await this.getEnabledChannelsForEvent(userId, event);
    if (!enabledChannels.includes(channel)) {
      return false;
    }

    // Check Do Not Disturb
    if (await this.isDoNotDisturb(userId)) {
      // Allow critical notifications even during DND
      if (!this.isCriticalEvent(event)) {
        return false;
      }
    }

    // Check quiet hours for non-critical notifications
    if (await this.isInQuietHours(userId)) {
      if (!this.isCriticalEvent(event)) {
        return false;
      }
    }

    return true;
  }

  private getDefaultPreferences(userId: string): UserPreferences {
    return {
      userId,
      channels: {
        email: true,
        sms: false,
        slack: true,
        webhook: false,
      },
      events: {
        'threat.detected': ['email', 'slack'],
        'threat.resolved': ['email'],
        'project.completed': ['email'],
        'project.updated': ['slack'],
        'report.generated': ['email'],
        'security.alert': ['email', 'sms', 'slack'],
        'user.mentioned': ['email', 'slack'],
        'system.maintenance': ['email'],
      },
      doNotDisturb: {
        enabled: false,
        until: null,
      },
      quietHours: {
        enabled: false,
        startHour: 22,
        endHour: 8,
        timezone: 'UTC',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private getDefaultChannelsForEvent(event: NotificationEvent): NotificationChannel[] {
    const defaults: Record<NotificationEvent, NotificationChannel[]> = {
      'threat.detected': ['email', 'slack'],
      'threat.resolved': ['email'],
      'project.completed': ['email'],
      'project.updated': ['slack'],
      'report.generated': ['email'],
      'security.alert': ['email', 'sms', 'slack'],
      'user.mentioned': ['email', 'slack'],
      'system.maintenance': ['email'],
    };

    return defaults[event] || ['email'];
  }

  private isCriticalEvent(event: NotificationEvent): boolean {
    return event === 'security.alert' || event === 'threat.detected';
  }

  async cleanup(): Promise<void> {
    await this.redis.quit();
  }
}

// Export singleton instance
export const preferenceService = new PreferenceService();