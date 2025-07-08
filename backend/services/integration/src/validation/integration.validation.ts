import { z } from 'zod';
import { IntegrationProvider, IntegrationStatus } from '../types/integration';

// Base schemas
const providerSchema = z.nativeEnum(IntegrationProvider);
const statusSchema = z.nativeEnum(IntegrationStatus);

// Credential schemas
const basicCredentialsSchema = z.object({
  type: z.literal('basic'),
  username: z.string().min(1),
  password: z.string().min(1),
});

const tokenCredentialsSchema = z.object({
  type: z.literal('token'),
  token: z.string().min(1),
});

const oauth2CredentialsSchema = z.object({
  type: z.literal('oauth2'),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

const credentialsSchema = z.discriminatedUnion('type', [
  basicCredentialsSchema,
  tokenCredentialsSchema,
  oauth2CredentialsSchema,
]);

// Config schemas
const baseConfigSchema = z.object({
  baseUrl: z.string().url(),
  webhookUrl: z.string().url().optional(),
});

const jiraConfigSchema = baseConfigSchema.extend({
  projectKey: z.string().min(1),
  issueTypeId: z.string().optional(),
  customFields: z.record(z.any()).optional(),
});

const githubConfigSchema = baseConfigSchema.extend({
  owner: z.string().min(1),
  repo: z.string().min(1),
  labels: z.array(z.string()).optional(),
});

const gitlabConfigSchema = baseConfigSchema.extend({
  projectId: z.union([z.string(), z.number()]),
  labels: z.array(z.string()).optional(),
});

const azureDevOpsConfigSchema = baseConfigSchema.extend({
  organization: z.string().min(1),
  project: z.string().min(1),
  workItemType: z.string().optional(),
});

// Create integration schema
export const createIntegrationSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255),
    provider: providerSchema,
    config: z.union([
      jiraConfigSchema,
      githubConfigSchema,
      gitlabConfigSchema,
      azureDevOpsConfigSchema,
    ]),
    credentials: credentialsSchema,
    syncFrequencyMinutes: z.number().min(15).max(1440).optional().default(60),
  }).refine((data) => {
    // Validate config matches provider
    switch (data.provider) {
      case IntegrationProvider.JIRA:
        return jiraConfigSchema.safeParse(data.config).success;
      case IntegrationProvider.GITHUB:
        return githubConfigSchema.safeParse(data.config).success;
      case IntegrationProvider.GITLAB:
        return gitlabConfigSchema.safeParse(data.config).success;
      case IntegrationProvider.AZURE_DEVOPS:
        return azureDevOpsConfigSchema.safeParse(data.config).success;
      default:
        return false;
    }
  }, {
    message: 'Config does not match provider requirements',
    path: ['config'],
  }),
});

// Update integration schema
export const updateIntegrationSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    config: z.union([
      jiraConfigSchema,
      githubConfigSchema,
      gitlabConfigSchema,
      azureDevOpsConfigSchema,
    ]).optional(),
    credentials: credentialsSchema.optional(),
    status: statusSchema.optional(),
    syncFrequencyMinutes: z.number().min(15).max(1440).optional(),
  }),
});

// Sync request schema
export const syncRequestSchema = z.object({
  body: z.object({
    threatModelIds: z.array(z.string().uuid()).optional(),
    force: z.boolean().optional().default(false),
  }),
});

// Test connection schema
export const testConnectionSchema = z.object({
  body: z.object({
    provider: providerSchema,
    config: z.union([
      jiraConfigSchema,
      githubConfigSchema,
      gitlabConfigSchema,
      azureDevOpsConfigSchema,
    ]),
    credentials: credentialsSchema,
  }),
});