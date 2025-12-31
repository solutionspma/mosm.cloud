# GPT-CONTEXT.md — MOSM Cloud Control Plane

## IDENTITY

**MOSM Cloud is a CONTROL PLANE.**

It does NOT execute restaurant operations.  
It does NOT render menus.  
It does NOT process orders.  
It does NOT handle payments.

---

## CORE RESPONSIBILITIES

MOSM Cloud:
- **Orchestrates** — coordinates multi-location deployments
- **Configures** — owns source of truth for location/screen config
- **Audits** — logs all changes and events for compliance
- **Observes** — monitors service health without blocking operations

---

## SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                    MOSM CLOUD (Control Plane)               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │  Registry   │ │   Config    │ │    Event Mirror         ││
│  │  Service    │ │   Service   │ │    (Audit Only)         ││
│  └──────┬──────┘ └──────┬──────┘ └───────────┬─────────────┘│
│         │               │                     │              │
│         └───────────────┼─────────────────────┘              │
│                         │                                    │
│              ┌──────────▼──────────┐                        │
│              │     MOSM Dashboard   │                        │
│              │   (Observe & Control)│                        │
│              └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                          │
           ┌──────────────┼──────────────┐
           │              │              │
           ▼              ▼              ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  MOD OS     │ │  POS-Lite   │ │    KDS      │
    │  Menus      │ │             │ │             │
    │ (Customer   │ │ (Kitchen    │ │ (Kitchen    │
    │  Display)   │ │  Orders)    │ │  Display)   │
    └─────────────┘ └─────────────┘ └─────────────┘
         │                │              │
         └────────────────┼──────────────┘
                          │
                    HEARTBEAT TO MOSM
```

---

## HARD BOUNDARIES (DO NOT VIOLATE)

| MOSM Cloud DOES                  | MOSM Cloud DOES NOT         |
|----------------------------------|-----------------------------|
| Own locations, screens, roles    | Render menus                |
| Own deployment state & config    | Handle order flow           |
| Own audit logs                   | Display KDS                 |
| Own multi-location coordination  | Touch payments              |
| Own feature toggles              | Execute kitchen operations  |

---

## SERVICE COMMUNICATION MODEL

### Heartbeats (Inbound)
MOD OS Menus, POS-Lite, and KDS send heartbeats to MOSM:
```
POST /api/mosm/heartbeat
{
  "service": "modos-menus | pos-lite | kds",
  "location_id": "loc_01",
  "status": "online | degraded | offline",
  "version": "git-sha",
  "timestamp": "ISO-8601"
}
```

### Configuration (Outbound — Read-Only)
MOD OS reads config from MOSM on boot, then caches locally:
```
GET /api/mosm/config/location/:id
GET /api/mosm/config/screens/:location_id
GET /api/mosm/config/features/:location_id
```

### Events (Inbound — No Mutation)
MOSM subscribes to events but NEVER mutates live systems:
- Order lifecycle events
- Menu changes
- Availability changes

Events are stored for audit and analytics ONLY.

---

## FAILURE MODES

| Service State | MOSM Response                    |
|---------------|----------------------------------|
| Online        | Normal operations                |
| Degraded      | Log + throttle updates           |
| Offline       | Log + alert owner                |

**CRITICAL:** MOSM can go offline without stopping kitchens.  
MOD OS and POS-Lite MUST continue operating if MOSM is unreachable.

---

## ROLE PERMISSIONS

| Role      | Capabilities                                    |
|-----------|-------------------------------------------------|
| Owner     | Modify pricing, menus, integrations, all access |
| Manager   | Toggle availability, promotions, view analytics |
| Staff     | Read-only access to assigned locations          |
| Installer | Bind hardware, configure screens only           |

---

## MENTAL MODEL

> **MOD OS Menus** → "What customers & staff see"  
> **POS-Lite / KDS** → "What kitchens do"  
> **MOSM Cloud** → "What owners control"

If MOSM disappears, the restaurant still runs.
That's enterprise-grade.

---

## FILE STRUCTURE

```
/blueprints/            # Architecture docs (mirrored, read-only)
  /architecture/
    mosm-auth-control.md
    service-boundaries.md
    
/services/
  /registry/            # Service heartbeats & health
  /config/              # Location & screen configuration
  /rollouts/            # Menu activation & deployment control
  /audit/               # Event & change logs

/netlify/functions/
  /mosm/                # Control plane API endpoints
    heartbeat.js
    config.js
    events.js
    rollouts.js
```

---

## ACCEPTANCE CRITERIA

Before any PR is merged:
- [ ] MOD OS can read config from MOSM
- [ ] POS-Lite can read feature flags from MOSM
- [ ] MOSM can orchestrate rollouts without breaking kitchens
- [ ] MOSM logs all changes and events
- [ ] MOSM can be taken offline without halting operations

---

## ENV CONTRACT (Shared Across All Services)

```env
# MOSM Cloud
MOSM_BASE_URL=https://mosm-cloud.netlify.app
MOSM_API_KEY=mosm_...

# Supabase (shared auth)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

# Service Identity
SERVICE_NAME=mosm-cloud
SERVICE_VERSION=git-sha
```

---

*Last Updated: 2025-01-01*
*Version: 1.0.0*
