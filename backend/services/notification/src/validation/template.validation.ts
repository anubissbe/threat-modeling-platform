import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { ApiResponse, ValidationError } from '../types';

// Zod schemas for template validation
const TemplateTypeSchema = z.enum([
  'threat_model_created',
  'threat_model_updated', 
  'threat_model_deleted',
  'threat_identified',
  'threat_mitigated',
  'collaboration_invited',
  'collaboration_mentioned',
  'report_generated',
  'system_maintenance',
  'custom'
]);

const CreateTemplateSchema = z.object({
  name: z.string()
    .min(1, 'Template name is required')
    .max(255, 'Template name too long')
    .regex(/^[a-zA-Z0-9_\s-]+$/, 'Template name contains invalid characters'),
  type: TemplateTypeSchema,
  subject: z.string()
    .min(1, 'Subject is required')
    .max(255, 'Subject too long'),
  body: z.string()
    .min(1, 'Body is required')
    .max(10000, 'Body too long'),
  htmlBody: z.string()
    .max(50000, 'HTML body too long')
    .optional(),
  variables: z.record(z.any()).optional(),
});

const UpdateTemplateSchema = z.object({
  name: z.string()
    .min(1, 'Template name is required')
    .max(255, 'Template name too long')
    .regex(/^[a-zA-Z0-9_\s-]+$/, 'Template name contains invalid characters')
    .optional(),
  type: TemplateTypeSchema.optional(),
  subject: z.string()
    .min(1, 'Subject is required')
    .max(255, 'Subject too long')
    .optional(),
  body: z.string()
    .min(1, 'Body is required')
    .max(10000, 'Body too long')
    .optional(),
  htmlBody: z.string()
    .max(50000, 'HTML body too long')
    .optional(),
  variables: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
});

const PreviewTemplateSchema = z.object({
  variables: z.record(z.any()).optional(),
});

const CloneTemplateSchema = z.object({
  name: z.string()
    .min(1, 'Template name is required')
    .max(255, 'Template name too long')
    .regex(/^[a-zA-Z0-9_\s-]+$/, 'Template name contains invalid characters'),
});

// Validation middleware functions
export const validateTemplateRequest = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const result = CreateTemplateSchema.safeParse(req.body);
    
    if (!result.success) {
      const errors: ValidationError[] = result.error.errors.map(error => ({
        field: error.path.join('.'),
        message: error.message,
        value: error.path.reduce((obj, key) => obj?.[key], req.body),
      }));

      const response: ApiResponse = {
        success: false,
        message: 'Template validation failed',
        errors,
      };

      logger.warn('Template creation validation failed:', errors);
      res.status(400).json(response);
      return;
    }

    // Validate template variables
    const variableErrors = validateTemplateVariables(result.data.subject, result.data.body, result.data.variables);
    if (variableErrors.length > 0) {
      const response: ApiResponse = {
        success: false,
        message: 'Template variable validation failed',
        errors: variableErrors,
      };

      res.status(400).json(response);
      return;
    }

    // Validate HTML if provided
    if (result.data.htmlBody) {
      const htmlErrors = validateHTMLContent(result.data.htmlBody);
      if (htmlErrors.length > 0) {
        const response: ApiResponse = {
          success: false,
          message: 'HTML validation failed',
          errors: htmlErrors,
        };

        res.status(400).json(response);
        return;
      }
    }

    req.body = result.data;
    next();
  } catch (error) {
    logger.error('Template validation middleware error:', error);
    
    const response: ApiResponse = {
      success: false,
      message: 'Validation error',
      errors: [{ field: 'general', message: 'Internal validation error' }],
    };

    res.status(500).json(response);
  }
};

