/**
 * Docs site: fuzzy search powered by MiniSearch.
 * Fetches a build-time JSON index and renders results in the sidebar.
 * When navigating to a result, matched terms are highlighted on the target page.
 */
(function () {
  const MAX_RESULTS = 10;
  const HIGHLIGHT_PARAM = 'highlight';

  function getDocsRoot() {
    const loc = window.location.pathname;
    const idx = loc.lastIndexOf('/docs/');
    if (idx !== -1) return loc.slice(0, idx + '/docs/'.length);
    if (loc.endsWith('/docs') || loc.endsWith('/docs/')) {
      return loc.endsWith('/') ? loc : loc + '/';
    }
    return './';
  }

  let miniSearch = null;
  let indexDocs = null;
  let fetchPromise = null;

  function ensureIndex() {
    if (fetchPromise) return fetchPromise;
    const url = getDocsRoot() + 'search-index.json';
    fetchPromise = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then((docs) => {
        indexDocs = docs;
        miniSearch = new MiniSearch({
          fields: ['pageTitle', 'section', 'content'],
          storeFields: ['pageTitle', 'section', 'url', 'hash', 'level'],
          searchOptions: {
            boost: { section: 2, pageTitle: 1.5 },
            fuzzy: 0.2,
            prefix: true,
          },
        });
        miniSearch.addAll(docs);
      })
      .catch((err) => {
        console.warn('docs-search: failed to load index', err);
        fetchPromise = null;
      });
    return fetchPromise;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** Build the href for a result, appending ?highlight= with matched document terms. */
  function resultHref(result) {
    const base = getDocsRoot() + result.url;
    const terms = result.match ? Object.keys(result.match) : [];
    const qs = terms.length ? '?' + HIGHLIGHT_PARAM + '=' + encodeURIComponent(terms.join(' ')) : '';
    return (result.hash ? base + qs + '#' + result.hash : base + qs);
  }

  function renderResults(results, listEl) {
    if (!results.length) {
      listEl.innerHTML = '<li class="docs-search-empty" role="option">No results found</li>';
      listEl.hidden = false;
      return;
    }
    const items = results.slice(0, MAX_RESULTS).map((r, i) => {
      const href = escapeHtml(resultHref(r));
      const page = escapeHtml(r.pageTitle);
      const section = r.level > 1 ? escapeHtml(r.section) : '';
      const label = section && section !== page
        ? `<span class="docs-search-page">${page}</span><span class="docs-search-sep">&rsaquo;</span><span class="docs-search-section">${section}</span>`
        : `<span class="docs-search-page">${page}</span>`;
      return `<li class="docs-search-result" role="option" data-idx="${i}"><a class="docs-search-result-link" href="${href}" tabindex="-1">${label}</a></li>`;
    });
    listEl.innerHTML = items.join('');
    listEl.hidden = false;
  }

  // ── Highlight matched terms on the destination page ──────────────────

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Walk text nodes inside `root` and wrap case-insensitive whole-word
   * occurrences of any term in <mark> tags.
   */
  function highlightTermsInNode(root, terms) {
    if (!terms.length) return;
    const pattern = new RegExp(
      '\\b(' + terms.map(escapeRegExp).join('|') + ')\\b',
      'gi',
    );

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    for (const node of textNodes) {
      if (!pattern.test(node.nodeValue)) continue;
      // Skip nodes inside syntax-highlighted code blocks or existing <mark>
      if (node.parentElement && node.parentElement.closest('pre, mark')) continue;

      const frag = document.createDocumentFragment();
      let last = 0;
      pattern.lastIndex = 0;
      let m;
      while ((m = pattern.exec(node.nodeValue)) !== null) {
        if (m.index > last) {
          frag.appendChild(document.createTextNode(node.nodeValue.slice(last, m.index)));
        }
        const mark = document.createElement('mark');
        mark.className = 'docs-search-highlight';
        mark.textContent = m[0];
        frag.appendChild(mark);
        last = m.index + m[0].length;
      }
      if (last < node.nodeValue.length) {
        frag.appendChild(document.createTextNode(node.nodeValue.slice(last)));
      }
      node.parentNode.replaceChild(frag, node);
    }
  }

  function applyHighlightsFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get(HIGHLIGHT_PARAM);
    if (!raw) return;

    const terms = raw.split(/\s+/).filter(Boolean);
    if (!terms.length) return;

    const main = document.querySelector('.docs-main');
    if (!main) return;

    highlightTermsInNode(main, terms);

    // One-shot highlight: remove the query param so refresh doesn't reapply.
    params.delete(HIGHLIGHT_PARAM);
    const query = params.toString();
    const cleanedUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', cleanedUrl);

    // Scroll the first highlight into view (after the browser's own hash scroll)
    requestAnimationFrame(() => {
      const first = main.querySelector('.docs-search-highlight');
      if (first && !window.location.hash) {
        first.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });
  }

  // ── Search UI setup ──────────────────────────────────────────────────

  function setup() {
    applyHighlightsFromUrl();

    const input = document.querySelector('.docs-search-input');
    const listEl = document.querySelector('.docs-search-results');
    if (!input || !listEl) return;

    let activeIdx = -1;
    let currentResults = [];

    function clearResults() {
      listEl.innerHTML = '';
      listEl.hidden = true;
      activeIdx = -1;
      currentResults = [];
    }

    function setActive(idx) {
      const items = listEl.querySelectorAll('.docs-search-result');
      if (activeIdx >= 0 && activeIdx < items.length) {
        items[activeIdx].classList.remove('docs-search-result--active');
      }
      activeIdx = idx;
      if (activeIdx >= 0 && activeIdx < items.length) {
        items[activeIdx].classList.add('docs-search-result--active');
        items[activeIdx].scrollIntoView({ block: 'nearest' });
      }
    }

    function navigate(result) {
      window.location.href = resultHref(result);
    }

    input.addEventListener('input', () => {
      const query = input.value.trim();
      if (!query) {
        clearResults();
        return;
      }
      ensureIndex().then(() => {
        if (!miniSearch) return;
        const q = input.value.trim();
        if (!q) { clearResults(); return; }
        currentResults = miniSearch.search(q);
        renderResults(currentResults, listEl);
        activeIdx = -1;
      });
    });

    input.addEventListener('keydown', (e) => {
      if (listEl.hidden || !currentResults.length) return;
      const count = Math.min(currentResults.length, MAX_RESULTS);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(activeIdx < count - 1 ? activeIdx + 1 : 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(activeIdx > 0 ? activeIdx - 1 : count - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const idx = activeIdx >= 0 ? activeIdx : 0;
        if (currentResults[idx]) navigate(currentResults[idx]);
      } else if (e.key === 'Escape') {
        clearResults();
        input.blur();
      }
    });

    listEl.addEventListener('click', (e) => {
      const link = e.target.closest('.docs-search-result-link');
      if (link) return; // let normal navigation happen
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.docs-search')) {
        clearResults();
      }
    });

    // Pre-fetch the index on focus for snappy first searches
    input.addEventListener('focus', () => ensureIndex(), { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
