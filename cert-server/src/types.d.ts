// cert-server/src/types.d.ts
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    oauthState?: string;
    verifiedGithubUsername?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      session: import('express-session').Session & Partial<import('express-session').SessionData>;
    }
  }
}