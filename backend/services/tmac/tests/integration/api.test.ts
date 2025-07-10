import request from 'supertest';
import { readFileSync } from 'fs';
import { join } from 'path';
import app from '../../src/index';

describe('TMAC API Integration Tests', () => {
  const sampleTMACPath = join(__dirname, '../../../../packages/tmac-core/examples/ecommerce-platform.tmac.yaml');
  let sampleTMACContent: string;

  beforeAll(() => {
    // Read the sample TMAC file
    try {
      sampleTMACContent = readFileSync(sampleTMACPath, 'utf-8');
    } catch (error) {
      console.warn('Sample TMAC file not found, using mock content');
      sampleTMACContent = `
version: "1.0.0"
metadata:
  name: "Test Model"
  description: "Integration test model"
  author: "Test Suite"
  version: "1.0.0"
  tags:
    - test
    - integration
system:
  name: "Test System"
  description: "A test system for integration testing"
  components:
    - id: "web"
      name: "Web Application"
      type: "web_application"
      technologies:
        - "React"
        - "TypeScript"
dataFlows:
  - id: "df1"
    name: "User Login"
    source: "user"
    destination: "web"
    protocol: "HTTPS"
    data:
      - "credentials"
threats:
  - id: "T1"
    name: "SQL Injection"
    component: "web"
    category: "tampering"
    severity: "high"
    description: "Attacker could inject SQL commands"
    stride: ["T"]
    mitigations:
      - "M1"
mitigations:
  - id: "M1"
    name: "Input Validation"
    description: "Validate and sanitize all user inputs"
    threats:
      - "T1"
`;
    }
  });

  describe('Complete TMAC workflow', () => {
    it('should parse, validate, and analyze a TMAC file', async () => {
      // Step 1: Parse the file
      const parseResponse = await request(app)
        .post('/api/tmac/parse')
        .attach('file', Buffer.from(sampleTMACContent), 'test.tmac.yaml')
        .field('format', 'yaml');

      expect(parseResponse.status).toBe(200);
      expect(parseResponse.body).toHaveProperty('model');
      expect(parseResponse.body.model).toHaveProperty('version', '1.0.0');
      expect(parseResponse.body.model.metadata).toHaveProperty('name');

      // Step 2: Validate the file
      const validateResponse = await request(app)
        .post('/api/tmac/validate')
        .attach('file', Buffer.from(sampleTMACContent), 'test.tmac.yaml');

      expect(validateResponse.status).toBe(200);
      expect(validateResponse.body).toHaveProperty('validation');
      expect(validateResponse.body.validation).toHaveProperty('valid');
      expect(validateResponse.body.validation).toHaveProperty('errors');
      expect(validateResponse.body.validation).toHaveProperty('warnings');

      // Step 3: Analyze the file
      const analyzeResponse = await request(app)
        .post('/api/tmac/analyze')
        .attach('file', Buffer.from(sampleTMACContent), 'test.tmac.yaml');

      expect(analyzeResponse.status).toBe(200);
      expect(analyzeResponse.body).toHaveProperty('analysis');
      expect(analyzeResponse.body.analysis).toHaveProperty('summary');
      expect(analyzeResponse.body.analysis.summary).toHaveProperty('totalThreats');
      expect(analyzeResponse.body.analysis.summary).toHaveProperty('riskScore');
    });

    it('should convert between YAML and JSON formats', async () => {
      // Convert YAML to JSON
      const yamlToJsonResponse = await request(app)
        .post('/api/tmac/convert')
        .attach('file', Buffer.from(sampleTMACContent), 'test.tmac.yaml')
        .field('format', 'json');

      expect(yamlToJsonResponse.status).toBe(200);
      expect(yamlToJsonResponse.body).toHaveProperty('content');
      expect(yamlToJsonResponse.body).toHaveProperty('format', 'json');

      // Verify the JSON is valid
      const jsonContent = yamlToJsonResponse.body.content;
      expect(() => JSON.parse(jsonContent)).not.toThrow();

      // Convert JSON back to YAML
      const jsonToYamlResponse = await request(app)
        .post('/api/tmac/convert')
        .attach('file', Buffer.from(jsonContent), 'test.tmac.json')
        .field('format', 'yaml');

      expect(jsonToYamlResponse.status).toBe(200);
      expect(jsonToYamlResponse.body).toHaveProperty('content');
      expect(jsonToYamlResponse.body).toHaveProperty('format', 'yaml');
    });

    it('should merge multiple TMAC files', async () => {
      const model1 = `
version: "1.0.0"
metadata:
  name: "Model 1"
system:
  name: "System 1"
  components:
    - id: "comp1"
      name: "Component 1"
      type: "service"
dataFlows: []
threats:
  - id: "T1"
    name: "Threat 1"
    component: "comp1"
    category: "spoofing"
    severity: "high"
`;

      const model2 = `
version: "1.0.0"
metadata:
  name: "Model 2"
system:
  name: "System 2"
  components:
    - id: "comp2"
      name: "Component 2"
      type: "database"
dataFlows: []
threats:
  - id: "T2"
    name: "Threat 2"
    component: "comp2"
    category: "tampering"
    severity: "medium"
`;

      const mergeResponse = await request(app)
        .post('/api/tmac/merge')
        .attach('files', Buffer.from(model1), 'model1.yaml')
        .attach('files', Buffer.from(model2), 'model2.yaml');

      expect(mergeResponse.status).toBe(200);
      expect(mergeResponse.body).toHaveProperty('merged');
      expect(mergeResponse.body).toHaveProperty('fileCount', 2);
      
      const merged = mergeResponse.body.merged;
      expect(merged.system.components).toHaveLength(2);
      expect(merged.threats).toHaveLength(2);
    });
  });

  describe('Error scenarios', () => {
    it('should handle invalid YAML syntax', async () => {
      const invalidYAML = `
invalid: yaml: syntax:
  - broken
  : list
`;

      const response = await request(app)
        .post('/api/tmac/parse')
        .attach('file', Buffer.from(invalidYAML), 'invalid.yaml')
        .field('format', 'yaml');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid TMAC schema', async () => {
      const invalidModel = `
version: "1.0.0"
# Missing required fields
`;

      const response = await request(app)
        .post('/api/tmac/validate')
        .attach('file', Buffer.from(invalidModel), 'invalid.yaml');

      expect(response.status).toBe(200);
      expect(response.body.validation.valid).toBe(false);
      expect(response.body.validation.errors.length).toBeGreaterThan(0);
    });

    it('should handle missing file', async () => {
      const response = await request(app)
        .post('/api/tmac/parse')
        .field('format', 'yaml');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'No file uploaded');
    });

    it('should handle unsupported format', async () => {
      const response = await request(app)
        .post('/api/tmac/convert')
        .attach('file', Buffer.from('content'), 'test.yaml')
        .field('format', 'xml');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Health check', () => {
    it('should return service health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'tmac-service');
      expect(response.body).toHaveProperty('version', '1.0.0');
    });
  });

  describe('Rate limiting', () => {
    it('should enforce rate limits', async () => {
      // Make multiple requests quickly
      const requests = Array(15).fill(null).map(() =>
        request(app)
          .post('/api/tmac/validate')
          .attach('file', Buffer.from(sampleTMACContent), 'test.yaml')
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
});