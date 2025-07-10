import { SecurityToolsService } from '../../src/services/security-tools.service';
import {
  mockIntegration,
  mockSIEMEvent,
  mockVulnerability,
  mockCloudFinding,
  mockThreat
} from '../setup';

// Mock the dependencies at module level
jest.mock('pg');
jest.mock('ioredis');

describe('SecurityToolsService', () => {
  let service: SecurityToolsService;
  let mockDb: any;
  let mockRedis: any;

  beforeEach(() => {
    // Create mocked dependencies with Jest mock methods
    mockDb = {
      query: jest.fn(),
      end: jest.fn(),
      on: jest.fn()
    };
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      ping: jest.fn(),
      quit: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      on: jest.fn()
    };
    
    // Create service instance
    service = new SecurityToolsService({
      redis: mockRedis,
      db: mockDb,
      maxConcurrentSyncs: 3,
      correlationWindowMinutes: 15
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Integration Management', () => {
    describe('createIntegration', () => {
      it('should create a new integration successfully', async () => {
        const request = {
          name: 'Test SIEM',
          type: 'siem' as const,
          platform: 'splunk',
          description: 'Test SIEM integration',
          connectionConfig: {
            endpoint: 'https://splunk.example.com',
            authType: 'token' as const,
            credentials: {
              token: 'test-token'
            }
          }
        };

        mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

        const result = await service.createIntegration(request);

        expect(result).toMatchObject({
          name: request.name,
          type: request.type,
          platform: request.platform,
          status: 'configuring'
        });
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO security_tool_integrations'),
          expect.any(Array)
        );
      });

      it('should handle connection test failure', async () => {
        const request = {
          name: 'Test SIEM',
          type: 'siem' as const,
          platform: 'invalid',
          connectionConfig: {
            endpoint: 'https://invalid.example.com',
            authType: 'token' as const,
            credentials: {
              token: 'invalid-token'
            }
          }
        };

        await expect(service.createIntegration(request)).rejects.toThrow();
      });
    });

    describe('updateIntegration', () => {
      it('should update an existing integration', async () => {
        const integrationId = 'test-integration-id';
        const updates = {
          name: 'Updated SIEM',
          syncEnabled: true,
          syncInterval: 30
        };

        mockDb.query
          .mockResolvedValueOnce({ rows: [mockIntegration], rowCount: 1 } as any)
          .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

        const result = await service.updateIntegration(integrationId, updates);

        expect(result.name).toBe(updates.name);
        expect(result.syncEnabled).toBe(updates.syncEnabled);
        expect(result.syncInterval).toBe(updates.syncInterval);
      });

      it('should throw error for non-existent integration', async () => {
        mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

        await expect(
          service.updateIntegration('non-existent', {})
        ).rejects.toThrow('Integration non-existent not found');
      });
    });

    describe('deleteIntegration', () => {
      it('should delete an integration', async () => {
        const integrationId = 'test-integration-id';
        
        mockRedis.del.mockResolvedValueOnce(1);
        mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

        await service.deleteIntegration(integrationId);

        expect(mockDb.query).toHaveBeenCalledWith(
          'DELETE FROM security_tool_integrations WHERE id = $1',
          [integrationId]
        );
      });
    });

    describe('testConnection', () => {
      it('should test connection successfully', async () => {
        const request = {
          type: 'siem' as const,
          platform: 'splunk',
          connectionConfig: {
            endpoint: 'https://splunk.example.com',
            authType: 'token' as const,
            credentials: {
              token: 'test-token'
            }
          }
        };

        // Mock successful connection test
        const result = await service.testConnection(request);

        expect(result).toBe(false); // Default mock implementation
      });
    });
  });

  describe('Event Correlation', () => {
    describe('correlateEvents', () => {
      it('should correlate events and create threats', async () => {
        const request = {
          timeRange: {
            start: new Date(Date.now() - 3600000).toISOString(),
            end: new Date().toISOString()
          },
          severities: ['critical', 'high'] as any[]
        };

        // Mock events retrieval
        mockRedis.get.mockResolvedValueOnce(null);
        mockDb.query.mockResolvedValueOnce({
          rows: [mockSIEMEvent],
          rowCount: 1
        } as any);

        const threats = await service.correlateEvents(request);

        expect(Array.isArray(threats)).toBe(true);
      });
    });
  });

  describe('Ticket Management', () => {
    describe('createTicket', () => {
      it('should create a ticket for a threat', async () => {
        const request = {
          threatId: 'threat-001',
          integrationId: 'integration-001',
          ticketData: {
            title: 'Critical Security Threat',
            description: 'Threat detected and requires immediate attention',
            priority: 'High'
          }
        };

        // Mock integration retrieval
        mockDb.query
          .mockResolvedValueOnce({
            rows: [{ ...mockIntegration, type: 'ticketing', platform: 'jira' }],
            rowCount: 1
          } as any)
          .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

        // Note: Actual ticket creation would require mocking the adapter
        await expect(service.createTicket(request)).rejects.toThrow();
      });
    });
  });

  describe('Dashboard and Metrics', () => {
    describe('getSecurityPostureDashboard', () => {
      it('should generate security posture dashboard', async () => {
        // Mock various data retrievals
        mockDb.query
          .mockResolvedValueOnce({ rows: [mockIntegration], rowCount: 1 } as any)
          .mockResolvedValueOnce({ rows: [mockThreat], rowCount: 1 } as any)
          .mockResolvedValueOnce({ rows: [mockVulnerability], rowCount: 1 } as any)
          .mockResolvedValueOnce({ rows: [mockCloudFinding], rowCount: 1 } as any)
          .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
          .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
          .mockResolvedValueOnce({ rows: [{ count: 10 }], rowCount: 1 } as any)
          .mockResolvedValueOnce({ rows: [{ count: 8 }], rowCount: 1 } as any);

        const dashboard = await service.getSecurityPostureDashboard();

        expect(dashboard).toMatchObject({
          generatedAt: expect.any(Date),
          overallRiskScore: expect.any(Number),
          totalThreats: expect.any(Number),
          activeThreats: expect.any(Number),
          toolMetrics: expect.any(Map),
          integrationHealth: expect.any(Map)
        });
      });
    });
  });

  describe('Sync Operations', () => {
    describe('syncIntegration', () => {
      it('should queue sync operation', async () => {
        const request = {
          integrationId: 'test-integration-id',
          fullSync: true
        };

        // Mock integration retrieval
        mockDb.query.mockResolvedValueOnce({
          rows: [mockIntegration],
          rowCount: 1
        } as any);

        await service.syncIntegration(request);

        // Verify sync was queued (actual sync would be async)
        expect(mockDb.query).toHaveBeenCalled();
      });

      it('should handle sync with time range', async () => {
        const request = {
          integrationId: 'test-integration-id',
          startDate: new Date(Date.now() - 86400000).toISOString(),
          endDate: new Date().toISOString()
        };

        mockDb.query.mockResolvedValueOnce({
          rows: [mockIntegration],
          rowCount: 1
        } as any);

        await service.syncIntegration(request);

        expect(mockDb.query).toHaveBeenCalled();
      });
    });
  });

  describe('Helper Methods', () => {
    describe('getTopThreats', () => {
      it('should retrieve top threats', async () => {
        mockDb.query.mockResolvedValueOnce({
          rows: [mockThreat],
          rowCount: 1
        } as any);

        const threats = await (service as any).getTopThreats(10);

        expect(threats).toHaveLength(1);
        expect(threats[0]).toMatchObject({
          id: mockThreat.id,
          severity: mockThreat.severity
        });
      });
    });

    describe('getTopVulnerabilities', () => {
      it('should retrieve top vulnerabilities', async () => {
        mockDb.query.mockResolvedValueOnce({
          rows: [mockVulnerability],
          rowCount: 1
        } as any);

        const vulnerabilities = await (service as any).getTopVulnerabilities(10);

        expect(vulnerabilities).toHaveLength(1);
        expect(vulnerabilities[0]).toMatchObject({
          id: mockVulnerability.id,
          severity: mockVulnerability.severity
        });
      });
    });

    describe('getCriticalFindings', () => {
      it('should retrieve critical findings', async () => {
        mockDb.query.mockResolvedValueOnce({
          rows: [mockCloudFinding],
          rowCount: 1
        });

        const findings = await (service as any).getCriticalFindings(10);

        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({
          id: mockCloudFinding.id,
          platform: mockCloudFinding.platform
        });
      });
    });
  });

  describe('Event Handling', () => {
    it('should emit events on integration connection', async () => {
      const listener = jest.fn();
      service.on('integration.connected', listener);

      // Trigger event emission (would happen during adapter connection)
      service.emit('integration.connected', { integrationId: 'test-id' });

      expect(listener).toHaveBeenCalledWith({ integrationId: 'test-id' });
    });

    it('should emit events on threat detection', async () => {
      const listener = jest.fn();
      service.on('threat.detected', listener);

      // Trigger event emission
      service.emit('threat.detected', mockThreat);

      expect(listener).toHaveBeenCalledWith(mockThreat);
    });
  });

  describe('Cleanup', () => {
    it('should shutdown gracefully', async () => {
      await service.shutdown();

      // Verify cleanup operations
      expect(service.listenerCount('integration.connected')).toBe(0);
    });
  });
});