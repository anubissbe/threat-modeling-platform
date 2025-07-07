# Testing Documentation

## Overview

This document describes the comprehensive testing strategy for the Threat Modeling Platform. Our testing approach follows the testing pyramid with multiple layers of tests to ensure reliability, security, and performance.

## Testing Strategy

### 1. Testing Pyramid

```
                    E2E Tests
                 ┌─────────────┐
                 │   Browser   │
                 │    Tests    │
                 └─────────────┘
               Integration Tests
            ┌───────────────────┐
            │   API + Database  │
            │      Tests        │
            └───────────────────┘
                Unit Tests
        ┌─────────────────────────┐
        │    Components, Utils    │
        │     Services, Models    │
        └─────────────────────────┘
```

### 2. Test Types

#### Unit Tests (Base Layer)
- **Frontend**: React components, hooks, utilities, Redux slices
- **Backend**: Services, utilities, middleware, models
- **Coverage Target**: 90%+
- **Tools**: Vitest (Frontend), Jest (Backend)

#### Integration Tests (Middle Layer)
- **API Integration**: Full auth flow with database
- **Service Integration**: Multiple services working together
- **Database Integration**: Real database operations
- **Tools**: Jest with Supertest, PostgreSQL Test Database

#### End-to-End Tests (Top Layer)
- **User Workflows**: Complete user journeys
- **Browser Testing**: Cross-browser compatibility
- **Accessibility**: WCAG compliance testing
- **Tools**: Playwright

#### Security Tests
- **Input Validation**: XSS, SQL injection, NoSQL injection
- **Authentication**: Token security, session management
- **Authorization**: Role-based access control
- **Rate Limiting**: DDoS protection
- **Tools**: Custom security test suite

#### Performance Tests
- **Load Testing**: Concurrent user simulation
- **Stress Testing**: Breaking point identification
- **API Performance**: Response time benchmarks
- **Tools**: k6

## Test Organization

### Directory Structure

```
threat-modeling-platform/
├── backend/services/auth/
│   ├── tests/
│   │   ├── setup.ts                    # Test configuration
│   │   ├── integration/                # API integration tests
│   │   │   └── auth.integration.test.ts
│   │   ├── security/                   # Security-specific tests
│   │   │   └── security.test.ts
│   │   └── utils/                      # Unit tests for utilities
│   │       ├── jwt.test.ts
│   │       └── password.test.ts
│   └── jest.config.js                  # Jest configuration
├── frontend/
│   ├── src/
│   │   ├── components/__tests__/       # Component unit tests
│   │   │   ├── Login.test.tsx
│   │   │   └── ThreatModelEditor.test.tsx
│   │   ├── store/slices/__tests__/     # Redux slice tests
│   │   │   └── authSlice.test.ts
│   │   └── test/
│   │       ├── setup.ts                # Test setup
│   │       └── e2e/                    # E2E tests
│   │           └── auth.e2e.test.ts
│   ├── playwright.config.ts            # Playwright configuration
│   └── vite.config.ts                  # Vitest configuration
├── tests/
│   └── performance/                    # Performance tests
│       └── auth-load-test.js
└── .github/workflows/
    └── test-suite.yml                  # CI/CD pipeline
```

## Running Tests

### Prerequisites

1. **Environment Setup**:
   ```bash
   # Install dependencies
   npm ci
   
   # Start test databases
   docker-compose up -d postgres redis
   ```

2. **Environment Variables**:
   ```bash
   export NODE_ENV=test
   export DB_HOST=localhost
   export DB_NAME=threatmodel_db_test
   export DB_USER=threatmodel
   export DB_PASSWORD=threatmodel123
   export REDIS_HOST=localhost
   export JWT_SECRET=test-jwt-secret
   export MASTER_ENCRYPTION_KEY=test-32char-encryption-key-12345678901234567890
   ```

### Backend Tests

```bash
# Navigate to auth service
cd backend/services/auth

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run only security tests
npm run test:security

# Watch mode for development
npm run test:watch
```

### Frontend Tests

```bash
# Navigate to frontend
cd frontend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:headed

# Interactive test UI
npm run test:ui
```

### Performance Tests

```bash
# Install k6 (if not already installed)
# See: https://k6.io/docs/getting-started/installation/

# Start the auth service
cd backend/services/auth
npm run build && npm start

# Run performance tests
cd ../../../
k6 run tests/performance/auth-load-test.js
```

## Test Configuration

### Jest Configuration (Backend)

```javascript
// backend/services/auth/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
};
```

### Vitest Configuration (Frontend)

```typescript
// frontend/vite.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
      ],
    },
  },
});
```

### Playwright Configuration (E2E)

