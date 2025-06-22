import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration schema
const configSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3010),
  HOST: z.string().default('0.0.0.0'),
  
  // Security
  JWT_SECRET: z.string().min(32),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  
  // Elasticsearch Configuration
  ELASTICSEARCH_NODE: z.string().default('http://localhost:9200'),
  ELASTICSEARCH_USERNAME: z.string().optional(),
  ELASTICSEARCH_PASSWORD: z.string().optional(),
  ELASTICSEARCH_CA_CERT: z.string().optional(),
  ELASTICSEARCH_REJECT_UNAUTHORIZED: z.coerce.boolean().default(true),
  
  // Index Configuration
  INDEX_PREFIX: z.string().default('threatmodel'),
  INDEX_REPLICAS: z.coerce.number().default(1),
  INDEX_SHARDS: z.coerce.number().default(1),
  INDEX_REFRESH_INTERVAL: z.string().default('1s'),
  
  // Search Configuration
  SEARCH_DEFAULT_SIZE: z.coerce.number().default(20),
  SEARCH_MAX_SIZE: z.coerce.number().default(1000),
  SEARCH_HIGHLIGHT_FRAGMENT_SIZE: z.coerce.number().default(150),
  SEARCH_SUGGESTION_SIZE: z.coerce.number().default(10),
  SEARCH_TIMEOUT: z.coerce.number().default(30000),
  
  // Analytics Configuration
  ANALYTICS_ENABLED: z.coerce.boolean().default(true),
  ANALYTICS_RETENTION_DAYS: z.coerce.number().default(90),
  ANALYTICS_INDEX_PREFIX: z.string().default('search_analytics'),
  
  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().default(60000),
  
  // Service URLs
  AUTH_SERVICE_URL: z.string().default('http://localhost:3001'),
  USER_SERVICE_URL: z.string().default('http://localhost:3002'),
  PROJECT_SERVICE_URL: z.string().default('http://localhost:3003'),
  FILE_SERVICE_URL: z.string().default('http://localhost:3009'),
  
  // Indexing Configuration
  BULK_INDEX_SIZE: z.coerce.number().default(1000),
  REINDEX_BATCH_SIZE: z.coerce.number().default(100),
  INDEXING_RETRY_ATTEMPTS: z.coerce.number().default(3),
  INDEXING_RETRY_DELAY: z.coerce.number().default(1000),
  
  // Real-time Indexing
  ENABLE_REAL_TIME_INDEXING: z.coerce.boolean().default(true),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_TOPIC_PREFIX: z.string().default('threatmodel'),
  
  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(true),
  
  // Monitoring
  ENABLE_METRICS: z.coerce.boolean().default(true),
  METRICS_PORT: z.coerce.number().default(9100),
});

