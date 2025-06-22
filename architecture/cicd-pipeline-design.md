# CI/CD Pipeline Design - Threat Modeling Application

## Overview

This document details the complete CI/CD pipeline design for the Threat Modeling Application, implementing continuous integration, continuous delivery, and continuous deployment practices with security, quality, and reliability at every stage.

## Pipeline Architecture

### Pipeline Stages Overview

```mermaid
graph LR
    subgraph "Developer"
        Dev[Developer] --> Commit[Git Commit]
    end
    
    subgraph "Source Control"
        Commit --> Branch[Feature Branch]
        Branch --> PR[Pull Request]
    end
    
    subgraph "CI Pipeline"
        PR --> Lint[Linting]
        Lint --> Build[Build]
        Build --> UnitTest[Unit Tests]
        UnitTest --> IntTest[Integration Tests]
        IntTest --> SecScan[Security Scan]
        SecScan --> Quality[Code Quality]
        Quality --> Package[Package]
    end
    
    subgraph "CD Pipeline"
        Package --> Deploy_Dev[Deploy to Dev]
        Deploy_Dev --> Test_Dev[Test Dev]
        Test_Dev --> Deploy_Stage[Deploy to Staging]
        Deploy_Stage --> Test_Stage[Test Staging]
        Test_Stage --> Approve[Manual Approval]
        Approve --> Deploy_Prod[Deploy to Prod]
        Deploy_Prod --> Test_Prod[Smoke Tests]
    end
    
    subgraph "Monitoring"
        Test_Prod --> Monitor[Monitoring]
        Monitor --> Rollback[Rollback if needed]
    end
```

## Git Workflow

### Branch Strategy

```yaml
branching_strategy:
  main:
    description: "Production-ready code"
    protected: true
    requires:
      - pull_request_reviews: 2
      - status_checks: all_passing
      - up_to_date: true
    
  develop:
    description: "Integration branch for features"
    protected: true
    requires:
      - pull_request_reviews: 1
      - status_checks: all_passing
    
  feature/*:
    description: "Feature development branches"
    naming: "feature/JIRA-123-description"
    merge_to: develop
    
  release/*:
    description: "Release preparation branches"
    naming: "release/v1.2.3"
    merge_to: [develop, main]
    
  hotfix/*:
    description: "Emergency fixes for production"
    naming: "hotfix/JIRA-456-description"
    merge_to: [main, develop]
```

### Commit Standards

```yaml
commit_standards:
  format: conventional_commits
  types:
    - feat: New feature
    - fix: Bug fix
    - docs: Documentation changes
    - style: Code style changes
    - refactor: Code refactoring
    - perf: Performance improvements
    - test: Test additions/changes
    - chore: Build/auxiliary changes
    
  example: |
    feat(auth): implement OAuth2 integration
    
    - Added OAuth2 provider support
    - Implemented token refresh logic
    - Updated user model for OAuth data
    
    JIRA: TMA-123
    Reviewed-by: john.doe@example.com
```

## Continuous Integration Pipeline

### Pipeline Configuration

