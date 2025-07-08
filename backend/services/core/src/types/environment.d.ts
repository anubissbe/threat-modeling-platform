declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      PORT: string;
      LOG_LEVEL: string;
      
      // Database
      DB_HOST: string;
      DB_PORT: string;
      DB_NAME: string;
      DB_USER: string;
      DB_PASSWORD: string;
      
      // Redis
      REDIS_URL: string;
      
      // Auth
      JWT_SECRET: string;
      
      // CORS
      ALLOWED_ORIGINS: string;
      
      // Package
      npm_package_version: string;
    }
  }
}

export {};