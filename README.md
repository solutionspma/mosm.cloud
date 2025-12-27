# mOSm.Cloud

**Digital Menu Control Plane**

mOSm.Cloud is the authoritative backend control plane for managing digital menus, screens, and devices. It connects to the Menu Builder and Kiosk/Player frontends.

## 🎯 What This Does

1. **Store & Version Menus** - Full version history, draft/published/archived states
2. **Control Devices Remotely** - Register, monitor, and manage physical devices
3. **Assign Menus to Screens** - Map different layouts to different screens
4. **Push Updates Live** - Instant deployment to all connected devices
5. **User Access Control** - Owner, Manager, Designer, Viewer roles

## 🏗️ Architecture

```
mOSm.Cloud (This Repo)
├── API Layer (Netlify Functions)
│   ├── /api/auth - Authentication
│   ├── /api/menus - Menu CRUD
│   ├── /api/layouts - Layout CRUD
│   ├── /api/devices - Device management
│   ├── /api/screens - Screen management
│   └── /api/publish - Publish pipeline
│
├── Data Layer (Supabase)
│   ├── organizations
│   ├── users
│   ├── menus
│   ├── layouts
│   ├── devices
│   └── screens
│
└── Frontend (Public HTML)
    ├── index.html - Landing page
    ├── login.html - Auth pages
    └── dashboard.html - Admin dashboard
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key
```

### 3. Set Up Database

Run the SQL schema in your Supabase project:
- Go to Supabase Dashboard → SQL Editor
- Paste contents of `supabase/schema.sql`
- Run

### 4. Deploy to Netlify

```bash
netlify deploy --prod
```

Or connect your GitHub repo to Netlify for auto-deploys.

## 📡 API Reference

### Authentication

```
POST /api/auth/signup    - Create account
POST /api/auth/signin    - Login
POST /api/auth/signout   - Logout
GET  /api/auth/session   - Get current session
POST /api/auth/reset-password - Password reset
```

### Menus

```
GET    /api/menus              - List menus
POST   /api/menus              - Create menu
GET    /api/menus/:id          - Get menu
PUT    /api/menus/:id          - Update menu
DELETE /api/menus/:id          - Archive menu
POST   /api/menus/:id/publish  - Publish menu
POST   /api/menus/:id/duplicate - Duplicate menu
```

### Layouts

```
GET    /api/layouts?menuId=    - Get layouts for menu
POST   /api/layouts            - Create layout
GET    /api/layouts/:id        - Get layout
PUT    /api/layouts/:id        - Update layout
DELETE /api/layouts/:id        - Delete layout
```

### Devices

```
GET    /api/devices            - List devices
POST   /api/devices/register   - Register device
POST   /api/devices/heartbeat  - Device heartbeat
GET    /api/devices/:id        - Get device
PUT    /api/devices/:id        - Update device
DELETE /api/devices/:id        - Delete device
```

### Screens

```
GET    /api/screens?deviceId=  - Get screens for device
POST   /api/screens            - Create screen
PUT    /api/screens/:id        - Update screen
PUT    /api/screens/:id/assign - Assign layout to screen
DELETE /api/screens/:id        - Delete screen
```

### Publish

```
POST   /api/publish/menu/:menuId     - Publish menu to devices
GET    /api/publish/device/:deviceId - Get content for device
POST   /api/publish/ack/:deviceId    - Acknowledge update
```

## 🔒 Data Models

### Menu
```javascript
{
  id: "uuid",
  name: "Main Menu",
  status: "draft | published | archived",
  version: 3,
  organizationId: "uuid",
  createdBy: "uuid",
  lastEditedBy: "uuid",
  lastPublishedAt: "timestamp",
  tags: [],
  metadata: {}
}
```

### Layout
```javascript
{
  id: "uuid",
  menuId: "uuid",
  screenIndex: 1,
  resolution: "1920x1080",
  aspectRatio: "16:9",
  orientation: "landscape",
  safeZone: "tv_1080p",
  elements: [],
  background: { type: "color", value: "#000000" }
}
```

### Device
```javascript
{
  id: "uuid",
  name: "Front Counter TV",
  organizationId: "uuid",
  location: "Store #1",
  status: "online | offline",
  lastHeartbeat: "timestamp",
  ipAddress: "192.168.1.100",
  screens: []
}
```

### Screen
```javascript
{
  id: "uuid",
  deviceId: "uuid",
  screenIndex: 1,
  resolution: "1920x1080",
  orientation: "landscape",
  assignedLayoutId: "uuid"
}
```

## ⚙️ Resolution Profiles

| Key | Resolution | Aspect Ratio |
|-----|------------|--------------|
| 720p | 1280x720 | 16:9 |
| 1080p | 1920x1080 | 16:9 |
| 2k | 2560x1440 | 16:9 |
| 4k | 3840x2160 | 16:9 |
| kiosk_portrait | 1080x1920 | 9:16 |

## 🔲 Safe Zones

| Key | Margin | Use Case |
|-----|--------|----------|
| tv_4k | 120px | 4K TVs |
| tv_1080p | 60px | 1080p TVs |
| kiosk | 40px | Kiosk displays |
| commercial_1080p | 30px | Commercial displays |
| none | 0px | Full bleed |

## 🛡️ User Roles

| Role | Permissions |
|------|-------------|
| Owner | Full access, billing, user management |
| Manager | Device & menu management, publishing |
| Designer | Create & edit menus only |
| Viewer | Read-only access |

## 📝 Non-Negotiable Rules

1. **Save FIRST** - Builder saves to Cloud before anything else
2. **No silent overwrites** - Always confirm destructive actions
3. **No auto-renaming** - Names stay exactly as set
4. **Preview ≠ Display** - Preview uses Cloud data, not local state
5. **Kiosk reads PUBLISHED only** - Draft menus never shown to customers

## 🔗 Integration Points

### Menu Builder
- Saves to `/api/menus/:id`
- Loads layouts from `/api/layouts?menuId=`
- Preview pulls from Cloud

### Kiosk/Player
- Fetches from `/api/publish/device/:deviceId`
- Heartbeat every 15 seconds to `/api/devices/heartbeat`
- Falls back to cached content when offline

---

**mOSm.Cloud** - Part of the Modos Menus ecosystem
