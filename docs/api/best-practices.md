# 🌟 API Best Practices Guide

## 📋 Table of Contents

1. [Authentication & Security](#authentication--security)
2. [Request/Response Patterns](#requestresponse-patterns)  
3. [Error Handling](#error-handling)
4. [Rate Limiting & Performance](#rate-limiting--performance)
5. [Data Validation](#data-validation)
6. [Integration Patterns](#integration-patterns)
7. [Monitoring & Observability](#monitoring--observability)
8. [SDK Usage Recommendations](#sdk-usage-recommendations)

---

## 🔐 Authentication & Security

### JWT Token Management

```javascript
// ✅ RECOMMENDED: Proper token handling
class ThreatModelingAPIClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }

  async authenticate(email, password) {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error('Authentication failed');
    }

    const data = await response.json();
    this.setTokens(data.accessToken, data.refreshToken);
    return data;
  }

  setTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    
    // Parse JWT to get expiry
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      this.tokenExpiry = new Date(payload.exp * 1000);
    } catch (e) {
      console.warn('Could not parse JWT token expiry');
    }
  }

  async makeAuthenticatedRequest(url, options = {}) {
    // Check if token needs refresh (with 5 min buffer)
    if (this.needsTokenRefresh()) {
      await this.refreshAccessToken();
    }

    return fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  }

  needsTokenRefresh() {
    if (!this.tokenExpiry) return false;
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    return new Date() > new Date(this.tokenExpiry.getTime() - bufferTime);
  }

  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken })
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    this.setTokens(data.accessToken, data.refreshToken);
  }
}
```

### Secure API Key Storage

```javascript
// ✅ RECOMMENDED: Environment-based configuration
const config = {
  apiKey: process.env.THREAT_MODELING_API_KEY,
  baseUrl: process.env.THREAT_MODELING_API_URL || 'http://localhost:3000/api',
  timeout: parseInt(process.env.API_TIMEOUT) || 30000
};

// ❌ AVOID: Hardcoded credentials
const badConfig = {
  apiKey: 'sk-1234567890abcdef',  // Never do this!
  baseUrl: 'http://localhost:3000/api'
};
```

---

## 📨 Request/Response Patterns

### Consistent Request Structure

```javascript
// ✅ RECOMMENDED: Structured request with validation
async function createThreatModel(threatModelData) {
  // Validate required fields
  const requiredFields = ['name', 'description', 'methodology'];
  for (const field of requiredFields) {
    if (!threatModelData[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate methodology
  const validMethodologies = ['STRIDE', 'PASTA', 'LINDDUN', 'VAST', 'OCTAVE', 'TRIKE'];
  if (!validMethodologies.includes(threatModelData.methodology)) {
    throw new Error(`Invalid methodology. Must be one of: ${validMethodologies.join(', ')}`);
  }

  const request = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      name: threatModelData.name.trim(),
      description: threatModelData.description.trim(),
      methodology: threatModelData.methodology,
      scope: threatModelData.scope || {},
      metadata: threatModelData.metadata || {}
    })
  };

  const response = await fetch(`${baseUrl}/threat-models`, request);
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new APIError(errorData.error, errorData.code, response.status);
  }

  return response.json();
}
```

### Response Handling Patterns

```javascript
// ✅ RECOMMENDED: Comprehensive response handling
class APIError extends Error {
  constructor(message, code, status, details = []) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function handleAPIResponse(response) {
  const contentType = response.headers.get('content-type');
  
  // Handle non-JSON responses
  if (!contentType || !contentType.includes('application/json')) {
    if (response.status === 200) {
      return { success: true, data: await response.text() };
    }
    throw new APIError('Invalid response format', 'INVALID_RESPONSE', response.status);
  }

  const data = await response.json();

  // Handle successful responses
  if (response.ok) {
    return data;
  }

  // Handle error responses
  throw new APIError(
    data.error || 'Unknown error',
    data.code || 'UNKNOWN_ERROR',
    response.status,
    data.details || []
  );
}

// Usage example
try {
  const threatModel = await createThreatModel({
    name: 'API Security Review',
    description: 'Security assessment of REST APIs',
    methodology: 'STRIDE'
  });
  console.log('Threat model created:', threatModel.threatModel.id);
} catch (error) {
  if (error instanceof APIError) {
    console.error(`API Error (${error.status}): ${error.message}`);
    if (error.details.length > 0) {
      console.error('Details:', error.details);
    }
  } else {
    console.error('Unexpected error:', error.message);
  }
}
```

---

## ❌ Error Handling

### Comprehensive Error Strategy

```javascript
// ✅ RECOMMENDED: Robust error handling with retry logic
class ResilientAPIClient {
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.timeout = options.timeout || 30000;
  }

  async request(endpoint, options = {}, retryCount = 0) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Handle different HTTP status codes
      if (response.status >= 200 && response.status < 300) {
        return await this.handleSuccessResponse(response);
      } else if (response.status >= 400 && response.status < 500) {
        // Client errors - don't retry
        throw await this.handleClientError(response);
      } else if (response.status >= 500) {
        // Server errors - retry with backoff
        throw await this.handleServerError(response);
      }

    } catch (error) {
      // Handle network errors, timeouts, and server errors with retry
      if (this.shouldRetry(error, retryCount)) {
        await this.delay(this.retryDelay * Math.pow(2, retryCount));
        return this.request(endpoint, options, retryCount + 1);
      }
      throw error;
    }
  }

  shouldRetry(error, retryCount) {
    if (retryCount >= this.maxRetries) return false;
    
    // Retry on network errors, timeouts, and 5xx errors
    return (
      error.name === 'AbortError' ||  // Timeout
      error.name === 'TypeError' ||   // Network error
      (error.status >= 500 && error.status < 600) ||  // Server error
      error.status === 429  // Rate limit
    );
  }

  async handleSuccessResponse(response) {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    return await response.text();
  }

  async handleClientError(response) {
    const data = await response.json();
    const error = new APIError(
      data.error || 'Client error',
      data.code || 'CLIENT_ERROR',
      response.status,
      data.details || []
    );
    
    // Add specific handling for common client errors
    if (response.status === 401) {
      // Handle authentication errors
      this.emit('authenticationRequired');
    } else if (response.status === 403) {
      // Handle authorization errors
      console.warn('Insufficient permissions for this operation');
    } else if (response.status === 429) {
      // Handle rate limiting
      const retryAfter = response.headers.get('Retry-After');
      if (retryAfter) {
        error.retryAfter = parseInt(retryAfter) * 1000;
      }
    }
    
    return error;
  }

  async handleServerError(response) {
    const data = await response.json().catch(() => ({}));
    return new APIError(
      data.error || 'Server error',
      data.code || 'SERVER_ERROR',
      response.status
    );
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Error Recovery Patterns

```javascript
// ✅ RECOMMENDED: Graceful degradation
async function analyzeThreatsWithFallback(threatModelId) {
  try {
    // Try AI analysis first
    return await client.ai.analyzeThreats({
      threat_model_id: threatModelId,
      analysis_type: 'deep'
    });
  } catch (error) {
    if (error.status === 503 || error.code === 'AI_SERVICE_UNAVAILABLE') {
      console.warn('AI service unavailable, falling back to basic analysis');
      
      // Fallback to basic analysis
      return await client.ai.analyzeThreats({
        threat_model_id: threatModelId,
        analysis_type: 'quick'
      });
    }
    throw error;
  }
}
```

---

## ⚡ Rate Limiting & Performance

### Request Optimization

```javascript
// ✅ RECOMMENDED: Batch operations and caching
class OptimizedThreatModelingClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cache = new Map();
    this.batchQueue = [];
    this.batchTimeout = null;
  }

  // Implement caching for read operations
  async getThreatModel(id, useCache = true) {
    const cacheKey = `threat-model-${id}`;
    
    if (useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 min cache
        return cached.data;
      }
    }

    const data = await this.request(`/threat-models/${id}`);
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  // Batch multiple threat model updates
  batchUpdateThreats(updates) {
    return new Promise((resolve, reject) => {
      this.batchQueue.push(...updates.map(update => ({ ...update, resolve, reject })));
      
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
      }
      
      this.batchTimeout = setTimeout(() => this.processBatch(), 100);
    });
  }

  async processBatch() {
    if (this.batchQueue.length === 0) return;
    
    const batch = this.batchQueue.splice(0, 50); // Process in chunks of 50
    
    try {
      const results = await this.request('/threats/batch-update', {
        method: 'PUT',
        body: JSON.stringify({ updates: batch.map(({ resolve, reject, ...update }) => update) })
      });
      
      batch.forEach((item, index) => {
        item.resolve(results.data[index]);
      });
    } catch (error) {
      batch.forEach(item => item.reject(error));
    }
  }

  // Implement pagination for large datasets
  async *getAllThreatModels(filters = {}) {
    let offset = 0;
    const limit = 50;
    
    while (true) {
      const response = await this.request('/threat-models', {
        method: 'GET',
        query: { ...filters, limit, offset }
      });
      
      yield* response.threatModels;
      
      if (response.threatModels.length < limit) {
        break; // No more data
      }
      
      offset += limit;
    }
  }
}

// Usage example
const client = new OptimizedThreatModelingClient('http://localhost:3000/api');

// Efficient pagination
for await (const threatModel of client.getAllThreatModels({ status: 'published' })) {
  console.log('Processing threat model:', threatModel.name);
  // Process each threat model without loading all into memory
}
```

### Rate Limit Handling

```javascript
// ✅ RECOMMENDED: Respect rate limits
class RateLimitAwareClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.rateLimitInfo = {
      remaining: null,
      resetTime: null,
      limit: null
    };
  }

  async request(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ endpoint, options, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      // Check if we need to wait for rate limit reset
      if (this.rateLimitInfo.remaining === 0 && this.rateLimitInfo.resetTime) {
        const waitTime = this.rateLimitInfo.resetTime - Date.now();
        if (waitTime > 0) {
          console.log(`Rate limit exceeded. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
          await this.delay(waitTime);
        }
      }

      const { endpoint, options, resolve, reject } = this.requestQueue.shift();

      try {
        const response = await fetch(`${this.baseUrl}${endpoint}`, options);
        
        // Update rate limit info from headers
        this.updateRateLimitInfo(response);
        
        if (response.ok) {
          resolve(await response.json());
        } else {
          reject(new APIError('Request failed', 'REQUEST_FAILED', response.status));
        }
      } catch (error) {
        reject(error);
      }

      // Small delay between requests to be respectful
      await this.delay(100);
    }

    this.isProcessingQueue = false;
  }

  updateRateLimitInfo(response) {
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');
    const limit = response.headers.get('X-RateLimit-Limit');

    if (remaining !== null) this.rateLimitInfo.remaining = parseInt(remaining);
    if (reset !== null) this.rateLimitInfo.resetTime = parseInt(reset) * 1000;
    if (limit !== null) this.rateLimitInfo.limit = parseInt(limit);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## ✅ Data Validation

### Input Validation Best Practices

```javascript
// ✅ RECOMMENDED: Comprehensive input validation
class ThreatModelValidator {
  static validateThreatModel(data) {
    const errors = [];

    // Required field validation
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push('Name is required and must be a non-empty string');
    }

    if (!data.description || typeof data.description !== 'string') {
      errors.push('Description is required and must be a string');
    }

    if (!data.methodology || !this.VALID_METHODOLOGIES.includes(data.methodology)) {
      errors.push(`Methodology must be one of: ${this.VALID_METHODOLOGIES.join(', ')}`);
    }

    // Length validation
    if (data.name && data.name.length > 255) {
      errors.push('Name must be 255 characters or less');
    }

    if (data.description && data.description.length > 2000) {
      errors.push('Description must be 2000 characters or less');
    }

    // Scope validation
    if (data.scope) {
      if (data.scope.systems && !Array.isArray(data.scope.systems)) {
        errors.push('Scope systems must be an array');
      }

      if (data.scope.boundaries && !Array.isArray(data.scope.boundaries)) {
        errors.push('Scope boundaries must be an array');
      }
    }

    // Metadata validation
    if (data.metadata) {
      if (data.metadata.compliance && !Array.isArray(data.metadata.compliance)) {
        errors.push('Metadata compliance must be an array');
      }

      if (data.metadata.technologies && !Array.isArray(data.metadata.technologies)) {
        errors.push('Metadata technologies must be an array');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateThreat(data) {
    const errors = [];

    // Required fields
    const requiredFields = ['title', 'description', 'category', 'severity'];
    requiredFields.forEach(field => {
      if (!data[field] || typeof data[field] !== 'string' || data[field].trim().length === 0) {
        errors.push(`${field} is required and must be a non-empty string`);
      }
    });

    // Enum validation
    if (data.category && !this.VALID_THREAT_CATEGORIES.includes(data.category)) {
      errors.push(`Category must be one of: ${this.VALID_THREAT_CATEGORIES.join(', ')}`);
    }

    if (data.severity && !this.VALID_SEVERITY_LEVELS.includes(data.severity)) {
      errors.push(`Severity must be one of: ${this.VALID_SEVERITY_LEVELS.join(', ')}`);
    }

    // CVSS score validation
    if (data.cvss_score !== undefined) {
      if (typeof data.cvss_score !== 'number' || data.cvss_score < 0 || data.cvss_score > 10) {
        errors.push('CVSS score must be a number between 0 and 10');
      }
    }

    // STRIDE validation
    if (data.stride) {
      if (!Array.isArray(data.stride)) {
        errors.push('STRIDE must be an array');
      } else {
        const validStride = ['S', 'T', 'R', 'I', 'D', 'E'];
        const invalidStride = data.stride.filter(s => !validStride.includes(s));
        if (invalidStride.length > 0) {
          errors.push(`Invalid STRIDE values: ${invalidStride.join(', ')}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static get VALID_METHODOLOGIES() {
    return ['STRIDE', 'PASTA', 'LINDDUN', 'VAST', 'OCTAVE', 'TRIKE'];
  }

  static get VALID_THREAT_CATEGORIES() {
    return [
      'spoofing',
      'tampering', 
      'repudiation',
      'information_disclosure',
      'denial_of_service',
      'elevation_of_privilege'
    ];
  }

  static get VALID_SEVERITY_LEVELS() {
    return ['low', 'medium', 'high', 'critical'];
  }
}

// Usage example
const threatModelData = {
  name: 'API Security Review',
  description: 'Security assessment of REST APIs',
  methodology: 'STRIDE'
};

const validation = ThreatModelValidator.validateThreatModel(threatModelData);
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
  return;
}

// Proceed with API call
const result = await client.createThreatModel(threatModelData);
```

---

## 🔗 Integration Patterns

### TMAC CI/CD Integration

```yaml
# ✅ RECOMMENDED: GitOps workflow for threat models
name: Threat Model Validation
on:
  push:
    paths: ['threat-models/**/*.tmac.yaml']
  pull_request:
    paths: ['threat-models/**/*.tmac.yaml']

jobs:
  validate-threat-models:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install TMAC CLI
        run: npm install -g @threatmodeling/tmac-cli
      
      - name: Validate TMAC Files
        run: |
          find threat-models -name "*.tmac.yaml" | while read file; do
            echo "Validating $file..."
            
            # Local validation
            tmac validate "$file"
            
            # API validation
            curl -f -X POST "${{ secrets.THREAT_MODEL_API }}/api/tmac/validate" \
              -H "Authorization: Bearer ${{ secrets.API_TOKEN }}" \
              -F "file=@$file" \
              | jq -e '.validation.valid'
          done

      - name: Generate Security Report
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        run: |
          # Generate compliance report for main branch
          tmac report --format pdf --type compliance \
            --output reports/threat-model-compliance.pdf \
            threat-models/**/*.tmac.yaml
      
      - name: Upload Report
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        uses: actions/upload-artifact@v3
        with:
          name: threat-model-reports
          path: reports/
```

### Real-time Monitoring Integration

```javascript
// ✅ RECOMMENDED: WebSocket integration for real-time updates
class RealTimeThreatMonitor {
  constructor(apiUrl, wsUrl) {
    this.apiUrl = apiUrl;
    this.wsUrl = wsUrl;
    this.socket = null;
    this.eventHandlers = new Map();
  }

  async connect(threatModelId) {
    this.socket = new WebSocket(`${this.wsUrl}/threat-models/${threatModelId}/events`);
    
    this.socket.onopen = () => {
      console.log('Connected to real-time threat monitoring');
      this.emit('connected');
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleEvent(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.socket.onclose = () => {
      console.log('Disconnected from threat monitoring');
      this.emit('disconnected');
      
      // Auto-reconnect after 5 seconds
      setTimeout(() => this.connect(threatModelId), 5000);
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    };
  }

  handleEvent(data) {
    switch (data.type) {
      case 'threat_identified':
        this.emit('threatIdentified', data.payload);
        break;
      case 'analysis_complete':
        this.emit('analysisComplete', data.payload);
        break;
      case 'risk_score_updated':
        this.emit('riskScoreUpdated', data.payload);
        break;
      case 'mitigation_added':
        this.emit('mitigationAdded', data.payload);
        break;
      default:
        console.log('Unknown event type:', data.type);
    }
  }

  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  emit(event, data) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

// Usage example
const monitor = new RealTimeThreatMonitor(
  'http://localhost:3000/api',
  'ws://localhost:3000'
);

monitor.on('threatIdentified', (threat) => {
  console.log('New threat identified:', threat.title);
  
  // Auto-create JIRA ticket for high-severity threats
  if (threat.severity === 'high' || threat.severity === 'critical') {
    createJiraTicket(threat);
  }
  
  // Send Slack notification
  sendSlackAlert(threat);
});

monitor.on('analysisComplete', (analysis) => {
  console.log('Analysis complete. Risk score:', analysis.riskScore);
  
  // Update dashboard
  updateDashboard(analysis);
});

await monitor.connect('threat-model-uuid');
```

---

## 📊 Monitoring & Observability

### Application Performance Monitoring

```javascript
// ✅ RECOMMENDED: Comprehensive APM integration
class InstrumentedAPIClient {
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl;
    this.metrics = options.metrics || new Map();
    this.tracer = options.tracer || null;
  }

  async request(endpoint, options = {}) {
    const startTime = Date.now();
    const span = this.tracer?.startSpan(`api.${endpoint.replace(/\//g, '.')}`);
    
    try {
      span?.setTag('http.method', options.method || 'GET');
      span?.setTag('http.url', `${this.baseUrl}${endpoint}`);
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      
      // Record metrics
      const duration = Date.now() - startTime;
      this.recordMetrics(endpoint, options.method || 'GET', response.status, duration);
      
      span?.setTag('http.status_code', response.status);
      span?.finish();
      
      return await this.handleResponse(response);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordMetrics(endpoint, options.method || 'GET', 'error', duration);
      
      span?.setTag('error', true);
      span?.setTag('error.message', error.message);
      span?.finish();
      
      throw error;
    }
  }

  recordMetrics(endpoint, method, status, duration) {
    const key = `${method}:${endpoint}:${status}`;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        count: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0
      });
    }
    
    const metric = this.metrics.get(key);
    metric.count++;
    metric.totalDuration += duration;
    metric.minDuration = Math.min(metric.minDuration, duration);
    metric.maxDuration = Math.max(metric.maxDuration, duration);
    metric.avgDuration = metric.totalDuration / metric.count;
  }

  getMetrics() {
    const summary = {};
    for (const [key, metric] of this.metrics) {
      summary[key] = {
        ...metric,
        avgDuration: Math.round(metric.avgDuration)
      };
    }
    return summary;
  }
}

// Usage with OpenTelemetry
const opentelemetry = require('@opentelemetry/api');
const tracer = opentelemetry.trace.getTracer('threat-modeling-client');

const client = new InstrumentedAPIClient('http://localhost:3000/api', {
  tracer
});

// Periodically report metrics
setInterval(() => {
  const metrics = client.getMetrics();
  console.log('API Metrics:', JSON.stringify(metrics, null, 2));
  
  // Send to monitoring system (Prometheus, DataDog, etc.)
  // monitoringSystem.sendMetrics(metrics);
}, 60000); // Every minute
```

---

## 🛠️ SDK Usage Recommendations

### TypeScript SDK Best Practices

```typescript
// ✅ RECOMMENDED: Type-safe SDK usage
import { ThreatModelingClient, ThreatModel, AnalysisType } from '@threatmodeling/typescript-sdk';

interface ThreatModelConfig {
  name: string;
  description: string;
  methodology: 'STRIDE' | 'PASTA' | 'LINDDUN';
  scope?: {
    systems: string[];
    boundaries: string[];
  };
}

class SecurityAssessmentWorkflow {
  private client: ThreatModelingClient;

  constructor(apiKey: string, baseUrl?: string) {
    this.client = new ThreatModelingClient({
      apiKey,
      baseUrl: baseUrl || 'http://localhost:3000/api',
      timeout: 30000,
      retryConfig: {
        maxRetries: 3,
        retryDelay: 1000
      }
    });
  }

  async createSecurityAssessment(config: ThreatModelConfig): Promise<ThreatModel> {
    // Input validation
    this.validateConfig(config);

    try {
      // Create threat model
      const threatModel = await this.client.threatModels.create(config);
      
      // Run initial analysis
      const analysis = await this.client.ai.analyzeThreats({
        threatModelId: threatModel.id,
        analysisType: AnalysisType.Deep,
        includeCompliance: true
      });

      // Generate initial report
      await this.client.reports.generate({
        threatModelId: threatModel.id,
        reportType: 'executive_summary',
        format: 'pdf'
      });

      return threatModel;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  private validateConfig(config: ThreatModelConfig): void {
    if (!config.name?.trim()) {
      throw new Error('Name is required');
    }
    
    if (!config.description?.trim()) {
      throw new Error('Description is required');
    }
    
    const validMethodologies = ['STRIDE', 'PASTA', 'LINDDUN'] as const;
    if (!validMethodologies.includes(config.methodology)) {
      throw new Error(`Invalid methodology: ${config.methodology}`);
    }
  }

  private handleError(error: any): void {
    // Log structured error data
    console.error('Security assessment error:', {
      message: error.message,
      code: error.code,
      status: error.status,
      details: error.details,
      timestamp: new Date().toISOString()
    });

    // Send to error tracking service
    // errorTracker.captureException(error);
  }
}

// Usage
const workflow = new SecurityAssessmentWorkflow(process.env.THREAT_MODELING_API_KEY!);

const assessment = await workflow.createSecurityAssessment({
  name: 'Payment Gateway Security Review',
  description: 'Comprehensive security assessment of payment processing system',
  methodology: 'STRIDE',
  scope: {
    systems: ['payment-api', 'gateway', 'processor'],
    boundaries: ['internet', 'payment-network', 'internal']
  }
});
```

### Python SDK Best Practices

```python
# ✅ RECOMMENDED: Production-ready Python integration
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

from threatmodeling import AsyncThreatModelingClient, ThreatModel, APIError

@dataclass
class SecurityConfig:
    api_key: str
    base_url: str = "http://localhost:3000/api"
    timeout: int = 30
    max_retries: int = 3

class SecurityAutomationPipeline:
    def __init__(self, config: SecurityConfig):
        self.config = config
        self.client = AsyncThreatModelingClient(
            api_key=config.api_key,
            base_url=config.base_url,
            timeout=config.timeout,
            max_retries=config.max_retries
        )
        self.logger = logging.getLogger(__name__)

    @asynccontextmanager
    async def session(self):
        """Context manager for API session with proper cleanup."""
        try:
            await self.client.authenticate()
            yield self.client
        finally:
            await self.client.close()

    async def process_threat_models(self, tmac_files: List[str]) -> Dict[str, Any]:
        """Process multiple TMAC files concurrently."""
        async with self.session() as client:
            # Process files concurrently
            tasks = [
                self._process_single_file(client, file_path)
                for file_path in tmac_files
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Categorize results
            successful = []
            failed = []
            
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    failed.append({
                        'file': tmac_files[i],
                        'error': str(result)
                    })
                else:
                    successful.append(result)
            
            return {
                'successful': successful,
                'failed': failed,
                'summary': {
                    'total': len(tmac_files),
                    'successful_count': len(successful),
                    'failed_count': len(failed)
                }
            }

    async def _process_single_file(self, client: AsyncThreatModelingClient, file_path: str) -> Dict[str, Any]:
        """Process a single TMAC file with comprehensive error handling."""
        try:
            self.logger.info(f"Processing TMAC file: {file_path}")
            
            # Parse and validate
            with open(file_path, 'rb') as f:
                parse_result = await client.tmac.parse(f, validate=True)
            
            if not parse_result.success:
                raise ValueError(f"TMAC parsing failed: {parse_result.error}")
            
            # Run analysis
            with open(file_path, 'rb') as f:
                analysis_result = await client.tmac.analyze(f)
            
            # Generate report if analysis is successful
            report = None
            if analysis_result.success:
                report = await client.reports.generate({
                    'tmac_content': parse_result.model,
                    'report_type': 'technical',
                    'format': 'json'
                })
            
            return {
                'file': file_path,
                'parse_result': parse_result,
                'analysis_result': analysis_result,
                'report': report,
                'status': 'success'
            }
            
        except APIError as e:
            self.logger.error(f"API error processing {file_path}: {e}")
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error processing {file_path}: {e}")
            raise

# Usage example
async def main():
    config = SecurityConfig(
        api_key=os.environ['THREAT_MODELING_API_KEY'],
        base_url=os.environ.get('THREAT_MODELING_API_URL', 'http://localhost:3000/api')
    )
    
    pipeline = SecurityAutomationPipeline(config)
    
    tmac_files = [
        'threat-models/web-app.tmac.yaml',
        'threat-models/api-gateway.tmac.yaml',
        'threat-models/database.tmac.yaml'
    ]
    
    results = await pipeline.process_threat_models(tmac_files)
    
    print(f"Processed {results['summary']['total']} files:")
    print(f"  Successful: {results['summary']['successful_count']}")
    print(f"  Failed: {results['summary']['failed_count']}")
    
    if results['failed']:
        print("\nFailed files:")
        for failure in results['failed']:
            print(f"  - {failure['file']}: {failure['error']}")

if __name__ == "__main__":
    asyncio.run(main())
```

---

## 🎯 Summary

This comprehensive best practices guide ensures that developers can:

1. **🔐 Implement robust security** with proper authentication and token management
2. **📨 Handle requests efficiently** with validation, caching, and batching
3. **❌ Manage errors gracefully** with retry logic and fallback strategies
4. **⚡ Optimize performance** through rate limiting awareness and pagination
5. **✅ Validate data comprehensively** to prevent API errors
6. **🔗 Integrate seamlessly** with CI/CD pipelines and monitoring systems
7. **📊 Monitor effectively** with metrics and distributed tracing
8. **🛠️ Use SDKs properly** with type safety and error handling

Following these patterns will ensure your integration with the Threat Modeling Platform API is **production-ready, resilient, and maintainable**.