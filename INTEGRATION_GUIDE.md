# mOSm.Cloud + modOSmenus Integration Guide

## CRITICAL: This is the single source of truth for both platforms

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        mOSm.Cloud                               │
│                 (mosm-cloud.netlify.app)                        │
│                                                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ index.html  │ │ login.html  │ │dashboard.html│              │
│  │ (Lead Gate) │ │ (Auth)      │ │ (Main App)  │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│         │              │               │                        │
│         └──────────────┼───────────────┘                        │
│                        ▼                                        │
│                 /js/auth.js                                     │
│           (Shared Auth Module)                                  │
│                        │                                        │
│         ┌──────────────┼──────────────┐                        │
│         ▼              ▼              ▼                        │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                 │
│  │ Supabase   │ │ Netlify    │ │ GitHub     │                 │
│  │ Database   │ │ Functions  │ │ Auto-deploy│                 │
│  └────────────┘ └────────────┘ └────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ SSO Token via URL
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        modOSmenus                               │
│                 (modosmenus.netlify.app)                        │
│                                                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ login.html  │ │ kiosk.html  │ │ kiosk.js    │               │
│  │ (Auth)      │ │ (Display)   │ │ (Renderer)  │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│                                                                 │
│  Deploy: npx netlify deploy --prod --dir=apps/shell/dist        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure

### mOSm.Cloud Repository
```
mOSm.cloud/
├── public/                      # Static files (Netlify serves this)
│   ├── index.html              # Landing page with lead capture
│   ├── login.html              # Authentication page
│   ├── dashboard.html          # Main dashboard
│   ├── editor.html             # Layout/menu editor
│   ├── menus.html              # Menu management
│   ├── devices.html            # Device management
│   ├── screens.html            # Screen management
│   ├── users.html              # User management
│   ├── settings.html           # Organization settings
│   └── js/
│       └── auth.js             # SHARED AUTH MODULE
├── netlify/
│   └── functions/              # Serverless API endpoints
│       ├── submit-lead.js      # Lead capture endpoint
│       └── [...other functions]
├── netlify.toml                # Netlify config (headers, redirects)
└── package.json
```

### modOSmenus Repository (Kiosk Shell)
```
modosmenus/
└── apps/
    └── shell/
        └── dist/               # DEPLOY THIS FOLDER ONLY
            ├── index.html      # Redirect to kiosk
            ├── apps/
            │   ├── login.html  # Auth page
            │   ├── kiosk.html  # Kiosk display
            │   └── js/
            │       ├── auth.js # Shared auth (copy from mOSm.cloud)
            │       └── kiosk.js # Kiosk renderer
            └── _headers        # Cache-busting headers
```

---

## 🔐 Authentication System

### Storage Keys (localStorage)
```javascript
mosm_session     // Supabase session object (JSON)
mosm_user        // User data (JSON)
mosm_last_activity // Timestamp of last activity
mosm_organization // Organization ID
mosm_lead_submitted // Whether lead form was submitted
```

### Session Timeout: 30 minutes
- Activity refreshes timeout
- 5-minute warning toast before expiration
- Auto-logout on expiration

### SSO Flow
```
mOSm.Cloud Dashboard
    │
    │ User clicks "Open Kiosk"
    │
    │ ┌──────────────────────────────────────────────────┐
    │ │ const token = await supabase.auth.getSession(); │
    │ │ const url = `https://modosmenus.netlify.app/    │
    │ │            apps/kiosk.html?token=${token}`;     │
    │ │ window.open(url, '_blank');                      │
    │ └──────────────────────────────────────────────────┘
    │
    ▼
modOSmenus Kiosk
    │
    │ ┌──────────────────────────────────────────────────┐
    │ │ const urlParams = new URLSearchParams(...);      │
    │ │ const token = urlParams.get('token');           │
    │ │ if (token) {                                     │
    │ │   await supabase.auth.setSession(token);        │
    │ │   localStorage.setItem('mosm_session', token);  │
    │ │ }                                               │
    │ └──────────────────────────────────────────────────┘
```

---

## 🚀 Deployment Commands

### ⚠️ CRITICAL: mOSm.Cloud - USE CLI DEPLOY, NOT GIT PUSH
```bash
cd /Users/cffsmacmini/Documents/pitchmarketingagency.code-workspace/mOSm.cloud

# ALWAYS use Netlify CLI - GitHub auto-deploy is UNRELIABLE
npx netlify deploy --prod --dir=public

# This bypasses the GitHub integration and deploys directly
# The GitHub auto-deploy often fails to invalidate CDN cache
```

**WHY NOT GIT PUSH?**
- GitHub integration sometimes doesn't trigger Netlify rebuild
- Netlify CDN caches aggressively and doesn't invalidate on git push
- CLI deploy ALWAYS works and invalidates cache immediately

### modOSmenus (Kiosk)
```bash
cd /Users/cffsmacmini/Documents/pitchmarketingagency.code-workspace/modosmenus/modosmenus
npx netlify deploy --prod --dir=apps/shell/dist
# Manual deploy to modosmenus.netlify.app
```

---

## ⚠️ CACHE PROBLEMS & SOLUTIONS

### Problem: Updates not showing after deploy

### Solution 1: netlify.toml headers (mOSm.cloud)
```toml
# netlify.toml
[[headers]]
  for = "/*.html"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate"

[[headers]]
  for = "/*.js"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate"
```

### Solution 2: _headers file (modOSmenus)
```
# apps/shell/dist/_headers
/*.html
  Cache-Control: no-cache, no-store, must-revalidate
/*.js
  Cache-Control: no-cache, no-store, must-revalidate
/apps/*.html
  Cache-Control: no-cache, no-store, must-revalidate
/apps/js/*.js
  Cache-Control: no-cache, no-store, must-revalidate
```

