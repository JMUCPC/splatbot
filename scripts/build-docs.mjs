import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import MarkdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import GithubSlugger from 'github-slugger';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const SRC = path.join(DOCS, 'src');

/** Set before each `md.render()` — used by the `.md` link rewriter. */
let renderAbsMd = '';

function titleFromMarkdown(source, fallback) {
  const m = source.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

function pageShell({ title, bodyHtml, outFile }) {
  const outDir = path.dirname(outFile);
  const toRoot = path.relative(outDir, ROOT) || '.';
  const cssHref = path.join(toRoot, 'css', 'docs.css').split(path.sep).join('/');
  const gameHref = path.join(toRoot, 'index.html').split(path.sep).join('/');
  const docsIndexHref = path.join(toRoot, 'docs', 'index.html').split(path.sep).join('/');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} · Splatbot</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:wght@400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${cssHref}">
</head>
<body class="docs-body">
  <header class="docs-header">
    <nav class="docs-nav">
      <a class="docs-brand" href="${gameHref}">Splatbot</a>
      <span class="docs-sep">/</span>
      <a class="docs-crumb" href="${docsIndexHref}">Docs</a>
    </nav>
  </header>
  <main class="docs-main markdown-body">
${bodyHtml}
  </main>
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
 * Map a `.md` href under `docs/src` to the relative URL between built HTML files.
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

let slugger = new GithubSlugger();

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
})
  .use(markdownItAnchor, {
    slugify: (s) => slugger.slug(s),
    permalink: false,
  })
  .use(mdLinkRewritePlugin);

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
        if (path.resolve(p) === path.resolve(SRC)) continue;
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
  await cleanGeneratedHtml();

  for await (const absMd of iterMarkdownFiles(SRC)) {
    const rel = path.relative(SRC, absMd).split(path.sep).join('/');
    const raw = await fs.readFile(absMd, 'utf8');
    const title = titleFromMarkdown(raw, rel.replace(/\.md$/i, ''));
    const bodyHtml = renderMarkdown(raw, absMd);
    const outFile = outPathForSource(rel);
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    const html = pageShell({ title, bodyHtml, outFile });
    await fs.writeFile(outFile, html, 'utf8');
  }

  console.log('docs: built HTML under docs/ from docs/src');
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