```yaml
# .github/workflows/ci.yml
name: Continuous Integration

on:
  pull_request:
    types: [opened, synchronize, reopened]
  push:
    branches: [develop, main]

env:
  NODE_VERSION: '18'
  PYTHON_VERSION: '3.11'
  GO_VERSION: '1.21'
  DOCKER_BUILDKIT: 1

jobs:
  # Code Quality Checks
  lint:
    name: Code Linting
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [auth-service, user-service, project-service]
    
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install dependencies
      run: |
        cd services/${{ matrix.service }}
        npm ci
    
    - name: Run ESLint
      run: |
        cd services/${{ matrix.service }}
        npm run lint
    
    - name: Run Prettier
      run: |
        cd services/${{ matrix.service }}
        npm run format:check
    
    - name: TypeScript type checking
      run: |
        cd services/${{ matrix.service }}
        npm run type-check

  # Security Scanning
  security:
    name: Security Scanning
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        format: 'sarif'
        output: 'trivy-results.sarif'
        severity: 'CRITICAL,HIGH,MEDIUM'
    
    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'
    
    - name: Run Snyk security scan
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      with:
        args: --severity-threshold=high
    
    - name: Run Semgrep
      uses: returntocorp/semgrep-action@v1
      with:
        config: >-
          p/security-audit
          p/secrets
          p/owasp-top-ten
          p/nodejs
          p/typescript

  # Build and Test
  build-test:
    name: Build and Test
    runs-on: ubuntu-latest
    needs: [lint]
    strategy:
      matrix:
        service: [auth-service, user-service, project-service]
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install dependencies
      run: |
        cd services/${{ matrix.service }}
        npm ci
    
    - name: Build service
      run: |
        cd services/${{ matrix.service }}
        npm run build
    
    - name: Run unit tests
      run: |
        cd services/${{ matrix.service }}
        npm run test:unit -- --coverage --ci
      env:
        NODE_ENV: test
    
    - name: Run integration tests
      run: |
        cd services/${{ matrix.service }}
        npm run test:integration -- --ci
      env:
        DATABASE_URL: postgres://test:test@localhost:5432/test_db
        REDIS_URL: redis://localhost:6379
        NODE_ENV: test
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./services/${{ matrix.service }}/coverage/lcov.info
        flags: ${{ matrix.service }}
        name: ${{ matrix.service }}-coverage

  # Contract Testing
  contract-tests:
    name: Contract Testing
    runs-on: ubuntu-latest
    needs: [build-test]
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
    
    - name: Run Pact tests
      run: |
        npm run test:contract
    
    - name: Publish Pacts
      run: |
        npm run pact:publish
      env:
        PACT_BROKER_URL: ${{ secrets.PACT_BROKER_URL }}
        PACT_BROKER_TOKEN: ${{ secrets.PACT_BROKER_TOKEN }}

  # Build Docker Images
  docker-build:
    name: Build Docker Images
    runs-on: ubuntu-latest
    needs: [security, build-test]
    strategy:
      matrix:
        service: [auth-service, user-service, project-service]
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
    
    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ghcr.io/${{ github.repository }}/${{ matrix.service }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=semver,pattern={{version}}
          type=sha,prefix={{branch}}-
    
    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: ./services/${{ matrix.service }}
        file: ./services/${{ matrix.service }}/Dockerfile
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
        build-args: |
          BUILD_DATE=${{ github.event.repository.updated_at }}
          VCS_REF=${{ github.sha }}
          VERSION=${{ steps.meta.outputs.version }}

  # Helm Chart Validation
  helm-validation:
    name: Helm Chart Validation
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Install Helm
      uses: azure/setup-helm@v3
      with:
        version: '3.13.0'
    
    - name: Lint Helm charts
      run: |
        helm lint helm/threatmodel-app
    
    - name: Template Helm charts
      run: |
        helm template threatmodel helm/threatmodel-app \
          --values helm/threatmodel-app/values.yaml \
          --validate
    
    - name: Run Helm unittest
      run: |
        helm plugin install https://github.com/helm-unittest/helm-unittest
        helm unittest helm/threatmodel-app

  # SonarQube Analysis
  sonarqube:
    name: SonarQube Analysis
    runs-on: ubuntu-latest
    needs: [build-test]
    
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    
    - name: SonarQube Scan
      uses: sonarsource/sonarqube-scan-action@master
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
        SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
    
    - name: SonarQube Quality Gate check
      uses: sonarsource/sonarqube-quality-gate-action@master
      timeout-minutes: 5
      env:
        SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

### GitLab CI Configuration

```yaml
# .gitlab-ci.yml
include:
  - template: Security/SAST.gitlab-ci.yml
  - template: Security/Dependency-Scanning.gitlab-ci.yml
  - template: Security/Container-Scanning.gitlab-ci.yml
  - template: Security/License-Scanning.gitlab-ci.yml

