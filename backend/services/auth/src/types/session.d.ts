import { Request } from 'express';
import { Session, SessionData } from 'express-session';

declare module 'express' {
  interface Request {
    session: Session & Partial<SessionData>;
  }
}
