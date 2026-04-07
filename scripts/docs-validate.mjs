import fs from 'fs/promises';
import path from 'path';
import { spawnSync } from 'child_process';
import MarkdownIt from 'markdown-it';
import GithubSlugger from 'github-slugger';
import { looksLikeRunnableBot, BOT_CLASS_RE } from './bot-runnable.mjs';

const SKIP_SCHEMES = /^(mailto|tel|javascript):/i;
const EXTERNAL_PREFIX = /^[a-z][a-z0-9+.-]*:/i;

function splitHref(href) {
  const hashIdx = href.indexOf('#');
  const pathPart = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
  const fragment = hashIdx >= 0 ? href.slice(hashIdx + 1) : '';
  return { pathPart: pathPart.trim(), fragment };
}

function isExternalOrSpecial(trimmed) {
  return EXTERNAL_PREFIX.test(trimmed);
}

/** Slugs markdown-it-anchor would assign, in order (handles duplicate `-1` suffixes). */
function slugSetFromMarkdown(raw) {
  const slugger = new GithubSlugger();
  const slugs = new Set();
  const re = /^#{1,6}\s+(.+)$/gm;
  let m;
  while ((m = re.exec(raw))) {
    const title = m[1].trim().replace(/\s+#+\s*$/, '').trim();
    slugs.add(slugger.slug(title));
  }
  return slugs;
}

const headingSlugCache = new Map();

function getHeadingSlugsForMd(absMd, raw) {
  if (headingSlugCache.has(absMd)) return headingSlugCache.get(absMd);
  const set = slugSetFromMarkdown(raw);
  headingSlugCache.set(absMd, set);
  return set;
}

/** 1-based line number of `raw[charIndex]` (start of match). */
function line1FromCharIndex(raw, charIndex) {
  return raw.slice(0, charIndex).split(/\r?\n/).length;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Next `[text](href)` or `![alt](src)` whose destination equals `href` (same rules as
 * CommonMark inline link), starting at `fromIndex` in `raw`. Avoids false positives from
 * substring matches (e.g. `./x` inside `../x`).
 */
function findNextMdRefDestination(raw, href, kind, fromIndex) {
  if (!href) return null;
  const esc = escapeRegExp(href);
  const body =
    kind === 'image'
      ? `!\\[[^\\]]*\\]\\(\\s*${esc}(?:\\s+["'][^"']*["'])?\\s*\\)`
      : `\\[[^\\]]*\\]\\(\\s*${esc}(?:\\s+["'][^"']*["'])?\\s*\\)`;
  const re = new RegExp(body, 'g');
  re.lastIndex = fromIndex;
  const m = re.exec(raw);
  if (!m) return null;
  return { index: m.index, end: m.index + m[0].length };
}

/** Per-file scan cursors so repeated identical hrefs map to successive source locations (token order). */
function lineForNextHrefOccurrence(raw, href, kind, cursors, inlineMap) {
  const key = `${kind}\0${href}`;
  const start = cursors.get(key) ?? 0;

  const mdMatch = findNextMdRefDestination(raw, href, kind, start);
  if (mdMatch) {
    cursors.set(key, mdMatch.end);
    return line1FromCharIndex(raw, mdMatch.index);
  }

  // linkify: bare URL in source (no `](href)` wrapper)
  const bare = raw.indexOf(href, start);
  if (bare >= 0) {
    cursors.set(key, bare + href.length);
    return line1FromCharIndex(raw, bare);
  }

  if (inlineMap && typeof inlineMap[0] === 'number') {
    return inlineMap[0] + 1;
  }
  return 1;
}

function collectHrefsFromMarkdown(raw) {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
  });
  const tokens = md.parse(raw, {});
  const hrefs = [];
  const cursors = new Map();

  function walkToken(t, enclosingInlineMap) {
    const inlineMap = t.type === 'inline' && Array.isArray(t.map) ? t.map : enclosingInlineMap;
    if (!t.children?.length) return;
    for (const c of t.children) {
      if (c.type === 'link_open') {
        const idx = c.attrIndex('href');
        if (idx >= 0) {
          const value = c.attrs[idx][1];
          hrefs.push({
            kind: 'href',
            value,
            line: lineForNextHrefOccurrence(raw, value, 'href', cursors, inlineMap),
          });
        }
      } else if (c.type === 'image') {
        const idx = c.attrIndex('src');
        if (idx >= 0) {
          const value = c.attrs[idx][1];
          hrefs.push({
            kind: 'src',
            value,
            line: lineForNextHrefOccurrence(raw, value, 'image', cursors, inlineMap),
          });
        }
      }
      walkToken(c, inlineMap);
    }
  }

  for (const t of tokens) {
    walkToken(t, null);
  }
  return hrefs;
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function resolvePythonCommand() {
  const env = process.env.PYTHON?.trim();
  if (env) return env;
  for (const bin of ['python3', 'python']) {
    const r = spawnSync(bin, ['-c', 'import sys'], { encoding: 'utf8' });
    if (r.status === 0) return bin;
  }
  return null;
}

let pythonSyntaxWarned = false;

function validatePythonSyntax(source, bin) {
  const r = spawnSync(bin, ['-c', 'import ast,sys; ast.parse(sys.stdin.read())'], {
    input: source,
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    const detail = [r.stderr, r.stdout].filter(Boolean).join('\n').trim() || `exit ${r.status}`;
    return detail;
  }
  return null;
}

/**
 * @param {object} opts
 * @param {string} opts.root
 * @param {string} opts.src - docs-src
 * @param {string} opts.docs - docs output dir
 * @param {{ rel: string, absMd: string, raw: string, outFile: string }[]} opts.pages
 */
export async function validateDocs({ root, src, docs, pages }) {
  headingSlugCache.clear();
  const errors = [];
  const warnings = [];
  const rawByRel = new Map(pages.map((p) => [p.rel, p.raw]));

  for (const page of pages) {
    const refs = collectHrefsFromMarkdown(page.raw);
    for (const ref of refs) {
      const href = ref.value?.trim() ?? '';
      const label = ref.kind === 'src' ? 'image src' : 'link';
      const loc = `${page.rel}:${ref.line ?? 1}`;
      if (!href) continue;

      if (href.startsWith('#')) {
        const frag = href.slice(1);
        if (frag) {
          const slugs = getHeadingSlugsForMd(page.absMd, page.raw);
          const dec = decodeURIComponent(frag);
          if (!slugs.has(dec)) {
            errors.push(`${loc}: ${label} "${href}" — missing heading anchor #${dec}`);
          }
        }
        continue;
      }

      const { pathPart, fragment } = splitHref(href);
      if (!pathPart) {
        if (fragment) {
          const slugs = getHeadingSlugsForMd(page.absMd, page.raw);
          const dec = decodeURIComponent(fragment);
          if (!slugs.has(dec)) {
            errors.push(`${loc}: ${label} "${href}" — missing heading anchor #${dec}`);
          }
        }
        continue;
      }

      if (SKIP_SCHEMES.test(pathPart)) continue;
      if (/^https?:\/\//i.test(pathPart)) continue;
      if (pathPart.startsWith('//')) continue;

      if (isExternalOrSpecial(pathPart)) continue;

      if (/\.html?$/i.test(pathPart)) {
        const resolved = path.normalize(path.resolve(path.dirname(page.outFile), pathPart));
        const relToRoot = path.relative(root, resolved);
        if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) {
          errors.push(`${loc}: ${label} "${href}" — resolves outside repo (${relToRoot})`);
          continue;
        }
        if (!(await pathExists(resolved))) {
          errors.push(`${loc}: ${label} "${href}" — missing file ${path.relative(root, resolved) || '.'}`);
        }
        continue;
      }

      let targetMdAbs;
      if (/\.md$/i.test(pathPart)) {
        targetMdAbs = path.normalize(path.resolve(path.dirname(page.absMd), pathPart));
      } else {
        const dirAbs = path.normalize(path.resolve(path.dirname(page.absMd), pathPart));
        targetMdAbs = path.join(dirAbs, 'index.md');
      }

      const relToSrc = path.relative(src, targetMdAbs).split(path.sep).join('/');
      if (relToSrc.startsWith('..') || path.isAbsolute(relToSrc)) {
        errors.push(`${loc}: ${label} "${href}" — target not under docs-src (${pathPart})`);
        continue;
      }

      if (!(await pathExists(targetMdAbs))) {
        errors.push(`${loc}: ${label} "${href}" — no file found at "${relToSrc}"`);
        continue;
      }

      if (fragment) {
        const dec = decodeURIComponent(fragment);
        const targetRaw = rawByRel.get(relToSrc);
        if (!targetRaw) {
          errors.push(`${loc}: ${label} "${href}" — internal: no page content for ${relToSrc}`);
          continue;
        }
        const slugs = getHeadingSlugsForMd(targetMdAbs, targetRaw);
        if (!slugs.has(dec)) {
          errors.push(`${loc}: ${label} "${href}" — missing heading #${dec} in ${relToSrc}`);
        }
      }
    }
  }

  const pyCmd = resolvePythonCommand();
  if (!pyCmd && !pythonSyntaxWarned) {
    pythonSyntaxWarned = true;
    warnings.push(
      'docs validate: no Python on PATH — skipping `ast.parse` on bot blocks (set PYTHON to enable).'
    );
  }

  const pythonFenceRe = /^```python(?:[ \t]+[^\n]*)?\n([\s\S]*?)^```/gm;

  for (const page of pages) {
    let fenceIdx = 0;
    let m;
    pythonFenceRe.lastIndex = 0;
    while ((m = pythonFenceRe.exec(page.raw)) !== null) {
      fenceIdx += 1;
      const fenceLine = line1FromCharIndex(page.raw, m.index);
      const loc = `${page.rel}:${fenceLine}`;
      const body = m[1].replace(/\r\n/g, '\n');
      // Same trigger as the docs "Try it out" button (class Bot). Skip API/type-stub fences, etc.
      if (!BOT_CLASS_RE.test(body)) continue;
      if (!looksLikeRunnableBot(body)) {
        errors.push(
          `${loc}: python fence #${fenceIdx} declares class Bot but must use def decide(self, ...) (Try it out / game import parity).`
        );
        continue;
      }
      if (pyCmd) {
        const synErr = validatePythonSyntax(body, pyCmd);
        if (synErr) {
          errors.push(`${loc}: python fence #${fenceIdx} — syntax error:\n${synErr}`);
        }
      }
    }
  }

  return { errors, warnings };
}
