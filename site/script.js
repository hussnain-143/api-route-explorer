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
    'POST /api/v1/auth/login': {
      method: 'POST',
      path: '/api/v1/auth/login',
      url: 'http://localhost:5000/api/v1/auth/login',
      response: '{\n  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",\n  "expiresIn": 3600,\n  "status": "authenticated"\n}',
    },
    'DELETE /api/v1/items/:id': {
      method: 'DELETE',
      path: '/api/v1/items/{id}',
      url: 'http://localhost:5000/api/v1/items/itm_4011',
      response: '{\n  "success": true,\n  "deletedId": "itm_4011"\n}',
    },
    'GET /api/v1/admin/bookings': {
      method: 'GET',
      path: '/api/v1/admin/bookings',
      url: 'http://localhost:5000/api/v1/admin/bookings?status=confirmed',
      response: '{\n  "total": 42,\n  "page": 1,\n  "bookings": [\n    { "id": "bk_01", "service": "Deep Clean" }\n  ]\n}',
    },
  };

  routeItems.forEach((item) => {
    item.addEventListener('click', () => {
      routeItems.forEach((r) => r.classList.remove('active'));
      item.classList.add('active');

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
