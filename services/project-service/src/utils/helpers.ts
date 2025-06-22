import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a URL-friendly slug from a string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start
    .replace(/-+$/, ''); // Trim - from end
}

/**
 * Generate a random string
 */
export function generateRandomString(length: number): string {
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

/**
 * Generate a unique identifier
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Parse boolean from string
 */
export function parseBoolean(value: string | boolean | undefined): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return false;
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Format date for API response
 */
export function formatDate(date: Date | string): string {
  return new Date(date).toISOString();
}

/**
 * Get pagination offset
 */
export function getPaginationOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

/**
 * Sanitize search input
 */
export function sanitizeSearchInput(input: string): string {
  return input
    .trim()
    .replace(/[%_\\]/g, '\\$&') // Escape SQL wildcards
    .substring(0, 100); // Limit length
}

/**
 * Extract bearer token from authorization header
 */
export function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>
): T {
  const output = { ...target };
  
  Object.keys(source).forEach(key => {
    const sourceValue = (source as any)[key];
    if (sourceValue && typeof sourceValue === 'object' && key in target) {
      (output as any)[key] = deepMerge((target as any)[key], sourceValue);
    } else {
      (output as any)[key] = sourceValue;
    }
  });
  
  return output;
}

/**
 * Omit fields from object
 */
export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  keys.forEach(key => delete result[key]);
  return result;
}

/**
 * Pick fields from object
 */
export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
}

/**
 * Calculate risk score based on severity and likelihood
 */
export function calculateRiskScore(
  severity: 'low' | 'medium' | 'high' | 'critical',
  likelihood: 'very_low' | 'low' | 'medium' | 'high' | 'very_high'
): number {
  const severityScores = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  const likelihoodScores = {
    very_low: 1,
    low: 2,
    medium: 3,
    high: 4,
    very_high: 5,
  };

  return severityScores[severity] * likelihoodScores[likelihood];
}

/**
 * Generate semantic version string
 */
export function generateVersion(
  major: number,
  minor: number,
  patch: number,
  tag?: string
): string {
  const baseVersion = `${major}.${minor}.${patch}`;
  return tag ? `${baseVersion}-${tag}` : baseVersion;
}

/**
 * Parse semantic version string
 */
export function parseVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
  tag?: string;
} {
  const versionRegex = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/;
  const match = version.match(versionRegex);
  
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    tag: match[4] || undefined,
  };
}

/**
 * Compare two semantic versions
 */
export function compareVersions(version1: string, version2: string): number {
  const v1 = parseVersion(version1);
  const v2 = parseVersion(version2);

  if (v1.major !== v2.major) {
    return v1.major - v2.major;
  }
  if (v1.minor !== v2.minor) {
    return v1.minor - v2.minor;
  }
  if (v1.patch !== v2.patch) {
    return v1.patch - v2.patch;
  }

  // Handle tags (pre-release versions are considered lower)
  if (v1.tag && !v2.tag) return -1;
  if (!v1.tag && v2.tag) return 1;
  if (v1.tag && v2.tag) {
    return v1.tag.localeCompare(v2.tag);
  }

  return 0;
}

/**
 * Increment semantic version
 */
export function incrementVersion(
  version: string,
  type: 'major' | 'minor' | 'patch'
): string {
  const { major, minor, patch } = parseVersion(version);

  switch (type) {
    case 'major':
      return generateVersion(major + 1, 0, 0);
    case 'minor':
      return generateVersion(major, minor + 1, 0);
    case 'patch':
      return generateVersion(major, minor, patch + 1);
    default:
      throw new Error(`Invalid version increment type: ${type}`);
  }
}

/**
 * Validate project name
 */
export function isValidProjectName(name: string): boolean {
  return name.length >= 3 && name.length <= 100 && /^[a-zA-Z0-9\s\-_]+$/.test(name);
}

/**
 * Validate threat model name
 */
export function isValidThreatModelName(name: string): boolean {
  return name.length >= 3 && name.length <= 100 && /^[a-zA-Z0-9\s\-_\.]+$/.test(name);
}

/**
 * Generate unique component ID
 */
export function generateComponentId(prefix: string = 'comp'): string {
  return `${prefix}_${generateRandomString(8)}`;
}

/**
 * Generate unique threat ID
 */
export function generateThreatId(prefix: string = 'threat'): string {
  return `${prefix}_${generateRandomString(8)}`;
}

/**
 * Sanitize HTML content
 */
export function sanitizeHtml(html: string): string {
  // Basic HTML sanitization - in production, use a proper library like DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Delay execution
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2,
  } = options;

  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      const delayMs = Math.min(
        initialDelay * Math.pow(factor, attempt - 1),
        maxDelay
      );
      
      await delay(delayMs);
    }
  }
  
  throw lastError!;
}