stages:
  - validate
  - build
  - test
  - security
  - package
  - deploy
  - verify

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"
  CONTAINER_REGISTRY: registry.gitlab.com
  CONTAINER_IMAGE: ${CONTAINER_REGISTRY}/${CI_PROJECT_PATH}
  KUBERNETES_VERSION: 1.28.0
  HELM_VERSION: 3.13.0

# Validation Stage
validate:commits:
  stage: validate
  image: node:18-alpine
  script:
    - npx commitlint --from=$CI_MERGE_REQUEST_DIFF_BASE_SHA --to=$CI_COMMIT_SHA
  only:
    - merge_requests

validate:branch:
  stage: validate
  script:
    - |
      if [[ ! "$CI_COMMIT_REF_NAME" =~ ^(main|develop|feature/.*|release/.*|hotfix/.*)$ ]]; then
        echo "Branch name does not follow naming convention"
        exit 1
      fi
  only:
    - branches

# Build Stage
.build_template: &build_template
  stage: build
  image: docker:24-dind
  services:
    - docker:24-dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - docker build 
        --cache-from ${CONTAINER_IMAGE}/${SERVICE}:latest
        --tag ${CONTAINER_IMAGE}/${SERVICE}:${CI_COMMIT_SHA}
        --tag ${CONTAINER_IMAGE}/${SERVICE}:latest
        --build-arg BUILDKIT_INLINE_CACHE=1
        services/${SERVICE}
    - docker push ${CONTAINER_IMAGE}/${SERVICE}:${CI_COMMIT_SHA}
    - docker push ${CONTAINER_IMAGE}/${SERVICE}:latest

build:auth-service:
  <<: *build_template
  variables:
    SERVICE: auth-service

build:user-service:
  <<: *build_template
  variables:
    SERVICE: user-service

# Test Stage
.test_template: &test_template
  stage: test
  image: node:18-alpine
  services:
    - postgres:15-alpine
    - redis:7-alpine
  variables:
    POSTGRES_DB: test
    POSTGRES_USER: test
    POSTGRES_PASSWORD: test
    DATABASE_URL: "postgres://test:test@postgres:5432/test"
    REDIS_URL: "redis://redis:6379"
  before_script:
    - cd services/${SERVICE}
    - npm ci
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: services/${SERVICE}/coverage/cobertura-coverage.xml
      junit: services/${SERVICE}/junit.xml

test:unit:auth-service:
  <<: *test_template
  variables:
    SERVICE: auth-service
  script:
    - npm run test:unit -- --coverage --ci --reporters=default --reporters=jest-junit

test:integration:auth-service:
  <<: *test_template
  variables:
    SERVICE: auth-service
  script:
    - npm run test:integration -- --ci

# Security Stage
dependency_scanning:
  stage: security
  image: node:18-alpine
  script:
    - npm audit --audit-level=high
    - npx snyk test --severity-threshold=high
  allow_failure: true

container_scanning:
  stage: security
  image: aquasec/trivy:latest
  script:
    - trivy image --exit-code 1 --severity HIGH,CRITICAL ${CONTAINER_IMAGE}/auth-service:${CI_COMMIT_SHA}
  dependencies:
    - build:auth-service

sast:
  stage: security
  variables:
    SAST_EXCLUDED_PATHS: "node_modules/, coverage/, dist/"

license_scanning:
  stage: security
  variables:
    LICENSE_FINDER_CLI_OPTS: "--decisions-file=.license-decisions.yml"

# Package Stage
package:helm:
  stage: package
  image: alpine/helm:${HELM_VERSION}
  script:
    - helm dependency update helm/threatmodel-app
    - helm package helm/threatmodel-app --version ${CI_COMMIT_SHA}
    - helm push threatmodel-app-${CI_COMMIT_SHA}.tgz oci://${CONTAINER_REGISTRY}/${CI_PROJECT_PATH}/charts
  artifacts:
    paths:
      - "*.tgz"
    expire_in: 30 days