export const validateTemplateUpdate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const result = UpdateTemplateSchema.safeParse(req.body);
    
    if (!result.success) {
      const errors: ValidationError[] = result.error.errors.map(error => ({
        field: error.path.join('.'),
        message: error.message,
        value: error.path.reduce((obj, key) => obj?.[key], req.body),
      }));

      const response: ApiResponse = {
        success: false,
        message: 'Template update validation failed',
        errors,
      };

      logger.warn('Template update validation failed:', errors);
      res.status(400).json(response);
      return;
    }

    // Validate template variables if subject and body are provided
    if (result.data.subject || result.data.body) {
      const subject = result.data.subject || '';
      const body = result.data.body || '';
      const variables = result.data.variables;
      
      const variableErrors = validateTemplateVariables(subject, body, variables);
      if (variableErrors.length > 0) {
        const response: ApiResponse = {
          success: false,
          message: 'Template variable validation failed',
          errors: variableErrors,
        };

        res.status(400).json(response);
        return;
      }
    }

    // Validate HTML if provided
    if (result.data.htmlBody) {
      const htmlErrors = validateHTMLContent(result.data.htmlBody);
      if (htmlErrors.length > 0) {
        const response: ApiResponse = {
          success: false,
          message: 'HTML validation failed',
          errors: htmlErrors,
        };

        res.status(400).json(response);
        return;
      }
    }

    req.body = result.data;
    next();
  } catch (error) {
    logger.error('Template update validation middleware error:', error);
    
    const response: ApiResponse = {
      success: false,
      message: 'Validation error',
      errors: [{ field: 'general', message: 'Internal validation error' }],
    };

    res.status(500).json(response);
  }
};

export const validatePreviewRequest = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const result = PreviewTemplateSchema.safeParse(req.body);
    
    if (!result.success) {
      const errors: ValidationError[] = result.error.errors.map(error => ({
        field: error.path.join('.'),
        message: error.message,
        value: error.path.reduce((obj, key) => obj?.[key], req.body),
      }));

      const response: ApiResponse = {
        success: false,
        message: 'Preview validation failed',
        errors,
      };

      logger.warn('Template preview validation failed:', errors);
      res.status(400).json(response);
      return;
    }

    req.body = result.data;
    next();
  } catch (error) {
    logger.error('Template preview validation middleware error:', error);
    
    const response: ApiResponse = {
      success: false,
      message: 'Validation error',
      errors: [{ field: 'general', message: 'Internal validation error' }],
    };

    res.status(500).json(response);
  }
};

export const validateCloneRequest = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const result = CloneTemplateSchema.safeParse(req.body);
    
    if (!result.success) {
      const errors: ValidationError[] = result.error.errors.map(error => ({
        field: error.path.join('.'),
        message: error.message,
        value: error.path.reduce((obj, key) => obj?.[key], req.body),
      }));

      const response: ApiResponse = {
        success: false,
        message: 'Clone validation failed',
        errors,
      };

      logger.warn('Template clone validation failed:', errors);
      res.status(400).json(response);
      return;
    }

    req.body = result.data;
    next();
  } catch (error) {
    logger.error('Template clone validation middleware error:', error);
    
    const response: ApiResponse = {
      success: false,
      message: 'Validation error',
      errors: [{ field: 'general', message: 'Internal validation error' }],
    };

    res.status(500).json(response);
  }
};

// Helper function to validate template variables
function validateTemplateVariables(
  subject: string, 
  body: string, 
  variables?: Record<string, any>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const variableRegex = /\{\{(\w+)\}\}/g;
  
  // Extract variables from subject and body
  const usedVariables = new Set<string>();
  
  let match;
  while ((match = variableRegex.exec(subject)) !== null) {
    usedVariables.add(match[1]);
  }
  
  variableRegex.lastIndex = 0; // Reset regex
  while ((match = variableRegex.exec(body)) !== null) {
    usedVariables.add(match[1]);
  }

  // Check if all used variables are defined
  if (variables) {
    const definedVariables = new Set(Object.keys(variables));
    
    for (const variable of usedVariables) {
      if (!definedVariables.has(variable)) {
        errors.push({
          field: 'variables',
          message: `Variable '${variable}' is used in template but not defined`,
          value: variable,
        });
      }
    }

    // Check for unused variables
    for (const variable of definedVariables) {
      if (!usedVariables.has(variable)) {
        logger.warn(`Variable '${variable}' is defined but not used in template`);
      }
    }
  } else if (usedVariables.size > 0) {
    errors.push({
      field: 'variables',
      message: 'Template uses variables but none are defined',
      value: Array.from(usedVariables),
    });
  }

  return errors;
}

