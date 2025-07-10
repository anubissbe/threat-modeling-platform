import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Global test setup
beforeAll(() => {
  // Setup global test configuration
});

// Global test timeout
jest.setTimeout(30000);

// Clean up after tests
afterAll(async () => {
  // Clean up any resources
});

// Utility functions for tests
export const mockUser = {
  userId: 'test-user-id',
  email: 'test@example.com',
  role: 'admin',
  organization: 'test-org',
};

export const mockIntegration = {
  id: 'test-integration-id',
  name: 'Test Integration',
  type: 'siem' as const,
  platform: 'splunk',
  description: 'Test integration for unit tests',
  connectionConfig: {
    endpoint: 'https://test.splunk.com',
    authType: 'token' as const,
    credentials: {
      token: 'test-token',
    },
  },
  status: 'connected' as const,
  syncEnabled: true,
  syncDirection: 'inbound' as const,
  syncInterval: 60,
  fieldMappings: [],
  severityMapping: {
    critical: ['critical', 'p1'],
    high: ['high', 'p2'],
    medium: ['medium', 'p3'],
    low: ['low', 'p4'],
    info: ['info', 'p5'],
  },
  features: {
    alertIngestion: true,
    eventCorrelation: true,
    ticketCreation: true,
    bidirectionalSync: false,
    automatedResponse: false,
    customWebhooks: true,
    bulkOperations: true,
    realTimeStreaming: true,
  },
  createdBy: 'test-user',
  createdAt: new Date(),
  updatedAt: new Date(),
  version: '1.0.0',
};

export const mockSIEMEvent = {
  id: 'test-event-id',
  timestamp: new Date(),
  source: 'test-source',
  eventType: 'test-event',
  severity: 'high' as const,
  title: 'Test Security Event',
  description: 'Test security event for unit tests',
  category: 'test-category',
  sourceIP: '192.168.1.100',
  destinationIP: '10.0.0.1',
  sourcePort: 12345,
  destinationPort: 443,
  protocol: 'TCP',
  user: 'test-user',
  host: 'test-host',
  rawEvent: { test: true },
  status: 'new' as const,
};

export const mockVulnerability = {
  id: 'test-vuln-id',
  scannerVulnId: 'SCAN-001',
  cve: 'CVE-2023-12345',
  title: 'Test Vulnerability',
  description: 'Test vulnerability for unit tests',
  severity: 'critical' as const,
  cvssScore: 9.8,
  category: 'test-category',
  affectedAssets: [
    {
      assetId: 'asset-1',
      hostname: 'test-host',
      ipAddress: '192.168.1.100',
      status: 'vulnerable' as const,
      lastChecked: new Date(),
    },
  ],
  exploitAvailable: true,
  solution: 'Test solution',
  firstSeen: new Date(),
  lastSeen: new Date(),
  scanId: 'scan-001',
  riskScore: 95,
  status: 'open' as const,
};

export const mockCloudFinding = {
  id: 'test-finding-id',
  findingId: 'FINDING-001',
  platform: 'aws' as const,
  title: 'Test Cloud Security Finding',
  description: 'Test finding for unit tests',
  severity: 'high' as const,
  confidence: 90,
  resourceType: 'AWS::EC2::Instance',
  resourceId: 'i-1234567890abcdef0',
  resourceName: 'test-instance',
  region: 'us-east-1',
  accountId: '123456789012',
  category: 'test-category',
  createdAt: new Date(),
  updatedAt: new Date(),
  status: 'active' as const,
};

export const mockThreat = {
  id: 'test-threat-id',
  correlationId: 'corr-001',
  title: 'Test Correlated Threat',
  description: 'Test threat for unit tests',
  severity: 'critical' as const,
  confidence: 85,
  sources: [
    {
      toolType: 'siem' as const,
      toolId: 'test-integration-id',
      sourceId: 'event-001',
      timestamp: new Date(),
      rawData: mockSIEMEvent,
    },
  ],
  firstSeen: new Date(),
  lastSeen: new Date(),
  eventCount: 10,
  affectedAssets: ['asset-1', 'asset-2'],
  status: 'active' as const,
  responseActions: [],
  evidence: [],
  riskScore: 90,
  riskFactors: [
    {
      factor: 'Critical Assets Affected',
      weight: 30,
      description: '2 critical assets affected',
    },
  ],
};

export const mockTicket = {
  id: 'test-ticket-id',
  externalId: 'TICKET-001',
  platform: 'jira' as const,
  title: 'Test Security Ticket',
  description: 'Test ticket for unit tests',
  type: 'Bug',
  priority: 'High',
  severity: 'high' as const,
  assignee: 'test-assignee',
  reporter: 'test-reporter',
  status: 'Open',
  linkedThreats: ['threat-001'],
  linkedVulnerabilities: ['vuln-001'],
  linkedFindings: ['finding-001'],
  linkedTickets: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  comments: [],
  attachments: [],
  history: [],
};

// Helper function to create mock request
export function createMockRequest(
  body?: any,
  params?: any,
  query?: any,
  user = mockUser
) {
  return {
    body: body || {},
    params: params || {},
    query: query || {},
    user,
    headers: {},
    get: jest.fn(),
  };
}

// Helper function to create mock response
export function createMockResponse() {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  res.download = jest.fn(() => res);
  return res;
}

// Helper function to create mock next function
export function createMockNext() {
  return jest.fn();
}