import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { config } from '../../config';
import { logger, notificationLogger } from '../../utils/logger';
import {
  WebhookProvider,
  WebhookNotification,
  WebhookResult,
  WebhookRetryPolicy,
} from '../../types';

export class HTTPWebhookProvider implements WebhookProvider {
  private client: AxiosInstance;
  private retryPolicy: WebhookRetryPolicy;

  constructor(retryPolicy?: WebhookRetryPolicy) {
    this.client = axios.create({
      timeout: config.WEBHOOK_TIMEOUT_MS,
      headers: {
        'User-Agent': 'ThreatModelingApp/1.0 WebhookService',
      },
    });

    this.retryPolicy = retryPolicy || {
      maxRetries: config.WEBHOOK_MAX_RETRIES,
      initialDelay: config.NOTIFICATION_RETRY_DELAY_MS,
      maxDelay: 60000,
      backoffMultiplier: 2,
    };

    // Add request/response interceptors for logging
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Webhook request', {
          url: config.url,
          method: config.method,
          headers: config.headers,
        });
        return config;
      },
      (error) => {
        logger.error('Webhook request error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Webhook response', {
          url: response.config.url,
          status: response.status,
          statusText: response.statusText,
        });
        return response;
      },
      (error) => {
        if (error.response) {
          logger.error('Webhook response error', {
            url: error.config?.url,
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
          });
        } else {
          logger.error('Webhook network error', error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  async verifyConnection(): Promise<boolean> {
    // Webhook providers don't have a general verification method
    // Connection will be verified when sending to specific endpoints
    return true;
  }

  async send(notification: WebhookNotification): Promise<WebhookResult> {
    let attempt = 0;
    let lastError: Error | null = null;
    let delay = this.retryPolicy.initialDelay;

    while (attempt <= this.retryPolicy.maxRetries) {
      const startTime = Date.now();

      try {
        const response = await this.sendWebhook(notification);
        
        const duration = Date.now() - startTime;
        notificationLogger.webhookSent(
          notification.url,
          response.status,
          duration
        );

        return {
          status: response.status,
          statusText: response.statusText,
          responseTime: duration,
          attempt: attempt + 1,
          data: response.data,
        };

      } catch (error: any) {
        lastError = error;
        const duration = Date.now() - startTime;
        
        notificationLogger.webhookFailed(
          notification.url,
          error,
          attempt + 1
        );

        // Check if we should retry
        if (attempt < this.retryPolicy.maxRetries && this.shouldRetry(error)) {
          notificationLogger.retrying(
            'webhook',
            notification.url,
            attempt + 2
          );

          // Wait before retrying
          await this.delay(delay);
          
          // Calculate next delay with exponential backoff
          delay = Math.min(
            delay * this.retryPolicy.backoffMultiplier,
            this.retryPolicy.maxDelay
          );
          
          attempt++;
        } else {
          // No more retries
          break;
        }
      }
    }

    // All attempts failed
    return {
      status: 0,
      statusText: 'Failed',
      responseTime: 0,
      attempt: attempt + 1,
      error: lastError?.message || 'Unknown error',
    };
  }

  private async sendWebhook(notification: WebhookNotification): Promise<any> {
    const headers = {
      ...notification.headers,
      'Content-Type': notification.contentType || 'application/json',
      'X-Webhook-Event': notification.event,
      'X-Webhook-Id': notification.id,
      'X-Webhook-Timestamp': Date.now().toString(),
    };

    // Add signature if secret is provided
    if (notification.secret) {
      const signature = this.generateSignature(
        notification.payload,
        notification.secret
      );
      headers['X-Webhook-Signature'] = signature;
    }

    // Add custom authentication
    if (notification.auth) {
      switch (notification.auth.type) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${notification.auth.token}`;
          break;
        case 'basic':
          const credentials = Buffer.from(
            `${notification.auth.username}:${notification.auth.password}`
          ).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
          break;
        case 'apikey':
          headers[notification.auth.headerName || 'X-API-Key'] = notification.auth.key;
          break;
      }
    }

    return await this.client.request({
      method: notification.method || 'POST',
      url: notification.url,
      data: notification.payload,
      headers,
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
    });
  }

  private generateSignature(payload: any, secret: string): string {
    const body = typeof payload === 'string' 
      ? payload 
      : JSON.stringify(payload);
    
    return crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
  }

  private shouldRetry(error: any): boolean {
    // Don't retry on client errors (4xx)
    if (error.response && error.response.status >= 400 && error.response.status < 500) {
      return false;
    }

    // Retry on network errors or server errors (5xx)
    return !error.response || error.response.status >= 500;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Webhook validation utilities
export const validateWebhookSignature = (
  payload: string | Buffer,
  signature: string,
  secret: string,
  algorithm: string = 'sha256'
): boolean => {
  const expectedSignature = crypto
    .createHmac(algorithm, secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

export const parseWebhookPayload = (
  body: string | Buffer,
  contentType: string
): any => {
  if (contentType.includes('application/json')) {
    return JSON.parse(body.toString());
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(body.toString());
    const result: any = {};
    for (const [key, value] of params) {
      result[key] = value;
    }
    return result;
  } else {
    return body.toString();
  }
};

// Webhook event builders
export const buildWebhookPayload = (
  event: string,
  data: any,
  metadata?: any
): any => {
  return {
    event,
    timestamp: new Date().toISOString(),
    data,
    metadata: {
      ...metadata,
      source: 'threat-modeling-app',
      version: '1.0.0',
    },
  };
};

export const buildSecurityAlertWebhook = (
  alert: {
    type: string;
    severity: string;
    title: string;
    description: string;
    affectedResources: string[];
    recommendations: string[];
  }
): any => {
  return buildWebhookPayload('security.alert', {
    type: alert.type,
    severity: alert.severity,
    title: alert.title,
    description: alert.description,
    affected_resources: alert.affectedResources,
    recommendations: alert.recommendations,
    detected_at: new Date().toISOString(),
  });
};

export const buildThreatDetectedWebhook = (
  threat: {
    id: string;
    category: string;
    severity: string;
    confidence: number;
    description: string;
    mitigations: string[];
  }
): any => {
  return buildWebhookPayload('threat.detected', {
    threat_id: threat.id,
    category: threat.category,
    severity: threat.severity,
    confidence_score: threat.confidence,
    description: threat.description,
    suggested_mitigations: threat.mitigations,
  });
};

export const buildProjectStatusWebhook = (
  project: {
    id: string;
    name: string;
    status: string;
    threatCount: number;
    vulnerabilityCount: number;
    riskScore: number;
  }
): any => {
  return buildWebhookPayload('project.status_changed', {
    project_id: project.id,
    project_name: project.name,
    status: project.status,
    metrics: {
      total_threats: project.threatCount,
      total_vulnerabilities: project.vulnerabilityCount,
      risk_score: project.riskScore,
    },
  });
};