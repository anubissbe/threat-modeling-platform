import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { ThreatSeverity, ThreatLikelihood } from '../types';

/**
 * Generate a unique identifier
 */
export function generateId(): string {
  return uuidv4();
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
 * Calculate risk score based on severity and likelihood
 */
export function calculateRiskScore(
  severity: ThreatSeverity,
  likelihood: ThreatLikelihood
): number {
  const severityScores = {
    [ThreatSeverity.LOW]: 1,
    [ThreatSeverity.MEDIUM]: 2,
    [ThreatSeverity.HIGH]: 3,
    [ThreatSeverity.CRITICAL]: 4,
  };

  const likelihoodScores = {
    [ThreatLikelihood.VERY_LOW]: 1,
    [ThreatLikelihood.LOW]: 2,
    [ThreatLikelihood.MEDIUM]: 3,
    [ThreatLikelihood.HIGH]: 4,
    [ThreatLikelihood.VERY_HIGH]: 5,
  };

  return severityScores[severity] * likelihoodScores[likelihood];
}

/**
 * Calculate DREAD score
 */
export function calculateDreadScore(
  damage: number,
  reproducibility: number,
  exploitability: number,
  affectedUsers: number,
  discoverability: number
): number {
  // Validate inputs (should be 1-10)
  const scores = [damage, reproducibility, exploitability, affectedUsers, discoverability];
  for (const score of scores) {
    if (score < 1 || score > 10) {
      throw new Error('DREAD scores must be between 1 and 10');
    }
  }

  // Calculate average
  return (damage + reproducibility + exploitability + affectedUsers + discoverability) / 5;
}

/**
 * Convert DREAD score to risk level
 */
export function dreadScoreToRiskLevel(score: number): ThreatSeverity {
  if (score >= 8.5) return ThreatSeverity.CRITICAL;
  if (score >= 6.5) return ThreatSeverity.HIGH;
  if (score >= 4.5) return ThreatSeverity.MEDIUM;
  return ThreatSeverity.LOW;
}

/**
 * Normalize string for comparison
 */
export function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Calculate confidence score based on multiple factors
 */
export function calculateConfidenceScore(factors: {
  patternMatch?: number;
  ruleMatch?: number;
  mlPrediction?: number;
  expertKnowledge?: number;
}): number {
  const weights = {
    patternMatch: 0.3,
    ruleMatch: 0.4,
    mlPrediction: 0.2,
    expertKnowledge: 0.1,
  };

  let totalScore = 0;
  let totalWeight = 0;

  Object.entries(factors).forEach(([key, value]) => {
    if (value !== undefined && value >= 0 && value <= 1) {
      const weight = weights[key as keyof typeof weights];
      totalScore += value * weight;
      totalWeight += weight;
    }
  });

  return totalWeight > 0 ? totalScore / totalWeight : 0;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const cloned = {} as T;
    Object.keys(obj).forEach(key => {
      (cloned as any)[key] = deepClone((obj as any)[key]);
    });
    return cloned;
  }

  return obj;
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
 * Format duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Sanitize input string
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>\"'&]/g, '') // Remove potential XSS characters
    .substring(0, 1000); // Limit length
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Group array by key
 */
export function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

/**
 * Remove duplicates from array
 */
export function unique<T>(array: T[], keyFn?: (item: T) => any): T[] {
  if (!keyFn) {
    return [...new Set(array)];
  }

  const seen = new Set();
  return array.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Sort array by multiple criteria
 */
export function multiSort<T>(
  array: T[],
  ...sortFns: Array<(a: T, b: T) => number>
): T[] {
  return [...array].sort((a, b) => {
    for (const sortFn of sortFns) {
      const result = sortFn(a, b);
      if (result !== 0) return result;
    }
    return 0;
  });
}

/**
 * Retry async function with exponential backoff
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

/**
 * Delay execution
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Throttle function calls
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
 * Debounce function calls
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
 * Extract bearer token from authorization header
 */
export function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Check if object has all required properties
 */
export function hasRequiredProperties<T>(
  obj: any,
  properties: (keyof T)[]
): obj is T {
  return properties.every(prop => obj && obj[prop] !== undefined);
}

/**
 * Convert string to title case
 */
export function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

/**
 * Generate slug from string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Merge arrays and remove duplicates
 */
export function mergeArrays<T>(...arrays: T[][]): T[] {
  return unique(arrays.flat());
}

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value: any): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Convert camelCase to snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Convert snake_case to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Calculate hash of string using simple hash function
 */
export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Check if two arrays are equal
 */
export function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, index) => val === b[index]);
}

/**
 * Get random element from array
 */
export function randomElement<T>(array: T[]): T | undefined {
  if (array.length === 0) return undefined;
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Chunk array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}