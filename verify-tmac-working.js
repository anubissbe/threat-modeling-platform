// Final verification that TMAC is working
const axios = require('axios');
const FormData = require('form-data');

console.log('🧪 Final TMAC Verification Test\n');

async function testTMAC() {
  const baseURL = 'http://localhost:3010';
  
  // Sample TMAC content
  const tmacContent = `version: "1.0.0"
metadata:
  name: "Test Model"
  description: "A test threat model"
  author: "TMAC Tester"
system:
  name: "Test System"
  components:
    - id: "web"
      name: "Web Application"
      type: "web_application"
    - id: "db"
      name: "Database"
      type: "database"
dataFlows:
  - id: "df1"
    name: "User Login"
    source: "web"
    destination: "db"
    protocol: "HTTPS"
threats:
  - id: "T1"
    name: "SQL Injection"
    description: "Attacker could inject SQL commands"
    components: ["db"]
    category: "tampering"
    severity: "high"
mitigations:
  - id: "M1"
    name: "Input Validation"
    description: "Validate all user inputs"
    threats: ["T1"]
`;

  try {
    // Test 1: Health Check
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${baseURL}/health`);
    console.log('✅ Health check:', healthResponse.data.status);

    // Test 2: Parse
    console.log('\n2. Testing parse endpoint...');
    const parseForm = new FormData();
    parseForm.append('file', Buffer.from(tmacContent), 'test.yaml');
    
    const parseResponse = await axios.post(`${baseURL}/api/tmac/parse`, parseForm, {
      headers: parseForm.getHeaders()
    });
    console.log('✅ Parse successful:', parseResponse.data.success);
    console.log('   Components:', parseResponse.data.model.system.components.length);
    console.log('   Threats:', parseResponse.data.model.threats.length);

    // Test 3: Validate
    console.log('\n3. Testing validate endpoint...');
    const validateForm = new FormData();
    validateForm.append('file', Buffer.from(tmacContent), 'test.yaml');
    
    const validateResponse = await axios.post(`${baseURL}/api/tmac/validate`, validateForm, {
      headers: validateForm.getHeaders()
    });
    console.log('✅ Validation result:', validateResponse.data.validation.valid);
    console.log('   Errors:', validateResponse.data.validation.errors.length);
    console.log('   Warnings:', validateResponse.data.validation.warnings.length);

    // Test 4: Analyze
    console.log('\n4. Testing analyze endpoint...');
    const analyzeForm = new FormData();
    analyzeForm.append('file', Buffer.from(tmacContent), 'test.yaml');
    
    const analyzeResponse = await axios.post(`${baseURL}/api/tmac/analyze`, analyzeForm, {
      headers: analyzeForm.getHeaders()
    });
    console.log('✅ Analysis complete:', analyzeResponse.data.success);
    console.log('   Risk Score:', analyzeResponse.data.analysis.summary.riskScore);
    console.log('   Coverage:', analyzeResponse.data.analysis.summary.coveragePercentage + '%');
    console.log('   Recommendations:', analyzeResponse.data.analysis.recommendations.length);

    // Test 5: Convert
    console.log('\n5. Testing convert endpoint...');
    const convertForm = new FormData();
    convertForm.append('file', Buffer.from(tmacContent), 'test.yaml');
    convertForm.append('format', 'json');
    
    const convertResponse = await axios.post(`${baseURL}/api/tmac/convert`, convertForm, {
      headers: convertForm.getHeaders()
    });
    console.log('✅ Convert successful:', convertResponse.data.success);
    console.log('   Output format:', convertResponse.data.format);

    console.log('\n🎉 All TMAC API endpoints are working correctly!');
    console.log('\n📊 Summary:');
    console.log('- ✅ TMAC service is running and healthy');
    console.log('- ✅ Parse endpoint working');
    console.log('- ✅ Validate endpoint working');
    console.log('- ✅ Analyze endpoint working');
    console.log('- ✅ Convert endpoint working');
    console.log('\n🚀 TMAC implementation is fully functional!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Start TMAC service first
const { spawn } = require('child_process');

console.log('Starting TMAC service...');
const tmacProcess = spawn('docker', ['run', '-d', '--name', 'tmac-verify', '-p', '3010:3010', 'tmac-service:latest'], {
  stdio: 'inherit'
});

tmacProcess.on('close', (code) => {
  if (code === 0) {
    // Wait a moment for service to start, then test
    setTimeout(async () => {
      await testTMAC();
      
      // Cleanup
      console.log('\n🧹 Cleaning up...');
      spawn('docker', ['stop', 'tmac-verify'], { stdio: 'inherit' });
      spawn('docker', ['rm', 'tmac-verify'], { stdio: 'inherit' });
    }, 3000);
  } else {
    console.error('Failed to start TMAC service');
  }
});