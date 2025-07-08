# 🧠 AI Service Documentation

## Overview

The AI service is a comprehensive machine learning and threat intelligence platform that enhances threat modeling with intelligent suggestions, risk assessment, and contextual threat analysis. It integrates real-world threat intelligence from multiple sources to provide actionable security insights.

## 🎯 Key Features

### ✅ Implemented Features

#### 1. **AI-Powered Threat Analysis**
- **Multi-Methodology Support**: STRIDE, LINDDUN, PASTA, VAST, DREAD
- **Contextual Analysis**: Considers system architecture, data flows, and business context
- **Confidence Scoring**: Statistical confidence metrics for all AI-generated recommendations
- **Similarity Analysis**: Finds similar threats from historical data and intelligence feeds

#### 2. **Threat Intelligence Integration**
- **Real-time Feeds**: MITRE ATT&CK, CVE Database, CWE Database
- **STIX Format Support**: Industry-standard threat intelligence processing
- **Contextual Matching**: Intelligence filtered by technology stack, industry, geography
- **Automated Updates**: Scheduled updates from threat intelligence sources

#### 3. **Enhanced Threat Suggestions**
- **Context-Aware Generation**: Based on system components, data flows, and assets
- **Risk Prediction**: ML-based risk level assessment with contributing factors
- **Mitigation Recommendations**: Actionable security controls with effectiveness scores
- **Attack Vector Analysis**: Detailed attack path identification

#### 4. **Enterprise Security**
- **Role-Based Access Control**: Admin and user roles with granular permissions
- **Rate Limiting**: Adaptive limits based on user tier and endpoint sensitivity
- **Audit Logging**: Comprehensive audit trail for all AI analysis operations
- **Input Validation**: Multi-layer validation preventing injection attacks

## 🏗️ Architecture

### Service Components

```
AI Service (Port 8002)
├── Controllers/
│   └── ai.controller.ts          # REST API endpoints
├── Services/
│   ├── ai-threat-analyzer.service.ts    # Core AI analysis engine
│   └── threat-intelligence.service.ts  # Threat intel integration
├── Middleware/
│   ├── auth.middleware.ts        # JWT authentication
│   ├── rate-limit.middleware.ts  # Redis-based rate limiting
│   └── validation.middleware.ts  # Input validation & sanitization
├── Types/
│   ├── ai.ts                    # AI-specific type definitions
│   ├── shared.ts                # Shared enums and interfaces
│   └── global.d.ts              # Global type extensions
└── Utils/
    └── logger.ts                # Structured logging with Winston
```

### Data Flow

```
Frontend Request
     ↓
API Gateway (Authentication)
     ↓
Rate Limiting Middleware
     ↓
Input Validation
     ↓
AI Threat Analyzer
     ↓
Threat Intelligence Service
     ↓
Database & Redis Cache
     ↓
AI Analysis Response
```

## 🔌 API Endpoints

### Core Analysis Endpoints

#### `POST /api/ai/analyze`
Performs comprehensive AI-powered threat analysis.

**Request Body:**
```json
{
  "threat_model_id": "uuid",
  "methodology": "stride|linddun|pasta|vast|dread",
  "context": {
    "system_components": [...],
    "data_flows": [...],
    "trust_boundaries": [...],
    "assets": [...],
    "existing_controls": [...],
    "business_context": {...}
  },
  "analysis_depth": "basic|standard|comprehensive",
  "focus_areas": ["optional", "categories"],
  "exclude_categories": ["optional", "exclusions"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analysis_id": "unique_id",
    "threat_model_id": "uuid",
    "generated_threats": [...],
    "risk_assessment": {...},
    "recommendations": [...],
    "predictions": [...],
    "confidence_metrics": {...},
    "processing_metadata": {...}
  }
}
```

#### `GET /api/ai/analysis/{analysisId}`
Retrieve analysis results by ID.

#### `GET /api/ai/analysis/history/{threatModelId}`
Get analysis history for a threat model.