# Deploy Stage
.deploy_template: &deploy_template
  image: alpine/k8s:${KUBERNETES_VERSION}
  before_script:
    - kubectl config set-cluster k8s --server="$KUBE_URL" --insecure-skip-tls-verify=true
    - kubectl config set-credentials gitlab --token="$KUBE_TOKEN"
    - kubectl config set-context default --cluster=k8s --user=gitlab
    - kubectl config use-context default

deploy:dev:
  <<: *deploy_template
  stage: deploy
  environment:
    name: development
    url: https://dev-api.threatmodel.io
  script:
    - |
      helm upgrade --install threatmodel-dev \
        oci://${CONTAINER_REGISTRY}/${CI_PROJECT_PATH}/charts/threatmodel-app \
        --version ${CI_COMMIT_SHA} \
        --namespace threatmodel-dev \
        --create-namespace \
        --values helm/threatmodel-app/values-dev.yaml \
        --set global.image.tag=${CI_COMMIT_SHA} \
        --wait \
        --timeout 10m
  only:
    - develop

deploy:staging:
  <<: *deploy_template
  stage: deploy
  environment:
    name: staging
    url: https://staging-api.threatmodel.io
  script:
    - |
      helm upgrade --install threatmodel-staging \
        oci://${CONTAINER_REGISTRY}/${CI_PROJECT_PATH}/charts/threatmodel-app \
        --version ${CI_COMMIT_SHA} \
        --namespace threatmodel-staging \
        --create-namespace \
        --values helm/threatmodel-app/values-staging.yaml \
        --set global.image.tag=${CI_COMMIT_SHA} \
        --wait \
        --timeout 10m
  only:
    - main

deploy:production:
  <<: *deploy_template
  stage: deploy
  environment:
    name: production
    url: https://api.threatmodel.io
  script:
    - |
      helm upgrade --install threatmodel-prod \
        oci://${CONTAINER_REGISTRY}/${CI_PROJECT_PATH}/charts/threatmodel-app \
        --version ${CI_COMMIT_SHA} \
        --namespace threatmodel-prod \
        --create-namespace \
        --values helm/threatmodel-app/values-prod.yaml \
        --set global.image.tag=${CI_COMMIT_SHA} \
        --wait \
        --timeout 15m \
        --atomic
  when: manual
  only:
    - main
    - /^release\/.*$/

# Verify Stage
verify:smoke-tests:
  stage: verify
  image: postman/newman:alpine
  script:
    - |
      newman run tests/postman/smoke-tests.json \
        --environment tests/postman/${CI_ENVIRONMENT_NAME}-env.json \
        --reporters cli,junit \
        --reporter-junit-export results/newman-results.xml
  artifacts:
    when: always
    reports:
      junit: results/newman-results.xml
  dependencies: []

verify:e2e-tests:
  stage: verify
  image: cypress/included:12.17.0
  script:
    - npm ci
    - npx cypress run --config baseUrl=${CI_ENVIRONMENT_URL}
  artifacts:
    when: always
    paths:
      - cypress/screenshots
      - cypress/videos
    reports:
      junit: cypress/results/junit.xml
  only:
    variables:
      - $CI_ENVIRONMENT_NAME == "staging"
      - $CI_ENVIRONMENT_NAME == "production"
```

## Continuous Deployment Pipeline

### Deployment Strategies

```yaml
deployment_strategies:
  development:
    strategy: direct
    automatic: true
    rollback: manual
    
  staging:
    strategy: blue_green
    automatic: true
    validation_time: 30m
    rollback: automatic
    smoke_tests: required
    
  production:
    strategy: canary
    automatic: false
    canary_percentage: [10, 25, 50, 100]
    canary_duration: 15m
    metrics_evaluation: true
    rollback: automatic
    approval_required: true
