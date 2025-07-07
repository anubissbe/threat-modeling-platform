import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests should be below 1000ms
    http_req_failed: ['rate<0.1'],     // Error rate should be below 10%
    errors: ['rate<0.1'],              // Custom error rate should be below 10%
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3001';

// Test data
const users = [
  { email: 'loadtest1@example.com', password: 'LoadTest123!' },
  { email: 'loadtest2@example.com', password: 'LoadTest123!' },
  { email: 'loadtest3@example.com', password: 'LoadTest123!' },
  { email: 'loadtest4@example.com', password: 'LoadTest123!' },
  { email: 'loadtest5@example.com', password: 'LoadTest123!' },
];

export function setup() {
  // Setup: Create test users
  console.log('Setting up test users...');
  
  for (const user of users) {
    const registerPayload = {
      email: user.email,
      password: user.password,
      firstName: 'Load',
      lastName: 'Test',
      organization: 'Load Test Org',
    };
    
    const registerResponse = http.post(
      `${BASE_URL}/api/auth/register`,
      JSON.stringify(registerPayload),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    
    if (registerResponse.status === 201 || registerResponse.status === 409) {
      console.log(`User ${user.email} ready for testing`);
    } else {
      console.log(`Failed to create user ${user.email}: ${registerResponse.status}`);
    }
  }
  
  return users;
}

export default function (data) {
  // Select random user
  const user = data[Math.floor(Math.random() * data.length)];
  
  // Test 1: Health Check
  const healthResponse = http.get(`${BASE_URL}/health`);
  check(healthResponse, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 100ms': (r) => r.timings.duration < 100,
  }) || errorRate.add(1);
  
  // Test 2: Login
  const loginPayload = {
    email: user.email,
    password: user.password,
  };
  
  const loginResponse = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify(loginPayload),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  const loginSuccess = check(loginResponse, {
    'login status is 200': (r) => r.status === 200,
    'login response time < 500ms': (r) => r.timings.duration < 500,
    'login returns tokens': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.tokens && body.tokens.accessToken;
      } catch (e) {
        return false;
      }
    },
  });
  
  if (!loginSuccess) {
    errorRate.add(1);
    return;
  }
  
  const tokens = JSON.parse(loginResponse.body).tokens;
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${tokens.accessToken}`,
  };
  
  // Test 3: Get Profile (Protected Route)
  const profileResponse = http.get(`${BASE_URL}/api/auth/profile`, {
    headers: authHeaders,
  });
  
  check(profileResponse, {
    'profile status is 200': (r) => r.status === 200,
    'profile response time < 300ms': (r) => r.timings.duration < 300,
    'profile returns user data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.email === user.email;
      } catch (e) {
        return false;
      }
    },
  }) || errorRate.add(1);
  
  // Test 4: Token Refresh
  const refreshPayload = {
    refreshToken: tokens.refreshToken,
  };
  
  const refreshResponse = http.post(
    `${BASE_URL}/api/auth/refresh`,
    JSON.stringify(refreshPayload),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  check(refreshResponse, {
    'refresh status is 200': (r) => r.status === 200,
    'refresh response time < 400ms': (r) => r.timings.duration < 400,
    'refresh returns new tokens': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.tokens && body.tokens.accessToken !== tokens.accessToken;
      } catch (e) {
        return false;
      }
    },
  }) || errorRate.add(1);
  
  // Test 5: Logout
  const logoutResponse = http.post(
    `${BASE_URL}/api/auth/logout`,
    null,
    {
      headers: authHeaders,
    }
  );
  
  check(logoutResponse, {
    'logout status is 200': (r) => r.status === 200,
    'logout response time < 200ms': (r) => r.timings.duration < 200,
  }) || errorRate.add(1);
  
  // Test 6: Verify logout (should fail)
  const verifyLogoutResponse = http.get(`${BASE_URL}/api/auth/profile`, {
    headers: authHeaders,
  });
  
  check(verifyLogoutResponse, {
    'profile after logout is 401': (r) => r.status === 401,
  }) || errorRate.add(1);
  
  // Simulate user think time
  sleep(Math.random() * 2 + 1);
}

export function teardown(data) {
  console.log('Cleaning up test data...');
  // Note: In a real scenario, you might want to clean up test users
  // For now, we'll leave them as they can be reused
}

export function handleSummary(data) {
  return {
    'performance-results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options = {}) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;
  
  let summary = `${indent}Performance Test Results:\n`;
  summary += `${indent}========================\n\n`;
  
  // Test duration
  summary += `${indent}Test Duration: ${data.state.testRunDurationMs}ms\n\n`;
  
  // HTTP requests
  const httpReqs = data.metrics.http_reqs;
  if (httpReqs) {
    summary += `${indent}HTTP Requests:\n`;
    summary += `${indent}  Total: ${httpReqs.count}\n`;
    summary += `${indent}  Rate: ${httpReqs.rate.toFixed(2)}/s\n\n`;
  }
  
  // Response times
  const httpDuration = data.metrics.http_req_duration;
  if (httpDuration) {
    summary += `${indent}Response Times:\n`;
    summary += `${indent}  Average: ${httpDuration.avg.toFixed(2)}ms\n`;
    summary += `${indent}  Median: ${httpDuration.med.toFixed(2)}ms\n`;
    summary += `${indent}  95th percentile: ${httpDuration['p(95)'].toFixed(2)}ms\n`;
    summary += `${indent}  Max: ${httpDuration.max.toFixed(2)}ms\n\n`;
  }
  
  // Error rates
  const httpFailed = data.metrics.http_req_failed;
  if (httpFailed) {
    summary += `${indent}Error Rate: ${(httpFailed.rate * 100).toFixed(2)}%\n\n`;
  }
  
  // Thresholds
  summary += `${indent}Thresholds:\n`;
  for (const [name, threshold] of Object.entries(data.thresholds)) {
    const status = threshold.ok ? '✓' : '✗';
    summary += `${indent}  ${status} ${name}\n`;
  }
  
  return summary;
}