### Management Endpoints

#### `GET /api/ai/health`
Service health status with model availability.

#### `GET /api/ai/metrics` (Admin Only)
Service metrics including accuracy and performance data.

#### `POST /api/ai/threat-intelligence/update` (Admin Only)
Trigger manual threat intelligence update.

#### `GET /api/ai/threat-intelligence/stats`
Threat intelligence statistics and freshness.

## 📊 AI Analysis Components

### 1. Threat Classification
- **Algorithm**: Context-aware classification using threat patterns
- **Categories**: Injection, Authentication, Authorization, Cryptography, Configuration
- **Confidence**: Statistical confidence scoring (0-1 scale)
- **Alternative Classifications**: Multiple potential classifications with scores

### 2. Risk Prediction
- **Factors**: System complexity, data sensitivity, external exposure
- **Levels**: Low, Medium, High, Critical
- **Contributing Factors**: Weighted factors with justifications
- **Recommendations**: Risk-specific mitigation strategies

### 3. Similarity Analysis
- **Historical Threats**: Comparison with past threat models
- **Intelligence Matching**: MITRE ATT&CK pattern matching
- **Pattern Recognition**: Common attack patterns and TTPs
- **Lessons Learned**: Historical mitigation effectiveness

### 4. Global Risk Assessment
- **Overall Risk Score**: Computed composite score (0-100)
- **Risk Distribution**: Breakdown by severity levels
- **Risk Trends**: Increasing, stable, decreasing threat categories
- **Critical Vulnerabilities**: High-priority items requiring immediate attention

## 🎨 Machine Learning Models

### Current Implementation
- **Threat Classifier**: Pattern-based classification with confidence scoring
- **Risk Predictor**: Multi-factor risk assessment algorithm
- **Similarity Analyzer**: Vector-based threat comparison
- **Context Processor**: Business and technical context integration

### Future Enhancements
- **Large Language Models**: Integration with GPT-4/Claude for natural language processing
- **Deep Learning**: Neural networks for advanced pattern recognition
- **Ensemble Methods**: Multiple model voting for improved accuracy
- **Continuous Learning**: Model updates based on feedback and new data

## 🔒 Security Features

### Authentication & Authorization
- **JWT Tokens**: Secure token-based authentication
- **Role-Based Access**: Admin and user roles with different permissions
- **Session Management**: Secure session handling with refresh tokens

### Rate Limiting
- **User-Based Limits**: Per-user rate limiting with Redis storage
- **Endpoint-Specific**: Different limits for different API endpoints
- **Adaptive Limits**: Premium users get higher rate limits
- **Global Protection**: Service-wide rate limiting for DDoS protection

### Input Security
- **Schema Validation**: Zod-based request validation
- **Sanitization**: XSS and injection prevention
- **Size Limits**: Request size and complexity limits
- **Content-Type Validation**: Strict content type checking

## 📈 Monitoring & Observability

### Health Checks
- **Service Health**: `/health` endpoint with dependency checks
- **Database Connectivity**: PostgreSQL connection validation
- **Redis Connectivity**: Cache service availability
- **Threat Intel Freshness**: Data recency validation

### Metrics (Prometheus Format)
- **Request Metrics**: Count, latency, error rates
- **Model Performance**: Accuracy, precision, recall, F1 scores
- **Threat Intelligence**: Update frequency, source reliability
- **Resource Usage**: Memory, CPU, processing time

### Logging
- **Structured Logging**: JSON format with Winston
- **Audit Trail**: All AI analysis operations logged
- **Security Events**: Authentication failures, rate limit violations
- **Performance Metrics**: Processing times, model performance

## 🛠️ Configuration