```typescript
// frontend/playwright.config.ts
export default defineConfig({
  testDir: './src/test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  
  use: {
    baseURL: 'http://localhost:3006',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

## Continuous Integration

### GitHub Actions Pipeline

Our CI/CD pipeline runs comprehensive tests on every push and pull request:

1. **Lint & Type Check**: Code quality validation
2. **Unit Tests**: Component and service testing
3. **Integration Tests**: API and database testing
4. **E2E Tests**: Full user journey testing
5. **Security Tests**: Vulnerability scanning
6. **Performance Tests**: Load testing

### Coverage Requirements

- **Unit Tests**: Minimum 90% coverage
- **Integration Tests**: All critical API endpoints
- **E2E Tests**: All primary user workflows
- **Security Tests**: All input validation scenarios

### Quality Gates

Tests must pass the following thresholds:

- **Code Coverage**: ≥90%
- **Performance**: 95th percentile response time <1000ms
- **Security**: No critical or high vulnerabilities
- **Accessibility**: WCAG 2.1 AA compliance

## Test Data Management

### Test Databases

- **Unit Tests**: Mocked dependencies
- **Integration Tests**: Dedicated test database with cleanup
- **E2E Tests**: Isolated test environment

### Data Seeding

```typescript
// Example test data setup
beforeEach(async () => {
  // Clean database
  await db.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  await redis.flushall();
  
  // Seed test data
  await createTestUser({
    email: 'test@example.com',
    password: 'SecurePass123!',
    role: 'user'
  });
});
```

### Cleanup Strategy

- **After Each Test**: Clean test-specific data
- **After Test Suite**: Reset database state
- **CI Environment**: Fresh database per run

## Best Practices

### Test Writing Guidelines

1. **Descriptive Names**: Test names should clearly describe what is being tested
2. **Arrange-Act-Assert**: Follow the AAA pattern for test structure
3. **Single Responsibility**: Each test should verify one specific behavior
4. **Test Independence**: Tests should not depend on each other
5. **Data Isolation**: Use fresh test data for each test

### Example Test Structure

```typescript
describe('Authentication Service', () => {
  describe('login functionality', () => {
    it('should return tokens for valid credentials', async () => {
      // Arrange
      const userData = { email: 'test@example.com', password: 'SecurePass123!' };
      await createTestUser(userData);
      
      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(userData);
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body.tokens).toBeDefined();
      expect(response.body.tokens.accessToken).toBeTruthy();
    });
  });
});
```

### Mocking Guidelines

1. **External Services**: Always mock external API calls
2. **Database**: Use real database for integration tests, mock for unit tests
3. **Time-dependent Code**: Mock Date.now() and setTimeout
4. **File System**: Mock file operations in unit tests

### Security Testing Best Practices

1. **Input Validation**: Test all input fields with malicious payloads
2. **Authentication**: Verify token security and session management
3. **Authorization**: Test access controls for different user roles
4. **Data Leakage**: Ensure sensitive data is not exposed in responses

## Debugging Tests

### Common Issues

1. **Flaky Tests**: Use proper waiting mechanisms, avoid arbitrary timeouts
2. **Memory Leaks**: Ensure proper cleanup in afterEach/afterAll hooks
3. **Port Conflicts**: Use dynamic ports or proper cleanup
4. **Database State**: Ensure proper isolation between tests

### Debugging Commands

```bash
# Run specific test file
npm test auth.test.ts

# Run tests in debug mode
npm test -- --detectOpenHandles --forceExit

# Run with verbose output
npm test -- --verbose

# Run single test
npm test -- --testNamePattern="should login with valid credentials"
```

## Metrics and Reporting

### Coverage Reports

- **Text**: Console output during test runs
- **HTML**: Detailed coverage reports in `coverage/` directory
- **LCOV**: Machine-readable format for CI integration

### Performance Metrics

- **Response Times**: Average, median, 95th percentile
- **Throughput**: Requests per second
- **Error Rates**: Failed request percentage
- **Resource Usage**: CPU, memory consumption

### Test Results

- **JUnit XML**: For CI integration
- **HTML Reports**: Human-readable test results
- **GitHub Actions**: Automated test status checks

## Maintenance

### Regular Tasks

1. **Update Test Data**: Keep test scenarios current with application changes
2. **Review Coverage**: Identify gaps in test coverage
3. **Performance Baselines**: Update performance thresholds as needed
4. **Security Updates**: Keep security test scenarios current with threats

### Test Hygiene

1. **Remove Obsolete Tests**: Clean up tests for removed features
2. **Refactor Duplicated Code**: Extract common test utilities
3. **Update Dependencies**: Keep testing libraries current
4. **Documentation**: Keep this document updated with changes

## Resources

- [Jest Documentation](https://jestjs.io/docs/)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [k6 Documentation](https://k6.io/docs/)
- [Testing Best Practices](https://kentcdodds.com/blog/write-tests)
- [Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)

## Getting Help

- **Test Failures**: Check CI logs and local reproduction steps
- **Performance Issues**: Review k6 reports and metrics
- **Security Concerns**: Consult security testing guidelines
- **Coverage Questions**: Review coverage reports and identify gaps