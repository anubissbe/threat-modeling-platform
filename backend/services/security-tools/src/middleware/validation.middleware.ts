import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Internal validation error'
      });
    }
  };
};

export const validateQuery = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = await schema.parseAsync(req.query);
      req.query = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: 'Query validation error',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Internal validation error'
      });
    }
  };
};

export const validateParams = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = await schema.parseAsync(req.params);
      req.params = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: 'Parameter validation error',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Internal validation error'
      });
    }
  };
};

// Custom validators for security-specific requirements
export const validateIntegrationPlatform = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { type, platform } = req.body;

  // Validate platform is appropriate for the tool type
  const validPlatforms: Record<string, string[]> = {
    'siem': ['splunk', 'qradar', 'elastic', 'sentinel', 'chronicle', 'sumologic', 'custom'],
    'vulnerability-scanner': ['nessus', 'qualys', 'rapid7', 'openvas', 'acunetix', 'burp', 'custom'],
    'cloud-security': ['aws', 'azure', 'gcp', 'alibaba', 'oracle', 'ibm'],
    'ticketing': ['jira', 'servicenow', 'remedy', 'zendesk', 'freshservice', 'custom']
  };

  if (type && platform && validPlatforms[type]) {
    if (!validPlatforms[type].includes(platform)) {
      res.status(400).json({
        success: false,
        error: `Invalid platform '${platform}' for tool type '${type}'`,
        validPlatforms: validPlatforms[type]
      });
      return;
    }
  }

  next();
};

export const validateCredentials = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { connectionConfig } = req.body;

  if (!connectionConfig || !connectionConfig.credentials) {
    next();
    return;
  }

  const { authType, credentials } = connectionConfig;

  // Validate required credentials based on auth type
  const requiredFields: Record<string, string[]> = {
    'api-key': ['apiKey'],
    'oauth2': ['clientId', 'clientSecret'],
    'basic': ['username', 'password'],
    'token': ['token'],
    'certificate': ['certificate', 'privateKey']
  };

  if (authType && requiredFields[authType]) {
    const missing = requiredFields[authType].filter(
      field => !credentials[field]
    );

    if (missing.length > 0) {
      res.status(400).json({
        success: false,
        error: `Missing required credentials for auth type '${authType}'`,
        missingFields: missing
      });
      return;
    }
  }

  next();
};

export const sanitizeOutput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Override res.json to sanitize sensitive data
  const originalJson = res.json.bind(res);
  
  res.json = function(data: any) {
    const sanitized = sanitizeData(data);
    return originalJson(sanitized);
  };

  next();
};

function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }

  const sanitized = { ...data };

  // Remove sensitive fields
  const sensitiveFields = [
    'password',
    'apiKey',
    'apiToken',
    'token',
    'secret',
    'privateKey',
    'credentials',
    'clientSecret',
    'accessToken',
    'refreshToken'
  ];

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      if (typeof sanitized[field] === 'string') {
        sanitized[field] = '***REDACTED***';
      } else if (typeof sanitized[field] === 'object') {
        sanitized[field] = sanitizeData(sanitized[field]);
      }
    }
  }

  // Recursively sanitize nested objects
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }

  return sanitized;
}