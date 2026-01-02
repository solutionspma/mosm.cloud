/**
 * Shared Navigation Component
 * 
 * DESIGN PRINCIPLE:
 * - Presentation-only (no auth logic embedded)
 * - Same look, same feel across platforms
 * - Platform-specific links disabled via config
 * 
 * Use:
 * - mOSm.cloud: Full navigation
 * - modOSmenus: Menu kiosk context only
 */

(function() {
  'use strict';
  
  const SharedNav = {
    /**
     * CSS Variables (can be overridden)
     */
    cssVars: {
      '--nav-bg': '#1a1a2e',
      '--nav-border': 'rgba(255, 255, 255, 0.1)',
      '--nav-text': '#ffffff',
      '--nav-text-muted': 'rgba(255, 255, 255, 0.7)',
      '--nav-accent': '#00d4ff',
      '--nav-hover': '#252540',
    },
    
    /**
     * Navigation items configuration
     */
    navItems: [
      { id: 'dashboard', label: 'Dashboard', icon: '📊', href: '/dashboard.html', platforms: ['mosm.cloud'] },
      { id: 'menus', label: 'Menus', icon: '📋', href: '/menus.html', platforms: ['mosm.cloud', 'modosmenus'] },
      { id: 'screens', label: 'Screens', icon: '🖥️', href: '/screens.html', platforms: ['mosm.cloud'] },
      { id: 'devices', label: 'Devices', icon: '📱', href: '/devices.html', platforms: ['mosm.cloud'] },
      { id: 'layouts', label: 'Layouts', icon: '📐', href: '/layouts.html', platforms: ['mosm.cloud', 'modosmenus'] },
      { id: 'billing', label: 'Billing', icon: '💳', href: '/billing.html', platforms: ['mosm.cloud'] },
      { id: 'settings', label: 'Settings', icon: '⚙️', href: '/settings.html', platforms: ['mosm.cloud'] },
    ],
    
    /**
     * Inject CSS styles
     */
    injectStyles: function() {
      if (document.getElementById('shared-nav-styles')) return;
      
      const style = document.createElement('style');
      style.id = 'shared-nav-styles';
      style.textContent = `
        .shared-nav-header {
          background: var(--nav-bg, #1a1a2e);
          border-bottom: 1px solid var(--nav-border, rgba(255, 255, 255, 0.1));
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 60px;
          position: sticky;
          top: 0;
          z-index: 1000;
        }
        
        .shared-nav-left {
          display: flex;
          align-items: center;
          gap: 32px;
        }
        
        .shared-nav-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          color: var(--nav-text, #fff);
        }
        
        .shared-nav-logo img {
          height: 32px;
          width: auto;
        }
        
        .shared-nav-logo-text {
          font-size: 18px;
          font-weight: 600;
        }
        
        .shared-nav-logo-text .accent {
          color: var(--nav-accent, #00d4ff);
        }
        
        .shared-nav-menu {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .shared-nav-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: 8px;
          color: var(--nav-text-muted, rgba(255, 255, 255, 0.7));
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
          cursor: pointer;
        }
        
        .shared-nav-item:hover {
          background: var(--nav-hover, #252540);
          color: var(--nav-text, #fff);
        }
        
        .shared-nav-item.active {
          background: rgba(0, 212, 255, 0.15);
          color: var(--nav-accent, #00d4ff);
        }
        
        .shared-nav-item.disabled {
          opacity: 0.4;
          cursor: not-allowed;
          pointer-events: none;
        }
        
        .shared-nav-item-icon {
          font-size: 16px;
        }
        
        .shared-nav-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .shared-nav-user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 12px;
          border-radius: 8px;
          background: var(--nav-hover, #252540);
          cursor: pointer;
        }
        
        .shared-nav-avatar {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: linear-gradient(135deg, #00d4ff, #7c3aed);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
        }
        
        .shared-nav-user-email {
          font-size: 13px;
          color: var(--nav-text-muted, rgba(255, 255, 255, 0.7));
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        /* Ensure body has proper spacing */
        body.has-shared-nav {
          padding-top: 0;
        }
        
        body.has-shared-nav .main-content,
        body.has-shared-nav main {
          min-height: calc(100vh - 60px);
        }
      `;
      document.head.appendChild(style);
    },
    
    /**
     * Render the navigation
     */
    render: function(config) {
      config = config || {};
      const platform = config.platform || 'mosm.cloud';
      const activePage = config.activePage || '';
      const user = config.user || null;
      const logoSrc = config.logoSrc || '/images/logo.png';
      
      this.injectStyles();
      
      // Filter nav items for platform
      const visibleItems = this.navItems.filter(function(item) {
        return item.platforms.includes(platform);
      });
      
      // Build nav items HTML
      let navItemsHtml = visibleItems.map(function(item) {
        const isActive = item.id === activePage ? ' active' : '';
        const isDisabled = !item.platforms.includes(platform) ? ' disabled' : '';
        return `
          <a href="${item.href}" class="shared-nav-item${isActive}${isDisabled}" data-nav-id="${item.id}">
            <span class="shared-nav-item-icon">${item.icon}</span>
            <span>${item.label}</span>
          </a>
        `;
      }).join('');
      
      // Build user section
      let userHtml = '';
      if (user && user.email) {
        const initials = user.email.substring(0, 2).toUpperCase();
        userHtml = `
          <div class="shared-nav-user" id="shared-nav-user-btn">
            <div class="shared-nav-avatar">${initials}</div>
            <span class="shared-nav-user-email">${user.email}</span>
          </div>
        `;
      }
      
      // Build complete nav HTML
      const navHtml = `
        <nav class="shared-nav-header" id="shared-nav">
          <div class="shared-nav-left">
            <a href="/" class="shared-nav-logo">
              <img src="${logoSrc}" alt="Logo">
              <span class="shared-nav-logo-text">
                ${platform === 'mosm.cloud' ? 'mOSm<span class="accent">.cloud</span>' : 'mod<span class="accent">OS</span>menus'}
              </span>
            </a>
            <div class="shared-nav-menu">
              ${navItemsHtml}
            </div>
          </div>
          <div class="shared-nav-right">
            ${userHtml}
          </div>
        </nav>
      `;
      
      // Insert into DOM
      const existingNav = document.getElementById('shared-nav');
      if (existingNav) {
        existingNav.outerHTML = navHtml;
      } else {
        document.body.insertAdjacentHTML('afterbegin', navHtml);
      }
      
      document.body.classList.add('has-shared-nav');
      
      // Bind user click handler
      if (config.onUserClick) {
        const userBtn = document.getElementById('shared-nav-user-btn');
        if (userBtn) {
          userBtn.onclick = config.onUserClick;
        }
      }
      
      return document.getElementById('shared-nav');
    },
    
    /**
     * Update active page
     */
    setActivePage: function(pageId) {
      const items = document.querySelectorAll('.shared-nav-item');
      items.forEach(function(item) {
        item.classList.remove('active');
        if (item.dataset.navId === pageId) {
          item.classList.add('active');
        }
      });
    },
    
    /**
     * Update user info
     */
    setUser: function(user) {
      const avatar = document.querySelector('.shared-nav-avatar');
      const email = document.querySelector('.shared-nav-user-email');
      
      if (user && user.email) {
        if (avatar) avatar.textContent = user.email.substring(0, 2).toUpperCase();
        if (email) email.textContent = user.email;
      }
    },
    
    /**
     * Remove the navigation
     */
    destroy: function() {
      const nav = document.getElementById('shared-nav');
      if (nav) nav.remove();
      document.body.classList.remove('has-shared-nav');
    },
  };
  
  // Expose globally
  window.SharedNav = SharedNav;
  
  console.log('[SharedNav] Component loaded');
})();
