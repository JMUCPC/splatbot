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
const NAV_ORDER_FILE = path.join(SRC, 'nav-order.txt');

async function readNavOrder() {
  let raw;
  try {
    raw = await fs.readFile(NAV_ORDER_FILE, 'utf8');
  } catch {
    return { order: new Map(), titles: [] };
  }
  const order = new Map();
  const titles = [];
  let idx = 0;
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (/^\*+.+\*+$/.test(trimmed)) {
      const title = trimmed.replace(/^\*+/, '').replace(/\*+$/, '').trim();
      if (title) {
        titles.push({ index: idx, title });
      }
      continue;
    }
    order.set(trimmed, idx++);
  }
  return { order, titles };
}

function navOrderComparator(order, keyFn) {
  return (a, b) => {
    const ka = keyFn(a);
    const kb = keyFn(b);
    const oa = order.has(ka) ? order.get(ka) : Infinity;
    const ob = order.has(kb) ? order.get(kb) : Infinity;
    if (oa !== ob) return oa - ob;
    return ka.localeCompare(kb);
  };
}

function buildPageNeighbors(pages, navOrder) {
  const sorted = [...pages].sort(navOrderComparator(navOrder, (p) => p.rel));
  const byRel = new Map();
  for (let i = 0; i < sorted.length; i++) {
    const page = sorted[i];
    byRel.set(page.rel, {
      prev: i > 0 ? sorted[i - 1] : null,
      next: i < sorted.length - 1 ? sorted[i + 1] : null,
    });
  }
  return byRel;
}

/** Set before each `md.render()` — used by the `.md` link rewriter. */
let renderAbsMd = '';

