/**
 * Session Token Issuance
 * POST /api/sessions/issue
 * 
 * Office → Device communication
 * Issues short-lived session tokens (30 min TTL)
 */

import { generateSessionToken } from '../auth/tokens';

interface SessionIssueRequest {
  device_id: string;
  device_token: string;
  scopes?: string[];
}

interface SessionIssueResponse {
  session_token: string;
  expires_at: string;
  scopes: string[];
  ttl_minutes: number;
}

const SESSION_TTL_MINUTES = 30;
const WARN_BEFORE_EXPIRY_MINUTES = 2;

export async function issueSession(
  req: SessionIssueRequest
): Promise<SessionIssueResponse> {
  // Validate device token
  // const device = await validateDeviceToken(req.device_token);

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + SESSION_TTL_MINUTES);

  const scopes = req.scopes || ['display', 'heartbeat'];

  const session_token = await generateSessionToken({
    device_id: req.device_id,
    scopes,
    expires_at: expiresAt.toISOString(),
  });

  return {
    session_token,
    expires_at: expiresAt.toISOString(),
    scopes,
    ttl_minutes: SESSION_TTL_MINUTES,
  };
}

export const SESSION_CONFIG = {
  ttl_minutes: SESSION_TTL_MINUTES,
  warn_before_minutes: WARN_BEFORE_EXPIRY_MINUTES,
};