```

### Canary Deployment Configuration

```yaml
# deployments/canary-deployment.yaml
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: auth-service
  namespace: threatmodel-prod
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: auth-service
  
  progressDeadlineSeconds: 600
  
  service:
    port: 8080
    targetPort: 8080
    gateways:
    - public-gateway.istio-system.svc.cluster.local
    hosts:
    - api.threatmodel.io
    
  analysis:
    interval: 1m
    threshold: 5
    maxWeight: 50
    stepWeight: 10
    
    metrics:
    - name: request-success-rate
      thresholdRange:
        min: 99
      interval: 1m
    
    - name: request-duration
      thresholdRange:
        max: 500
      interval: 30s
    
    - name: error-rate
      thresholdRange:
        max: 1
      interval: 1m
      
    webhooks:
    - name: load-test
      url: http://flagger-loadtester.test/
      timeout: 5s
      metadata:
        cmd: "hey -z 1m -q 10 -c 2 http://auth-service.threatmodel-prod:8080/"
    
    - name: acceptance-test
      url: http://flagger-loadtester.test/
      timeout: 30s
      metadata:
        type: bash
        cmd: "curl -s http://auth-service-canary.threatmodel-prod:8080/health | grep -q 'ok'"
```

### Blue-Green Deployment

```yaml
# deployments/blue-green-deployment.yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: auth-service
  namespace: threatmodel-staging
spec:
  replicas: 5
  strategy:
    blueGreen:
      activeService: auth-service-active
      previewService: auth-service-preview
      autoPromotionEnabled: false
      scaleDownDelaySeconds: 30
      prePromotionAnalysis:
        templates:
        - templateName: success-rate
        args:
        - name: service-name
          value: auth-service-preview
      postPromotionAnalysis:
        templates:
        - templateName: success-rate
        args:
        - name: service-name
          value: auth-service-active
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
    spec:
      containers:
      - name: auth-service
        image: ghcr.io/threatmodel/auth-service:latest
        ports:
        - containerPort: 8080
```

### Progressive Delivery with Flagger

```yaml
# flagger/flagger-values.yaml
flagger:
  metricsServer: http://prometheus:9090
  meshProvider: istio
  
  slack:
    user: flagger
    channel: deployments
    url: ${SLACK_WEBHOOK_URL}
    
  eventWebhook: http://event-collector:8080/

# Analysis Template
apiVersion: flagger.app/v1beta1
kind: MetricTemplate
metadata:
  name: error-rate
  namespace: istio-system
spec:
  provider:
    type: prometheus
    address: http://prometheus:9090
  query: |
    100 - (
      sum(
        rate(
          istio_request_duration_milliseconds_bucket{
            reporter="destination",
            destination_workload_namespace="{{ namespace }}",
            destination_workload="{{ target }}",
            response_code!~"5.."
          }[{{ interval }}]
        )
      ) / 
      sum(
        rate(
          istio_request_duration_milliseconds_bucket{
            reporter="destination",
            destination_workload_namespace="{{ namespace }}",
            destination_workload="{{ target }}"
          }[{{ interval }}]
        )
      ) * 100
    )
```

## Testing Strategies

### Test Pyramid

```yaml
test_pyramid:
  unit_tests:
    percentage: 70
    execution_time: < 5 minutes
    tools:
      - Jest
      - Mocha
      - pytest
      - go test
    coverage_threshold: 80%
    
  integration_tests:
    percentage: 20
    execution_time: < 15 minutes
    tools:
      - Supertest
      - TestContainers
      - WireMock
    coverage_threshold: 70%
    
  e2e_tests:
    percentage: 10
    execution_time: < 30 minutes
    tools:
      - Cypress
      - Playwright
      - Selenium
    coverage_threshold: 60%
```

### Test Automation Framework

```typescript
// tests/framework/test-runner.ts
import { TestSuite, TestCase, TestResult } from './types';
import { DatabaseHelper } from './helpers/database';
import { APIHelper } from './helpers/api';
import { MockServer } from './helpers/mock-server';

