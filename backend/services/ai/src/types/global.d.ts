import { RedisClientType } from 'redis';

declare global {
  var redisClient: RedisClientType;
  
  namespace NodeJS {
    interface ProcessEnv {
      PORT?: string;
      HOST?: string;
      NODE_ENV?: string;
      CORS_ORIGINS?: string;
      DB_HOST?: string;
      DB_PORT?: string;
      DB_NAME?: string;
      DB_USER?: string;
      DB_PASSWORD?: string;
      DB_SSL?: string;
      DB_POOL_SIZE?: string;
      DB_IDLE_TIMEOUT?: string;
      DB_CONNECTION_TIMEOUT?: string;
      REDIS_HOST?: string;
      REDIS_PORT?: string;
      REDIS_PASSWORD?: string;
      REDIS_DB?: string;
      JWT_SECRET?: string;
      JWT_REFRESH_SECRET?: string;
      OPENAI_API_URL?: string;
      OPENAI_API_KEY?: string;
      INTERNAL_SERVICE_TOKEN?: string;
      LOG_LEVEL?: string;
      SERVICE_VERSION?: string;
      ENABLE_FILE_LOGGING?: string;
    }
  }
}