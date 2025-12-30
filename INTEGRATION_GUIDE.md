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
                              │ Direct Supabase REST API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        modOSmenus                               │
│                 (modosmenus.netlify.app)                        │
│                                                                 │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │ kiosk-selector  │ │ kiosk.html      │ │ (root landing)  │   │
│  │ (Menu Picker)   │ │ (Fullscreen)    │ │                 │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
│                                                                 │
│  Deploy: git push (auto-deploy via GitHub)                      │
│  Build: npm run build in apps/shell                             │
│  Publish: modosmenus/apps/shell/dist                            │
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
├── INTEGRATION_GUIDE.md        # THIS FILE
└── package.json
```

### modOSmenus Repository (Kiosk Shell)
```
modOSmenus/
└── modosmenus/
    └── apps/
        └── shell/
            ├── public/              # Source files
            │   └── apps/
            │       ├── kiosk-selector.html  # Menu selection page
            │       └── kiosk.html           # Fullscreen kiosk player
            └── dist/                # BUILD OUTPUT (auto-generated)
                └── apps/
                    ├── kiosk-selector.html
                    └── kiosk.html
```

---

## 🖥️ Kiosk System

### Kiosk URLs
| Page | URL | Description |
|------|-----|-------------|
| Kiosk Selector | https://modosmenus.netlify.app/apps/kiosk-selector.html | Shows all published menus |
| Kiosk Display | https://modosmenus.netlify.app/apps/kiosk.html?menu={UUID} | Fullscreen menu display |
| Home | https://modosmenus.netlify.app/ | Landing/home page |

### Kiosk Features
- **True fullscreen mode** - Fills entire screen, no borders
- **Auto-hide controls** - Back/Fullscreen buttons appear only on mouse movement (3s timeout)
- **Cursor hides** when inactive for clean display
- **Auto-rotate screens** - 10 second intervals for multi-screen layouts
- **Keyboard navigation** - Arrow keys, F for fullscreen, ESC to exit
- **Responsive scaling** - Uses `Math.max(scaleX, scaleY)` to cover entire viewport

### Kiosk Data Flow
```
kiosk-selector.html                    kiosk.html?menu={id}
      │                                       │
      │ Fetch published menus                 │ Fetch menu + layouts
      ▼                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ Supabase REST API (Direct fetch, NOT JS client)                 │
│                                                                 │
│ GET /rest/v1/menus?status=eq.published&select=id,name,status    │
│ GET /rest/v1/menus?id=eq.{uuid}&select=*                        │
│ GET /rest/v1/layouts?menu_id=eq.{uuid}&select=*&order=screen_index.asc │
│                                                                 │
│ Headers:                                                        │
│   apikey: {SERVICE_ROLE_KEY}                                    │
│   Authorization: Bearer {SERVICE_ROLE_KEY}                      │
└─────────────────────────────────────────────────────────────────┘
```

### Why Direct REST API Instead of Supabase JS Client?
The Supabase JS client was returning 0 results from cross-origin requests even though:
- The same query worked via curl
- RLS policies were correct
- Anon key had proper permissions

**Solution:** Use direct `fetch()` to Supabase REST API with service role key.

---

## 🔐 Supabase Configuration

### Credentials (BOTH PLATFORMS USE THESE)
```javascript
const SUPABASE_URL = 'https://agkrwcdvfraivfhttjrp.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFna3J3Y2R2ZnJhaXZmaHR0anJwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg1MTY5MiwiZXhwIjoyMDgyNDI3NjkyfQ.DuwTJdUHsOa2H3eGgz7fsPe4aejBtUVlV7CkUaL3Y0c';
```

### Environment Variables (Netlify)
Both sites need these in Netlify → Site Settings → Environment Variables:
```
SUPABASE_URL=https://agkrwcdvfraivfhttjrp.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Database Tables
```sql
-- Menus table
CREATE TABLE menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft',  -- 'draft' | 'published'
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Layouts table (separate from menus)
CREATE TABLE layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID REFERENCES menus(id) ON DELETE CASCADE,
  screen_index INTEGER DEFAULT 1,
  name TEXT DEFAULT 'Main',
  resolution TEXT DEFAULT '1080p',  -- '720p' | '1080p' | '4k'
  aspect_ratio TEXT DEFAULT '16:9',
  orientation TEXT DEFAULT 'landscape',  -- 'landscape' | 'portrait'
  safe_zone TEXT DEFAULT 'tv_1080p',
  elements JSONB DEFAULT '[]',
  background JSONB DEFAULT '{"type": "color", "color": "#1a1a2e"}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Layout Background Structure
```javascript
background: {
  type: 'color' | 'image' | 'gradient',
  color: '#1a1a2e',        // Always present as fallback
  value: 'https://...'     // Image URL or gradient CSS
}
```

### Element Types (Kiosk Renderer Supports)
| Type | Description | Data Properties |
|------|-------------|-----------------|
| `category_header` | Section header with icon | `icon`, `title`, `subtitle` |
| `menu_section` | Section divider | `title`, `showDivider` |
| `menu_item` | Food item | `name`, `description`, `price`, `image`, `showImage` |
| `price_list` | Multiple price items | `items: [{name, price}]` |
| `ticker` | Scrolling text | `messages: []`, `speed` |
| `text` | Plain text | `text` |
| `image` | Image element | `src` or `url` |
| `shape` | Rectangle/circle | `fill`, `borderRadius` |

---

## 🚀 Deployment

### modOSmenus (Git Push Auto-Deploy)
```bash
cd /Users/cffsmacmini/Documents/pitchmarketingagency.code-workspace/modOSmenus
git add -A && git commit -m "Your message" && git push
# Netlify auto-deploys from GitHub
# Build command: npm install && npm run build
# Publish directory: modosmenus/apps/shell/dist
```

### mOSm.Cloud (Git Push or CLI)
```bash
cd /Users/cffsmacmini/Documents/pitchmarketingagency.code-workspace/mOSm.cloud
git add -A && git commit -m "Your message" && git push
# OR direct CLI deploy:
npx netlify deploy --prod --dir=public
```

---

## 🎨 Editor → Kiosk Data Flow

### Menu Creation Flow
1. User creates menu in mOSm.Cloud dashboard
2. Menu saved to `menus` table with `organization_id`
3. User opens editor → creates layouts
4. Layouts saved to `layouts` table with `menu_id`
5. User publishes menu (`status: 'published'`)
6. Kiosk selector shows published menus
7. Kiosk player renders layouts for selected menu

### Element Rendering in Kiosk
```javascript
// Kiosk reads layout.elements directly (NOT layout.content.elements)
const elements = layout.elements || [];
const background = layout.background || {};

