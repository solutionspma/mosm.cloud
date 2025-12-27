# mOSm.Cloud - Complete Build Summary & Integration Guide

> **Document Purpose**: Summary of mOSm.Cloud backend implementation for handoff/collaboration with other AI assistants or developers.

---

## 🏗️ What Was Built

### Project Overview
**mOSm.Cloud** is the authoritative backend control plane for the Modos Menus digital signage ecosystem. It serves as the single source of truth for:
- Menu management (CRUD, versioning, publishing)
- Device registration and heartbeat monitoring
- Screen/layout assignments
- User authentication and organization management
- Live publishing to kiosks/displays

### Architecture Principle
> "All frontends (Menu Builder, Kiosk, Admin) READ AND WRITE THROUGH THIS CLOUD LAYER. There is no local-only state."

---

## 📁 Project Structure

```
mOSm.cloud/
├── models/
│   ├── User.js
│   ├── Organization.js
│   ├── Menu.js
│   ├── Layout.js
│   ├── Screen.js
│   ├── Device.js
│   ├── Location.js
│   └── index.js
├── services/
│   ├── supabase.js          # Supabase client initialization
│   ├── authService.js       # Authentication operations
│   ├── menuService.js       # Menu CRUD operations
│   ├── layoutService.js     # Layout management
│   ├── deviceService.js     # Device registration/heartbeat
│   ├── publishService.js    # Publishing workflow
│   └── index.js
├── utils/
│   ├── resolutionProfiles.js # Screen resolution definitions
│   ├── safeZones.js         # TV/kiosk safe zone margins
│   ├── validators.js        # Input validation helpers
│   └── index.js
├── netlify/
│   └── functions/
│       ├── auth.js          # POST /api/auth/signup, /signin, /signout
│       ├── menus.js         # GET/POST /api/menus
│       ├── layouts.js       # GET/POST /api/layouts
│       ├── devices.js       # GET/POST /api/devices, /heartbeat
│       ├── screens.js       # GET/POST /api/screens
│       └── publish.js       # POST /api/publish
├── public/
│   ├── index.html           # Landing page
│   ├── login.html           # Auth UI
│   └── dashboard.html       # Admin dashboard
├── supabase/
│   └── schema.sql           # Complete database schema
├── netlify.toml             # Netlify configuration
├── package.json
├── .env                     # Environment variables (not committed)
├── .env.example
└── README.md
```

---

## 🌐 Live Deployment

| Resource | URL |
|----------|-----|
| **Production Site** | https://mosm-cloud.netlify.app |
| **Login Page** | https://mosm-cloud.netlify.app/login.html |
| **Dashboard** | https://mosm-cloud.netlify.app/dashboard.html |
| **Menus List** | https://mosm-cloud.netlify.app/menus.html |
| **Menu Editor** | https://mosm-cloud.netlify.app/admin.html |
| **Devices** | https://mosm-cloud.netlify.app/devices.html |
| **Device Player** | https://mosm-cloud.netlify.app/player.html |
| **Onboarding** | https://mosm-cloud.netlify.app/onboarding.html |
| **GitHub Repo** | https://github.com/solutionspma/mosm.cloud |
| **Netlify Project** | mosm-cloud (ID: 48e5af30-9596-4fa1-9766-7fee16f03396) |

---

## 🔌 API Endpoints

All endpoints are accessed via `https://mosm-cloud.netlify.app/api/...`

### Authentication
```
POST /api/auth/signup     - Create new account
POST /api/auth/signin     - Login (returns session token)
POST /api/auth/signout    - Logout
GET  /api/auth/session    - Verify session (requires Bearer token)
POST /api/auth/reset-password - Send password reset email
```

### Menus
```
GET  /api/menus           - List all menus for organization
GET  /api/menus/:id       - Get single menu with layouts
POST /api/menus           - Create new menu
PUT  /api/menus/:id       - Update menu
DELETE /api/menus/:id     - Delete menu
```

### Layouts
```
GET  /api/layouts?menuId=xxx  - Get layouts for a menu
POST /api/layouts             - Create layout
PUT  /api/layouts/:id         - Update layout (elements, background, etc.)
DELETE /api/layouts/:id       - Delete layout
```

### Devices
```
GET  /api/devices              - List devices for organization
POST /api/devices              - Register new device
POST /api/devices/register-self - Device self-registration (returns pairing code)
POST /api/devices/claim        - Claim device by pairing code
POST /api/devices/heartbeat    - Device heartbeat (every 15s)
PUT  /api/devices/:id          - Update device settings
DELETE /api/devices/:id        - Remove device
```

### Screens
```
GET  /api/screens?deviceId=xxx - Get screens for a device
POST /api/screens              - Add screen to device
PUT  /api/screens/:id          - Update screen (assign layout)
DELETE /api/screens/:id        - Remove screen
```

