const jwt = require('jsonwebtoken');

// Test different secret combinations
const secrets = {
  jwt: 'your-super-secret-jwt-key',
  jwtLong: 'your-super-secret-jwt-key-change-this-in-production',
  refresh: 'your-super-secret-refresh-key',
  refreshLong: 'your-super-secret-refresh-key-change-this-in-production',
  default: 'your-jwt-secret-here',
  refreshDefault: 'your-refresh-secret-here'
};

// Sample refresh token from the test
const sampleToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1Y2M5YTA2Ny0wMzIzLTQ5MmQtODg1My0zNTBkMmFjZDA3OTUiLCJpYXQiOjE3NTIxMjg2NDMsImV4cCI6MTc1MjczMzQ0M30.UHMwHdCMk8jFthELAsvooHzEDczUJRZDW6J91ge3SO8';

console.log('🔍 Diagnosing JWT Token Issues\n');

// Decode without verification to see the payload
const decoded = jwt.decode(sampleToken);
console.log('Token payload:', decoded);
console.log('Token issued at:', new Date(decoded.iat * 1000).toISOString());
console.log('Token expires at:', new Date(decoded.exp * 1000).toISOString());
console.log();

// Try each secret
console.log('Testing different secrets:');
for (const [name, secret] of Object.entries(secrets)) {
  try {
    const verified = jwt.verify(sampleToken, secret);
    console.log(`✅ ${name}: SUCCESS - Token verified with secret: "${secret}"`);
    break;
  } catch (error) {
    console.log(`❌ ${name}: Failed - ${error.message}`);
  }
}

console.log('\n🔐 Creating new tokens with correct secret:');

// Create tokens with the correct secret
const userId = '5cc9a067-0323-492d-8853-350d2acd0795';
const correctJwtSecret = 'your-super-secret-jwt-key';
const correctRefreshSecret = 'your-super-secret-refresh-key';

const newAccessToken = jwt.sign(
  { userId, email: 'test@example.com', role: 'user' },
  correctJwtSecret,
  { expiresIn: '15m' }
);

const newRefreshToken = jwt.sign(
  { userId },
  correctRefreshSecret,
  { expiresIn: '7d' }
);

console.log('New Access Token:', newAccessToken.substring(0, 50) + '...');
console.log('New Refresh Token:', newRefreshToken.substring(0, 50) + '...');

// Verify the new tokens
try {
  jwt.verify(newAccessToken, correctJwtSecret);
  console.log('✅ New access token verified successfully');
} catch (error) {
  console.log('❌ New access token verification failed:', error.message);
}

try {
  jwt.verify(newRefreshToken, correctRefreshSecret);
  console.log('✅ New refresh token verified successfully');
} catch (error) {
  console.log('❌ New refresh token verification failed:', error.message);
}