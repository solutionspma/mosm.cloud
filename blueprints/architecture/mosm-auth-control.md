# MOSM Auth Control Architecture

## Overview

MOSM Cloud owns authentication and authorization for the entire ecosystem.
MOD OS Menus and POS-Lite defer permission checks to MOSM using shared session tokens.

---

## Authentication Flow

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   User       │         │  MOSM Cloud  │         │  Supabase    │
│   (Browser)  │         │  (Auth Hub)  │         │  (Auth DB)   │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       │  1. Login Request      │                        │
       │───────────────────────>│                        │
       │                        │  2. Authenticate       │
       │                        │───────────────────────>│
       │                        │                        │
       │                        │  3. Session Token      │
       │                        │<───────────────────────│
       │  4. Token + User Data  │                        │
       │<───────────────────────│                        │
       │                        │                        │
```

---

## Session Token Structure

All services use the same Supabase JWT:

```json
{
  "sub": "user_uuid",
  "email": "user@example.com",
  "role": "owner | manager | staff | installer",
  "org_id": "organization_uuid",
  "locations": ["loc_01", "loc_02"],
  "permissions": ["menu:write", "screen:bind", "analytics:read"],
  "iat": 1704067200,
  "exp": 1704153600
}
```

---

## Permission Matrix

| Action                    | Owner | Manager | Staff | Installer |
|---------------------------|-------|---------|-------|-----------|
| Modify pricing            | ✓     | ✗       | ✗     | ✗         |
| Edit menu content         | ✓     | ✗       | ✗     | ✗         |
| Toggle item availability  | ✓     | ✓       | ✗     | ✗         |
| Create promotions         | ✓     | ✓       | ✗     | ✗         |
| View analytics            | ✓     | ✓       | ✓     | ✗         |
| Bind hardware             | ✓     | ✗       | ✗     | ✓         |
| Configure screens         | ✓     | ✗       | ✗     | ✓         |
| Manage integrations       | ✓     | ✗       | ✗     | ✗         |
| Invite users              | ✓     | ✓       | ✗     | ✗         |
| View locations            | ✓     | ✓       | ✓     | ✓         |

---

## Cross-Service Auth Flow

When MOD OS needs to verify permissions:

```
┌──────────────┐         ┌──────────────┐
│  MOD OS      │         │  MOSM Cloud  │
│  Menus       │         │  (Auth Hub)  │
└──────┬───────┘         └──────┬───────┘
       │                        │
       │  GET /api/mosm/auth/verify
       │  Authorization: Bearer <token>
       │  X-Action: menu:write
       │───────────────────────>│
       │                        │
       │  { allowed: true/false,
       │    user: {...},
       │    permissions: [...] }
       │<───────────────────────│
       │                        │
```

---

## Implementation Notes

1. **Single Source of Truth**: MOSM owns role definitions
2. **Token Passthrough**: MOD OS/POS-Lite pass tokens, don't decode
3. **Graceful Degradation**: Cache last-known permissions locally
4. **Audit Trail**: Every permission check is logged

---

## API Endpoints

### Verify Permission
```
GET /api/mosm/auth/verify
Headers:
  Authorization: Bearer <supabase_jwt>
  X-Action: <permission_key>
  X-Resource: <resource_id> (optional)

Response:
{
  "allowed": true,
  "user": {
    "id": "uuid",
    "role": "manager",
    "org_id": "uuid"
  },
  "permissions": ["menu:read", "availability:write"]
}
```

### Get User Permissions
```
GET /api/mosm/auth/permissions
Headers:
  Authorization: Bearer <supabase_jwt>

Response:
{
  "user_id": "uuid",
  "role": "manager",
  "permissions": [
    { "key": "menu:read", "scope": "org" },
    { "key": "availability:write", "scope": "location", "locations": ["loc_01"] }
  ]
}
```

---

## Security Constraints

- Tokens expire after 24 hours
- Refresh tokens valid for 7 days
- Role changes require re-authentication
- Permission changes propagate within 60 seconds
- Failed auth attempts rate-limited (5 per minute)
