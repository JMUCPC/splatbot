/**
 * Docs site: add a labeled code toolbar + copy button to fenced code blocks.
 * “Try it out” is added only for Python blocks that pass `splatbotLooksLikeRunnableBot` (see js/bot-runnable.js).
 * Opens a minimal in-page game preview (same engine as the main app) in a modal.
 */
(function () {
  const DOCS_IMPORT_KEY = 'splatbot_import_bot_p1_v1';
  const DOCS_IMPORT_FLAG = 'importBotP1';

  /** @type {{ source: string, createdAt: number, version: number } | null} */
  let lastTryPayload = null;

  /** @type {{ root: HTMLElement, mountEl: HTMLElement, closeBtn: HTMLButtonElement, titleEl: HTMLElement } | null} */
  let tryPreviewEls = null;

  /** @type {(() => void) | null} */
  let tryPreviewDestroyMini = null;

  /** @type {HTMLElement | null} */
  let tryPreviewFocusBefore = null;

  /** @type {((e: KeyboardEvent) => void) | null} */
  let tryPreviewKeydownHandler = null;

  const LANG_LABELS = {
    js: 'JavaScript',
    ts: 'TypeScript',
    py: 'Python',
    sh: 'Shell',
    bash: 'Bash',
    yml: 'YAML',
    md: 'Markdown',
    html: 'HTML',
    css: 'CSS',
    json: 'JSON',
  };

  function labelFromLang(langRaw) {
    const lang = (langRaw || '').trim().toLowerCase();
    if (!lang) return 'Code';
    if (LANG_LABELS[lang]) return LANG_LABELS[lang];
    if (lang.includes('-')) {
      return lang
        .split('-')
        .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
        .join('-');
    }
    return lang[0].toUpperCase() + lang.slice(1);
  }

  function extractLangFromCodeClass(code) {
    for (const cls of code.classList) {
      if (cls.startsWith('language-')) {
        return cls.slice('language-'.length);
      }
    }
    return '';
  }

  function getLooksLikeRunnableBot() {
    const g = typeof globalThis !== 'undefined' ? globalThis : window;
    return typeof g.splatbotLooksLikeRunnableBot === 'function' ? g.splatbotLooksLikeRunnableBot : null;
  }

  /** Try it out only for Python bot snippets (same idea as docs build validation). */
  function shouldOfferTryInDocs(sourceText, langRaw) {
    const lang = (langRaw || '').trim().toLowerCase();
    if (lang !== 'python' && lang !== 'py') return false;
    const looksLike = getLooksLikeRunnableBot();
    if (!looksLike) return false;
    return looksLike(sourceText);
  }

  /** Repo root as URL (parent of `docs/`), ending with `/`. */
  function getSiteRootBaseUrl() {
    const url = new URL(window.location.href);
    const docsPathIdx = url.pathname.lastIndexOf('/docs/');
    if (docsPathIdx !== -1) {
      url.pathname = url.pathname.slice(0, docsPathIdx + 1);
    } else {
      url.pathname = '/';
    }
    url.hash = '';
    url.search = '';
    return url;
  }

  function getGamePageUrl() {
    const url = new URL('index.html', getSiteRootBaseUrl().href);
    url.searchParams.set(DOCS_IMPORT_FLAG, '1');
    return url;
  }

  function getTryPreviewModuleUrl() {
    return new URL('js/docs/try-bot-preview.js', getSiteRootBaseUrl().href).href;
  }

  function closeTryPreview() {
    const els = tryPreviewEls;
    if (!els || els.root.hidden) return;

    if (tryPreviewDestroyMini) {
      try {
        tryPreviewDestroyMini();
      } catch {
        // Ignore teardown errors.
      }
      tryPreviewDestroyMini = null;
    }
    els.mountEl.innerHTML = '';
    els.root.hidden = true;
    document.body.style.overflow = '';

    if (tryPreviewKeydownHandler) {
      document.removeEventListener('keydown', tryPreviewKeydownHandler, true);
      tryPreviewKeydownHandler = null;
    }

    const prev = tryPreviewFocusBefore;
    tryPreviewFocusBefore = null;
    if (prev && typeof prev.focus === 'function') {
      try {
        prev.focus();
      } catch {
        // Ignore focus failures (e.g. disconnected node).
      }
    }
  }

  function ensureTryPreviewModal() {
    if (tryPreviewEls) return tryPreviewEls;

    const root = document.createElement('div');
    root.id = 'docs-try-preview-root';
    root.className = 'docs-try-preview-root';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'docs-try-preview-title');
    root.hidden = true;

    const backdrop = document.createElement('div');
    backdrop.className = 'docs-try-preview-backdrop';
    backdrop.addEventListener('click', () => closeTryPreview());

    const panel = document.createElement('div');
    panel.className = 'docs-try-preview-panel';

    const header = document.createElement('div');
    header.className = 'docs-try-preview-header';

    const title = document.createElement('div');
    title.id = 'docs-try-preview-title';
    title.className = 'docs-try-preview-title';
    title.textContent = 'Try your bot';

    const headerActions = document.createElement('div');
    headerActions.className = 'docs-try-preview-header-actions';

    const openFull = document.createElement('a');
    openFull.className = 'docs-try-preview-open-full';
    openFull.href = '#';
    openFull.rel = 'noopener noreferrer';
    openFull.textContent = 'Open full game';
    openFull.addEventListener('click', (e) => {
      e.preventDefault();
      if (lastTryPayload) {
        try {
          localStorage.setItem(DOCS_IMPORT_KEY, JSON.stringify(lastTryPayload));
        } catch {
          // Ignore; new tab may not get the import.
        }
      }
      window.open(getGamePageUrl().toString(), '_blank', 'noopener,noreferrer');
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'docs-try-preview-close';
    closeBtn.setAttribute('aria-label', 'Close game preview');
    closeBtn.textContent = '×';

    closeBtn.addEventListener('click', () => closeTryPreview());

    headerActions.appendChild(openFull);
    headerActions.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(headerActions);

    const mountEl = document.createElement('div');
    mountEl.className = 'docs-try-preview-mount';
    panel.appendChild(header);
    panel.appendChild(mountEl);
    root.appendChild(backdrop);
    root.appendChild(panel);
    document.body.appendChild(root);

    tryPreviewEls = { root, mountEl, closeBtn, titleEl: title };
    return tryPreviewEls;
  }

  /**
   * @param {{ source: string, createdAt: number, version: number, scriptLabel: string }} payload
   */
  async function openTryPreviewModal(payload) {
    lastTryPayload = payload;
    const els = ensureTryPreviewModal();
    const label = (payload.scriptLabel || '').trim() || 'this bot';
    els.titleEl.textContent = `Try ${label}`;

    if (tryPreviewKeydownHandler) {
      document.removeEventListener('keydown', tryPreviewKeydownHandler, true);
      tryPreviewKeydownHandler = null;
    }

    if (tryPreviewDestroyMini) {
      try {
        tryPreviewDestroyMini();
      } catch {
        // Ignore.
      }
      tryPreviewDestroyMini = null;
    }

    els.mountEl.innerHTML = `
      <div class="docs-try-preview-loading" role="status" aria-live="polite">
        <div class="docs-try-preview-loading-spinner" aria-hidden="true"></div>
        <div class="docs-try-preview-loading-brand">SPLATBOT</div>
        <div class="docs-try-preview-loading-text">Loading Python preview…</div>
        <div class="docs-try-preview-loading-hint">First load may take a moment.</div>
      </div>
    `;

    tryPreviewFocusBefore = /** @type {HTMLElement} */ (document.activeElement);
    els.root.hidden = false;
    document.body.style.overflow = 'hidden';

    try {
      const mod = await import(getTryPreviewModuleUrl());
      tryPreviewDestroyMini = await mod.mountTryBotPreview(els.mountEl, { source: payload.source });
    } catch (err) {
      const detail = err?.message ?? String(err);
      els.mountEl.innerHTML = '';
      const p = document.createElement('p');
      p.className = 'docs-try-mini-error';
      p.textContent = `Preview failed: ${detail}`;
      els.mountEl.appendChild(p);
    }

    tryPreviewKeydownHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeTryPreview();
      }
    };
    document.addEventListener('keydown', tryPreviewKeydownHandler, true);

    requestAnimationFrame(() => {
      try {
        els.closeBtn.focus();
      } catch {
        // Ignore.
      }
    });
  }

  function enhance() {
    const mains = document.querySelectorAll('main.markdown-body');
    for (const main of mains) {
      for (const pre of main.querySelectorAll('pre')) {
        const code = pre.querySelector(':scope > code');
        if (!code || pre.closest('.docs-code-wrap')) continue;

        const wrap = document.createElement('div');
        wrap.className = 'docs-code-wrap';
        pre.replaceWith(wrap);

        const toolbar = document.createElement('div');
        toolbar.className = 'docs-code-toolbar';

        const title = code.dataset.docsCodeTitle?.trim() || pre.dataset.docsCodeTitle?.trim();
        const lang = code.dataset.docsCodeLang?.trim() || pre.dataset.docsCodeLang?.trim() || extractLangFromCodeClass(code);

        const label = document.createElement('span');
        label.className = 'docs-code-label';
        label.textContent = title || labelFromLang(lang);

        const actions = document.createElement('div');
        actions.className = 'docs-code-actions';

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'docs-copy-btn';
        copyBtn.setAttribute('aria-label', 'Copy code to clipboard');
        copyBtn.textContent = 'Copy code';

        copyBtn.addEventListener('click', async () => {
          const text = code.textContent ?? '';
          try {
            await navigator.clipboard.writeText(text);
            copyBtn.textContent = 'Copied!';
            copyBtn.classList.add('docs-copy-btn--done');
            clearTimeout(copyBtn._docsCopyT);
            copyBtn._docsCopyT = setTimeout(() => {
              copyBtn.textContent = 'Copy code';
              copyBtn.classList.remove('docs-copy-btn--done');
            }, 2000);
          } catch {
            copyBtn.textContent = 'Copy failed';
            clearTimeout(copyBtn._docsCopyT);
            copyBtn._docsCopyT = setTimeout(() => {
              copyBtn.textContent = 'Copy code';
            }, 2000);
          }
        });

        actions.appendChild(copyBtn);
        const sourceText = code.textContent ?? '';
        if (shouldOfferTryInDocs(sourceText, lang)) {
          const scriptLabel = (title && title.trim()) || labelFromLang(lang);
          const tryBtn = document.createElement('button');
          tryBtn.type = 'button';
          tryBtn.className = 'docs-try-btn';
          tryBtn.setAttribute('aria-label', `Open a game preview for ${scriptLabel}`);
          tryBtn.textContent = 'Try it out';
          tryBtn.addEventListener('click', () => {
            const payload = {
              source: sourceText,
              createdAt: Date.now(),
              version: 1,
              scriptLabel,
            };
            void (async () => {
              try {
                await openTryPreviewModal(payload);
              } catch {
                tryBtn.textContent = 'Try failed';
                clearTimeout(tryBtn._docsTryT);
                tryBtn._docsTryT = setTimeout(() => {
                  tryBtn.textContent = 'Try it out';
                }, 2000);
              }
            })();
          });
          actions.appendChild(tryBtn);
        }

        toolbar.appendChild(label);
        toolbar.appendChild(actions);
        wrap.appendChild(toolbar);
        wrap.appendChild(pre);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhance);
  } else {
    enhance();
  }
})();