### Solution 3: Version query strings
```html
<script src="/js/auth.js?v=1766969346"></script>
```

### Solution 4: Force redeploy
```bash
git commit --allow-empty -m "Force redeploy $(date +%s)"
git push
```

### Solution 5: Purge Netlify CDN cache
- Go to Netlify Dashboard → Site → Deploys → Production
- Click "..." menu → "Clear cache and retry deploy"

---

## 🔧 Supabase Configuration

### Environment Variables (Netlify)
```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Database Tables Required
```sql
-- Leads table for landing page gate
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  company TEXT,
  role TEXT,
  locations TEXT,
  source TEXT DEFAULT 'landing_page',
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menus
CREATE TABLE menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  layouts JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft',
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Devices
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  device_code TEXT UNIQUE,
  assigned_menu_id UUID REFERENCES menus(id),
  assigned_layout_index INTEGER,
  last_heartbeat TIMESTAMPTZ,
  status TEXT DEFAULT 'offline',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 📱 Kiosk API Endpoints

### Get Menu for Device
```
GET /api/kiosk/menu?device_code=XXXX-XXXX
Response: { menu, layout }
```

### Device Heartbeat
```
POST /api/devices/heartbeat
Body: { device_code, status }
```

---

## 🎨 Editor Features (Phase 2)

### Element Types
- `text` - Text block
- `image` - Image element
- `rectangle` - Box/rectangle shape
- `circle` - Circle shape
- `group` - Container for grouping elements
- `menu_item` - Menu item with name, description, price, image
- `menu_section` - Section header
- `price_list` - Price list table
- `combo` - Combo/special deal
- `category_header` - Category header
- `ticker` - Scrolling ticker

### Element Properties
```javascript
{
  type: 'menu_item',
  x: 100,
  y: 100,
  width: 400,
  height: 200,
  name: 'Item Name',
  hidden: false,      // Don't render in editor/kiosk
  locked: false,      // Prevent editing
  parentId: null,     // Group parent reference
  data: {
    name: 'Burger',
    description: 'Delicious burger',
    price: '$9.99',
    image: 'https://...',
    showImage: true
  },
  style: {
    fontSize: 24,
    color: '#ffffff',
    bgColor: 'rgba(0,0,0,0.6)',
    imageFit: 'cover',  // cover, contain, fill, none
    opacity: 100
  }
}
```

---

## 🔄 Sync Checklist When Making Changes

### If you change auth.js:
1. Update `/public/js/auth.js` in mOSm.cloud
2. Copy to `/apps/shell/dist/apps/js/auth.js` in modOSmenus
3. Deploy both platforms

### If you change kiosk rendering:
1. Update `/apps/shell/dist/apps/js/kiosk.js` in modOSmenus
2. Deploy modOSmenus only

### If you change editor:
1. Update `/public/editor.html` in mOSm.cloud
2. Deploy mOSm.cloud only
3. Test kiosk still renders correctly

### If you add new element types:
1. Add to editor.html (addElement, renderElement, getElementIcon)
2. Add to kiosk.js (renderElementContent)
3. Deploy both platforms

---

## 🐛 Common Issues

### ⚠️ "Changes not showing after deploy" - THE BIG ONE
**SOLUTION: USE CLI DEPLOY, NOT GIT PUSH**
```bash
# For mOSm.cloud
cd /Users/cffsmacmini/Documents/pitchmarketingagency.code-workspace/mOSm.cloud
npx netlify deploy --prod --dir=public

# For modOSmenus
cd /Users/cffsmacmini/Documents/pitchmarketingagency.code-workspace/modosmenus/modosmenus
npx netlify deploy --prod --dir=apps/shell/dist
```
**WHY?** GitHub auto-deploy integration is unreliable. The CDN doesn't always invalidate cache on git push. CLI deploy ALWAYS works.

To verify your changes are live:
```bash
curl -s https://mosm-cloud.netlify.app | head -20
```

### "Kiosk shows blank/black screen"
- Check browser console for errors
- Verify API returns layout with elements (not empty array)
- Check `elements.length > 0` condition
- Verify hidden elements are being skipped

### "Login not persisting"
- Check localStorage has `mosm_session`
- Verify Supabase session not expired
- Check auth.js is loaded (no 404)

### "Lead form not submitting"
- Check Netlify function logs
- Verify `leads` table exists in Supabase
- Check SUPABASE_SERVICE_KEY is set in Netlify env

---

## 📋 Pre-Deploy Checklist

- [ ] Make all code changes
- [ ] Run: `npx netlify deploy --prod --dir=public`
- [ ] Verify with: `curl -s https://mosm-cloud.netlify.app | head -20`
- [ ] Test in incognito browser
- [ ] Verify critical functionality:
  - [ ] Landing page loads
  - [ ] Login works
  - [ ] Dashboard loads
  - [ ] Editor saves/loads menus
  - [ ] Kiosk renders menu

---

## 🔗 URLs

| Platform | URL |
|----------|-----|
| mOSm.Cloud (Prod) | https://mosm-cloud.netlify.app |
| modOSmenus (Prod) | https://modosmenus.netlify.app |
| mOSm.Cloud Netlify Dashboard | https://app.netlify.com/sites/mosm-cloud |
| modOSmenus Netlify Dashboard | https://app.netlify.com/sites/modosmenus |
| Supabase Dashboard | https://app.supabase.com/project/YOUR_PROJECT |
| GitHub mOSm.cloud | https://github.com/solutionspma/mosm.cloud |

---

*Last updated: December 28, 2025*