// Each element has:
{
  type: 'menu_item',
  x: 100,           // Position from left
  y: 200,           // Position from top
  width: 350,       // Element width
  height: 100,      // Element height
  hidden: false,    // Skip rendering if true
  data: {           // Type-specific data
    name: 'Tacos',
    price: '$15.99',
    description: 'Angus beef, lettuce, tomato',
    image: 'https://...',
    showImage: true
  },
  style: {          // Type-specific styling
    fontSize: 20,
    color: '#ffffff',
    bgColor: 'rgba(0,0,0,0.5)',
    imageFit: 'cover'
  }
}
```

---

## 🐛 Troubleshooting

### "Kiosk shows 'No menus found'"
1. Check menus have `status: 'published'` in database
2. Check Supabase URL and service key are correct
3. Open browser console → Network tab → check API responses
4. Verify: `curl "https://agkrwcdvfraivfhttjrp.supabase.co/rest/v1/menus?status=eq.published" -H "apikey: {KEY}"`

### "Kiosk shows menu but content is blank"
1. Check `layouts` table has records for that `menu_id`
2. Verify `layout.elements` is an array (not nested in `content`)
3. Check browser console for rendering errors
4. Verify element positions are within viewport

### "Controls not hiding"
- Controls auto-hide after 3 seconds of inactivity
- Move mouse to show, then stop moving
- Check `HIDE_CONTROLS_DELAY = 3000` in kiosk.html

### "Gray bars on sides of fullscreen"
- Fixed: Kiosk now uses `Math.max(scaleX, scaleY)` to cover viewport
- Content scales up to fill, may crop edges slightly

### "Changes not showing after deploy"
1. Wait 2-3 minutes for Netlify build
2. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
3. Check Netlify deploy logs for build success
4. Verify correct file was edited (public/ vs dist/)

---

## 🔗 URLs Reference

| Resource | URL |
|----------|-----|
| **mOSm.Cloud** | https://mosm-cloud.netlify.app |
| **modOSmenus** | https://modosmenus.netlify.app |
| **Kiosk Selector** | https://modosmenus.netlify.app/apps/kiosk-selector.html |
| **Supabase Dashboard** | https://supabase.com/dashboard/project/agkrwcdvfraivfhttjrp |
| **Netlify mOSm.Cloud** | https://app.netlify.com/sites/mosm-cloud |
| **Netlify modOSmenus** | https://app.netlify.com/sites/modosmenus |
| **GitHub mOSm.cloud** | https://github.com/solutionspma/mosm.cloud |
| **GitHub modOSmenus** | https://github.com/solutionspma/modOSmenus |

---

## ✅ Current Status (December 29, 2025)

### Working ✅
- [x] Kiosk selector shows all published menus
- [x] Kiosk player renders menu layouts
- [x] True fullscreen mode (fills entire screen)
- [x] Auto-hide controls on inactivity
- [x] All element types render (category_header, menu_item, price_list, ticker, etc.)
- [x] Background images display correctly
- [x] Multi-screen auto-rotation (10s intervals)
- [x] Keyboard navigation (arrows, F, ESC)
- [x] Back button goes to root (/)

### Known Issues
- Footer ticker removed from kiosk (was interfering with safe zones)
- Global ticker/messaging system planned for master account control

---

*Last updated: December 29, 2025*
