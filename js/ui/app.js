import config from '../config.js';
import { makeInitialState } from '../engine/game-state.js';
import { renderHexGrid } from '../renderer/hex-renderer.js';
import {
  logEvent,
  clearLog,
  initEventConsole,
  attachEventLogMirror,
  onLogLine,
  onLogClear,
} from './event-console.js';
import {
  initPlayerCardEventFeed,
  syncPlayerCardsFromLogLine,
  clearPlayerCardFeeds,
  setPlayerCardFeedForPlayer,
} from './player-card-log-feed.js';
import {
  loadOverrides, saveOverrides, mergeWithDefaults, applyToConfig,
  buildSettingsUI, validateOverrides, SETTING_SPECS,
} from './settings.js';
import { fireWinCelebration } from './confetti.js';
import { BotRunner } from '../sandbox/bot-runner.js';
import {
  buildBotCatalog,
  getDefaultBotId,
  STUB_BOT_CODE,
} from '../bots/catalog.js';

let state = null;
let running = false;
let tickDelay = config.TICK_DELAY;
let lastTick = 0;

/** True while a multi-tick step is running (blocks live loop advances). */
let stepBusy = false;
/** Number of simulation ticks the Step button runs (dropdown). */
let stepTickCount = 1;

const STEP_PRESET_COUNTS = [1, 2, 3, 5, 10, 25, 50, 100];
const STEP_TICK_MAX = 99999;

/** Slider 1–20 ↔ delay (s); must stay consistent with `#speed-slider` min/max. */
const SPEED_SLIDER_MIN = 1;
const SPEED_SLIDER_MAX = 20;

function tickDelayFromSlider(val) {
  return Math.max(0.03, 0.53 - val * 0.025);
}

function sliderValueFromTickDelay(delay) {
  const v = Math.round((0.53 - delay) / 0.025);
  return Math.min(SPEED_SLIDER_MAX, Math.max(SPEED_SLIDER_MIN, v));
}
const runners = {};
let settingsForm = null;

let hexGridPy = '';
let actionsPy = '';

/** @type {Map<string, string>} */
const botSourceCache = new Map();
/** @type {Map<string, Promise<string>>} */
const botFetchPending = new Map();
let botCatalog = [];
/** @type {Map<string, { id: string, group: string, label: string, path: string }>} */
let catalogById = new Map();
const playerBotId = { 1: null, 2: null };
/** Shown under CHOOSE FILE after a successful upload or docs import. */
const uploadDisplayName = { 1: null, 2: null };
let botControlsReady = false;

const els = {};

function makeInitialMatchStats() {
  return {
    1: {
      tilesPainted: 0,
      tilesMoved: 0,
      skips: 0,
      blockedActions: 0,
      moves: 0,
      dashes: 0,
      splats: 0,
      paintballs: 0,
    },
    2: {
      tilesPainted: 0,
      tilesMoved: 0,
      skips: 0,
      blockedActions: 0,
      moves: 0,
      dashes: 0,
      splats: 0,
      paintballs: 0,
    },
  };
}

let matchStats = makeInitialMatchStats();

let eventLogPopoutWin = null;
let eventLogPopoutDetach = null;

function hideMatchEndModal() {
  if (!els.matchEndModal) return;
  els.matchEndModal.classList.remove('open');
  els.matchEndModal.setAttribute('aria-hidden', 'true');
}

function showMatchEndModal() {
  if (!els.matchEndModal || !els.matchEndMessage) return;
  const w = state?.winner();
  const sc = state?.score?.() ?? { 1: 0, 2: 0 };
  const p1 = config.PLAYER_BOT_COLORS[1];
  const p2 = config.PLAYER_BOT_COLORS[2];
  if (w === 1 || w === 2) {
    const winnerScore = sc[w];
    const loser = w === 1 ? 2 : 1;
    const loserScore = sc[loser];
    const winnerColor = w === 1 ? p1 : p2;
    const loserColor = loser === 1 ? p1 : p2;
    els.matchEndMessage.innerHTML =
      `Player ${w} wins! ` +
      `<span style="color:${winnerColor}">${winnerScore}</span> - ` +
      `<span style="color:${loserColor}">${loserScore}</span>`;
    els.matchEndMessage.style.color = '#c6d6e6';
  } else {
    els.matchEndMessage.innerHTML =
      `Draw! <span style="color:${p1}">${sc[1]}</span> - <span style="color:${p2}">${sc[2]}</span>`;
    els.matchEndMessage.style.color = '#c6d6e6';
  }

  if (els.matchEndStats) {
    const s1 = matchStats[1];
    const s2 = matchStats[2];
    const rows = [
      ['Tiles painted', s1.tilesPainted, s2.tilesPainted],
      ['Tiles moved', s1.tilesMoved, s2.tilesMoved],
      ['Skips', s1.skips, s2.skips],
      ['Move uses', s1.moves, s2.moves],
      ['Dash uses', s1.dashes, s2.dashes],
      ['Splat uses', s1.splats, s2.splats],
      ['Paintball uses', s1.paintballs, s2.paintballs],
      ['Blocked actions', s1.blockedActions, s2.blockedActions],
    ];
    els.matchEndStats.innerHTML = `
      <table class="match-end-stats-table" aria-label="Player match stats">
        <thead>
          <tr>
            <th>Stat</th>
            <th style="color:${p1}">P1</th>
            <th style="color:${p2}">P2</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(([name, a, b]) => `
            <tr>
              <td>${name}</td>
              <td>${a}</td>
              <td>${b}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
  els.matchEndModal.classList.add('open');
  els.matchEndModal.setAttribute('aria-hidden', 'false');
}

function setRootCssVar(name, value) {
  document.documentElement.style.setProperty(name, value);
}

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }) {
  return `#${clampByte(r).toString(16).padStart(2, '0')}${clampByte(g).toString(16).padStart(2, '0')}${clampByte(b).toString(16).padStart(2, '0')}`;
}