### Environment Variables
```env
# Service Configuration
PORT=8002
HOST=0.0.0.0
NODE_ENV=production

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=threatmodel_db
DB_USER=threatmodel
DB_PASSWORD=secure_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional_password

# Authentication
JWT_SECRET=secure_jwt_secret
JWT_REFRESH_SECRET=secure_refresh_secret

# AI Models (Optional)
OPENAI_API_URL=https://api.openai.com/v1
OPENAI_API_KEY=your_openai_key

# Security
INTERNAL_SERVICE_TOKEN=internal_token
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Logging
LOG_LEVEL=info
ENABLE_FILE_LOGGING=true
```

### Model Configuration
```typescript
const modelConfig: AIModelConfig = {
  model_type: 'llm',
  model_name: 'gpt-4-turbo',
  version: '1.0',
  endpoint_url: process.env.OPENAI_API_URL,
  api_key: process.env.OPENAI_API_KEY,
  parameters: {
    max_tokens: 2000,
    temperature: 0.3,
    top_p: 0.9
  },
  confidence_threshold: 0.7
};
```

## 🚀 Deployment

### Docker Deployment
```bash
# Build the service
npm run build

# Create Docker image
docker build -t threat-modeling-ai:latest .

# Run with environment variables
docker run -d \
  --name threat-modeling-ai \
  -p 8002:8002 \
  -e DB_HOST=your_db_host \
  -e REDIS_HOST=your_redis_host \
  -e JWT_SECRET=your_jwt_secret \
  threat-modeling-ai:latest
```

### Production Checklist
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Redis connection established
- [ ] SSL/TLS certificates configured
- [ ] Rate limiting configured
- [ ] Monitoring dashboards setup
- [ ] Log aggregation configured
- [ ] Backup procedures established

## 🔧 Development

### Setup
```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env

# Start development server
npm run dev

# Run tests
npm run test

# Build for production
npm run build
```

### Testing
```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Load testing
k6 run tests/performance/ai-load-test.js

# Health check
curl http://localhost:8002/health
```

### API Testing
```bash
# Analyze threats
curl -X POST http://localhost:8002/api/ai/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d @example-analysis-request.json

# Get analysis results
curl http://localhost:8002/api/ai/analysis/{analysis_id} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Check service metrics
curl http://localhost:8002/api/ai/metrics \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

## 📚 Integration Examples

### Frontend Integration
```typescript
// React component for AI analysis
const analyzeThreats = async (threatModelData) => {
  const response = await fetch('/api/ai/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      threat_model_id: threatModelData.id,
      methodology: 'stride',
      context: threatModelData.context,
      analysis_depth: 'standard'
    })
  });
  
  const analysis = await response.json();
  return analysis.data;
};
```

### Backend Integration
```typescript
// Integration with core threat service
import { AIThreatAnalyzerService } from './ai-threat-analyzer.service';

const aiService = new AIThreatAnalyzerService(db, redis, threatIntelService);
const analysis = await aiService.analyzeThreats(analysisRequest);
```

## 🔮 Future Roadmap

### Q1 2025
- [ ] LLM Integration (GPT-4, Claude)
- [ ] Real-time threat feeds
- [ ] Advanced ML models
- [ ] Automated model retraining

### Q2 2025
- [ ] Custom model training
- [ ] Industry-specific models
- [ ] Collaborative intelligence
- [ ] Advanced visualization

### Q3 2025
- [ ] Threat prediction
- [ ] Behavioral analysis
- [ ] Zero-day detection
- [ ] Automated response

## 📞 Support

### API Documentation
- **Interactive API Docs**: Available at `/api/docs` when service is running
- **OpenAPI Spec**: Available at `/api/openapi.json`

### Troubleshooting
- **Logs**: Check service logs for detailed error information
- **Health Check**: Use `/health` endpoint to verify service status
- **Metrics**: Monitor performance via `/metrics` endpoint

### Performance Tuning
- **Database**: Optimize PostgreSQL queries and indexing
- **Redis**: Configure appropriate memory limits and eviction policies
- **Node.js**: Tune memory limits and garbage collection
- **Rate Limiting**: Adjust limits based on usage patterns

---

**Built with ❤️ for the security community**  
*Making AI-powered threat modeling accessible to everyone*