// Debug script to check authentication state
// Run this in browser console after login attempt

console.log('=== Authentication Debug ===');

// Check localStorage
const accessToken = localStorage.getItem('accessToken');
const refreshToken = localStorage.getItem('refreshToken');

console.log('Access Token:', {
  exists: !!accessToken,
  value: accessToken,
  length: accessToken ? accessToken.length : 0,
  isString: typeof accessToken === 'string',
  isUndefinedString: accessToken === 'undefined',
  first50: accessToken ? accessToken.substring(0, 50) : null
});

console.log('Refresh Token:', {
  exists: !!refreshToken,
  value: refreshToken ? refreshToken.substring(0, 30) + '...' : null,
  length: refreshToken ? refreshToken.length : 0
});

// Try to decode JWT if valid
if (accessToken && accessToken !== 'undefined' && accessToken.split('.').length === 3) {
  try {
    const parts = accessToken.split('.');
    const header = JSON.parse(atob(parts[0]));
    const payload = JSON.parse(atob(parts[1]));
    
    console.log('JWT Header:', header);
    console.log('JWT Payload:', payload);
    console.log('Token expires at:', new Date(payload.exp * 1000));
    console.log('Token is expired:', new Date(payload.exp * 1000) < new Date());
  } catch (e) {
    console.error('Failed to decode JWT:', e);
  }
} else {
  console.error('Invalid token format');
}

// Check axios defaults
if (window.axios) {
  console.log('Axios default auth header:', window.axios.defaults.headers.common['Authorization']);
}

console.log('=== End Debug ===');