### Publishing
```
POST /api/publish              - Publish menu to assigned screens
  Body: { menuId: "uuid" }
  - Increments version
  - Updates status to "published"
  - Records in publish_history
  - Flags devices for update

GET  /api/publish/device/:id   - Get published content for device (used by player)
```

---

## 📱 Application Pages

### Menu Editor (`/admin.html`)
Full multi-screen layout editor with:
- **Resolution Profiles**: 720p through 8K, portrait/landscape variants
- **Multi-Screen Support**: Manage multiple screens per layout
- **Element Palette**: Text, Image, Video, Zone elements
- **Properties Panel**: Edit selected element properties
- **Safe Zone Overlay**: Visualize TV overscan/kiosk bezels
- **Publish Button**: One-click publish to devices

### Device Player (`/player.html`)
Kiosk/display runtime with:
- **Self-Registration**: Automatically registers with cloud on first load
- **Pairing Code Display**: Shows 6-character code until claimed
- **Heartbeat**: Sends status every 15 seconds
- **Auto-Refresh**: Polls for published content updates
- **CSS Transform Scaling**: Fits any resolution to screen

### Device Management (`/devices.html`)
Admin page for device pairing:
- **Pairing Code Entry**: Enter code displayed on kiosk to claim it
- **Device List**: View all claimed devices with online/offline status
- **Menu Assignment**: Assign menus to device screens

### Menus List (`/menus.html`)
Menu management page:
- **Grid View**: Visual cards for all organization menus
- **Quick Actions**: Create, Edit, Delete menus
- **Status Indicators**: Draft, Published, Archived

---

## 🗄️ Database Schema (Supabase)

### Tables
- **organizations** - Multi-tenant organization support
- **users** - User profiles (extends auth.users)
- **locations** - Physical locations for devices
- **menus** - Menu definitions with status/versioning
- **layouts** - Visual layouts tied to menus (elements stored as JSONB)
- **devices** - Registered display devices
- **screens** - Individual screens on devices
- **publish_history** - Audit trail of publishes
- **invites** - Team invitation system

### Key Relationships
```
Organization → Users (many)
Organization → Menus (many)
Organization → Devices (many)
Menu → Layouts (many)
Device → Screens (many)
Screen → Layout (assigned)
```

### Row Level Security (RLS)
All tables have RLS enabled. Users can only access data within their organization.

### Triggers
- `on_auth_user_created` - Auto-creates user profile on signup
- `update_*_updated_at` - Auto-updates timestamps on all tables

---

## 🖥️ Resolution Profiles

Defined in `utils/resolutionProfiles.js`:

```javascript
RESOLUTIONS = {
  '720p': { width: 1280, height: 720, aspectRatio: '16:9' },
  '1080p': { width: 1920, height: 1080, aspectRatio: '16:9' },
  '2k': { width: 2560, height: 1440, aspectRatio: '16:9' },
  '4k': { width: 3840, height: 2160, aspectRatio: '16:9' },
  '8k': { width: 7680, height: 4320, aspectRatio: '16:9' },
  // Portrait variants
  '1080p_portrait': { width: 1080, height: 1920, aspectRatio: '9:16' },
  '4k_portrait': { width: 2160, height: 3840, aspectRatio: '9:16' },
  // Ultrawide
  'ultrawide_1080p': { width: 2560, height: 1080, aspectRatio: '21:9' },
  'ultrawide_1440p': { width: 3440, height: 1440, aspectRatio: '21:9' },
}
```

---

## 📐 Safe Zones

Defined in `utils/safeZones.js`:

```javascript
SAFE_ZONES = {
  tv_4k: { top: 120, right: 120, bottom: 120, left: 120 },
  tv_1080p: { top: 60, right: 60, bottom: 60, left: 60 },
  kiosk: { top: 40, right: 40, bottom: 40, left: 40 },
  desktop: { top: 20, right: 20, bottom: 20, left: 20 },
  none: { top: 0, right: 0, bottom: 0, left: 0 },
}
```

---

## 🔐 Environment Variables