function titleFromMarkdown(source, fallback) {
  const m = source.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

function formatNavLabel(segment) {
  if (segment === 'utils') return 'utils';
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

function renderDocsSidebar(navTree, currentRel, outFile, navOrder, navTitles) {
  const renderNode = (node, includeTitles = false, includeNodeIndex = false) => {
    const parts = [];
    const orderedItems = [];
    if (includeNodeIndex && node.indexPage) {
      const isActive = node.indexPage.rel === currentRel;
      const activeClass = isActive ? ' docs-sidebar-link--active' : '';
      const ariaCurrent = isActive ? ' aria-current="page"' : '';
      orderedItems.push({
        rel: node.indexPage.rel,
        html: `<li class="docs-sidebar-item"><a class="docs-sidebar-link${activeClass}" href="${relHref(outFile, node.indexPage.outFile)}"${ariaCurrent}>${escapeHtml(node.indexPage.title)}</a></li>`,
      });
    }
    const sortedPages = [...node.pages].sort(navOrderComparator(navOrder, (p) => p.rel));
    for (const page of sortedPages) {
      const isActive = page.rel === currentRel;
      const activeClass = isActive ? ' docs-sidebar-link--active' : '';
      const ariaCurrent = isActive ? ' aria-current="page"' : '';
      orderedItems.push({
        rel: page.rel,
        html: `<li class="docs-sidebar-item"><a class="docs-sidebar-link${activeClass}" href="${relHref(outFile, page.outFile)}"${ariaCurrent}>${escapeHtml(page.title)}</a></li>`,
      });
    }

    const sortedChildren = [...node.children.entries()].sort(
      navOrderComparator(navOrder, ([, child]) => child.indexPage ? child.indexPage.rel : '')
    );
    for (const [segment, child] of sortedChildren) {
      const sectionLabel = child.indexPage ? child.indexPage.title : formatNavLabel(segment);
      const isActiveSection = Boolean(child.indexPage) && child.indexPage.rel === currentRel;
      const sectionActiveClass = isActiveSection ? ' docs-sidebar-link--active' : '';
      const sectionAriaCurrent = isActiveSection ? ' aria-current="page"' : '';
      const sectionHeader = child.indexPage
        ? `<a class="docs-sidebar-section-link${sectionActiveClass}" href="${relHref(outFile, child.indexPage.outFile)}"${sectionAriaCurrent}>${escapeHtml(sectionLabel)}</a>`
        : `<span class="docs-sidebar-section-link">${escapeHtml(sectionLabel)}</span>`;
      const childItems = renderNode(child, false, false);
      orderedItems.push({
        rel: child.indexPage ? child.indexPage.rel : '',
        html: `<li class="docs-sidebar-section"><div class="docs-sidebar-section-head">${sectionHeader}</div>${childItems ? `<ul class="docs-sidebar-list docs-sidebar-list--nested">${childItems}</ul>` : ''}</li>`,
      });
    }

    if (!includeTitles) {
      return orderedItems.map((item) => item.html).join('\n');
    }

    const titleByIndex = new Map(navTitles.map((t) => [t.index, t.title]));
    for (const item of orderedItems) {
      const orderIdx = navOrder.has(item.rel) ? navOrder.get(item.rel) : Infinity;
      if (titleByIndex.has(orderIdx)) {
        parts.push(`<li class="docs-sidebar-title">${escapeHtml(titleByIndex.get(orderIdx))}</li>`);
      }
      parts.push(item.html);
    }

    return parts.join('\n');
  };

  const sectionItems = [renderNode(navTree, true, true)];

  return `<aside class="docs-sidebar" id="docs-sidebar" aria-label="Docs navigation">
    <div class="docs-sidebar-inner">
      <a class="docs-sidebar-brand" href="${relHref(outFile, path.join(ROOT, 'index.html'))}">Splatbot</a>
      <div class="docs-search" role="search">
        <input class="docs-search-input" type="search" placeholder="Search docs\u2026" aria-label="Search documentation">
        <ul class="docs-search-results" role="listbox" hidden></ul>
      </div>
      <ul class="docs-sidebar-list">
        ${sectionItems.filter(Boolean).join('\n')}
      </ul>
    </div>
  </aside>`;
}

function renderMobileNavChrome(outFile) {
  const homeHref = relHref(outFile, path.join(ROOT, 'index.html'));
  return `<header class="docs-mobile-nav-bar" role="banner">
  <a class="docs-mobile-nav-brand" href="${homeHref}">Splatbot</a>
  <button type="button" class="docs-nav-menu-btn" id="docs-nav-menu-btn" aria-controls="docs-sidebar" aria-expanded="false" aria-label="Open navigation menu"><span class="docs-nav-menu-icon" aria-hidden="true"><span class="docs-nav-menu-bar"></span><span class="docs-nav-menu-bar"></span><span class="docs-nav-menu-bar"></span></span></button>
</header>
<div class="docs-nav-backdrop" id="docs-nav-backdrop" hidden></div>`;
}

function renderPager(currentPage, outFile, neighborsByRel) {
  const neighbors = neighborsByRel.get(currentPage.rel) || { prev: null, next: null };
  const prevHtml = neighbors.prev
    ? `<a class="docs-pager-link docs-pager-link--prev" href="${relHref(outFile, neighbors.prev.outFile)}">&larr; Back: ${escapeHtml(neighbors.prev.title)}</a>`
    : '<span class="docs-pager-spacer" aria-hidden="true"></span>';
  const nextHtml = neighbors.next
    ? `<a class="docs-pager-link docs-pager-link--next" href="${relHref(outFile, neighbors.next.outFile)}">Next: ${escapeHtml(neighbors.next.title)} &rarr;</a>`
    : '<span class="docs-pager-spacer" aria-hidden="true"></span>';

  return `<nav class="docs-pager" aria-label="Page navigation">${prevHtml}${nextHtml}</nav>`;
}

function pageShell({ title, bodyHtml, outFile, sidebarHtml, pagerHtml }) {
  const outDir = path.dirname(outFile);
  const toRoot = path.relative(outDir, ROOT) || '.';
  const cssHref = path.join(toRoot, 'css', 'docs.css').split(path.sep).join('/');
  const hljsHref = path.join(toRoot, 'css', 'docs-hljs.css').split(path.sep).join('/');
  const botRunnableHref = path.join(toRoot, 'js', 'bot-runnable.js').split(path.sep).join('/');
  const copyJsHref = path.join(toRoot, 'js', 'docs-copy-code.js').split(path.sep).join('/');
  const actionDemosHref = path.join(toRoot, 'js', 'docs', 'action-demos.js').split(path.sep).join('/');
  const hexHoverDemosHref = path.join(toRoot, 'js', 'docs', 'hex-hover-demos.js').split(path.sep).join('/');
  const hexDistanceDemosHref = path.join(toRoot, 'js', 'docs', 'hex-distance-demos.js').split(path.sep).join('/');
  const minisearchHref = path.join(toRoot, 'js', 'vendor', 'minisearch.js').split(path.sep).join('/');
  const docsSearchHref = path.join(toRoot, 'js', 'docs-search.js').split(path.sep).join('/');
  const docsTocHref = path.join(toRoot, 'js', 'docs-toc.js').split(path.sep).join('/');
  const docsNavDrawerHref = path.join(toRoot, 'js', 'docs-nav-drawer.js').split(path.sep).join('/');
  const iconHref = path.join(toRoot, 'images', 'splat.ico').split(path.sep).join('/');
  const mobileNavChrome = renderMobileNavChrome(outFile);

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
${mobileNavChrome}
  <div class="docs-layout">
    <div class="docs-main-wrap">
    <main class="docs-main markdown-body">
${bodyHtml}
${pagerHtml}
    </main>
    </div>
${sidebarHtml}
  </div>
  <script src="${botRunnableHref}" defer></script>
  <script src="${copyJsHref}" defer></script>
  <script src="${minisearchHref}" defer></script>
  <script src="${docsSearchHref}" defer></script>
  <script src="${docsTocHref}" defer></script>
  <script src="${docsNavDrawerHref}" defer></script>
  <script type="module" src="${actionDemosHref}"></script>
  <script type="module" src="${hexHoverDemosHref}"></script>
  <script type="module" src="${hexDistanceDemosHref}"></script>
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

/**
 * Wrap each top-level `<table>...</table>` so narrow viewports can scroll horizontally.
 */
function wrapMarkdownTables(html) {
  const out = [];
  let i = 0;
  const openRe = /<table\b/i;
  while (i < html.length) {
    const slice = html.slice(i);
    const m = openRe.exec(slice);
    if (!m) {
      out.push(html.slice(i));
      break;
    }
    const start = i + m.index;
    out.push(html.slice(i, start));
    const afterOpen = start + m[0].length;
    const rest = html.slice(afterOpen);
    const closeRe = /<\/table>/i;
    const closeMatch = closeRe.exec(rest);
    if (!closeMatch) {
      out.push(html.slice(start));
      break;
    }
    const end = afterOpen + closeMatch.index + closeMatch[0].length;
    const tableHtml = html.slice(start, end);
    out.push('<div class="docs-table-scroll" role="region" aria-label="Scroll horizontally for full table">');
    out.push(tableHtml);
    out.push('</div>');
    i = end;
  }
  return out.join('');
}

function renderMarkdown(raw, absMd) {
  renderAbsMd = absMd;
  slugger = new GithubSlugger();
  return wrapMarkdownTables(md.render(raw));
}

/**
 * Extract heading-delimited sections from raw Markdown for the search index.
 * Returns an array of { title, slug, level, content } where content is the
 * plain-text body below that heading (up to the next heading of equal or
 * higher level), stripped of code fences and HTML tags.
 */
function extractSections(raw) {
  const sectionSlugger = new GithubSlugger();
  const headingRe = /^(#{1,6})\s+(.+)$/gm;
  const sections = [];
  let lastIndex = 0;
  let lastHeading = null;

  function stripMarkdown(text) {
    return text
      .replace(/^```[\s\S]*?^```/gm, '')   // code fences
      .replace(/<[^>]+>/g, '')               // HTML tags
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // [text](url) → text
      .replace(/[`*_~]+/g, '')               // inline formatting
      .replace(/\n{2,}/g, '\n')
      .trim();
  }

  let m;
  while ((m = headingRe.exec(raw)) !== null) {
    if (lastHeading) {
      lastHeading.content = stripMarkdown(raw.slice(lastIndex, m.index));
    }
    const level = m[1].length;
    const titleRaw = m[2].trim().replace(/\s+#+\s*$/, '').trim();
    lastHeading = {
      title: titleRaw,
      slug: sectionSlugger.slug(titleRaw),
      level,
      content: '',
    };
    sections.push(lastHeading);
    lastIndex = m.index + m[0].length;
  }
  if (lastHeading) {
    lastHeading.content = stripMarkdown(raw.slice(lastIndex));
  }
  return sections;
}

/** URL path from the docs root for a given output file. */
function urlPathForOutFile(outFile) {
  return path.relative(DOCS, outFile).split(path.sep).join('/');
}

function buildSearchIndex(pages) {
  const docs = [];
  let id = 0;
  for (const page of pages) {
    const url = urlPathForOutFile(page.outFile);
    const sections = extractSections(page.raw);
    for (const sec of sections) {
      docs.push({
        id: id++,
        pageTitle: page.title,
        section: sec.title,
        content: sec.content.slice(0, 1000),
        url,
        hash: sec.slug,
        level: sec.level,
      });
    }
  }
  return docs;
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

  const { order: navOrder, titles: navTitles } = await readNavOrder();
  const neighborsByRel = buildPageNeighbors(pages, navOrder);
  const navTree = buildDocsNav(pages);

  for (const page of pages) {
    const bodyHtml = renderMarkdown(page.raw, page.absMd);
    const sidebarHtml = renderDocsSidebar(navTree, page.rel, page.outFile, navOrder, navTitles);
    const pagerHtml = renderPager(page, page.outFile, neighborsByRel);
    await fs.mkdir(path.dirname(page.outFile), { recursive: true });
    const html = pageShell({ title: page.title, bodyHtml, outFile: page.outFile, sidebarHtml, pagerHtml });
    await fs.writeFile(page.outFile, html, 'utf8');
  }

  const searchIndex = buildSearchIndex(pages);
  await fs.writeFile(path.join(DOCS, 'search-index.json'), JSON.stringify(searchIndex), 'utf8');

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
