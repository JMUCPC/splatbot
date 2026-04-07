import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import MarkdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import markdownItHighlightjs from 'markdown-it-highlightjs';
import GithubSlugger from 'github-slugger';
import { validateDocs } from './docs-validate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const SRC = path.join(ROOT, 'docs-src');

/** Set before each `md.render()` — used by the `.md` link rewriter. */
let renderAbsMd = '';

function titleFromMarkdown(source, fallback) {
  const m = source.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

function formatNavLabel(segment) {
  return segment
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function relHref(fromFile, toFile) {
  let href = path.relative(path.dirname(fromFile), toFile).split(path.sep).join('/');
  if (!href || href === '.') {
    href = path.basename(toFile);
  } else if (!href.startsWith('.')) {
    href = `./${href}`;
  }
  return href;
}

function createNavNode(segment = '') {
  return {
    segment,
    indexPage: null,
    pages: [],
    children: new Map(),
  };
}

function buildDocsNav(pages) {
  const root = createNavNode();

  for (const page of pages) {
    const base = page.rel.replace(/\.md$/i, '');
    const segments = base.split('/').filter(Boolean);
    if (segments.length === 0) {
      root.indexPage = page;
      continue;
    }

    const isIndex = segments[segments.length - 1] === 'index';
    const dirSegments = isIndex ? segments.slice(0, -1) : segments.slice(0, -1);
    let node = root;
    for (const seg of dirSegments) {
      if (!node.children.has(seg)) {
        node.children.set(seg, createNavNode(seg));
      }
      node = node.children.get(seg);
    }

    if (isIndex) {
      node.indexPage = page;
    } else {
      node.pages.push(page);
    }
  }

  return root;
}

function renderDocsSidebar(navTree, currentRel, outFile) {
  const sectionItems = [];

  if (navTree.indexPage) {
    const isActive = navTree.indexPage.rel === currentRel;
    const activeClass = isActive ? ' docs-sidebar-link--active' : '';
    const ariaCurrent = isActive ? ' aria-current="page"' : '';
    sectionItems.push(
      `<li class="docs-sidebar-item"><a class="docs-sidebar-link${activeClass}" href="${relHref(outFile, navTree.indexPage.outFile)}"${ariaCurrent}>${escapeHtml(navTree.indexPage.title)}</a></li>`
    );
  }

  const renderNode = (node) => {
    const parts = [];
    const sortedPages = [...node.pages].sort((a, b) => a.title.localeCompare(b.title));
    for (const page of sortedPages) {
      const isActive = page.rel === currentRel;
      const activeClass = isActive ? ' docs-sidebar-link--active' : '';
      const ariaCurrent = isActive ? ' aria-current="page"' : '';
      parts.push(
        `<li class="docs-sidebar-item"><a class="docs-sidebar-link${activeClass}" href="${relHref(outFile, page.outFile)}"${ariaCurrent}>${escapeHtml(page.title)}</a></li>`
      );
    }

    const sortedChildren = [...node.children.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [segment, child] of sortedChildren) {
      const sectionLabel = child.indexPage ? child.indexPage.title : formatNavLabel(segment);
      const sectionHeader = child.indexPage
        ? `<a class="docs-sidebar-section-link" href="${relHref(outFile, child.indexPage.outFile)}">${escapeHtml(sectionLabel)}</a>`
        : `<span class="docs-sidebar-section-link">${escapeHtml(sectionLabel)}</span>`;
      const childItems = renderNode(child);
      parts.push(
        `<li class="docs-sidebar-section"><div class="docs-sidebar-section-head">${sectionHeader}</div>${childItems ? `<ul class="docs-sidebar-list docs-sidebar-list--nested">${childItems}</ul>` : ''}</li>`
      );
    }

    return parts.join('\n');
  };

  sectionItems.push(renderNode(navTree));

  return `<aside class="docs-sidebar" aria-label="Docs navigation">
    <div class="docs-sidebar-inner">
      <h2 class="docs-sidebar-title">Articles</h2>
      <ul class="docs-sidebar-list">
        ${sectionItems.filter(Boolean).join('\n')}
      </ul>
    </div>
  </aside>`;
}

function pageShell({ title, bodyHtml, outFile, sidebarHtml }) {
  const outDir = path.dirname(outFile);
  const toRoot = path.relative(outDir, ROOT) || '.';
  const cssHref = path.join(toRoot, 'css', 'docs.css').split(path.sep).join('/');
  const hljsHref = path.join(toRoot, 'css', 'docs-hljs.css').split(path.sep).join('/');
  const botRunnableHref = path.join(toRoot, 'js', 'bot-runnable.js').split(path.sep).join('/');
  const copyJsHref = path.join(toRoot, 'js', 'docs-copy-code.js').split(path.sep).join('/');
  const actionDemosHref = path.join(toRoot, 'js', 'docs', 'action-demos.js').split(path.sep).join('/');
  const gameHref = path.join(toRoot, 'index.html').split(path.sep).join('/');
  const docsIndexHref = path.join(toRoot, 'docs', 'index.html').split(path.sep).join('/');
  const iconHref = path.join(toRoot, 'images', 'splat.ico').split(path.sep).join('/');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} · Splatbot</title>
  <link rel="icon" href="${iconHref}" type="image/x-icon">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:wght@400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${cssHref}">
  <link rel="stylesheet" href="${hljsHref}">
</head>
<body class="docs-body">
  <header class="docs-header">
    <nav class="docs-nav">
      <a class="docs-brand" href="${gameHref}">Splatbot</a>
      <span class="docs-sep">/</span>
      <a class="docs-crumb" href="${docsIndexHref}">Docs</a>
    </nav>
  </header>
  <div class="docs-layout">
${sidebarHtml}
    <main class="docs-main markdown-body">
${bodyHtml}
    </main>
  </div>
  <script src="${botRunnableHref}" defer></script>
  <script src="${copyJsHref}" defer></script>
  <script type="module" src="${actionDemosHref}"></script>
</body>
</html>
`;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function outPathForSource(mdRelPosix) {
  const base = mdRelPosix.replace(/\.md$/i, '');
  const segments = base.split('/').filter(Boolean);

  if (segments.length === 0) {
    return path.join(DOCS, 'index.html');
  }

  const last = segments[segments.length - 1];
  if (last === 'index') {
    const dirParts = segments.slice(0, -1);
    const dir = path.join(DOCS, ...dirParts);
    return path.join(dir, 'index.html');
  }

  return path.join(DOCS, ...segments, 'index.html');
}

/**
 * Map a `.md` href under `docs-src` to the relative URL between built HTML files.
 * Matches `outPathForSource` (e.g. `overview.md` → `overview/index.html`).
 */
function rewriteMdHref(href, currentAbsMd) {
  const hashIdx = href.indexOf('#');
  const pathPart = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
  const fragment = hashIdx >= 0 ? href.slice(hashIdx) : '';

  const trimmed = pathPart.trim();
  if (!trimmed) {
    return href;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return href;
  }

  if (!/\.md$/i.test(trimmed)) {
    return href;
  }

  const resolved = path.normalize(path.resolve(path.dirname(currentAbsMd), trimmed));
  const relToSrc = path.relative(SRC, resolved);
  if (relToSrc.startsWith('..') || path.isAbsolute(relToSrc)) {
    return href;
  }

  const relPosix = relToSrc.split(path.sep).join('/');
  const targetHtml = outPathForSource(relPosix);
  const currentRel = path.relative(SRC, currentAbsMd).split(path.sep).join('/');
  const currentHtml = outPathForSource(currentRel);

  let out = path.relative(path.dirname(currentHtml), targetHtml).split(path.sep).join('/');
  if (!out || out === '.') {
    out = path.basename(targetHtml);
  } else if (!out.startsWith('.')) {
    out = `./${out}`;
  }
  return out + fragment;
}

function mdLinkRewritePlugin(md) {
  md.core.ruler.after('inline', 'docs-md-link-rewrite', (state) => {
    const absMd = renderAbsMd;
    if (!absMd) return;

    for (let i = 0; i < state.tokens.length; i++) {
      const token = state.tokens[i];
      if (token.type !== 'inline' || !token.children) continue;
      for (const child of token.children) {
        if (child.type !== 'link_open') continue;
        const hrefIdx = child.attrIndex('href');
        if (hrefIdx < 0) continue;
        const href = child.attrs[hrefIdx][1];
        child.attrs[hrefIdx][1] = rewriteMdHref(href, absMd);
      }
    }
  });
}

function parseFenceInfo(infoRaw) {
  const info = (infoRaw || '').trim();
  if (!info) {
    return { lang: '', attrs: {} };
  }

  const firstSpace = info.search(/\s/);
  if (firstSpace < 0) {
    return { lang: info, attrs: {} };
  }

  const lang = info.slice(0, firstSpace).trim();
  const rest = info.slice(firstSpace).trim();
  const attrs = {};
  const attrRe = /([A-Za-z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = attrRe.exec(rest))) {
    attrs[m[1]] = m[2] ?? m[3] ?? '';
  }
  return { lang, attrs };
}

function codeFenceMetaPlugin(md) {
  md.core.ruler.after('block', 'docs-code-fence-meta', (state) => {
    for (const token of state.tokens) {
      if (token.type !== 'fence') continue;
      const { lang, attrs } = parseFenceInfo(token.info);
      if (lang) {
        token.attrSet('data-docs-code-lang', lang);
      }
      if (attrs.title) {
        token.attrSet('data-docs-code-title', attrs.title);
      }
    }
  });
}

let slugger = new GithubSlugger();

const md = new MarkdownIt({
  /* Allow curated HTML in docs-src (e.g. action mini-grids). Sources are repo-controlled. */
  html: true,
  linkify: true,
  typographer: true,
})
  .use(markdownItHighlightjs)
  .use(markdownItAnchor, {
    slugify: (s) => slugger.slug(s),
    permalink: false,
  })
  .use(mdLinkRewritePlugin)
  .use(codeFenceMetaPlugin);

function renderMarkdown(raw, absMd) {
  renderAbsMd = absMd;
  slugger = new GithubSlugger();
  return md.render(raw);
}

async function cleanGeneratedHtml() {
  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(p);
      } else if (e.name.endsWith('.html')) {
        await fs.unlink(p);
      }
    }
  }
  await walk(DOCS);
}

async function* iterMarkdownFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* iterMarkdownFiles(p);
    } else if (e.isFile() && e.name.endsWith('.md')) {
      yield p;
    }
  }
}

async function buildOnce() {
  await fs.mkdir(SRC, { recursive: true });

  const allFiles = [];
  for await (const absMd of iterMarkdownFiles(SRC)) {
    allFiles.push(absMd);
  }
  allFiles.sort((a, b) => a.localeCompare(b));

  const pages = [];
  for (const absMd of allFiles) {
    const rel = path.relative(SRC, absMd).split(path.sep).join('/');
    const raw = await fs.readFile(absMd, 'utf8');
    const title = titleFromMarkdown(raw, rel.replace(/\.md$/i, ''));
    const outFile = outPathForSource(rel);
    pages.push({ absMd, rel, raw, title, outFile });
  }

  const { errors: docErrors, warnings: docWarnings } = await validateDocs({
    root: ROOT,
    src: SRC,
    docs: DOCS,
    pages,
  });
  for (const w of docWarnings) {
    console.warn(w);
  }
  if (docErrors.length) {
    console.error(`docs: validation failed (${docErrors.length} issue(s)):\n${docErrors.join('\n')}`);
    process.exitCode = 1;
    return;
  }

  await cleanGeneratedHtml();

  const navTree = buildDocsNav(pages);

  for (const page of pages) {
    const bodyHtml = renderMarkdown(page.raw, page.absMd);
    const sidebarHtml = renderDocsSidebar(navTree, page.rel, page.outFile);
    await fs.mkdir(path.dirname(page.outFile), { recursive: true });
    const html = pageShell({ title: page.title, bodyHtml, outFile: page.outFile, sidebarHtml });
    await fs.writeFile(page.outFile, html, 'utf8');
  }

  console.log('docs: built HTML under docs/ from docs-src');
}

const watch = process.argv.includes('--watch');

if (watch) {
  const { default: chokidar } = await import('chokidar');
  await buildOnce();
  chokidar.watch(SRC, { ignoreInitial: true }).on('all', () => {
    buildOnce().catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
  });
  console.log('docs: watching', path.relative(ROOT, SRC));
} else {
  await buildOnce();
}