// Helper function to validate HTML content
function validateHTMLContent(html: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // Basic HTML validation
  try {
    // Check for basic HTML structure
    const hasOpeningTag = /<[^>]+>/g.test(html);
    const hasClosingTag = /<\/[^>]+>/g.test(html);
    
    if (hasOpeningTag && !hasClosingTag) {
      errors.push({
        field: 'htmlBody',
        message: 'HTML appears to have unclosed tags',
      });
    }

    // Check for dangerous scripts
    if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(html)) {
      errors.push({
        field: 'htmlBody',
        message: 'HTML contains script tags which are not allowed',
      });
    }

    // Check for form elements
    if (/<form\b[^>]*>/gi.test(html)) {
      errors.push({
        field: 'htmlBody',
        message: 'HTML contains form elements which are not recommended',
      });
    }

    // Check for external resources
    if (/src\s*=\s*["']?https?:\/\//gi.test(html)) {
      logger.warn('HTML contains external resources which may not load in email clients');
    }

    // Check for inline styles length
    const inlineStyleRegex = /style\s*=\s*["'][^"']*["']/gi;
    let styleMatch;
    while ((styleMatch = inlineStyleRegex.exec(html)) !== null) {
      if (styleMatch[0].length > 1000) {
        errors.push({
          field: 'htmlBody',
          message: 'Inline styles are too long, consider using external CSS',
        });
        break;
      }
    }

  } catch (error) {
    errors.push({
      field: 'htmlBody',
      message: 'Invalid HTML content',
    });
  }

  return errors;
}

// Helper function to validate template name uniqueness (would need database access)
export const validateTemplateNameUniqueness = async (_name: string, _excludeId?: string): Promise<boolean> => {
  // This would require database access to check for existing templates
  // For now, just return true
  return true;
};

// Helper function to extract variables from template content
export const extractVariablesFromTemplate = (subject: string, body: string, htmlBody?: string): string[] => {
  const variableRegex = /\{\{(\w+)\}\}/g;
  const variables = new Set<string>();
  
  let match;
  
  // Extract from subject
  while ((match = variableRegex.exec(subject)) !== null) {
    variables.add(match[1]);
  }
  
  // Extract from body
  variableRegex.lastIndex = 0;
  while ((match = variableRegex.exec(body)) !== null) {
    variables.add(match[1]);
  }
  
  // Extract from HTML body if provided
  if (htmlBody) {
    variableRegex.lastIndex = 0;
    while ((match = variableRegex.exec(htmlBody)) !== null) {
      variables.add(match[1]);
    }
  }
  
  return Array.from(variables);
};

// Helper function to validate template type specific requirements
export const validateTemplateTypeRequirements = (type: string, variables: Record<string, any>): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  const typeRequirements: Record<string, string[]> = {
    threat_model_created: ['title', 'creator_name', 'project_name'],
    threat_model_updated: ['title', 'updater_name', 'project_name'],
    threat_identified: ['threat_title', 'model_title', 'risk_level'],
    threat_mitigated: ['threat_title', 'mitigator_name'],
    collaboration_invited: ['project_name', 'model_title', 'inviter_name'],
    report_generated: ['report_title'],
    system_maintenance: ['title', 'description'],
  };
  
  const requiredVars = typeRequirements[type];
  if (requiredVars) {
    const definedVars = Object.keys(variables || {});
    
    for (const requiredVar of requiredVars) {
      if (!definedVars.includes(requiredVar)) {
        errors.push({
          field: 'variables',
          message: `Template type '${type}' requires variable '${requiredVar}'`,
          value: requiredVar,
        });
      }
    }
  }
  
  return errors;
};

export { CreateTemplateSchema, UpdateTemplateSchema, PreviewTemplateSchema, CloneTemplateSchema };