export class TestRunner {
  private dbHelper: DatabaseHelper;
  private apiHelper: APIHelper;
  private mockServer: MockServer;

  async setup(): Promise<void> {
    // Setup test database
    this.dbHelper = new DatabaseHelper({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    await this.dbHelper.migrate();
    await this.dbHelper.seed();

    // Setup API helper
    this.apiHelper = new APIHelper({
      baseURL: process.env.TEST_API_URL || 'http://localhost:8080',
    });

    // Setup mock server for external dependencies
    this.mockServer = new MockServer({
      port: 9999,
    });
    await this.mockServer.start();
  }

  async runSuite(suite: TestSuite): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const testCase of suite.tests) {
      const result = await this.runTest(testCase);
      results.push(result);

      if (result.status === 'failed' && suite.failFast) {
        break;
      }
    }

    return results;
  }

  private async runTest(test: TestCase): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      // Setup test data
      if (test.setup) {
        await test.setup(this.dbHelper, this.apiHelper);
      }

      // Run the test
      await test.execute(this.apiHelper);

      // Verify assertions
      if (test.assertions) {
        await test.assertions(this.dbHelper, this.apiHelper);
      }

      return {
        name: test.name,
        status: 'passed',
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        name: test.name,
        status: 'failed',
        duration: Date.now() - startTime,
        error: error.message,
        stack: error.stack,
      };
    } finally {
      // Cleanup
      if (test.cleanup) {
        await test.cleanup(this.dbHelper);
      }
    }
  }

  async teardown(): Promise<void> {
    await this.dbHelper.cleanup();
    await this.mockServer.stop();
  }
}

// Example test suite
export const authenticationSuite: TestSuite = {
  name: 'Authentication Tests',
  failFast: false,
  tests: [
    {
      name: 'Should login with valid credentials',
      async setup(db, api) {
        await db.createUser({
          email: 'test@example.com',
          password: 'hashedPassword',
        });
      },
      async execute(api) {
        const response = await api.post('/auth/login', {
          email: 'test@example.com',
          password: 'password123',
        });
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('access_token');
      },
      async cleanup(db) {
        await db.deleteUser('test@example.com');
      },
    },
    {
      name: 'Should reject invalid credentials',
      async execute(api) {
        const response = await api.post('/auth/login', {
          email: 'invalid@example.com',
          password: 'wrongpassword',
        });
        
        expect(response.status).toBe(401);
      },
    },
  ],
};
```

### Performance Testing

```yaml
# performance/k6-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    errors: ['rate<0.01'],            // Error rate under 1%
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://api.threatmodel.io';

export default function () {
  // Login
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: 'test@example.com',
    password: 'password123',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    'login successful': (r) => r.status === 200,
    'token returned': (r) => r.json('access_token') !== '',
  });

  errorRate.add(loginRes.status !== 200);

  if (loginRes.status === 200) {
    const token = loginRes.json('access_token');
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // Get projects
    const projectsRes = http.get(`${BASE_URL}/projects`, { headers });
    
    check(projectsRes, {
      'projects retrieved': (r) => r.status === 200,
    });

    // Create threat model
    const threatModelRes = http.post(`${BASE_URL}/threat-models`, JSON.stringify({
      name: 'Load Test Model',
      projectId: 'test-project',
      methodology: 'STRIDE',
    }), { headers });

    check(threatModelRes, {
      'threat model created': (r) => r.status === 201,
    });
  }

  sleep(1);
}
```

## Release Management

### Semantic Versioning

```yaml
versioning:
  format: semver
  pattern: MAJOR.MINOR.PATCH
  
  rules:
    MAJOR:
      - Breaking API changes
      - Major architectural changes
      - Incompatible database migrations
      
    MINOR:
      - New features
      - New API endpoints
      - Backward compatible changes
      
    PATCH:
      - Bug fixes
      - Security patches
      - Performance improvements
