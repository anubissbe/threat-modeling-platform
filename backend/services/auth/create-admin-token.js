// Create admin JWT token for testing
const jwt = require('jsonwebtoken');

const adminUser = {
  userId: 'admin-test-id',
  email: 'superadmin@threat-modeling.com',
  role: 'admin', // This matches UserRole.ADMIN enum value
  organization: 'test-org'
};

const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const token = jwt.sign(adminUser, secret, { expiresIn: '24h' });

console.log('Admin JWT Token:');
console.log(token);
console.log('\nTest with:');
console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:3001/api/auth/sso/templates`);