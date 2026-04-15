/**
 * Docs: mobile navigation drawer (article-first layout; sidebar slides in from the left).
 */
(function () {
  const MQ = '(max-width: 900px)';
  const OPEN_CLASS = 'docs-nav-drawer-open';

  function mqMatches() {
    return window.matchMedia(MQ).matches;
  }

  function init() {
    const menuBtn = document.getElementById('docs-nav-menu-btn');
    const backdrop = document.getElementById('docs-nav-backdrop');
    const sidebar = document.getElementById('docs-sidebar');
    const body = document.body;
    if (!menuBtn || !sidebar) return;

    const mq = window.matchMedia(MQ);

    function isOpen() {
      return body.classList.contains(OPEN_CLASS);
    }

    function setOpen(open) {
      if (!mqMatches()) return;

      body.classList.toggle(OPEN_CLASS, open);
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuBtn.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');

      if (backdrop) {
        backdrop.hidden = !open;
        backdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
      }

      if (open) {
        sidebar.removeAttribute('inert');
        sidebar.removeAttribute('aria-hidden');
        document.body.style.overflow = 'hidden';
        const focusTarget =
          sidebar.querySelector('.docs-search-input') || sidebar.querySelector('a[href]');
        if (focusTarget && typeof focusTarget.focus === 'function') {
          focusTarget.focus({ preventScroll: true });
        }
      } else {
        sidebar.setAttribute('inert', '');
        sidebar.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (document.activeElement && sidebar.contains(document.activeElement)) {
          menuBtn.focus({ preventScroll: true });
        }
      }
    }

    function syncForViewport() {
      if (!mqMatches()) {
        body.classList.remove(OPEN_CLASS);
        document.body.style.overflow = '';
        sidebar.removeAttribute('inert');
        sidebar.removeAttribute('aria-hidden');
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.setAttribute('aria-label', 'Open navigation menu');
        if (backdrop) {
          backdrop.hidden = true;
          backdrop.setAttribute('aria-hidden', 'true');
        }
        return;
      }

      if (isOpen()) {
        sidebar.removeAttribute('inert');
        sidebar.removeAttribute('aria-hidden');
      } else {
        sidebar.setAttribute('inert', '');
        sidebar.setAttribute('aria-hidden', 'true');
      }
    }

    menuBtn.addEventListener('click', () => {
      if (!mqMatches()) return;
      setOpen(!isOpen());
    });

    if (backdrop) {
      backdrop.addEventListener('click', () => setOpen(false));
    }

    sidebar.addEventListener('click', (e) => {
      if (!mqMatches() || !isOpen()) return;
      const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || !sidebar.contains(a)) return;
      setOpen(false);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mqMatches() && isOpen()) {
        e.preventDefault();
        setOpen(false);
      }
    });

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', syncForViewport);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(syncForViewport);
    }

    syncForViewport();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
