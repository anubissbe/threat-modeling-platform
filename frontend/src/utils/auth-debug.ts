// Auth debugging utilities
export const debugAuth = {
  checkToken: () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.log('[AUTH DEBUG] No token in localStorage');
      return;
    }
    
    console.log('[AUTH DEBUG] Token found:', {
      length: token.length,
      firstChars: token.substring(0, 20),
      lastChars: token.substring(token.length - 20),
      startsWithBearer: token.startsWith('Bearer'),
      includesBearer: token.includes('Bearer'),
      isJWT: token.split('.').length === 3
    });
    
    // Try to decode JWT
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        console.log('[AUTH DEBUG] JWT payload:', payload);
        console.log('[AUTH DEBUG] Token expires:', new Date(payload.exp * 1000));
      }
    } catch (e) {
      console.error('[AUTH DEBUG] Failed to decode JWT:', e);
    }
  },
  
  interceptRequest: (config: any) => {
    console.log('[AUTH DEBUG] Request config:', {
      url: config.url,
      method: config.method,
      headers: {
        ...config.headers,
        Authorization: config.headers.Authorization ? 
          config.headers.Authorization.substring(0, 50) + '...' : 
          'none'
      }
    });
  }
};