The following are configured in Netlify:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL (https://agkrwcdvfraivfhttjrp.supabase.co) |
| `SUPABASE_ANON_KEY` | Public anon key (JWT token - configured in Netlify) |
| `SUPABASE_SERVICE_KEY` | Service role key for admin operations (configured in Netlify) |

> **Note**: Keys are stored securely in Netlify environment variables. The anon key was regenerated on Dec 27, 2025.

---

## 🔗 Integration with MODOSmenus

### Current State
- MODOSmenus app lives at: `modosmenus.netlify.app`
- Has a "Cloud" button that currently points to a problematic CMS page
- Menu Builder (CMS) is at `/apps/cms.html`

### Integration Points Needed

#### 1. Authentication Flow
MODOSmenus should authenticate against mOSm.Cloud:

```javascript
// In MODOSmenus app
const MOSM_API = 'https://mosm-cloud.netlify.app/api';

async function login(email, password) {
  const response = await fetch(`${MOSM_API}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const { user, session } = await response.json();
  localStorage.setItem('mosm_session', JSON.stringify(session));
  localStorage.setItem('mosm_user', JSON.stringify(user));
  return { user, session };
}
```

#### 2. Menu Builder → Cloud Save
When saving a menu in the CMS:

```javascript
async function saveMenuToCloud(menuData, layoutData) {
  const session = JSON.parse(localStorage.getItem('mosm_session'));
  
  // Create or update menu
  const menuResponse = await fetch(`${MOSM_API}/menus`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({
      name: menuData.name,
      organizationId: user.organization_id
    })
  });
  const menu = await menuResponse.json();
  
  // Save layout with elements
  await fetch(`${MOSM_API}/layouts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({
      menuId: menu.id,
      resolution: layoutData.resolution,
      elements: layoutData.elements,
      background: layoutData.background
    })
  });
}
```

#### 3. Cloud Button Behavior
The Cloud button in MODOSmenus should:
1. Check if user is logged into mOSm.Cloud
2. If not, redirect to `https://mosm-cloud.netlify.app/login.html?redirect=modosmenus`
3. If yes, show cloud sync options (Save, Load, Publish)

#### 4. Kiosk/Player Integration
Kiosks fetch published menus:

```javascript
async function fetchPublishedMenu(deviceId) {
  const response = await fetch(`${MOSM_API}/devices/${deviceId}/content`);
  const { layouts } = await response.json();
  return layouts; // Render these on screen
}

// Heartbeat every 15 seconds
setInterval(async () => {
  await fetch(`${MOSM_API}/devices/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: DEVICE_ID,
      status: 'online',
      ipAddress: await getLocalIP()
    })
  });
}, 15000);
```

---

## ✅ What's Working

- [x] Netlify deployment live
- [x] Supabase database schema created
- [x] All API endpoints functional
- [x] User signup/signin working
- [x] Session tokens being issued
- [x] RLS policies in place
- [x] Trigger for auto user profile creation
- [x] Organization onboarding flow
- [x] Multi-screen layout editor (admin.html)
- [x] Device self-registration with pairing codes
- [x] Device player with heartbeat and content rendering
- [x] Device claiming by pairing code
- [x] Menu publishing to devices
- [x] Menus list page with CRUD operations

## ⚠️ Known Issues / TODOs

1. ~~**Email Confirmation Redirect**: Was pointing to localhost:3000.~~ ✅ Fixed

2. ~~**Service Role Key**: Needs to be updated in Netlify.~~ ✅ Fixed

3. **CORS**: Currently allows all origins (`*`). May need to restrict to specific domains in production.

4. ~~**Organization Creation**: New users don't have an organization yet.~~ ✅ Fixed - Onboarding flow creates organization

---

## 🚀 Next Steps for Integration

1. ~~**Update MODOSmenus Cloud button**~~ ✅ mOSm.Cloud has its own full UI now
2. **Connect MODOSmenus Menu Builder** to mOSm.Cloud API for save/load
3. **Implement shared auth** - single login works across all apps
4. ~~**Build device registration flow**~~ ✅ Complete with pairing codes
5. ~~**Create publish workflow**~~ ✅ Available in Menu Editor
6. **Add real-time updates** via Supabase subscriptions (optional)
7. **Media asset management** - Image/video upload and library

---

## 🔄 Device Pairing Flow

### How It Works

1. **Kiosk loads player.html**
   - Calls `POST /api/devices/register-self`
   - Receives `deviceId` and 6-character `pairingCode`
   - Displays pairing code on screen

2. **Admin opens devices.html**
   - Clicks "Add Device"
   - Enters the pairing code shown on kiosk
   - Calls `POST /api/devices/claim` with code + orgId

3. **Device is claimed**
   - Device now belongs to organization
   - Admin can assign menus to device
   - Kiosk starts displaying published content

### Code Example (Player Side)
```javascript
// Self-register device
const response = await fetch('/api/devices/register-self', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Kiosk',
    resolution: '1920x1080'
  })
});
const { deviceId, pairingCode } = await response.json();
// Display pairingCode on screen until claimed
```

### Code Example (Admin Side)
```javascript
// Claim device by pairing code
const response = await fetch('/api/devices/claim', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  },
  body: JSON.stringify({
    pairingCode: 'ABC123',
    organizationId: user.organization_id
  })
});
```

---

## 📞 Support

- **GitHub**: https://github.com/solutionspma/mosm.cloud
- **Supabase Project**: mosm.cloud (agkrwcdvfraivfhttjrp)
- **Netlify Site**: mosm-cloud

---

*Document created: December 27, 2025*
*Last updated: December 27, 2025*
*Phases 1-6 completed: December 27, 2025*
