// Runtime configuration for the threat modeling platform
// This file is loaded before the React app starts and can be modified
// in production without rebuilding the application

window.REACT_APP_CONFIG = {
  // API Gateway URL - can be overridden by environment variable at runtime
  API_GATEWAY_URL: window.REACT_APP_API_GATEWAY_URL || 'http://localhost:3000',
  
  // Feature flags
  FEATURES: {
    AI_SUGGESTIONS: true,
    REAL_TIME_COLLABORATION: false,
    ADVANCED_REPORTING: true,
    TMAC_SUPPORT: false,
  },
  
  // Application metadata
  APP_VERSION: '1.0.0',
  APP_NAME: 'Threat Modeling Platform',
  
  // Auth settings
  AUTH: {
    TOKEN_REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutes
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  },
  
  // UI settings
  UI: {
    THEME: 'light',
    DEFAULT_LANGUAGE: 'en',
  }
};