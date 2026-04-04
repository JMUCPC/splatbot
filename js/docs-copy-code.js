/**
 * Docs site: add "Copy code" to Python fenced blocks so readers can paste into Splatbot.
 */
(function () {
  function enhance() {
    const mains = document.querySelectorAll('main.markdown-body');
    for (const main of mains) {
      for (const pre of main.querySelectorAll('pre')) {
        const code = pre.querySelector(':scope > code.language-python');
        if (!code || pre.closest('.docs-code-wrap')) continue;

        const wrap = document.createElement('div');
        wrap.className = 'docs-code-wrap';
        pre.replaceWith(wrap);

        const toolbar = document.createElement('div');
        toolbar.className = 'docs-code-toolbar';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'docs-copy-btn';
        btn.setAttribute('aria-label', 'Copy code to clipboard');
        btn.textContent = 'Copy code';

        btn.addEventListener('click', async () => {
          const text = code.textContent ?? '';
          try {
            await navigator.clipboard.writeText(text);
            btn.textContent = 'Copied!';
            btn.classList.add('docs-copy-btn--done');
            clearTimeout(btn._docsCopyT);
            btn._docsCopyT = setTimeout(() => {
              btn.textContent = 'Copy code';
              btn.classList.remove('docs-copy-btn--done');
            }, 2000);
          } catch {
            btn.textContent = 'Copy failed';
            clearTimeout(btn._docsCopyT);
            btn._docsCopyT = setTimeout(() => {
              btn.textContent = 'Copy code';
            }, 2000);
          }
        });

        toolbar.appendChild(btn);
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
