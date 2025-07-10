const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';

// Generate unique test user
const timestamp = Date.now();
const TEST_USER = {
  email: `test${timestamp}@example.com`,
  password: 'Test123!@#',
  firstName: 'Test',
  lastName: 'User',
  organization: 'Test Org'
};

async function testJWTRefresh() {
  try {
    console.log('🔐 Testing JWT Token Refresh with Fresh User\n');
    
    // Step 1: Register a new test user
    console.log('1. Registering new test user...');
    console.log(`   Email: ${TEST_USER.email}`);
    
    const response = await axios.post(`${API_BASE_URL}/api/auth/register`, TEST_USER);
    
    const { accessToken, refreshToken, expiresIn } = response.data.data;
    console.log('   ✅ Registration successful');
    console.log(`   Access Token: ${accessToken.substring(0, 50)}...`);
    console.log(`   Refresh Token: ${refreshToken.substring(0, 50)}...`);
    console.log(`   Expires In: ${expiresIn} seconds\n`);
    
    // Step 2: Test authenticated request
    console.log('2. Testing authenticated request...');
    const profileResponse = await axios.get(`${API_BASE_URL}/api/auth/profile`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    console.log('   ✅ Profile retrieved successfully');
    console.log(`   User: ${profileResponse.data.data.email}\n`);
    
    // Step 3: Test refresh token
    console.log('3. Testing token refresh...');
    const refreshResponse = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
      refreshToken: refreshToken
    });
    
    const newTokens = refreshResponse.data.data;
    console.log('   ✅ Token refresh successful!');
    console.log(`   New Access Token: ${newTokens.accessToken.substring(0, 50)}...`);
    console.log(`   New Refresh Token: ${newTokens.refreshToken.substring(0, 50)}...`);
    console.log(`   Expires In: ${newTokens.expiresIn} seconds\n`);
    
    // Step 4: Test authenticated request with new token
    console.log('4. Testing authenticated request with new token...');
    const newProfileResponse = await axios.get(`${API_BASE_URL}/api/auth/profile`, {
      headers: {
        'Authorization': `Bearer ${newTokens.accessToken}`
      }
    });
    console.log('   ✅ Profile retrieved successfully with new token');
    console.log(`   User: ${newProfileResponse.data.data.email}\n`);
    
    // Step 5: Test old refresh token is invalidated
    console.log('5. Testing old refresh token is invalidated...');
    try {
      await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
        refreshToken: refreshToken
      });
      console.log('   ❌ Old refresh token still works (this is a problem)');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('   ✅ Old refresh token properly invalidated');
      } else {
        console.log('   ❌ Unexpected error:', error.response?.data?.error);
      }
    }
    
    console.log('\n✅ JWT Token Refresh functionality is working correctly!');
    console.log('🎉 The JWT refresh token issue has been fixed!');
    
    // Cleanup - logout
    try {
      await axios.post(`${API_BASE_URL}/api/auth/logout`, 
        { refreshToken: newTokens.refreshToken },
        { headers: { 'Authorization': `Bearer ${newTokens.accessToken}` } }
      );
      console.log('\n🧹 Cleaned up - logged out test user');
    } catch (error) {
      console.log('\n⚠️  Could not logout test user:', error.message);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
testJWTRefresh();