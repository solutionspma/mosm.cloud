/**
 * Token Generation Utilities
 * 
 * AUTHORITY: Only mOSm.cloud generates and verifies tokens
 * Edge runtimes NEVER issue tokens
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';

interface DeviceTokenPayload {
  device_id: string;
  type: string;
}

interface SessionTokenPayload {
  device_id: string;
  scopes: string[];
  expires_at: string;
}

/**
 * Generate long-lived device token
 * TTL: 1 year (device identity)
 */
export async function generateDeviceToken(payload: DeviceTokenPayload): Promise<string> {
  return jwt.sign(
    {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      type: 'device',
    },
    JWT_SECRET,
    { expiresIn: '365d' }
  );
}

/**
 * Generate short-lived session token
 * TTL: 30 minutes (as per contract)
 */
export async function generateSessionToken(payload: SessionTokenPayload): Promise<string> {
  return jwt.sign(
    {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      type: 'session',
    },
    JWT_SECRET,
    { expiresIn: '30m' }
  );
}

/**
 * Verify any token issued by this authority
 */
export async function verifyToken(token: string): Promise<Record<string, unknown>> {
  try {
    return jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Decode token without verification (for debugging only)
 */
export function decodeToken(token: string): Record<string, unknown> | null {
  return jwt.decode(token) as Record<string, unknown> | null;
}
