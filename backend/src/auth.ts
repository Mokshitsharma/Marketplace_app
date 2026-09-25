import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config.js';
import type { Role } from './domain/types.js';

export interface AuthClaims {
  sub: string; // customer id or store id
  role: Role;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthClaims;
  }
}

export const signToken = (claims: AuthClaims) => jwt.sign(claims, config.jwtSecret, { expiresIn: '30d' });

export function verifyToken(token: string): AuthClaims | null {
  try {
    return jwt.verify(token, config.jwtSecret) as AuthClaims;
  } catch {
    return null;
  }
}

export const requireRole = (role: Role) => (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization ?? '';
  const claims = header.startsWith('Bearer ') ? verifyToken(header.slice(7)) : null;
  if (!claims || claims.role !== role) return res.status(401).json({ error: 'Log in to continue' });
  req.auth = claims;
  next();
};