// Parse and validate configuration
const parseConfig = () => {
  try {
    return configSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid configuration:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
};

// Export validated configuration
export const config = parseConfig();

// Export configuration type
export type Config = z.infer<typeof configSchema>;

// Helper functions
export const isDevelopment = () => config.NODE_ENV === 'development';
export const isProduction = () => config.NODE_ENV === 'production';
export const isTest = () => config.NODE_ENV === 'test';

// Elasticsearch configuration helper
export const getElasticsearchConfig = () => {
  const esConfig: any = {
    node: config.ELASTICSEARCH_NODE,
    requestTimeout: config.SEARCH_TIMEOUT,
    pingTimeout: 3000,
    maxRetries: 3,
  };

  // Add authentication if provided
  if (config.ELASTICSEARCH_USERNAME && config.ELASTICSEARCH_PASSWORD) {
    esConfig.auth = {
      username: config.ELASTICSEARCH_USERNAME,
      password: config.ELASTICSEARCH_PASSWORD,
    };
  }

  // Add SSL configuration if provided
  if (config.ELASTICSEARCH_CA_CERT || !config.ELASTICSEARCH_REJECT_UNAUTHORIZED) {
    esConfig.ssl = {
      ca: config.ELASTICSEARCH_CA_CERT,
      rejectUnauthorized: config.ELASTICSEARCH_REJECT_UNAUTHORIZED,
    };
  }

  return esConfig;
};

// Index names helper
export const getIndexName = (contentType: string, environment?: string) => {
  const env = environment || config.NODE_ENV;
  return `${config.INDEX_PREFIX}_${env}_${contentType}`;
};

// Analytics index name helper
export const getAnalyticsIndexName = (environment?: string) => {
  const env = environment || config.NODE_ENV;
  return `${config.ANALYTICS_INDEX_PREFIX}_${env}`;
};

// Search configuration helper
export const getSearchConfig = () => {
  return {
    defaultSize: config.SEARCH_DEFAULT_SIZE,
    maxSize: config.SEARCH_MAX_SIZE,
    highlightFragmentSize: config.SEARCH_HIGHLIGHT_FRAGMENT_SIZE,
    suggestionSize: config.SEARCH_SUGGESTION_SIZE,
    timeout: config.SEARCH_TIMEOUT,
  };
};

// Index settings helper
export const getIndexSettings = () => {
  return {
    number_of_shards: config.INDEX_SHARDS,
    number_of_replicas: config.INDEX_REPLICAS,
    refresh_interval: config.INDEX_REFRESH_INTERVAL,
    max_result_window: config.SEARCH_MAX_SIZE,
    analysis: {
      analyzer: {
        threat_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: [
            'lowercase',
            'stop',
            'stemmer',
            'threat_synonym',
          ],
        },
        autocomplete_analyzer: {
          type: 'custom',
          tokenizer: 'autocomplete_tokenizer',
          filter: ['lowercase'],
        },
        autocomplete_search_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase'],
        },
      },
      tokenizer: {
        autocomplete_tokenizer: {
          type: 'edge_ngram',
          min_gram: 1,
          max_gram: 20,
          token_chars: ['letter', 'digit'],
        },
      },
      filter: {
        threat_synonym: {
          type: 'synonym',
          synonyms: [
            'vulnerability,vuln,weakness',
            'attack,threat,exploit',
            'mitigation,countermeasure,control',
            'authentication,auth,login',
            'authorization,authz,permission',
            'confidentiality,privacy,secrecy',
            'integrity,accuracy,validity',
            'availability,uptime,accessibility',
          ],
        },
        stemmer: {
          type: 'stemmer',
          language: 'english',
        },
      },
    },
  };
};