```

### Release Process

```yaml
# .github/workflows/release.yml
name: Release Process

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    
    - name: Generate Changelog
      id: changelog
      uses: conventional-changelog-action@v2
      with:
        preset: angular
        release-count: 1
    
    - name: Create Release
      uses: actions/create-release@v1
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        tag_name: ${{ github.ref }}
        release_name: Release ${{ github.ref }}
        body: ${{ steps.changelog.outputs.clean_changelog }}
        draft: false
        prerelease: false
    
    - name: Build Release Artifacts
      run: |
        make build-all
        make package-release
    
    - name: Upload Release Artifacts
      uses: actions/upload-release-asset@v1
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        upload_url: ${{ steps.create_release.outputs.upload_url }}
        asset_path: ./dist/release.tar.gz
        asset_name: threatmodel-${{ github.ref }}.tar.gz
        asset_content_type: application/gzip
    
    - name: Deploy to Production
      run: |
        ./scripts/deploy-production.sh ${{ github.ref }}
      env:
        DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
```

## Monitoring and Alerting

### Deployment Metrics

```yaml
deployment_metrics:
  success_indicators:
    - deployment_frequency: "> 1 per day"
    - lead_time: "< 1 hour"
    - mttr: "< 30 minutes"
    - change_failure_rate: "< 5%"
    
  alerts:
    - name: deployment_failed
      condition: deployment_status == "failed"
      severity: critical
      channels: [pagerduty, slack]
      
    - name: high_rollback_rate
      condition: rollback_rate > 0.1
      severity: warning
      channels: [slack]
      
    - name: slow_deployment
      condition: deployment_duration > 30m
      severity: warning
      channels: [slack]
```

### Pipeline Monitoring Dashboard

```json
{
  "dashboard": {
    "title": "CI/CD Pipeline Metrics",
    "panels": [
      {
        "title": "Build Success Rate",
        "query": "sum(rate(ci_build_success_total[1h])) / sum(rate(ci_build_total[1h]))",
        "type": "stat",
        "unit": "percent"
      },
      {
        "title": "Average Build Time",
        "query": "avg(ci_build_duration_seconds)",
        "type": "graph",
        "unit": "seconds"
      },
      {
        "title": "Deployment Frequency",
        "query": "sum(increase(deployments_total[1d])) by (environment)",
        "type": "bar"
      },
      {
        "title": "Lead Time for Changes",
        "query": "avg(ci_lead_time_seconds)",
        "type": "graph",
        "unit": "seconds"
      },
      {
        "title": "Test Coverage Trend",
        "query": "avg(test_coverage_percent) by (service)",
        "type": "graph",
        "unit": "percent"
      }
    ]
  }
}
```

## Security in CI/CD

### Security Gates

```yaml
security_gates:
  pre_commit:
    - secret_scanning:
        tools: [gitleaks, trufflehog]
        action: block
        
    - code_formatting:
        tools: [prettier, eslint]
        action: fix
        
  ci_pipeline:
    - dependency_scanning:
        tools: [snyk, npm-audit]
        severity: high
        action: fail
        
    - sast:
        tools: [semgrep, sonarqube]
        severity: high
        action: fail
        
    - container_scanning:
        tools: [trivy, grype]
        severity: critical
        action: fail
        
  pre_deployment:
    - dast:
        tools: [owasp-zap, burp-suite]
        environment: staging
        action: warn
        
    - compliance_check:
        policies: [cis-benchmarks, pci-dss]
        action: fail
```

### Secret Management

```yaml
# .github/workflows/secret-rotation.yml
name: Secret Rotation

on:
  schedule:
    - cron: '0 0 1 * *' # Monthly
  workflow_dispatch:

jobs:
  rotate-secrets:
    runs-on: ubuntu-latest
    
    steps:
    - name: Rotate Database Passwords
      run: |
        ./scripts/rotate-db-passwords.sh
      env:
        VAULT_TOKEN: ${{ secrets.VAULT_TOKEN }}
    
    - name: Rotate API Keys
      run: |
        ./scripts/rotate-api-keys.sh
      env:
        VAULT_TOKEN: ${{ secrets.VAULT_TOKEN }}
    
    - name: Update Kubernetes Secrets
      run: |
        ./scripts/update-k8s-secrets.sh
      env:
        KUBE_CONFIG: ${{ secrets.KUBE_CONFIG }}
    
    - name: Notify Team
      uses: 8398a7/action-slack@v3
      with:
        status: ${{ job.status }}
        text: 'Secret rotation completed'
        webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## Rollback Procedures

### Automated Rollback

```yaml
# rollback/rollback-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: rollback-config
  namespace: threatmodel-prod
data:
  rollback-policy.yaml: |
    triggers:
      - metric: error_rate
        threshold: 5%
        duration: 5m
        action: automatic_rollback
        
      - metric: response_time_p95
        threshold: 1000ms
        duration: 5m
        action: automatic_rollback
        
      - metric: pod_restarts
        threshold: 3
        duration: 10m
        action: automatic_rollback
        
    rollback_strategy:
      method: immediate
      preserve_data: true
      notify_channels:
        - slack: "#incidents"
        - pagerduty: "platform-team"
      
    post_rollback:
      - create_incident_report
      - disable_auto_deploy
      - notify_stakeholders
```

### Manual Rollback Script

```bash
#!/bin/bash
# scripts/rollback.sh

set -euo pipefail

ENVIRONMENT=${1:-staging}
SERVICE=${2:-all}
VERSION=${3:-previous}

echo "🔄 Starting rollback for $SERVICE in $ENVIRONMENT to version $VERSION"

# Get current deployment info
CURRENT_VERSION=$(kubectl get deployment -n threatmodel-$ENVIRONMENT -l app=$SERVICE -o jsonpath='{.items[0].spec.template.spec.containers[0].image}' | cut -d: -f2)
echo "Current version: $CURRENT_VERSION"

if [ "$VERSION" == "previous" ]; then
  # Get previous version from helm history
  VERSION=$(helm history threatmodel-$ENVIRONMENT -n threatmodel-$ENVIRONMENT | tail -2 | head -1 | awk '{print $1}')
fi

# Perform rollback
if [ "$SERVICE" == "all" ]; then
  helm rollback threatmodel-$ENVIRONMENT $VERSION -n threatmodel-$ENVIRONMENT --wait
else
  kubectl set image deployment/$SERVICE $SERVICE=ghcr.io/threatmodel/$SERVICE:$VERSION -n threatmodel-$ENVIRONMENT
  kubectl rollout status deployment/$SERVICE -n threatmodel-$ENVIRONMENT
fi

# Verify rollback
kubectl get pods -n threatmodel-$ENVIRONMENT -l app=$SERVICE
kubectl logs -n threatmodel-$ENVIRONMENT -l app=$SERVICE --tail=50

# Run smoke tests
./scripts/smoke-tests.sh $ENVIRONMENT

echo "✅ Rollback completed successfully"

# Create incident report
cat <<EOF > /tmp/rollback-report.json
{
  "environment": "$ENVIRONMENT",
  "service": "$SERVICE",
  "from_version": "$CURRENT_VERSION",
  "to_version": "$VERSION",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "reason": "Manual rollback initiated",
  "operator": "$USER"
}
EOF

# Send notification
curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d @/tmp/rollback-report.json
```

This comprehensive CI/CD pipeline design includes:

1. **Complete pipeline architecture** from commit to production
2. **Multiple CI/CD platforms** (GitHub Actions, GitLab CI)
3. **Security scanning** at every stage
4. **Automated testing** frameworks and strategies
5. **Progressive deployment** strategies (canary, blue-green)
6. **Monitoring and alerting** for pipeline health
7. **Rollback procedures** both automated and manual
8. **Release management** with semantic versioning

The pipeline ensures code quality, security, and reliability throughout the software delivery lifecycle.