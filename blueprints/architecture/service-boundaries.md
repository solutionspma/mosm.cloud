# Service Boundaries

## The Three Pillars

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MOSM ECOSYSTEM                                  │
├─────────────────────┬─────────────────────┬─────────────────────────────────┤
│     MOD OS Menus    │      POS-Lite       │          MOSM Cloud             │
│    (Display Layer)  │   (Kitchen Layer)   │       (Control Layer)           │
├─────────────────────┼─────────────────────┼─────────────────────────────────┤
│ • Render menus      │ • Order entry       │ • Orchestration                 │
│ • Customer display  │ • Kitchen display   │ • Configuration                 │
│ • Staff display     │ • Payment handling  │ • Audit logging                 │
│ • Kiosk mode        │ • Ticket printing   │ • Health monitoring             │
│ • Promotions view   │ • Order routing     │ • Multi-location coordination   │
└─────────────────────┴─────────────────────┴─────────────────────────────────┘
```

---

## Strict Separation of Concerns

### MOD OS Menus OWNS
- Menu rendering and display logic
- Customer-facing UI
- Staff-facing menu boards
- Real-time visual updates
- Local cache of menu data

### MOD OS Menus DOES NOT
- Store master menu data (reads from MOSM)
- Process payments
- Handle orders
- Manage users

---

### POS-Lite OWNS
- Order creation and management
- Kitchen display system (KDS)
- Payment processing
- Ticket generation
- Order routing

### POS-Lite DOES NOT
- Render menus
- Manage menu content
- Handle multi-location logic
- Store configuration

---

### MOSM Cloud OWNS
- Location and organization management
- Screen and device configuration
- Role and permission enforcement
- Audit trail and event logs
- Menu version control
- Rollout orchestration
- Feature flags
- Service health monitoring

### MOSM Cloud DOES NOT
- Render menus
- Process orders
- Handle payments
- Display KDS
- Execute kitchen operations

---

## Data Flow Matrix

| Data Type        | Source        | Consumers           | Sync Method    |
|------------------|---------------|---------------------|----------------|
| Menu Content     | MOSM Cloud    | MOD OS Menus        | REST + Cache   |
| Screen Config    | MOSM Cloud    | MOD OS Menus        | REST + Cache   |
| Feature Flags    | MOSM Cloud    | All Services        | REST + Cache   |
| Order Events     | POS-Lite      | MOSM Cloud (audit)  | Webhook        |
| Menu Changes     | MOD OS        | MOSM Cloud (audit)  | Webhook        |
| Health Status    | All Services  | MOSM Cloud          | Heartbeat      |
| User Auth        | MOSM Cloud    | All Services        | Supabase JWT   |

---

## Offline Behavior

### If MOSM Cloud Goes Down

| Service      | Behavior                                          |
|--------------|---------------------------------------------------|
| MOD OS Menus | Continues with cached menu and config             |
| POS-Lite     | Continues accepting orders normally               |
| KDS          | Continues displaying orders                       |

**Critical**: Operations NEVER stop due to MOSM outage.

### If MOD OS Menus Goes Down

| Service      | Behavior                                          |
|--------------|---------------------------------------------------|
| POS-Lite     | Continues normally (has own product list)         |
| MOSM Cloud   | Logs offline status, alerts owner                 |
| KDS          | Continues displaying orders                       |

### If POS-Lite Goes Down

| Service      | Behavior                                          |
|--------------|---------------------------------------------------|
| MOD OS Menus | Continues displaying menus (no order impact)      |
| MOSM Cloud   | Logs offline status, alerts owner                 |
| KDS          | No new orders, displays existing queue            |

---

## API Contract Between Services

### MOSM → MOD OS (Configuration)
```
GET /api/mosm/config/location/:id
GET /api/mosm/config/screens/:location_id
GET /api/mosm/config/menu/:menu_id
```

### MOSM → POS-Lite (Feature Flags)
```
GET /api/mosm/config/features/:location_id
```

### MOD OS → MOSM (Heartbeat)
```
POST /api/mosm/heartbeat
```

### POS-Lite → MOSM (Events)
```
POST /api/mosm/events
```

### MOSM → All (Rollouts)
```
POST /api/mosm/rollouts/execute
```

---

## Integration Checkpoints

Before adding ANY feature, ask:

1. **Does this belong in the display layer?** → MOD OS Menus
2. **Does this belong in the kitchen layer?** → POS-Lite
3. **Does this belong in the control layer?** → MOSM Cloud

If unsure, default to MOSM Cloud for configuration/control,
and respective execution layers for runtime operations.