// Content type mappings
export const getContentTypeMappings = () => {
  return {
    threat: {
      dynamic: false,
      properties: {
        id: { type: 'keyword' },
        title: {
          type: 'text',
          analyzer: 'threat_analyzer',
          fields: {
            keyword: { type: 'keyword' },
            autocomplete: {
              type: 'text',
              analyzer: 'autocomplete_analyzer',
              search_analyzer: 'autocomplete_search_analyzer',
            },
          },
        },
        description: {
          type: 'text',
          analyzer: 'threat_analyzer',
        },
        category: { type: 'keyword' },
        severity: { type: 'keyword' },
        status: { type: 'keyword' },
        mitigation: {
          type: 'text',
          analyzer: 'threat_analyzer',
        },
        likelihood: { type: 'integer' },
        impact: { type: 'integer' },
        riskScore: { type: 'float' },
        userId: { type: 'keyword' },
        projectId: { type: 'keyword' },
        threatModelId: { type: 'keyword' },
        tags: { type: 'keyword' },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
      },
    },
    project: {
      dynamic: false,
      properties: {
        id: { type: 'keyword' },
        name: {
          type: 'text',
          analyzer: 'threat_analyzer',
          fields: {
            keyword: { type: 'keyword' },
            autocomplete: {
              type: 'text',
              analyzer: 'autocomplete_analyzer',
              search_analyzer: 'autocomplete_search_analyzer',
            },
          },
        },
        description: {
          type: 'text',
          analyzer: 'threat_analyzer',
        },
        status: { type: 'keyword' },
        type: { type: 'keyword' },
        methodology: { type: 'keyword' },
        userId: { type: 'keyword' },
        organizationId: { type: 'keyword' },
        teamMembers: { type: 'keyword' },
        tags: { type: 'keyword' },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
      },
    },
    threat_model: {
      dynamic: false,
      properties: {
        id: { type: 'keyword' },
        name: {
          type: 'text',
          analyzer: 'threat_analyzer',
          fields: {
            keyword: { type: 'keyword' },
            autocomplete: {
              type: 'text',
              analyzer: 'autocomplete_analyzer',
              search_analyzer: 'autocomplete_search_analyzer',
            },
          },
        },
        description: {
          type: 'text',
          analyzer: 'threat_analyzer',
        },
        version: { type: 'keyword' },
        status: { type: 'keyword' },
        methodology: { type: 'keyword' },
        projectId: { type: 'keyword' },
        userId: { type: 'keyword' },
        components: {
          type: 'nested',
          properties: {
            id: { type: 'keyword' },
            name: { type: 'text' },
            type: { type: 'keyword' },
            description: { type: 'text' },
          },
        },
        dataFlows: {
          type: 'nested',
          properties: {
            id: { type: 'keyword' },
            name: { type: 'text' },
            source: { type: 'keyword' },
            destination: { type: 'keyword' },
            description: { type: 'text' },
          },
        },
        tags: { type: 'keyword' },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
      },
    },
    user: {
      dynamic: false,
      properties: {
        id: { type: 'keyword' },
        email: {
          type: 'text',
          fields: {
            keyword: { type: 'keyword' },
          },
        },
        firstName: {
          type: 'text',
          fields: {
            autocomplete: {
              type: 'text',
              analyzer: 'autocomplete_analyzer',
              search_analyzer: 'autocomplete_search_analyzer',
            },
          },
        },
        lastName: {
          type: 'text',
          fields: {
            autocomplete: {
              type: 'text',
              analyzer: 'autocomplete_analyzer',
              search_analyzer: 'autocomplete_search_analyzer',
            },
          },
        },
        role: { type: 'keyword' },
        organizationId: { type: 'keyword' },
        department: { type: 'keyword' },
        skills: { type: 'keyword' },
        bio: { type: 'text' },
        isActive: { type: 'boolean' },
        lastLoginAt: { type: 'date' },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
      },
    },
    file: {
      dynamic: false,
      properties: {
        id: { type: 'keyword' },
        originalName: {
          type: 'text',
          fields: {
            keyword: { type: 'keyword' },
            autocomplete: {
              type: 'text',
              analyzer: 'autocomplete_analyzer',
              search_analyzer: 'autocomplete_search_analyzer',
            },
          },
        },
        mimeType: { type: 'keyword' },
        size: { type: 'long' },
        description: {
          type: 'text',
          analyzer: 'threat_analyzer',
        },
        userId: { type: 'keyword' },
        projectId: { type: 'keyword' },
        threatModelId: { type: 'keyword' },
        tags: { type: 'keyword' },
        isPublic: { type: 'boolean' },
        extractedText: {
          type: 'text',
          analyzer: 'threat_analyzer',
        },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
      },
    },
    report: {
      dynamic: false,
      properties: {
        id: { type: 'keyword' },
        title: {
          type: 'text',
          analyzer: 'threat_analyzer',
          fields: {
            keyword: { type: 'keyword' },
            autocomplete: {
              type: 'text',
              analyzer: 'autocomplete_analyzer',
              search_analyzer: 'autocomplete_search_analyzer',
            },
          },
        },
        description: {
          type: 'text',
          analyzer: 'threat_analyzer',
        },
        type: { type: 'keyword' },
        format: { type: 'keyword' },
        status: { type: 'keyword' },
        projectId: { type: 'keyword' },
        userId: { type: 'keyword' },
        summary: {
          type: 'text',
          analyzer: 'threat_analyzer',
        },
        findings: {
          type: 'nested',
          properties: {
            category: { type: 'keyword' },
            severity: { type: 'keyword' },
            title: { type: 'text' },
            description: { type: 'text' },
          },
        },
        recommendations: {
          type: 'text',
          analyzer: 'threat_analyzer',
        },
        tags: { type: 'keyword' },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
      },
    },
  };
};