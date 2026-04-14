/**
 * Docs: right-hand “On this page” subnav from headings inside the article.
 */
(function () {
  function collectHeadings(main) {
    const out = [];
    for (const el of main.querySelectorAll('h2[id], h3[id], h4[id]')) {
      if (el.closest('.docs-pager')) continue;
      out.push(el);
    }
    return out;
  }

  function init() {
    const wrap = document.querySelector('.docs-main-wrap');
    const main = document.querySelector('main.docs-main');
    if (!wrap || !main) return;

    const headings = collectHeadings(main);
    if (!headings.length) return;

    const aside = document.createElement('aside');
    aside.className = 'docs-toc';
    aside.setAttribute('aria-label', 'On this page');

    const inner = document.createElement('div');
    inner.className = 'docs-toc-inner';

    const titleEl = document.createElement('div');
    titleEl.className = 'docs-toc-title';
    titleEl.textContent = 'On this page';

    const nav = document.createElement('nav');
    nav.className = 'docs-toc-nav';

    const ul = document.createElement('ul');
    ul.className = 'docs-toc-list';

    const links = [];

    for (const h of headings) {
      const level = Number(h.tagName.slice(1), 10);
      const li = document.createElement('li');
      li.className = 'docs-toc-item';
      const a = document.createElement('a');
      a.className = 'docs-toc-link';
      a.href = '#' + h.id;
      a.dataset.level = String(level);
      a.textContent = h.textContent.trim();
      li.appendChild(a);
      ul.appendChild(li);
      links.push({ id: h.id, el: a, heading: h });
    }

    nav.appendChild(ul);
    inner.appendChild(titleEl);
    inner.appendChild(nav);
    aside.appendChild(inner);
    wrap.classList.add('docs-main-wrap--with-toc');
    wrap.appendChild(aside);

    const scrollPad = 100;
    let raf = 0;

    function pickActiveId() {
      let current = headings[0].id;
      for (const { id, heading } of links) {
        const top = heading.getBoundingClientRect().top;
        if (top <= scrollPad) current = id;
        else break;
      }
      return current;
    }

    function updateActive() {
      const id = pickActiveId();
      for (const { id: lid, el } of links) {
        const on = lid === id;
        el.classList.toggle('docs-toc-link--active', on);
        if (on) el.setAttribute('aria-current', 'true');
        else el.removeAttribute('aria-current');
      }
    }

    function onScroll() {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        updateActive();
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    updateActive();

    if ('onhashchange' in window) {
      window.addEventListener('hashchange', () => {
        window.requestAnimationFrame(updateActive);
      });
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function flashHeadingById(rawId) {
      let id = rawId;
      try {
        id = decodeURIComponent(rawId);
      } catch {
        /* keep rawId */
      }
      const el = document.getElementById(id);
      if (!el || !main.contains(el)) return;

      const clearReduced = () => {
        el.classList.remove('docs-heading-jump-flash--reduced');
      };

      if (reducedMotion.matches) {
        if (el._docsJumpFlashTimer) window.clearTimeout(el._docsJumpFlashTimer);
        el.classList.remove('docs-heading-jump-flash');
        clearReduced();
        void el.offsetWidth;
        el.classList.add('docs-heading-jump-flash--reduced');
        el._docsJumpFlashTimer = window.setTimeout(() => {
          clearReduced();
          el._docsJumpFlashTimer = 0;
        }, 550);
        return;
      }

      if (el._docsJumpFlashTimer) window.clearTimeout(el._docsJumpFlashTimer);
      el.classList.remove('docs-heading-jump-flash');
      void el.offsetWidth;

      function onFlashEnd() {
        if (el._docsJumpFlashTimer) {
          window.clearTimeout(el._docsJumpFlashTimer);
          el._docsJumpFlashTimer = 0;
        }
        el.classList.remove('docs-heading-jump-flash');
      }

      el.addEventListener('animationend', onFlashEnd, { once: true });
      el.classList.add('docs-heading-jump-flash');
      el._docsJumpFlashTimer = window.setTimeout(onFlashEnd, 1200);
    }

    nav.addEventListener('click', (e) => {
      const a = e.target.closest('a.docs-toc-link');
      if (!a || !nav.contains(a)) return;
      let url;
      try {
        url = new URL(a.getAttribute('href') || '', window.location.href);
      } catch {
        return;
      }
      if (url.pathname !== window.location.pathname) return;
      const hash = url.hash.slice(1);
      if (!hash) return;

      queueMicrotask(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => flashHeadingById(hash));
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
