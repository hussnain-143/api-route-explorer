/**
 * API Route Explorer — Public Website Interactive Script
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Theme Toggle (Dark / Light)
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const themeIcon = document.getElementById('theme-icon');

  function getPreferredTheme() {
    const saved = localStorage.getItem('are_theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('are_theme', theme);
    if (themeIcon) {
      themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
    }
  }

  applyTheme(getPreferredTheme());

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  }

  // 2. Copy Installation Command
  const copyCmdBtn = document.getElementById('copy-cmd-btn');
  const installCmdText = document.getElementById('install-cmd-text');

  if (copyCmdBtn && installCmdText) {
    copyCmdBtn.addEventListener('click', async () => {
      const text = installCmdText.textContent.trim();
      try {
        await navigator.clipboard.writeText(text);
        const originalText = copyCmdBtn.textContent;
        copyCmdBtn.textContent = '✓ Copied';
        copyCmdBtn.style.color = 'var(--emerald-primary)';
        setTimeout(() => {
          copyCmdBtn.textContent = originalText;
          copyCmdBtn.style.color = '';
        }, 2000);
      } catch (err) {
        console.error('Clipboard copy failed:', err);
      }
    });
  }

  // 3. Interactive Route Selection in Editor Mockup
  const routeItems = document.querySelectorAll('.route-item-mock');
  const mockupSignature = document.getElementById('mockup-signature');
  const mockupUrlInput = document.getElementById('mockup-url-input');
  const mockupResponsePre = document.getElementById('mockup-response-pre');

  const routePresets = {
    'GET /api/v1/users/:id': {
      method: 'GET',
      path: '/api/v1/users/{id}',
      url: 'http://localhost:5000/api/v1/users/usr_99182',
      response: '{\n  "id": "usr_99182",\n  "name": "Alex Mercer",\n  "role": "engineer",\n  "verified": true\n}',
    },
    'GET /api/v1/users': {
      method: 'GET',
      path: '/api/v1/users',
      url: 'http://localhost:5000/api/v1/users?limit=10',
      response: '{\n  "total": 128,\n  "page": 1,\n  "users": [\n    { "id": "usr_01", "name": "Sarah Connor" },\n    { "id": "usr_02", "name": "John Doe" }\n  ]\n}',
    },
    'POST /api/v1/auth/login': {
      method: 'POST',
      path: '/api/v1/auth/login',
      url: 'http://localhost:5000/api/v1/auth/login',
      response: '{\n  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",\n  "expiresIn": 3600,\n  "status": "authenticated"\n}',
    },
    'POST /api/v1/auth/register': {
      method: 'POST',
      path: '/api/v1/auth/register',
      url: 'http://localhost:5000/api/v1/auth/register',
      response: '{\n  "id": "usr_104",\n  "email": "developer@antigravity.io",\n  "created": true\n}',
    },
    'GET /api/v1/products': {
      method: 'GET',
      path: '/api/v1/products',
      url: 'http://localhost:5000/api/v1/products',
      response: '{\n  "items": [\n    { "sku": "PRD_01", "name": "Pro License", "price": 49 }\n  ]\n}',
    },
    'POST /api/v1/products': {
      method: 'POST',
      path: '/api/v1/products',
      url: 'http://localhost:5000/api/v1/products',
      response: '{\n  "sku": "PRD_99",\n  "created": true,\n  "status": "active"\n}',
    },
  };

  routeItems.forEach((item) => {
    item.addEventListener('click', () => {
      // Remove active and jump-arrow from all items
      routeItems.forEach((r) => {
        r.classList.remove('active');
        const arrow = r.querySelector('.jump-arrow');
        if (arrow) arrow.remove();
      });

      // Mark this item active and add jump arrow
      item.classList.add('active');
      const arrowSpan = document.createElement('span');
      arrowSpan.className = 'jump-arrow';
      arrowSpan.title = '1-Click AST Jump';
      arrowSpan.textContent = '→';
      item.appendChild(arrowSpan);

      const routeKey = item.getAttribute('data-route');
      const preset = routePresets[routeKey];
      if (preset && mockupSignature && mockupUrlInput && mockupResponsePre) {
        mockupSignature.textContent = `${preset.method} ${preset.path}`;
        mockupUrlInput.value = preset.url;
        mockupResponsePre.textContent = preset.response;
      }
    });
  });
});
