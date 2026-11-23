import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { verifySessionToken } from '../lib/auth-crypto.ts';
import {
  getUserByUid,
  getUserWithRbacById,
  upsertGoogleUser,
  type HydratedUserContext,
} from '../db/queries.ts';
import { hasPermission } from '../lib/rbac.ts';

const OWNER_EMAIL = 'nms.th666@gmail.com';
const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

export function getSessionSecret(): string {
  return SESSION_SECRET;
}

export interface AuthRequest extends Request {
  currentUser?: HydratedUserContext;
}

async function resolveBearerUser(token: string): Promise<HydratedUserContext | null> {
  // 1. Try server-signed Hamro Session Token (Email/Password login)
  const localPayload = verifySessionToken(token, SESSION_SECRET);
  if (localPayload) {
    const existing = await getUserWithRbacById(localPayload.userId);
    if (existing && existing.status === 'active') {
      return existing;
    }
    return null;
  }

  // 2. Try Firebase ID Token (Google Sign-In via Firebase Auth)
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email ?? '').trim().toLowerCase();
    if (!email) return null;

    const existing = await getUserByUid(decoded.uid);
    if (existing) {
      return await getUserWithRbacById(existing.id);
    }

    return await upsertGoogleUser({
      uid: decoded.uid,
      email,
      fullName: decoded.name || email.split('@')[0],
      emailVerified: Boolean(decoded.email_verified),
      avatarUrl: decoded.picture ?? null,
      grantSuperAdmin: Boolean(decoded.email_verified && email === OWNER_EMAIL),
    });
  } catch {
    return null;
  }
}

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (token) {
      try {
        const user = await resolveBearerUser(token);
        if (user) {
          req.currentUser = user;
        }
      } catch (err) {
        console.error('Optional auth verification failed:', err);
      }
    }
  }
  next();
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required. Please sign in with Email/Password or Google.',
    });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token.' });
  }

  try {
    const user = await resolveBearerUser(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired authentication token.' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'This account is suspended or inactive.' });
    }
    req.currentUser = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Unable to verify authentication credentials.' });
  }
};

export const requirePermission = (required: string | string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.currentUser) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!hasPermission(req.currentUser.permissions, required)) {
      const perms = Array.isArray(required) ? required.join(', ') : required;
      return res.status(403).json({
        error: `Forbidden: Missing required server-side permission (${perms}).`,
        requiredPermissions: Array.isArray(required) ? required : [required],
        activeRoles: req.currentUser.roles.map((r) => r.name),
      });
    }

    next();
  };
};
