/**
 * Docs site: sidebar "page -> headings" expander.
 *
 * Behavior:
 * - When you navigate to a page, that page expands a nested list of its headings.
 * - Clicking the active page in the sidebar toggles that headings list (collapse/expand).
 * - Clicking a heading navigates to `page#heading-id`.
 */
(function () {
  const PAGE_LINK_SELECTOR = '.docs-sidebar a.docs-sidebar-link, .docs-sidebar a.docs-sidebar-section-link';
  const EXPANDED_ATTR = 'data-docs-headings-expanded';
  const HEADINGS_LIST_CLASS = 'docs-sidebar-page-headings';

  function isPlainLeftClick(e) {
    return (
      e.button === 0 &&
      !e.defaultPrevented &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.shiftKey &&
      !e.altKey
    );
  }

  function collapseAll() {
    const lists = document.querySelectorAll(`.${HEADINGS_LIST_CLASS}`);
    for (const ul of lists) ul.remove();
    const expandedLinks = document.querySelectorAll(`[${EXPANDED_ATTR}="true"]`);
    for (const a of expandedLinks) {
      a.setAttribute(EXPANDED_ATTR, 'false');
      a.setAttribute('aria-expanded', 'false');
    }
  }

  function getPageHref(a) {
    // Use the resolved href (absolute), but keep it same-origin.
    try {
      return new URL(a.getAttribute('href') || '', window.location.href).toString();
    } catch {
      return null;
    }
  }

  function getHeadingText(h) {
    // Prefer visible text; fall back to id.
    const t = (h.textContent || '').trim().replace(/\s+/g, ' ');
    return t || h.id || 'Section';
  }

  function getHeadingLevel(h) {
    const m = /^H(\d)$/i.exec(h.tagName);
    return m ? Number(m[1]) : 2;
  }

  function headingsFromDocument(doc) {
    const main = doc.querySelector('main.docs-main');
    if (!main) return [];

    // Keep the list useful: show h2 + h3 by default (skip h1).
    const hs = Array.from(main.querySelectorAll('h2[id], h3[id]'));
    return hs.map((h) => ({
      id: h.id,
      text: getHeadingText(h),
      level: getHeadingLevel(h),
    }));
  }

  async function fetchHeadings(pageHref) {
    const res = await fetch(pageHref, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return headingsFromDocument(doc);
  }

  function buildHeadingsList(pageHref, headings) {
    const ul = document.createElement('ul');
    ul.className = `docs-sidebar-list docs-sidebar-list--nested ${HEADINGS_LIST_CLASS}`;
    ul.setAttribute('role', 'list');

    for (const h of headings) {
      const li = document.createElement('li');
      li.className = 'docs-sidebar-item';

      const a = document.createElement('a');
      a.className = 'docs-sidebar-link docs-sidebar-link--heading';
      a.textContent = h.text;
      a.href = pageHref + '#' + h.id;
      a.setAttribute('data-docs-heading-level', String(h.level));

      li.appendChild(a);
      ul.appendChild(li);
    }
    return ul;
  }

  function insertAfter(el, newEl) {
    const parent = el.parentNode;
    if (!parent) return;
    if (el.nextSibling) parent.insertBefore(newEl, el.nextSibling);
    else parent.appendChild(newEl);
  }

  async function toggleForLink(a, { preferCurrentDocument = false } = {}) {
    const li = a.closest('li');
    if (!li) return;
    const pageHref = getPageHref(a);
    if (!pageHref) return;

    const alreadyExpanded = a.getAttribute(EXPANDED_ATTR) === 'true';
    collapseAll();
    if (alreadyExpanded) return;

    a.setAttribute(EXPANDED_ATTR, 'true');
    a.setAttribute('aria-expanded', 'true');

    // If we already have a nested list under this li (API sub-sections), don't
    // treat it as the headings list; we add ours separately.
    let anchorNode = a.closest('.docs-sidebar-section-head') || a;

    try {
      const headings = preferCurrentDocument ? headingsFromDocument(document) : await fetchHeadings(pageHref);
      if (!headings.length) return;
      const ul = buildHeadingsList(pageHref, headings);
      insertAfter(anchorNode, ul);
    } catch (err) {
      // Fail silently; sidebar should remain usable even without fetch.
      a.setAttribute(EXPANDED_ATTR, 'false');
      console.warn('docs-sidebar-headings: failed to expand headings', err);
    }
  }

  function setup() {
    const sidebar = document.querySelector('.docs-sidebar');
    if (!sidebar) return;

    // Add arrow affordance to all top-level links in the "Articles" and
    // "API Docs" sections.
    const rootList = sidebar.querySelector('.docs-sidebar-list');
    if (rootList) {
      const children = Array.from(rootList.children);
      let inArrowSection = false;
      for (const child of children) {
        if (child.classList.contains('docs-sidebar-title')) {
          const label = (child.textContent || '').trim().toLowerCase();
          inArrowSection = label === 'articles' || label === 'api docs';
          continue;
        }
        if (!inArrowSection) continue;

        const articleLink =
          child.querySelector(':scope > a.docs-sidebar-link') ||
          child.querySelector(':scope > .docs-sidebar-section-head > a.docs-sidebar-section-link');
        if (!articleLink) continue;

        articleLink.classList.add('docs-sidebar-link--toggleable');
        if (!articleLink.hasAttribute('aria-expanded')) {
          articleLink.setAttribute('aria-expanded', 'false');
        }
      }

      // API section has 4 additional nested page links; give them the same
      // arrow affordance as top-level pages.
      const apiTitle = children.find(
        (child) =>
          child.classList &&
          child.classList.contains('docs-sidebar-title') &&
          ((child.textContent || '').trim().toLowerCase() === 'api docs')
      );
      if (apiTitle) {
        let apiContainer = apiTitle.nextElementSibling;
        while (apiContainer && apiContainer.classList.contains('docs-sidebar-title')) {
          apiContainer = apiContainer.nextElementSibling;
        }
        if (apiContainer) {
          const nestedApiLinks = apiContainer.querySelectorAll(
            '.docs-sidebar-list--nested a.docs-sidebar-link[href], .docs-sidebar-list--nested a.docs-sidebar-section-link[href]'
          );
          for (const link of nestedApiLinks) {
            link.classList.add('docs-sidebar-link--toggleable');
            if (!link.hasAttribute('aria-expanded')) {
              link.setAttribute('aria-expanded', 'false');
            }
          }
        }
      }
    }

    // Auto-expand the current page on load.
    const activeLink = sidebar.querySelector('a[aria-current="page"]');
    if (activeLink) {
      toggleForLink(activeLink, { preferCurrentDocument: true });
    }

    sidebar.addEventListener('click', (e) => {
      const a = e.target.closest(PAGE_LINK_SELECTOR);
      if (!a) return;
      if (!isPlainLeftClick(e)) return;

      // Only intercept clicks inside the sidebar navigation.
      if (!sidebar.contains(a)) return;

      // If it's a heading link (generated by us), let default navigation happen.
      if (a.classList.contains('docs-sidebar-link--heading')) return;

      // Only toggle when clicking the *current* page item.
      if (a.getAttribute('aria-current') !== 'page') return;

      e.preventDefault();
      toggleForLink(a, { preferCurrentDocument: true });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();

