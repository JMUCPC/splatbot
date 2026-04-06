/**
 * Docs site: add a labeled code toolbar + copy button to fenced code blocks.
 */
(function () {
  const BOT_CLASS_RE = /\bclass\s+Bot\b/;
  const BOT_INSTANCE_DECIDE_RE = /\bdef\s+decide\s*\(\s*self\b/;
  const DOCS_IMPORT_KEY = 'splatbot_import_bot_p1_v1';
  const DOCS_IMPORT_FLAG = 'importBotP1';

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

  function looksLikeRunnableBot(source) {
    return BOT_CLASS_RE.test(source) && BOT_INSTANCE_DECIDE_RE.test(source);
  }

  function getGamePageUrl() {
    const url = new URL(window.location.href);
    const docsPathIdx = url.pathname.lastIndexOf('/docs/');
    if (docsPathIdx !== -1) {
      const basePath = url.pathname.slice(0, docsPathIdx + 1);
      url.pathname = `${basePath}index.html`;
    } else {
      url.pathname = 'index.html';
    }
    url.search = '';
    url.searchParams.set(DOCS_IMPORT_FLAG, '1');
    url.hash = '';
    return url;
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
        if (looksLikeRunnableBot(sourceText)) {
          const tryBtn = document.createElement('button');
          tryBtn.type = 'button';
          tryBtn.className = 'docs-try-btn';
          tryBtn.setAttribute('aria-label', 'Load this bot into Player 1 in the game');
          tryBtn.textContent = 'Try it out';
          tryBtn.addEventListener('click', () => {
            try {
              const payload = {
                source: sourceText,
                createdAt: Date.now(),
                version: 1,
              };
              localStorage.setItem(DOCS_IMPORT_KEY, JSON.stringify(payload));
              window.location.href = getGamePageUrl().toString();
            } catch {
              tryBtn.textContent = 'Try failed';
              clearTimeout(tryBtn._docsTryT);
              tryBtn._docsTryT = setTimeout(() => {
                tryBtn.textContent = 'Try it out';
              }, 2000);
            }
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
