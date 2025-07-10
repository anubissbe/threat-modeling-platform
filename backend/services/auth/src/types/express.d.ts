import 'express-session';

declare module 'express-session' {
  interface SessionData {
    state?: string;
    returnTo?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      sessionID: string;
    }
  }
}