function mixHex(a, b, t) {
  const c1 = hexToRgb(a);
  const c2 = hexToRgb(b);
  const m = Math.max(0, Math.min(1, t));
  return rgbToHex({
    r: c1.r + (c2.r - c1.r) * m,
    g: c1.g + (c2.g - c1.g) * m,
    b: c1.b + (c2.b - c1.b) * m,
  });
}

function srgbToLinear(v) {
  const x = v / 255;
  if (x <= 0.04045) return x / 12.92;
  return ((x + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(a, b) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function ensureContrast(color, bg, minRatio = 3.2) {
  const againstWhite = contrastRatio('#ffffff', bg);
  const againstBlack = contrastRatio('#000000', bg);
  const target = againstWhite >= againstBlack ? '#ffffff' : '#000000';
  let out = color;
  let i = 0;
  while (contrastRatio(out, bg) < minRatio && i < 9) {
    out = mixHex(out, target, 0.22);
    i += 1;
  }
  return out;
}

function applyPlayerThemeVars() {
  const cardBg = '#0e1525';
  const p1Dark = ensureContrast(config.PLAYER_DARK_COLORS[1], cardBg, 3.0);
  const p1Base = ensureContrast(config.PLAYER_BOT_COLORS[1], cardBg, 3.4);
  const p1Bright = ensureContrast(config.PLAYER_BRIGHT_COLORS[1], cardBg, 4.0);
  const p2Dark = ensureContrast(config.PLAYER_DARK_COLORS[2], cardBg, 3.0);
  const p2Base = ensureContrast(config.PLAYER_BOT_COLORS[2], cardBg, 3.4);
  const p2Bright = ensureContrast(config.PLAYER_BRIGHT_COLORS[2], cardBg, 4.0);
  const vars = [
    ['--player1-base', p1Base],
    ['--player1-bright', p1Bright],
    ['--player1-dark', p1Dark],
    ['--player2-base', p2Base],
    ['--player2-bright', p2Bright],
    ['--player2-dark', p2Dark],
  ];
  for (const [name, value] of vars) {
    setRootCssVar(name, value);
  }
  if (eventLogPopoutWin && !eventLogPopoutWin.closed) {
    for (const [name, value] of vars) {
      eventLogPopoutWin.document.documentElement.style.setProperty(name, value);
    }
  }
}

function setEventLogExpanded(expanded) {
  const app = document.getElementById('app');
  const panel = document.getElementById('event-log-panel');
  const expandBtn = document.getElementById('btn-event-log-expand');
  const hideBtn = document.getElementById('btn-event-log-hide');
  if (!panel) return;

  /* Attribute + CSS `#event-log-panel[hidden]` — property alone can desync in some cases. */
  if (expanded) {
    panel.removeAttribute('hidden');
  } else {
    panel.setAttribute('hidden', '');
  }

  if (expanded) app?.classList.add('event-log-expanded');
  else app?.classList.remove('event-log-expanded');

  if (expandBtn) {
    if (expanded) {
      expandBtn.setAttribute('hidden', '');
    } else {
      expandBtn.removeAttribute('hidden');
    }
    expandBtn.setAttribute('aria-expanded', 'false');
    expandBtn.textContent = 'EVENT LOG';
    expandBtn.setAttribute('aria-label', 'Show event log');
  }

  if (hideBtn) {
    hideBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }
}

function logPythonLoadFailure(pid, err) {
  const detail = err?.message ?? String(err);
  const msg = `P${pid} — Python error\n${detail}`;
  logEvent(msg);
  setPlayerCardFeedForPlayer(pid, msg, { error: true });
  setEventLogExpanded(true);
}

/** Must match worker expectations before `runPython` (see also `bot-worker.js`). */
const BOT_CLASS_RE = /\bclass\s+Bot\b/;
const BOT_INSTANCE_DECIDE_RE = /\bdef\s+decide\s*\(\s*self\b/;

/** Pre-Pyodide checks: must match what the worker expects before `runPython`. */
function describeBotScriptShapeIssues(source) {
  const issues = [];
  if (!BOT_CLASS_RE.test(source)) {
    const m = source.match(/\bclass\s+(\w+)/);
    if (m && m[1] !== 'Bot') {
      issues.push(`Found class \`${m[1]}\`, but it must be named exactly \`Bot\` (case-sensitive).`);
    } else {
      issues.push('Must declare `class Bot:` — the main bot class cannot use another name.');
    }
  }
  if (!BOT_INSTANCE_DECIDE_RE.test(source)) {
    issues.push('Must define `def decide(self, game_state):` on `Bot` that returns an Action.');
  }
  if (issues.length === 0) return null;
  return issues.join('\n');
}

function logUploadShapeFailure(pid, detail) {
  const msg = `P${pid} — Upload rejected (script shape)\n${detail}`;
  logEvent(msg);
  setPlayerCardFeedForPlayer(pid, msg, { error: true });
  setEventLogExpanded(true);
}

function openEventLogPopout() {
  if (eventLogPopoutWin && !eventLogPopoutWin.closed) {
    eventLogPopoutWin.focus();
    return;
  }

  const cssHref = new URL('css/styles.css', window.location.href).href;
  const fontHref = 'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:wght@400;600;700&display=swap';
  const w = window.open(
    '',
    'SplatbotEventLog',
    'width=720,height=520,menubar=no,toolbar=no,scrollbars=yes',
  );
  if (!w) {
    logEvent('Pop-up blocked — allow pop-ups for this site to use Event log pop-out.');
    return;
  }

  eventLogPopoutWin = w;
  w.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Splatbot — Event log</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="${fontHref}" rel="stylesheet">
<link rel="stylesheet" href="${cssHref}">
<style>
  html { height: 100%; margin: 0; overflow: hidden; }
  body {
    height: 100%;
    margin: 0;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: #080c14;
  }
</style>
</head>
<body>
  <div id="event-log-pop" class="event-log event-log--popout-fill"></div>
</body>
</html>`);
  w.document.close();

  const inner = w.document.getElementById('event-log-pop');
  applyPlayerThemeVars();
  if (eventLogPopoutDetach) {
    eventLogPopoutDetach();
    eventLogPopoutDetach = null;
  }
  const detach = attachEventLogMirror(inner);
  eventLogPopoutDetach = detach;

  w.addEventListener('unload', () => {
    if (eventLogPopoutWin === w) eventLogPopoutWin = null;
    if (eventLogPopoutDetach === detach) eventLogPopoutDetach = null;
    detach();
  }, { once: true });

  w.focus();
}

const DOCS_IMPORT_KEY = 'splatbot_import_bot_p1_v1';
const DOCS_IMPORT_FLAG = 'importBotP1';

function looksLikeUploadableBot(source) {
  return describeBotScriptShapeIssues(source) === null;
}

function hasDocsImportFlag() {
  const params = new URLSearchParams(window.location.search || '');
  return params.get(DOCS_IMPORT_FLAG) === '1';
}

function clearDocsImportFlagFromUrl() {
  if (!hasDocsImportFlag()) return;
  const url = new URL(window.location.href);
  url.searchParams.delete(DOCS_IMPORT_FLAG);
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(null, '', next);
}

async function consumeDocsBotImportForPlayerOne() {
  const shouldImport = hasDocsImportFlag();
  if (!shouldImport) return;

  let raw = null;
  try {
    raw = localStorage.getItem(DOCS_IMPORT_KEY);
  } catch {
    clearDocsImportFlagFromUrl();
    return;
  }

  if (!raw) {
    clearDocsImportFlagFromUrl();
    return;
  }

  try {
    const payload = JSON.parse(raw);
    const source = typeof payload?.source === 'string' ? payload.source : '';
    const shapeIssues = describeBotScriptShapeIssues(source);
    if (shapeIssues) {
      const msg = `P1 — Docs import rejected (script shape)\n${shapeIssues}`;
      logEvent(msg);
      setPlayerCardFeedForPlayer(1, msg, { error: true });
      setEventLogExpanded(true);
      return;
    }
    botSourceCache.set('upload:1', source);
    uploadDisplayName[1] = 'From docs';
    await applyBotForPlayer(1, 'upload:1', { isInitialLoad: false });
    syncFileUploadRow(1);
    logEvent('P1 loaded bot from docs example.');
  } catch (err) {
    const detail = err?.message ?? String(err);
    const msg = `Docs bot import — Python error\n${detail}`;
    logEvent(msg);
    setPlayerCardFeedForPlayer(1, msg, { error: true });
    setEventLogExpanded(true);
  } finally {
    try {
      localStorage.removeItem(DOCS_IMPORT_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }
    clearDocsImportFlagFromUrl();
  }
}

function rebuildCatalogMaps() {
  botCatalog = buildBotCatalog();
  catalogById = new Map(botCatalog.map((e) => [e.id, e]));
}

function populateBotSelects() {
  rebuildCatalogMaps();
  for (const pid of [1, 2]) {
    const sel = els[`botSelect${pid}`];
    if (!sel) continue;
    sel.innerHTML = '';
    const byGroup = new Map();
    for (const e of botCatalog) {
      if (!byGroup.has(e.group)) byGroup.set(e.group, []);
      byGroup.get(e.group).push(e);
    }
    for (const [groupName, items] of byGroup) {
      const og = document.createElement('optgroup');
      og.label = groupName;
      for (const e of items) {
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.textContent = e.label;
        og.appendChild(opt);
      }
      sel.appendChild(og);
    }
    const customOg = document.createElement('optgroup');
    customOg.label = 'Custom';
    const customOpt = document.createElement('option');
    customOpt.value = `upload:${pid}`;
    customOpt.textContent = 'Uploaded file';
    customOg.appendChild(customOpt);
    sel.appendChild(customOg);
  }
}

async function fetchBotSource(botId) {
  if (botId.startsWith('upload:')) {
    if (botSourceCache.has(botId)) return botSourceCache.get(botId);
    throw new Error('Upload a .py bot file first.');
  }
  if (botSourceCache.has(botId)) return botSourceCache.get(botId);
  if (botFetchPending.has(botId)) return botFetchPending.get(botId);
  const entry = catalogById.get(botId);
  if (!entry) throw new Error(`Unknown bot: ${botId}`);
  const p = (async () => {
    const res = await fetch(entry.path);
    if (!res.ok) throw new Error(`${entry.path} (${res.status})`);
    const text = await res.text();
    botSourceCache.set(botId, text);
    return text;
  })();
  botFetchPending.set(botId, p);
  try {
    return await p;
  } finally {
    botFetchPending.delete(botId);
  }
}

function syncFileUploadRow(pid) {
  const input = els[`botFile${pid}`];
  const statusEl = els[`botFileStatus${pid}`];
  const botId = `upload:${pid}`;
  const hasCache = botSourceCache.has(botId);
  const hasPickedFile = Boolean(input?.files?.length);
  if (statusEl) {
    if (uploadDisplayName[pid]) statusEl.textContent = uploadDisplayName[pid];
    else if (hasPickedFile && input?.files?.[0]) statusEl.textContent = input.files[0].name;
    else if (hasCache) statusEl.textContent = 'Uploaded — in memory (pick "Uploaded file" in list, or CHOOSE FILE to replace)';
    else statusEl.textContent = 'No file chosen';
  }
}

async function applyBotForPlayer(pid, botId, { isInitialLoad = false } = {}) {
  const code = await fetchBotSource(botId);
  await runners[pid].setBotCode(code);
  playerBotId[pid] = botId;
  const sel = els[`botSelect${pid}`];
  if (sel) sel.value = botId;
  syncFileUploadRow(pid);
  if (!isInitialLoad) {
    running = false;
    for (const p of [1, 2]) {
      if (runners[p]) runners[p].resetTimingStats();
    }
    await Promise.all([1, 2].map((p) => runners[p] && runners[p].resetBotInstance()));
    state = makeInitialState();
    matchStats = makeInitialMatchStats();
    hideMatchEndModal();
    push();
    logEvent(`P${pid} bot changed — match reset.`);
  }
}

async function onBotFileChange(pid, input) {
  if (!botControlsReady || !input) return;
  const file = input.files?.[0];
  if (!file) {
    syncFileUploadRow(pid);
    return;
  }
  const botId = `upload:${pid}`;
  let text;
  try {
    text = await file.text();
  } catch (err) {
    input.value = '';
    logEvent(`Failed to read file: ${err.message || err}`);
    syncFileUploadRow(pid);
    return;
  }
  const shapeIssues = describeBotScriptShapeIssues(text);
  if (shapeIssues) {
    input.value = '';
    logUploadShapeFailure(pid, shapeIssues);
    syncFileUploadRow(pid);
    return;
  }
  const prevUpload = botSourceCache.get(botId);
  const prevLabel = uploadDisplayName[pid];
  botSourceCache.set(botId, text);
  uploadDisplayName[pid] = file.name;
  const locks = [els.botSelect1, els.botSelect2].filter(Boolean);
  for (const s of locks) s.disabled = true;
  try {
    await applyBotForPlayer(pid, botId, { isInitialLoad: false });
    logEvent(`P${pid} using uploaded bot: ${file.name}`);
  } catch (err) {
    if (prevUpload !== undefined) botSourceCache.set(botId, prevUpload);
    else botSourceCache.delete(botId);
    uploadDisplayName[pid] = prevLabel ?? null;
    input.value = '';
    logPythonLoadFailure(pid, err);
  } finally {
    for (const s of locks) s.disabled = false;
    syncFileUploadRow(pid);
  }
}

/**
 * Clears cached upload for this player, resets the native file input, and reverts
 * to the catalog default bot if they were actively using the upload slot.
 * Used before opening the file picker so the same file can be chosen again.
 */
async function prepareBotFilePicker(pid) {
  if (!botControlsReady) return;
  const botId = `upload:${pid}`;
  const input = els[`botFile${pid}`];
  uploadDisplayName[pid] = null;
  botSourceCache.delete(botId);
  if (input) input.value = '';
  const usingUpload = playerBotId[pid] === botId;
  const locks = [els.botSelect1, els.botSelect2].filter(Boolean);
  for (const s of locks) s.disabled = true;
  try {
    if (usingUpload) {
      const fallback = getDefaultBotId(botCatalog);
      if (fallback) await applyBotForPlayer(pid, fallback, { isInitialLoad: false });
      else syncFileUploadRow(pid);
    } else {
      syncFileUploadRow(pid);
    }
  } finally {
    for (const s of locks) s.disabled = false;
    syncFileUploadRow(pid);
  }
}

async function openBotFilePicker(pid) {
  await prepareBotFilePicker(pid);
  els[`botFile${pid}`]?.click();
}

async function onBotSelectChange(pid) {
  if (!botControlsReady) return;
  const sel = els[`botSelect${pid}`];
  if (!sel) return;
  const next = sel.value;
  const prev = playerBotId[pid];
  if (next === prev) return;
  const locks = [els.botSelect1, els.botSelect2].filter(Boolean);
  for (const s of locks) s.disabled = true;
  try {
    await applyBotForPlayer(pid, next, { isInitialLoad: false });
  } catch (err) {
    if (prev != null) sel.value = prev;
    logPythonLoadFailure(pid, err);
  } finally {
    for (const s of locks) s.disabled = false;
  }
}

// ── Public bootstrap API ─────────────────────────────────────────────────

export function initApp() {
  els.hexGrid = document.getElementById('hex-grid');
  els.score1 = document.getElementById('score-1');
  els.score2 = document.getElementById('score-2');
  els.pct1 = document.getElementById('pct-1');
  els.pct2 = document.getElementById('pct-2');
  els.decisionTime1 = document.getElementById('decision-time-1');
  els.decisionTime2 = document.getElementById('decision-time-2');
  els.turnNum = document.getElementById('turn-num');
  els.maxTurns = document.getElementById('max-turns');
  els.progressFill = document.getElementById('progress-fill');
  els.status = document.getElementById('status');
  els.speedSlider = document.getElementById('speed-slider');
  els.eventLog = document.getElementById('event-log');
  els.settingsModal = document.getElementById('settings-modal');
  els.settingsFields = document.getElementById('settings-fields');
  els.matchEndModal = document.getElementById('match-end-modal');
  els.matchEndMessage = document.getElementById('match-end-message');
  els.matchEndStats = document.getElementById('match-end-stats');
  els.matchEndClose = document.getElementById('btn-match-end-close');
  els.runToggle = document.getElementById('btn-run');
  els.botSelect1 = document.getElementById('bot-select-1');
  els.botSelect2 = document.getElementById('bot-select-2');
  els.botFile1 = document.getElementById('bot-file-1');
  els.botFile2 = document.getElementById('bot-file-2');
  els.botFileChoose1 = document.getElementById('bot-file-choose-1');
  els.botFileChoose2 = document.getElementById('bot-file-choose-2');
  els.botFileStatus1 = document.getElementById('bot-file-status-1');
  els.botFileStatus2 = document.getElementById('bot-file-status-2');

  populateBotSelects();
  if (els.botSelect1) els.botSelect1.disabled = true;
  if (els.botSelect2) els.botSelect2.disabled = true;
  if (els.botSelect1) els.botSelect1.addEventListener('change', () => onBotSelectChange(1));
  if (els.botSelect2) els.botSelect2.addEventListener('change', () => onBotSelectChange(2));
  if (els.botFile1) els.botFile1.addEventListener('change', () => onBotFileChange(1, els.botFile1));
  if (els.botFile2) els.botFile2.addEventListener('change', () => onBotFileChange(2, els.botFile2));
  if (els.botFileChoose1) els.botFileChoose1.addEventListener('click', () => { void openBotFilePicker(1); });
  if (els.botFileChoose2) els.botFileChoose2.addEventListener('click', () => { void openBotFilePicker(2); });
  syncFileUploadRow(1);
  syncFileUploadRow(2);

  initEventConsole(els.eventLog);
  initPlayerCardEventFeed();
  onLogLine(syncPlayerCardsFromLogLine);
  onLogClear(clearPlayerCardFeeds);

  const btnEventLogExpand = document.getElementById('btn-event-log-expand');
  const btnEventLogPopout = document.getElementById('btn-event-log-popout');
  if (btnEventLogExpand) {
    btnEventLogExpand.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setEventLogExpanded(true);
    });
  }
  const btnEventLogHide = document.getElementById('btn-event-log-hide');
  if (btnEventLogHide) {
    btnEventLogHide.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setEventLogExpanded(false);
    });
  }
  if (btnEventLogPopout) {
    btnEventLogPopout.addEventListener('click', () => openEventLogPopout());
  }
  setEventLogExpanded(false);

  const overrides = loadOverrides();
  const effective = mergeWithDefaults(overrides);
  applyToConfig(effective);
  applyPlayerThemeVars();
  tickDelay = config.TICK_DELAY;
  if (els.speedSlider) {
    els.speedSlider.min = String(SPEED_SLIDER_MIN);
    els.speedSlider.max = String(SPEED_SLIDER_MAX);
    els.speedSlider.value = String(sliderValueFromTickDelay(tickDelay));
  }

  state = makeInitialState();
  matchStats = makeInitialMatchStats();

  if (els.runToggle) els.runToggle.addEventListener('click', toggleRun);
  initStepControl();
  document.getElementById('btn-reset').addEventListener('click', () => {
    void resetGame({ clearEventLog: true });
  });
  document.getElementById('btn-settings').addEventListener('click', openSettings);
  document.getElementById('btn-settings-reset').addEventListener('click', resetSettingsForm);
  document.getElementById('btn-settings-cancel').addEventListener('click', closeSettings);
  document.getElementById('btn-settings-apply').addEventListener('click', applySettings);
  els.speedSlider.addEventListener('input', (e) => setSpeed(Number(e.target.value)));
  if (els.matchEndClose) {
    els.matchEndClose.addEventListener('click', hideMatchEndModal);
  }
  if (els.matchEndModal) {
    els.matchEndModal.addEventListener('click', (e) => {
      if (e.target === els.matchEndModal) hideMatchEndModal();
    });
  }

  push();
  logEvent('Splatbot ready — press START to begin demo.');

  gameLoop();
}

export function updateLoadingStatus(text) {
  const el = document.getElementById('loading-status');
  if (el) el.textContent = text;
}

export async function preloadWorkers() {
  botControlsReady = false;
  updateLoadingStatus('Fetching Python modules...');
  const [hg, ac] = await Promise.all([
    fetch('python/utils/hex_grid.py').then((r) => r.text()),
    fetch('python/utils/actions.py').then((r) => r.text()),
  ]);
  hexGridPy = hg;
  actionsPy = ac;

  updateLoadingStatus('Starting Python sandbox (first load may take a moment)...');
  for (const pid of [1, 2]) {
    runners[pid] = new BotRunner(pid, STUB_BOT_CODE);
    await runners[pid].init(hexGridPy, actionsPy);
  }

  const defaultId = getDefaultBotId(botCatalog);
  if (defaultId) {
    updateLoadingStatus('Loading default bot...');
    await Promise.all([
      applyBotForPlayer(1, defaultId, { isInitialLoad: true }),
      applyBotForPlayer(2, defaultId, { isInitialLoad: true }),
    ]);
  }

  await consumeDocsBotImportForPlayerOne();

  const noBots = botCatalog.length === 0;
  if (els.botSelect1) els.botSelect1.disabled = noBots;
  if (els.botSelect2) els.botSelect2.disabled = noBots;

  botControlsReady = true;
  syncFileUploadRow(1);
  syncFileUploadRow(2);
  syncStepControls();
  updateLoadingStatus('Ready.');
}

export function hideLoading() {
  const el = document.getElementById('loading');
  if (el) el.classList.add('hidden');
}

// ── DOM push ─────────────────────────────────────────────────────────────

function push() {
  if (!state) return;

  const sc = state.score();
  const pct = state.turn / Math.max(1, state.maxTurns);
  const cov = state.coveragePct();

  els.hexGrid.innerHTML = renderHexGrid(state, config.HEX_SIZE);
  els.score1.textContent = sc[1];
  els.score2.textContent = sc[2];
  els.pct1.textContent = `${cov[1].toFixed(1)}%`;
  els.pct2.textContent = `${cov[2].toFixed(1)}%`;
  els.turnNum.textContent = state.turn;
  els.maxTurns.textContent = `/ ${state.maxTurns}`;
  els.progressFill.style.width = `${(pct * 100).toFixed(1)}%`;

  for (const pid of [1, 2]) {
    const runner = runners[pid];
    const el = pid === 1 ? els.decisionTime1 : els.decisionTime2;
    if (runner) {
      const stats = runner.getTimingStats();
      const avg = stats.decisionCount > 0
        ? stats.totalDecisionSeconds / stats.decisionCount
        : 0;
      el.textContent = `${avg.toFixed(5)}s/dec`;
    } else {
      el.textContent = '0.00000s/dec';
    }
  }

  if (state.isOver) {
    const w = state.winner();
    if (w === 1) {
      els.status.textContent = 'P1 WINS';
      els.status.style.color = config.PLAYER_BOT_COLORS[1];
    } else if (w === 2) {
      els.status.textContent = 'P2 WINS';
      els.status.style.color = config.PLAYER_BOT_COLORS[2];
    } else {
      els.status.textContent = 'DRAW';
      els.status.style.color = '#8899aa';
    }
  } else if (running) {
    els.status.textContent = '● LIVE';
    els.status.style.color = '#22cc66';
  } else {
    els.status.textContent = '● PAUSED';
    els.status.style.color = '#4a6080';
  }

  if (els.runToggle) {
    els.runToggle.textContent = running ? '\u23F8  PAUSE' : '\u25B6  START';
    els.runToggle.setAttribute('aria-pressed', running ? 'true' : 'false');
    els.runToggle.setAttribute('aria-label', running ? 'Pause match' : 'Start match');
  }

  syncStepControls();
}

// ── Control callbacks ────────────────────────────────────────────────────

function toggleRun() {
  if (running) pauseGame();
  else void startGame();
}

async function startGame() {
  if (running) return;
  if (state?.isOver) {
    await resetGame();
  }
  hideMatchEndModal();
  running = true;
  lastTick = performance.now();
  push();
  logEvent('Match started.');
}

function pauseGame() {
  running = false;
  push();
  logEvent('Paused.');
}

async function resetGame(options = {}) {
  const { clearEventLog = false } = options;
  running = false;
  hideMatchEndModal();
  if (clearEventLog) clearLog();
  for (const pid of Object.keys(runners)) {
    runners[pid].resetTimingStats();
  }
  await Promise.all(Object.keys(runners).map((pid) => runners[pid].resetBotInstance()));
  state = makeInitialState();
  matchStats = makeInitialMatchStats();
  push();
  logEvent('Match reset.');
}

function setSpeed(val) {
  tickDelay = tickDelayFromSlider(val);
}

// ── One simulation tick (both bots act) — shared by live loop and Step ──

async function advanceSingleTick() {
  if (!state || state.isOver) return;

  const allReady = [1, 2].every(pid => !runners[pid] || runners[pid].ready);
  if (!allReady) return;

  state.advanceTurn();

  state.resetPaintClaims();
  for (const pid of [1, 2]) {
    const runner = runners[pid];
    if (!runner || !runner.ready) continue;
    try {
      const snapshot = state.toSnapshot(pid);
      const action = await runner.decide(snapshot);
      const report = state.applyAction(pid, action, logEvent);
      const stats = matchStats[pid];
      const actionType = String(action?.type || 'unknown');
      if (actionType === 'skip') stats.skips += 1;
      if (actionType === 'move') stats.moves += 1;
      if (actionType === 'dash') stats.dashes += 1;
      if (actionType === 'splat') stats.splats += 1;
      if (actionType === 'shoot_paintball') stats.paintballs += 1;
      if (report) {
        stats.tilesMoved += Number(report.movedTiles || 0);
        stats.tilesPainted += Number(report.paintedTiles || 0);
        if (report.blocked) stats.blockedActions += 1;
      }
    } catch (err) {
      logEvent(`Error in bot ${pid}: ${err}`);
    }
  }

  state.flushPaintClaims();
  state.neutralizeCollidingTiles(logEvent);
  state.tickBotTimers();

  if (state.isOver) {
    running = false;
  }

  push();

  if (state.isOver) {
    const sc = state.score();
    logEvent(`Match over — P1: ${sc[1]} tiles  |  P2: ${sc[2]} tiles`);
    const win = state.winner();
    if (win === 1 || win === 2) fireWinCelebration(win);
    showMatchEndModal();
  }
}

function syncStepControls() {
  const stepBtn = document.getElementById('btn-step');
  const menuBtn = document.getElementById('btn-step-menu');
  if (!stepBtn || !menuBtn) return;

  const disable = stepBusy || !botControlsReady || !state || state.isOver;
  stepBtn.disabled = disable;
  menuBtn.disabled = disable;
  if (disable) closeStepMenu();
}

function updateStepMainLabel() {
  const stepBtn = document.getElementById('btn-step');
  if (!stepBtn) return;
  const n = stepTickCount;
  const word = n === 1 ? 'tick' : 'ticks';
  stepBtn.textContent = `Step ${n} ${word}`;
}

function setStepMenuSelection(n) {
  const menu = document.getElementById('step-tick-menu');
  const customBtn = document.getElementById('btn-step-custom');
  if (!menu) return;

  menu.querySelectorAll('button[data-ticks]').forEach((opt) => {
    const v = parseInt(opt.getAttribute('data-ticks'), 10);
    const sel = v === n;
    opt.setAttribute('aria-selected', sel ? 'true' : 'false');
  });

  if (customBtn) {
    const customSel = !STEP_PRESET_COUNTS.includes(n);
    customBtn.setAttribute('aria-selected', customSel ? 'true' : 'false');
  }

  const input = document.getElementById('step-tick-custom-input');
  if (input) input.value = String(Math.min(STEP_TICK_MAX, Math.max(1, n)));
}

function closeStepMenu() {
  const menu = document.getElementById('step-tick-menu');
  const menuBtn = document.getElementById('btn-step-menu');
  const panel = document.getElementById('step-tick-custom-panel');
  if (panel) {
    panel.setAttribute('hidden', '');
  }
  if (menu) {
    menu.setAttribute('hidden', '');
  }
  if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
}

function applyCustomStepTicks() {
  const input = document.getElementById('step-tick-custom-input');
  if (!input) return;
  let v = parseInt(String(input.value).trim(), 10);
  if (!Number.isFinite(v)) v = 1;
  v = Math.min(STEP_TICK_MAX, Math.max(1, v));
  stepTickCount = v;
  input.value = String(v);
  updateStepMainLabel();
  setStepMenuSelection(stepTickCount);
  closeStepMenu();
}

function openStepMenu() {
  const menu = document.getElementById('step-tick-menu');
  const menuBtn = document.getElementById('btn-step-menu');
  const panel = document.getElementById('step-tick-custom-panel');
  if (!menu || !menuBtn || menuBtn.disabled) return;
  if (panel) panel.setAttribute('hidden', '');
  menu.removeAttribute('hidden');
  menuBtn.setAttribute('aria-expanded', 'true');
}

async function runStepTicks() {
  if (stepBusy || !botControlsReady || !state || state.isOver) return;

  stepBusy = true;
  syncStepControls();

  if (running) {
    running = false;
    push();
  }

  const n = Math.min(STEP_TICK_MAX, Math.max(1, Math.floor(Number(stepTickCount)) || 1));
  try {
    for (let i = 0; i < n; i++) {
      if (!state || state.isOver) break;
      await advanceSingleTick();
    }
  } finally {
    stepBusy = false;
    syncStepControls();
    push();
  }
}

function initStepControl() {
  const stepBtn = document.getElementById('btn-step');
  const menuBtn = document.getElementById('btn-step-menu');
  const menu = document.getElementById('step-tick-menu');
  const wrap = document.getElementById('step-control-wrap');
  const customBtn = document.getElementById('btn-step-custom');
  const customPanel = document.getElementById('step-tick-custom-panel');
  const customInput = document.getElementById('step-tick-custom-input');
  const customApply = document.getElementById('step-tick-custom-apply');
  if (!stepBtn || !menuBtn || !menu) return;

  updateStepMainLabel();
  setStepMenuSelection(stepTickCount);

  stepBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeStepMenu();
    runStepTicks();
  });

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menuBtn.disabled) return;
    if (menu.hasAttribute('hidden')) openStepMenu();
    else closeStepMenu();
  });

  menu.querySelectorAll('button[data-ticks]').forEach((opt) => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      if (customPanel) customPanel.setAttribute('hidden', '');
      const v = parseInt(opt.getAttribute('data-ticks'), 10);
      if (Number.isFinite(v) && v > 0) {
        stepTickCount = Math.min(STEP_TICK_MAX, v);
        updateStepMainLabel();
        setStepMenuSelection(stepTickCount);
      }
      closeStepMenu();
    });
  });

  if (customBtn && customPanel && customInput) {
    customBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !customPanel.hasAttribute('hidden');
      if (open) {
        customPanel.setAttribute('hidden', '');
      } else {
        customPanel.removeAttribute('hidden');
        customInput.value = String(Math.min(STEP_TICK_MAX, Math.max(1, stepTickCount)));
        customInput.focus();
        customInput.select();
      }
    });
  }

  if (customApply) {
    customApply.addEventListener('click', (e) => {
      e.stopPropagation();
      applyCustomStepTicks();
    });
  }

  if (customInput) {
    customInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyCustomStepTicks();
      }
    });
    customInput.addEventListener('click', (e) => e.stopPropagation());
  }

  document.addEventListener('click', (e) => {
    if (wrap && !wrap.contains(e.target)) closeStepMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu && !menu.hasAttribute('hidden')) closeStepMenu();
  });
}

// ── Game loop ────────────────────────────────────────────────────────────

async function gameLoop() {
  while (true) {
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (stepBusy) continue;
    if (!running) continue;

    const now = performance.now();
    if (now - lastTick < tickDelay * 1000) continue;
    lastTick = now;

    if (!state || state.isOver) {
      running = false;
      push();
      continue;
    }

    await advanceSingleTick();
  }
}

// ── Settings dialog ──────────────────────────────────────────────────────

function openSettings() {
  const overrides = loadOverrides();
  const effective = mergeWithDefaults(overrides);
  settingsForm = buildSettingsUI(els.settingsFields, effective);
  els.settingsModal.classList.add('open');
}

function closeSettings() {
  els.settingsModal.classList.remove('open');
}

function resetSettingsForm() {
  if (settingsForm) settingsForm.setValues(mergeWithDefaults({}));
}

function applySettings() {
  if (!settingsForm) return;
  const raw = settingsForm.getValues();
  const { clean, errors } = validateOverrides(raw);
  if (errors.length > 0) {
    logEvent(`Settings error: ${errors[0]}`);
    return;
  }
  saveOverrides(clean);
  applyToConfig(mergeWithDefaults(clean));
  applyPlayerThemeVars();
  tickDelay = config.TICK_DELAY;
  if (els.speedSlider) {
    els.speedSlider.value = String(sliderValueFromTickDelay(tickDelay));
  }
  if (running) {
    logEvent('Settings changed while live — pausing and resetting match.');
  }
  void resetGame();
  closeSettings();
  logEvent('Settings applied.');
}
