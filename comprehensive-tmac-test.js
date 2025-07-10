// Comprehensive TMAC testing suite
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

console.log('🧪 Comprehensive TMAC Testing Suite\n');

const baseURL = 'http://localhost:3010';
let testResults = [];

function addResult(test, status, details) {
  testResults.push({ test, status, details });
  console.log(`${status === 'PASS' ? '✅' : '❌'} ${test}: ${details}`);
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('1. BASIC FUNCTIONALITY TESTS');
  console.log('='.repeat(60));

  // Test 1: Health check
  try {
    const response = await axios.get(`${baseURL}/health`);
    addResult('Health Check', 'PASS', `Service is ${response.data.status}`);
  } catch (error) {
    addResult('Health Check', 'FAIL', error.message);
  }

  // Test 2: Valid TMAC parsing
  const validTMAC = `version: "1.0.0"
metadata:
  name: "E-commerce Security Model"
  description: "Comprehensive threat model for e-commerce platform"
  author: "Security Team"
  version: "2.1.0"
  tags:
    - ecommerce
    - web-application
  compliance:
    - PCI-DSS
    - GDPR
system:
  name: "E-commerce Platform"
  type: "web-application"
  components:
    - id: "web-frontend"
      name: "Web Frontend"
      type: "web_application"
      technologies: ["React", "TypeScript"]
      trustLevel: "medium"
    - id: "api-gateway"
      name: "API Gateway"
      type: "api_gateway"
      technologies: ["Node.js", "Express"]
      trustLevel: "high"
    - id: "payment-service"
      name: "Payment Service"
      type: "microservice"
      technologies: ["Java", "Spring Boot"]
      trustLevel: "critical"
    - id: "user-database"
      name: "User Database"
      type: "database"
      technologies: ["PostgreSQL"]
      trustLevel: "high"
dataFlows:
  - id: "df-001"
    name: "User Authentication"
    source: "web-frontend"
    destination: "api-gateway"
    protocol: "HTTPS"
    authentication: "OAuth2"
    data: ["credentials", "session-tokens"]
  - id: "df-002"
    name: "Payment Processing"
    source: "api-gateway"
    destination: "payment-service"
    protocol: "HTTPS"
    authentication: "JWT"
    data: ["payment-info", "transaction-data"]
threats:
  - id: "T-001"
    name: "SQL Injection Attack"
    description: "Attacker injects malicious SQL code through user inputs"
    components: ["user-database"]
    category: "tampering"
    severity: "high"
    stride: ["T"]
    cvssScore: 8.5
    likelihood: "medium"
    impact: "high"
    mitigations: ["M-001", "M-002"]
  - id: "T-002"
    name: "Cross-Site Scripting (XSS)"
    description: "Malicious scripts executed in user browsers"
    components: ["web-frontend"]
    category: "tampering"
    severity: "medium"
    stride: ["T", "I"]
    cvssScore: 6.1
    likelihood: "high"
    impact: "medium"
    mitigations: ["M-003"]
  - id: "T-003"
    name: "Payment Data Interception"
    description: "Sensitive payment data intercepted during transmission"
    components: ["payment-service", "api-gateway"]
    category: "information_disclosure"
    severity: "critical"
    stride: ["I", "D"]
    cvssScore: 9.2
    likelihood: "low"
    impact: "critical"
    mitigations: ["M-004", "M-005"]
mitigations:
  - id: "M-001"
    name: "Parameterized Queries"
    description: "Use prepared statements and parameterized queries"
    type: "preventive"
    implemented: true
    threats: ["T-001"]
  - id: "M-002"
    name: "Input Validation"
    description: "Comprehensive server-side input validation"
    type: "preventive"
    implemented: true
    threats: ["T-001"]
  - id: "M-003"
    name: "Content Security Policy"
    description: "Implement CSP headers to prevent XSS"
    type: "preventive"
    implemented: false
    threats: ["T-002"]
  - id: "M-004"
    name: "End-to-End Encryption"
    description: "Encrypt payment data end-to-end"
    type: "preventive"
    implemented: true
    threats: ["T-003"]
  - id: "M-005"
    name: "TLS 1.3 Implementation"
    description: "Use latest TLS version for all communications"
    type: "preventive"
    implemented: true
    threats: ["T-003"]
assumptions:
  - "Network infrastructure is properly configured and secured"
  - "Third-party payment processors comply with PCI-DSS"
  - "Regular security audits are conducted"
outOfScope:
  - "Physical security of data centers"
  - "Employee background checks"
  - "Third-party vendor security assessments"`;

  try {
    const form = new FormData();
    form.append('file', Buffer.from(validTMAC), 'ecommerce.tmac.yaml');
    
    const response = await axios.post(`${baseURL}/api/tmac/parse`, form, {
      headers: form.getHeaders()
    });
    
    if (response.data.success && response.data.model.threats.length === 3) {
      addResult('Parse Valid TMAC', 'PASS', `Parsed ${response.data.model.threats.length} threats, ${response.data.model.system.components.length} components`);
    } else {
      addResult('Parse Valid TMAC', 'FAIL', 'Incorrect parsing result');
    }
  } catch (error) {
    addResult('Parse Valid TMAC', 'FAIL', error.message);
  }

  // Test 3: Invalid TMAC handling
  const invalidTMAC = `invalid: yaml
missing: required fields`;

  try {
    const form = new FormData();
    form.append('file', Buffer.from(invalidTMAC), 'invalid.yaml');
    
    const response = await axios.post(`${baseURL}/api/tmac/parse`, form, {
      headers: form.getHeaders()
    });
    
    addResult('Parse Invalid TMAC', 'FAIL', 'Should have failed but succeeded');
  } catch (error) {
    if (error.response && error.response.status === 400) {
      addResult('Parse Invalid TMAC', 'PASS', 'Correctly rejected invalid TMAC');
    } else {
      addResult('Parse Invalid TMAC', 'FAIL', 'Unexpected error: ' + error.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('2. VALIDATION TESTS');
  console.log('='.repeat(60));

  // Test 4: Validation
  try {
    const form = new FormData();
    form.append('file', Buffer.from(validTMAC), 'ecommerce.tmac.yaml');
    
    const response = await axios.post(`${baseURL}/api/tmac/validate`, form, {
      headers: form.getHeaders()
    });
    
    if (response.data.success && response.data.validation.valid) {
      addResult('Validate Good TMAC', 'PASS', `Validation passed with ${response.data.validation.warnings.length} warnings`);
    } else {
      addResult('Validate Good TMAC', 'FAIL', `Validation failed: ${response.data.validation.errors.join(', ')}`);
    }
  } catch (error) {
    addResult('Validate Good TMAC', 'FAIL', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('3. ANALYSIS TESTS');
  console.log('='.repeat(60));

  // Test 5: Analysis
  try {
    const form = new FormData();
    form.append('file', Buffer.from(validTMAC), 'ecommerce.tmac.yaml');
    
    const response = await axios.post(`${baseURL}/api/tmac/analyze`, form, {
      headers: form.getHeaders()
    });
    
    if (response.data.success && response.data.analysis.summary.totalThreats === 3) {
      const summary = response.data.analysis.summary;
      addResult('Analyze TMAC', 'PASS', 
        `Risk score: ${summary.riskScore}, Coverage: ${summary.coveragePercentage}%, Critical: ${summary.criticalThreats}`);
    } else {
      addResult('Analyze TMAC', 'FAIL', 'Analysis failed or incorrect results');
    }
  } catch (error) {
    addResult('Analyze TMAC', 'FAIL', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('4. FORMAT CONVERSION TESTS');
  console.log('='.repeat(60));

  // Test 6: YAML to JSON conversion
  try {
    const form = new FormData();
    form.append('file', Buffer.from(validTMAC), 'ecommerce.tmac.yaml');
    form.append('format', 'json');
    
    const response = await axios.post(`${baseURL}/api/tmac/convert`, form, {
      headers: form.getHeaders()
    });
    
    if (response.data.success && response.data.format === 'json') {
      const parsed = JSON.parse(response.data.content);
      if (parsed.threats && parsed.threats.length === 3) {
        addResult('YAML to JSON Conversion', 'PASS', 'Successfully converted and preserved data');
      } else {
        addResult('YAML to JSON Conversion', 'FAIL', 'Data loss during conversion');
      }
    } else {
      addResult('YAML to JSON Conversion', 'FAIL', 'Conversion failed');
    }
  } catch (error) {
    addResult('YAML to JSON Conversion', 'FAIL', error.message);
  }

  // Test 7: JSON to YAML conversion
  const jsonTMAC = JSON.stringify({
    version: "1.0.0",
    metadata: { name: "JSON Test Model" },
    system: { 
      name: "Test System",
      components: [{ id: "comp1", name: "Component 1", type: "service" }]
    },
    dataFlows: [],
    threats: []
  });

  try {
    const form = new FormData();
    form.append('file', Buffer.from(jsonTMAC), 'test.json');
    form.append('format', 'yaml');
    
    const response = await axios.post(`${baseURL}/api/tmac/convert`, form, {
      headers: form.getHeaders()
    });
    
    if (response.data.success && response.data.format === 'yaml') {
      addResult('JSON to YAML Conversion', 'PASS', 'Successfully converted JSON to YAML');
    } else {
      addResult('JSON to YAML Conversion', 'FAIL', 'Conversion failed');
    }
  } catch (error) {
    addResult('JSON to YAML Conversion', 'FAIL', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('5. MERGE FUNCTIONALITY TESTS');
  console.log('='.repeat(60));

  // Test 8: Merge multiple models
  const model1 = `version: "1.0.0"
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
    components: ["comp1"]
    category: "spoofing"
    severity: "medium"`;

  const model2 = `version: "1.0.0"
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
    components: ["comp2"]
    category: "tampering"
    severity: "high"`;

  try {
    const form = new FormData();
    form.append('files', Buffer.from(model1), 'model1.yaml');
    form.append('files', Buffer.from(model2), 'model2.yaml');
    
    const response = await axios.post(`${baseURL}/api/tmac/merge`, form, {
      headers: form.getHeaders()
    });
    
    if (response.data.success) {
      addResult('Merge Models', 'PASS', `Merged ${response.data.summary?.filesМerged || 'multiple'} files successfully`);
    } else {
      addResult('Merge Models', 'FAIL', 'Merge operation failed');
    }
  } catch (error) {
    addResult('Merge Models', 'FAIL', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('6. FILE I/O TESTS');
  console.log('='.repeat(60));

  // Test 9: Large file handling
  const largeTMAC = validTMAC + '\n' + `threats:
  - id: "T-004"
    name: "Large Model Test Threat"
    description: "${'Very long description. '.repeat(100)}"
    components: ["web-frontend"]
    category: "denial_of_service"
    severity: "low"`.repeat(50);

  try {
    const form = new FormData();
    form.append('file', Buffer.from(largeTMAC), 'large.tmac.yaml');
    
    const response = await axios.post(`${baseURL}/api/tmac/parse`, form, {
      headers: form.getHeaders()
    });
    
    if (response.data.success) {
      addResult('Large File Handling', 'PASS', `Handled ${Buffer.from(largeTMAC).length} byte file`);
    } else {
      addResult('Large File Handling', 'FAIL', 'Failed to handle large file');
    }
  } catch (error) {
    addResult('Large File Handling', 'FAIL', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('7. ERROR HANDLING TESTS');
  console.log('='.repeat(60));

  // Test 10: Missing file
  try {
    const response = await axios.post(`${baseURL}/api/tmac/parse`, {}, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    addResult('Missing File Error', 'FAIL', 'Should have returned error');
  } catch (error) {
    if (error.response && error.response.status === 400) {
      addResult('Missing File Error', 'PASS', 'Correctly handled missing file');
    } else {
      addResult('Missing File Error', 'FAIL', 'Unexpected error');
    }
  }

  // Test 11: Unsupported format
  try {
    const form = new FormData();
    form.append('file', Buffer.from('random content'), 'test.txt');
    
    const response = await axios.post(`${baseURL}/api/tmac/parse`, form, {
      headers: form.getHeaders()
    });
    addResult('Unsupported Format', 'FAIL', 'Should have rejected unsupported format');
  } catch (error) {
    if (error.response && error.response.status === 400) {
      addResult('Unsupported Format', 'PASS', 'Correctly rejected unsupported format');
    } else {
      addResult('Unsupported Format', 'FAIL', 'Unexpected error');
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('TEST RESULTS SUMMARY');
  console.log('='.repeat(60));

  const passed = testResults.filter(r => r.status === 'PASS').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;
  const total = testResults.length;

  console.log(`\n📊 Overall Results:`);
  console.log(`✅ Passed: ${passed}/${total} (${Math.round(passed/total*100)}%)`);
  console.log(`❌ Failed: ${failed}/${total} (${Math.round(failed/total*100)}%)`);

  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! TMAC is fully functional!');
  } else {
    console.log('\n⚠️  Some tests failed. Review the failures above.');
    console.log('\nFailed tests:');
    testResults.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌ ${r.test}: ${r.details}`);
    });
  }

  return { passed, failed, total, testResults };
}

// Run the tests
runTests().catch(console.error);