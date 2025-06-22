import { config } from '../config';
import { elasticsearchService, indexManagerService } from '../services';

// Test configuration overrides
process.env.NODE_ENV = 'test';
process.env.ELASTICSEARCH_NODE = 'http://localhost:9200';
process.env.INDEX_PREFIX = 'test_threatmodel';
process.env.ANALYTICS_INDEX_PREFIX = 'test_search_analytics';
process.env.ENABLE_REAL_TIME_INDEXING = 'false';
process.env.ANALYTICS_ENABLED = 'false';
process.env.LOG_LEVEL = 'error';

export async function setupTests(): Promise<void> {
  try {
    // Initialize Elasticsearch connection
    await elasticsearchService.initialize();
    
    // Create test indices
    await indexManagerService.initialize();
    
    console.log('Test setup completed');
  } catch (error) {
    console.error('Test setup failed:', error);
    throw error;
  }
}

export async function teardownTests(): Promise<void> {
  try {
    // Clean up test indices
    const contentTypes = ['threat', 'project', 'threat_model', 'user', 'file', 'report'];
    
    for (const contentType of contentTypes) {
      try {
        await indexManagerService.deleteIndex(contentType as any);
      } catch (error) {
        // Ignore if index doesn't exist
      }
    }
    
    // Close Elasticsearch connection
    await elasticsearchService.close();
    
    console.log('Test teardown completed');
  } catch (error) {
    console.error('Test teardown failed:', error);
    throw error;
  }
}

// Global test data
export const testData = {
  threats: [
    {
      id: 'threat-1',
      title: 'SQL Injection Vulnerability',
      description: 'Potential SQL injection in user input validation',
      category: 'injection',
      severity: 'high',
      status: 'open',
      likelihood: 4,
      impact: 5,
      riskScore: 0.8,
      userId: 'user-1',
      projectId: 'project-1',
      threatModelId: 'model-1',
      tags: ['sql', 'injection', 'database'],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'threat-2',
      title: 'Cross-Site Scripting (XSS)',
      description: 'Stored XSS vulnerability in comment system',
      category: 'injection',
      severity: 'medium',
      status: 'in-progress',
      likelihood: 3,
      impact: 3,
      riskScore: 0.36,
      userId: 'user-2',
      projectId: 'project-1',
      threatModelId: 'model-1',
      tags: ['xss', 'injection', 'web'],
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
  ],
  projects: [
    {
      id: 'project-1',
      name: 'E-commerce Platform',
      description: 'Online shopping platform with payment processing',
      status: 'active',
      type: 'web-application',
      methodology: ['STRIDE', 'PASTA'],
      userId: 'user-1',
      organizationId: 'org-1',
      teamMembers: ['user-1', 'user-2'],
      tags: ['ecommerce', 'web', 'payments'],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ],
  users: [
    {
      id: 'user-1',
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'security-analyst',
      organizationId: 'org-1',
      department: 'Security',
      skills: ['threat-modeling', 'security-testing'],
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'user-2',
      email: 'jane.smith@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'developer',
      organizationId: 'org-1',
      department: 'Engineering',
      skills: ['web-development', 'security'],
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ],
};

export const mockUser = {
  id: 'user-1',
  email: 'john.doe@example.com',
  role: 'security-analyst',
  organizationId: 'org-1',
  permissions: ['search', 'read'],
};

export const mockAdminUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  role: 'admin',
  organizationId: 'org-1',
  permissions: ['*'],
};