// Global type declarations

interface AppConfig {
  API_BASE_URL: string;
  ENVIRONMENT: string;
  VERSION: string;
}

declare global {
  interface Window {
    APP_CONFIG?: AppConfig;
  }
}

export {};