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
  loadOverrides,
  saveOverrides,
  mergeWithDefaults,
  applyToConfig,
  buildSettingsUI,
  validateOverrides,
  serializeSettingsProfile,
  parseSettingsProfileJSON,
} from './settings.js';
import { fireWinCelebration } from './confetti.js';
import { BotRunner } from '../sandbox/bot-runner.js';
import {
  buildBotCatalog,
  getDefaultBotId,
  STUB_BOT_CODE,
} from '../bots/catalog.js';
import {
  loadCustomBotEntries,
  appendCustomBotUpload,
  appendCustomBotWithDisplayName,
  upsertDocsImportBot,
  getCustomBotSource,
  getCustomBotDisplayName,
  removeCustomBotById,
  baseDisplayName,
  familyCountForBase,
  hasDuplicateFamily,
  overwriteCustomBotFamilyMember,
  setCustomBotEntrySource,
  customBotDisplayNameCollides,
} from '../bots/custom-bots-store.js';
import { describeBotScriptShapeIssues } from '../bot-script-shape.js';

let state = null;
let running = false;
/** After the first live run for the current match, paused (not over) shows RESUME instead of START. */
let hadLiveRunThisMatch = false;
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
let starterCodePy = '';
let splatbotDataTypesPy = '';
const STARTER_ZIP_NAME = 'splatbot_starter_code.zip';

/** @type {{ path: string, content: string }[] | null} Cached built-in bots for starter zip (`examples/`). Null until first successful load. */
let exampleBotsZipEntries = null;

/** @type {Map<string, string>} */
const botSourceCache = new Map();
/** @type {Map<string, Promise<string>>} */
const botFetchPending = new Map();
let botCatalog = [];
/** @type {Map<string, { id: string, group: string, label: string, path: string }>} */
let catalogById = new Map();
const playerBotId = { 1: null, 2: null };
/** @type {1|2|null} */
let botPickerOpenPid = null;
let botPickerDelegationBound = false;
let botPickerOutsideBound = false;
/** @type {((value: boolean) => void) | null} */
let deleteCustomBotConfirmResolve = null;
let botControlsReady = false;
/** Player + bot id for the open source modal (copy / download). */
let botSourceModalContext = null;
/** Bumps on each open/close so async highlight cannot paint a stale modal. */
let botSourceModalSeq = 0;
let hljsBotSourceCache = null;
let botSourceCopyResetTimer = 0;

async function ensureHljsBotSource() {
  if (hljsBotSourceCache) return hljsBotSourceCache;
  const [coreMod, pythonMod] = await Promise.all([
    import('https://esm.sh/highlight.js@11.10.0/es/core.js'),
    import('https://esm.sh/highlight.js@11.10.0/es/languages/python.js'),
  ]);
  const hljs = coreMod.default;
  hljs.registerLanguage('python', pythonMod.default);
  hljsBotSourceCache = hljs;
  return hljs;
}

async function applyBotSourceHighlight(rawText, seq) {
  const el = els.botSourceCode;
  if (!el || seq !== botSourceModalSeq) return;
  try {
    const hljs = await ensureHljsBotSource();
    const { value } = hljs.highlight(rawText, { language: 'python', ignoreIllegals: true });
    if (seq !== botSourceModalSeq || !els.botSourceCode) return;
    els.botSourceCode.innerHTML = value;
    els.botSourceCode.classList.add('hljs');
  } catch {
    if (seq !== botSourceModalSeq || !els.botSourceCode) return;
    els.botSourceCode.textContent = rawText;
    els.botSourceCode.classList.remove('hljs');
  }
}

const els = {};

const WELCOME_LS_KEY = 'splatbot_welcome_seen_v1';
const WELCOME_OPEN_STARTUP_LS_KEY = 'splatbot_welcome_open_on_startup';

function welcomeOnboardingSeen() {
  try {
    return localStorage.getItem(WELCOME_LS_KEY) === '1';
  } catch {
    return true;
  }
}

function welcomeOpenOnStartup() {
  try {
    return localStorage.getItem(WELCOME_OPEN_STARTUP_LS_KEY) === '1';
  } catch {
    return false;
  }
}

/** @param {boolean} enabled */
function setWelcomeOpenOnStartup(enabled) {
  try {
    localStorage.setItem(WELCOME_OPEN_STARTUP_LS_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function shouldAutoShowWelcome() {
  return welcomeOpenOnStartup() || !welcomeOnboardingSeen();
}

function setWelcomeOnboardingSeen() {
  try {
    localStorage.setItem(WELCOME_LS_KEY, '1');
  } catch {
    /* ignore */
  }
}

function hideWelcomeOnboardingModal() {
  if (!els.welcomeModal) return;
  els.welcomeModal.classList.remove('open');
  els.welcomeModal.setAttribute('aria-hidden', 'true');
}

/** @param {() => void} [afterClose] */
function dismissWelcomeOnboarding(afterClose) {
  if (!els.welcomeModal?.classList.contains('open')) return;
  setWelcomeOnboardingSeen();
  hideWelcomeOnboardingModal();
  if (afterClose) {
    requestAnimationFrame(() => {
      afterClose();
    });
  }
}

function focusPlayer1BotControls() {
  const app = document.getElementById('app');
  const card = document.getElementById('player-card-1');
  if (app?.classList.contains('app--player-cards-compact') && card) {
    card.classList.add('player-card--expanded');
    syncPlayerCardToggleButtons();
    schedulePlayerCardsCompactLayout();
  }
  card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  if (els.botSelect1 && !els.botSelect1.disabled) {
    els.botSelect1.focus();
  } else if (els.botFileChoose1) {
    els.botFileChoose1.focus();
  }
}

function startMatchFromWelcome() {
  if (els.runToggle && !els.runToggle.disabled) {
    els.runToggle.click();
  }
}

function openWelcomeModal() {
  if (!els.welcomeModal) return;
  els.welcomeModal.classList.add('open');
  els.welcomeModal.setAttribute('aria-hidden', 'false');
  const cb = document.getElementById('welcome-open-on-startup');
  if (cb) cb.checked = welcomeOpenOnStartup();
}

/** Shows the welcome dialog on load when first visit or “open on startup” is enabled. */
export function maybeShowWelcomeOnboarding() {
  if (!els.welcomeModal || !shouldAutoShowWelcome()) return;
  openWelcomeModal();
}

/** Auto-collapse once the main scroll area overflows by more than this (px). Higher = full cards stay until the layout is shorter. */
const PLAYER_CARD_COMPACT_ENTER_OVERFLOW_PX = 56;
/** Leave compact when content fits; small slack for subpixel / scrollbar rounding. */
const PLAYER_CARD_COMPACT_EXIT_SLACK_PX = 6;
let playerCardCompactRaf = 0;

function getLayoutMetricsRoot() {
  return document.getElementById('app-main') || document.getElementById('app');
}

function syncPlayerCardToggleButtons() {
  const app = document.getElementById('app');
  const compact = app?.classList.contains('app--player-cards-compact');
  document.querySelectorAll('.player-card').forEach((card) => {
    const btn = card.querySelector('.player-card-expand-btn');
    if (!btn) return;
    if (!compact) {
      btn.hidden = true;
      btn.setAttribute('hidden', '');
      return;
    }
    btn.hidden = false;
    btn.removeAttribute('hidden');
    const expanded = card.classList.contains('player-card--expanded');
    btn.setAttribute('aria-expanded', String(expanded));
    const pid = card.id === 'player-card-2' ? '2' : '1';
    btn.setAttribute('aria-label', expanded ? `Hide player ${pid} bot controls` : `Show player ${pid} bot controls`);
  });
}

function updatePlayerCardsCompactLayout() {
  const app = document.getElementById('app');
  const metricsRoot = getLayoutMetricsRoot();
  if (!app || !metricsRoot) return;
  const compact = app.classList.contains('app--player-cards-compact');

  if (!compact) {
    void metricsRoot.offsetHeight;
    if (metricsRoot.scrollHeight > metricsRoot.clientHeight + PLAYER_CARD_COMPACT_ENTER_OVERFLOW_PX) {
      app.classList.add('app--player-cards-compact');
      document.querySelectorAll('.player-card').forEach((c) => c.classList.remove('player-card--expanded'));
    }
  } else {
    void metricsRoot.offsetHeight;
    if (metricsRoot.scrollHeight <= metricsRoot.clientHeight + PLAYER_CARD_COMPACT_EXIT_SLACK_PX) {
      app.classList.remove('app--player-cards-compact');
      void metricsRoot.offsetHeight;
      if (metricsRoot.scrollHeight > metricsRoot.clientHeight + PLAYER_CARD_COMPACT_ENTER_OVERFLOW_PX) {
        app.classList.add('app--player-cards-compact');
      } else {
        document.querySelectorAll('.player-card').forEach((c) => c.classList.remove('player-card--expanded'));
      }
    }
  }
  syncPlayerCardToggleButtons();
}

function schedulePlayerCardsCompactLayout() {
  if (playerCardCompactRaf) return;
  playerCardCompactRaf = requestAnimationFrame(() => {
    playerCardCompactRaf = 0;
    updatePlayerCardsCompactLayout();
  });
}

function initPlayerCardsCompactLayout() {
  const app = document.getElementById('app');
  const metricsRoot = getLayoutMetricsRoot();
  if (!app || !metricsRoot) return;
  const onViewportChange = () => schedulePlayerCardsCompactLayout();
  const ro = new ResizeObserver(onViewportChange);
  ro.observe(metricsRoot);
  const gameLayout = document.querySelector('.game-layout');
  if (gameLayout) ro.observe(gameLayout);
  const hexWrap = document.getElementById('hex-grid');
  if (hexWrap) ro.observe(hexWrap);

  window.addEventListener('resize', onViewportChange);
  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener('resize', onViewportChange);
  }
  window.addEventListener('orientationchange', () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(onViewportChange);
    });
  });

  document.querySelectorAll('.player-card-expand-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!app.classList.contains('app--player-cards-compact')) return;
      const card = btn.closest('.player-card');
      if (!card) return;
      card.classList.toggle('player-card--expanded');
      syncPlayerCardToggleButtons();
      schedulePlayerCardsCompactLayout();
    });
  });
  schedulePlayerCardsCompactLayout();
}

function buildCrc32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC32_TABLE = buildCrc32Table();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC32_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function writeU16LE(dst, offset, value) {
  dst[offset] = value & 0xff;
  dst[offset + 1] = (value >>> 8) & 0xff;
}

function writeU32LE(dst, offset, value) {
  dst[offset] = value & 0xff;
  dst[offset + 1] = (value >>> 8) & 0xff;
  dst[offset + 2] = (value >>> 16) & 0xff;
  dst[offset + 3] = (value >>> 24) & 0xff;
}

function makeStoredZip(files) {
  const enc = new TextEncoder();
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;
  let centralSize = 0;

  for (const file of files) {
    const nameBytes = enc.encode(file.path);
    const contentBytes = enc.encode(file.content);
    const crc = crc32(contentBytes);
    const compressedSize = contentBytes.length;
    const uncompressedSize = contentBytes.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeU32LE(localHeader, 0, 0x04034b50);
    writeU16LE(localHeader, 4, 20);
    writeU16LE(localHeader, 6, 0);
    writeU16LE(localHeader, 8, 0);
    writeU16LE(localHeader, 10, 0);
    writeU16LE(localHeader, 12, 0);
    writeU32LE(localHeader, 14, crc);
    writeU32LE(localHeader, 18, compressedSize);
    writeU32LE(localHeader, 22, uncompressedSize);
    writeU16LE(localHeader, 26, nameBytes.length);
    writeU16LE(localHeader, 28, 0);
    localHeader.set(nameBytes, 30);

    const localOffset = offset;
    localChunks.push(localHeader, contentBytes);
    offset += localHeader.length + contentBytes.length;

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeU32LE(centralHeader, 0, 0x02014b50);
    writeU16LE(centralHeader, 4, 20);
    writeU16LE(centralHeader, 6, 20);
    writeU16LE(centralHeader, 8, 0);
    writeU16LE(centralHeader, 10, 0);
    writeU16LE(centralHeader, 12, 0);
    writeU16LE(centralHeader, 14, 0);
    writeU32LE(centralHeader, 16, crc);
    writeU32LE(centralHeader, 20, compressedSize);
    writeU32LE(centralHeader, 24, uncompressedSize);
    writeU16LE(centralHeader, 28, nameBytes.length);
    writeU16LE(centralHeader, 30, 0);
    writeU16LE(centralHeader, 32, 0);
    writeU16LE(centralHeader, 34, 0);
    writeU16LE(centralHeader, 36, 0);
    writeU32LE(centralHeader, 38, 0);
    writeU32LE(centralHeader, 42, localOffset);
    centralHeader.set(nameBytes, 46);
    centralChunks.push(centralHeader);
    centralSize += centralHeader.length;
  }

  const centralOffset = offset;
  const end = new Uint8Array(22);
  writeU32LE(end, 0, 0x06054b50);
  writeU16LE(end, 4, 0);
  writeU16LE(end, 6, 0);
  writeU16LE(end, 8, files.length);
  writeU16LE(end, 10, files.length);
  writeU32LE(end, 12, centralSize);
  writeU32LE(end, 16, centralOffset);
  writeU16LE(end, 20, 0);

  return new Blob([...localChunks, ...centralChunks, end], { type: 'application/zip' });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Starter zip only: built-in examples are under `examples/` next to `utils/`. */
function rewriteExampleBotImportsForStarterZip(source) {
  return source.replace(/^from utils\./gm, 'from ..utils.');
}

async function ensureStarterCodeSourcesLoaded() {
  if (actionsPy && hexGridPy && starterCodePy && splatbotDataTypesPy) return;
  const [hg, ac, starter, dataTypes] = await Promise.all([
    hexGridPy
      ? Promise.resolve(hexGridPy)
      : fetch('python/utils/hex_grid.py').then((r) => {
        if (!r.ok) throw new Error(`python/utils/hex_grid.py (${r.status})`);
        return r.text();
      }),
    actionsPy
      ? Promise.resolve(actionsPy)
      : fetch('python/utils/actions.py').then((r) => {
        if (!r.ok) throw new Error(`python/utils/actions.py (${r.status})`);
        return r.text();
      }),
    starterCodePy
      ? Promise.resolve(starterCodePy)
      : fetch('python/starter_code.py').then((r) => {
        if (!r.ok) throw new Error(`python/starter_code.py (${r.status})`);
        return r.text();
      }),
    splatbotDataTypesPy
      ? Promise.resolve(splatbotDataTypesPy)
      : fetch('python/utils/splatbot_data_types.py').then((r) => {
        if (!r.ok) throw new Error(`python/utils/splatbot_data_types.py (${r.status})`);
        return r.text();
      }),
  ]);
  hexGridPy = hg;
  actionsPy = ac;
  starterCodePy = starter;
  splatbotDataTypesPy = dataTypes;
}

async function ensureExampleBotsForZipLoaded() {
  if (exampleBotsZipEntries !== null) return;
  if (!config.LOAD_BUILTIN_BOTS) {
    exampleBotsZipEntries = [];
    return;
  }
  const files = Object.values(config.BUILTIN_BOTS);
  const texts = await Promise.all(
    files.map((file) => {
      const url = `${config.BUILTIN_BOTS_PATH}${file}`;
      return fetch(url).then((r) => {
        if (!r.ok) throw new Error(`${url} (${r.status})`);
        return r.text();
      });
    }),
  );
  exampleBotsZipEntries = files.map((file, i) => ({
    path: `examples/${file}`,
    content: rewriteExampleBotImportsForStarterZip(texts[i]),
  }));
}

async function downloadStarterCodeZip() {
  try {
    await ensureStarterCodeSourcesLoaded();
    await ensureExampleBotsForZipLoaded();
  } catch (err) {
    const detail = err?.message ?? String(err);
    logEvent(`Starter code download failed\n${detail}`);
    setEventLogExpanded(true);
    return;
  }
  const zip = makeStoredZip([
    { path: 'utils/actions.py', content: actionsPy },
    { path: 'utils/hex_grid.py', content: hexGridPy },
    { path: 'utils/splatbot_data_types.py', content: splatbotDataTypesPy },
    { path: 'starter_code.py', content: starterCodePy },
    ...exampleBotsZipEntries,
  ]);
  downloadBlob(zip, STARTER_ZIP_NAME);
  logEvent(`Downloaded ${STARTER_ZIP_NAME}.`);
}

/** Docs link target: open `index.html#download-starter-code` to fetch the same zip as the UI button. */
export async function consumeStarterDownloadHash() {
  if (location.hash !== '#download-starter-code') return;
  history.replaceState(null, '', `${location.pathname}${location.search}`);
  await downloadStarterCodeZip();
}

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

/** Player ids (1 / 2) while a bot swap is in progress (upload, dropdown, picker prep, docs import). */
const botApplyBusyPids = new Set();

function setBotApplyBusy(pid, busy) {
  if (busy) botApplyBusyPids.add(pid);
  else botApplyBusyPids.delete(pid);
  syncRunToggleDisabled();
  syncStepControls();
}

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
    const t1 = runners[1]?.getTimingStats?.();
    const t2 = runners[2]?.getTimingStats?.();
    const avgDecision = (timing) => {
      if (!timing || timing.decisionCount <= 0) return '0.00000s/dec';
      return `${(timing.totalDecisionSeconds / timing.decisionCount).toFixed(5)}s/dec`;
    };
    const rows = [
      ['Tiles painted', s1.tilesPainted, s2.tilesPainted],
      ['Tiles moved', s1.tilesMoved, s2.tilesMoved],
      ['Skips', s1.skips, s2.skips],
      ['Move uses', s1.moves, s2.moves],
      ['Dash uses', s1.dashes, s2.dashes],
      ['Splat uses', s1.splats, s2.splats],
      ['Paintball uses', s1.paintballs, s2.paintballs],
      ['Blocked actions', s1.blockedActions, s2.blockedActions],
      ['Avg decision', avgDecision(t1), avgDecision(t2)],
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
    expandBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    expandBtn.textContent = 'EVENT LOG';
    expandBtn.setAttribute('aria-label', expanded ? 'Collapse event log' : 'Expand event log');
  }
  schedulePlayerCardsCompactLayout();
}

function logPythonLoadFailure(pid, err) {
  const detail = err?.message ?? String(err);
  const msg = `P${pid} — Python error\n${detail}`;
  logEvent(msg);
  setPlayerCardFeedForPlayer(pid, msg, { error: true });
  setEventLogExpanded(true);
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
    const importId = upsertDocsImportBot('From docs', source);
    botSourceCache.set(importId, source);
    renderBotPickers();
    setBotApplyBusy(1, true);
    try {
      await applyBotForPlayer(1, importId, { isInitialLoad: false });
      syncFileUploadRow(1);
      logEvent('P1 loaded bot from docs example.');
    } finally {
      setBotApplyBusy(1, false);
      syncBotPickerTriggersDisabledFromState();
    }
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

function displayLabelForBotId(botId) {
  if (botId == null || botId === '') return '—';
  const id = String(botId);
  if (id.startsWith('custom:')) return getCustomBotDisplayName(id);
  return catalogById.get(id)?.label ?? id;
}

function closeBotPickerPanels() {
  if (botPickerOpenPid == null) return;
  const pid = botPickerOpenPid;
  botPickerOpenPid = null;
  const panel = els[`botPickerPanel${pid}`];
  const trigger = els[`botPickerTrigger${pid}`];
  const root = els[`botPicker${pid}`];
  if (panel) panel.hidden = true;
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  if (root) root.classList.remove('sb-bot-picker--open');
}

function syncBotPickerTriggersDisabledFromState() {
  const noBots = botCatalog.length === 0 && loadCustomBotEntries().length === 0;
  const dis = !botControlsReady || noBots;
  for (const pid of [1, 2]) {
    const t = els[`botPickerTrigger${pid}`];
    if (t) t.disabled = dis;
  }
}

function finishDeleteCustomBotConfirm(value) {
  if (deleteCustomBotConfirmResolve) {
    const r = deleteCustomBotConfirmResolve;
    deleteCustomBotConfirmResolve = null;
    r(value);
  }
  if (els.deleteCustomBotModal) {
    els.deleteCustomBotModal.classList.remove('open');
    els.deleteCustomBotModal.setAttribute('aria-hidden', 'true');
  }
}

function openDeleteCustomBotConfirm(displayName) {
  return new Promise((resolve) => {
    if (!els.deleteCustomBotModal || !els.deleteCustomBotMessage) {
      resolve(false);
      return;
    }
    if (deleteCustomBotConfirmResolve) {
      deleteCustomBotConfirmResolve(false);
      deleteCustomBotConfirmResolve = null;
    }
    deleteCustomBotConfirmResolve = resolve;
    els.deleteCustomBotMessage.textContent = `Remove “${displayName}” from saved custom bots? This cannot be undone.`;
    els.deleteCustomBotModal.classList.add('open');
    els.deleteCustomBotModal.setAttribute('aria-hidden', 'false');
  });
}

function initDeleteCustomBotModal() {
  const modal = els.deleteCustomBotModal;
  if (!modal || modal.dataset.deleteModalInit) return;
  modal.dataset.deleteModalInit = '1';
  const onCancel = () => finishDeleteCustomBotConfirm(false);
  const onConfirm = () => finishDeleteCustomBotConfirm(true);
  els.btnDeleteCustomBotCancel?.addEventListener('click', onCancel);
  els.btnDeleteCustomBotConfirm?.addEventListener('click', onConfirm);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) onCancel();
  });
}

function makeBuiltinBotPickerRow(botId, label, pid, isSelected) {
  const row = document.createElement('div');
  row.className = 'sb-bot-picker-row';
  const opt = document.createElement('button');
  opt.type = 'button';
  opt.className = `sb-bot-picker-option${isSelected ? ' sb-bot-picker-option--selected' : ''}`;
  opt.setAttribute('role', 'option');
  opt.setAttribute('aria-selected', isSelected ? 'true' : 'false');
  opt.dataset.botId = botId;
  opt.dataset.player = String(pid);
  opt.textContent = label;
  row.appendChild(opt);
  return row;
}

const BOT_PICKER_TRASH_SVG =
  '<svg class="sb-bot-picker-delete-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M9 3v1H5v2h14V4h-4V3H9zm-4 5v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8H5zm3 3h2v8H8v-8zm4 0h2v8h-2v-8z"/></svg>';

function makeCustomBotPickerRow(botId, name, pid, isSelected) {
  const row = document.createElement('div');
  row.className = 'sb-bot-picker-row sb-bot-picker-row--custom';
  const opt = document.createElement('button');
  opt.type = 'button';
  opt.className = `sb-bot-picker-option${isSelected ? ' sb-bot-picker-option--selected' : ''}`;
  opt.setAttribute('role', 'option');
  opt.setAttribute('aria-selected', isSelected ? 'true' : 'false');
  opt.dataset.botId = botId;
  opt.dataset.player = String(pid);
  opt.textContent = name;
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'sb-bot-picker-delete';
  del.setAttribute('aria-label', `Delete saved bot ${name}`);
  del.dataset.botId = botId;
  del.innerHTML = BOT_PICKER_TRASH_SVG;
  row.appendChild(opt);
  row.appendChild(del);
  return row;
}

function onBotPickerPanelClick(e) {
  const delBtn = e.target.closest?.('.sb-bot-picker-delete');
  if (delBtn) {
    e.preventDefault();
    e.stopPropagation();
    const id = delBtn.dataset.botId;
    if (id) void deleteCustomBotById(id);
    return;
  }
  const opt = e.target.closest?.('.sb-bot-picker-option');
  if (!opt) return;
  e.preventDefault();
  const id = opt.dataset.botId;
  const p = Number(opt.dataset.player);
  if (id && p) void onBotPickerOptionChosen(p, id);
}

function onDocumentPointerDownCloseBotPicker(e) {
  if (botPickerOpenPid == null) return;
  const root = els[`botPicker${botPickerOpenPid}`];
  if (root && root.contains(e.target)) return;
  closeBotPickerPanels();
}

function onBotPickerTriggerClick(pid) {
  const t = els[`botPickerTrigger${pid}`];
  if (!t || t.disabled) return;
  const panel = els[`botPickerPanel${pid}`];
  if (!panel) return;
  if (botPickerOpenPid === pid) {
    closeBotPickerPanels();
    return;
  }
  closeBotPickerPanels();
  botPickerOpenPid = pid;
  const root = els[`botPicker${pid}`];
  panel.hidden = false;
  t.setAttribute('aria-expanded', 'true');
  if (root) root.classList.add('sb-bot-picker--open');
}

function initBotPickerUi() {
  if (!botPickerDelegationBound) {
    botPickerDelegationBound = true;
    for (const pid of [1, 2]) {
      const panel = els[`botPickerPanel${pid}`];
      panel?.addEventListener('click', onBotPickerPanelClick);
      const trigger = els[`botPickerTrigger${pid}`];
      trigger?.addEventListener('click', () => onBotPickerTriggerClick(pid));
    }
  }
  if (!botPickerOutsideBound) {
    botPickerOutsideBound = true;
    document.addEventListener('pointerdown', onDocumentPointerDownCloseBotPicker, true);
  }
}

function renderBotPickers() {
  rebuildCatalogMaps();
  const customEntries = loadCustomBotEntries();
  const byGroup = new Map();
  for (const e of botCatalog) {
    if (!byGroup.has(e.group)) byGroup.set(e.group, []);
    byGroup.get(e.group).push(e);
  }

  for (const pid of [1, 2]) {
    const panel = els[`botPickerPanel${pid}`];
    const trigger = els[`botPickerTrigger${pid}`];
    if (!panel || !trigger) continue;

    const selectedId = playerBotId[pid];
    trigger.textContent = displayLabelForBotId(selectedId);

    panel.innerHTML = '';
    for (const [groupName, items] of byGroup) {
      const gl = document.createElement('div');
      gl.className = 'sb-bot-picker-group-label';
      gl.textContent = groupName;
      panel.appendChild(gl);
      for (const e of items) {
        panel.appendChild(makeBuiltinBotPickerRow(e.id, e.label, pid, selectedId === e.id));
      }
    }
    const customGl = document.createElement('div');
    customGl.className = 'sb-bot-picker-group-label';
    customGl.textContent = 'Custom';
    panel.appendChild(customGl);
    if (customEntries.length === 0) {
      const ph = document.createElement('div');
      ph.className = 'sb-bot-picker-placeholder';
      ph.textContent = 'Upload a .py below to save…';
      panel.appendChild(ph);
    } else {
      for (const c of customEntries) {
        panel.appendChild(makeCustomBotPickerRow(c.id, c.name, pid, selectedId === c.id));
      }
    }
  }
}

async function deleteCustomBotById(botId) {
  if (!botControlsReady || !botId || !String(botId).startsWith('custom:')) return;
  const label = getCustomBotDisplayName(botId);
  initDeleteCustomBotModal();
  closeBotPickerPanels();
  const ok = await openDeleteCustomBotConfirm(label);
  if (!ok) return;

  const affected = [1, 2].filter((p) => playerBotId[p] === botId);
  removeCustomBotById(botId);
  botSourceCache.delete(botId);
  renderBotPickers();

  const fallback = getDefaultBotId(botCatalog) ?? loadCustomBotEntries()[0]?.id ?? null;
  if (!fallback) {
    logEvent('No bot available after removal — enable built-in bots or upload a new script.');
    syncFileUploadRow(1);
    syncFileUploadRow(2);
    syncBotPickerTriggersDisabledFromState();
    return;
  }

  const locks = [els.botPickerTrigger1, els.botPickerTrigger2].filter(Boolean);
  for (const t of locks) t.disabled = true;
  for (const p of affected) setBotApplyBusy(p, true);
  try {
    for (const p of affected) {
      await applyBotForPlayer(p, fallback, { isInitialLoad: false });
    }
    logEvent(`Removed saved custom bot: ${label}`);
  } catch (err) {
    logPythonLoadFailure(affected[0] ?? 1, err);
  } finally {
    for (const t of locks) t.disabled = false;
    for (const p of affected) setBotApplyBusy(p, false);
    syncBotPickerTriggersDisabledFromState();
    syncFileUploadRow(1);
    syncFileUploadRow(2);
  }
}

async function fetchBotSource(botId) {
  if (botId.startsWith('custom:')) {
    if (botSourceCache.has(botId)) return botSourceCache.get(botId);
    const src = getCustomBotSource(botId);
    if (src) {
      botSourceCache.set(botId, src);
      return src;
    }
    throw new Error('Saved bot not found — it may have been removed from browser storage.');
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

function suggestBotDownloadFilename(pid, botId) {
  if (botId.startsWith('custom:')) {
    const name = getCustomBotDisplayName(botId);
    const trimmed = name.trim();
    if (trimmed.toLowerCase().endsWith('.py')) return trimmed;
    const dot = trimmed.lastIndexOf('.');
    const base = dot > 0 ? trimmed.slice(0, dot) : trimmed;
    return `${base || 'bot'}.py`;
  }
  const entry = catalogById.get(botId);
  if (entry?.path) {
    const seg = entry.path.split('/').pop();
    if (seg) return seg;
  }
  return 'bot.py';
}

function botSourceModalTitleFor(pid, botId) {
  if (botId.startsWith('custom:')) {
    return getCustomBotDisplayName(botId);
  }
  return catalogById.get(botId)?.label ?? botId;
}

function closeBotSourceModal() {
  if (!els.botSourceModal) return;
  botSourceModalSeq += 1;
  botSourceModalContext = null;
  clearTimeout(botSourceCopyResetTimer);
  botSourceCopyResetTimer = 0;
  if (els.botSourceCopy) {
    els.botSourceCopy.textContent = 'Copy code';
    els.botSourceCopy.classList.remove('docs-copy-btn--done');
  }
  els.botSourceModal.classList.remove('open');
  els.botSourceModal.setAttribute('aria-hidden', 'true');
}

function openBotSourceModal(title, text, ctx) {
  botSourceModalContext = ctx;
  const seq = (botSourceModalSeq += 1);
  if (els.botSourceTitle) els.botSourceTitle.textContent = title;
  clearTimeout(botSourceCopyResetTimer);
  botSourceCopyResetTimer = 0;
  if (els.botSourceCopy) {
    els.botSourceCopy.textContent = 'Copy code';
    els.botSourceCopy.classList.remove('docs-copy-btn--done');
  }
  if (els.botSourceCode) {
    els.botSourceCode.textContent = text;
    els.botSourceCode.className = 'language-python';
    void applyBotSourceHighlight(text, seq);
  }
  els.botSourceModal?.classList.add('open');
  els.botSourceModal?.setAttribute('aria-hidden', 'false');
}

function syncBotSourceActionButtons() {
  const disabled =
    !botControlsReady || (botCatalog.length === 0 && loadCustomBotEntries().length === 0);
  for (const pid of [1, 2]) {
    const v = document.getElementById(`btn-bot-source-view-${pid}`);
    if (v) v.disabled = disabled;
  }
}

async function viewBotSourceForPlayer(pid) {
  if (!botControlsReady) return;
  const botId = playerBotId[pid];
  if (!botId) return;
  try {
    const code = await fetchBotSource(botId);
    const subtitle = botSourceModalTitleFor(pid, botId);
    openBotSourceModal(`P${pid} — ${subtitle}`, code, { pid, botId });
  } catch (err) {
    const detail = err?.message ?? String(err);
    logEvent(`View source (P${pid}) failed\n${detail}`);
    setEventLogExpanded(true);
  }
}

function setBotSourceCopyButtonFeedback(state) {
  const btn = els.botSourceCopy;
  if (!btn) return;
  clearTimeout(botSourceCopyResetTimer);
  botSourceCopyResetTimer = 0;
  if (state === 'ok') {
    btn.textContent = 'Copied!';
    btn.classList.add('docs-copy-btn--done');
    botSourceCopyResetTimer = setTimeout(() => {
      botSourceCopyResetTimer = 0;
      btn.textContent = 'Copy code';
      btn.classList.remove('docs-copy-btn--done');
    }, 2000);
    return;
  }
  if (state === 'fail') {
    btn.textContent = 'Copy failed';
    botSourceCopyResetTimer = setTimeout(() => {
      botSourceCopyResetTimer = 0;
      btn.textContent = 'Copy code';
    }, 2000);
  }
}

async function copyBotSourceFromModal() {
  const code = els.botSourceCode?.textContent ?? '';
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    setBotSourceCopyButtonFeedback('ok');
    logEvent('Bot source copied to clipboard.');
    return;
  } catch {
    // Non-secure contexts or denied permission: fall through.
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = code;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    setBotSourceCopyButtonFeedback('ok');
    logEvent('Bot source copied to clipboard.');
  } catch (err) {
    setBotSourceCopyButtonFeedback('fail');
    const detail = err?.message ?? String(err);
    logEvent(`Copy bot source failed\n${detail}`);
    setEventLogExpanded(true);
  }
}

function downloadBotSourceFromModal() {
  if (!botSourceModalContext) return;
  const { pid, botId } = botSourceModalContext;
  const code = els.botSourceCode?.textContent ?? '';
  if (!code) return;
  const filename = suggestBotDownloadFilename(pid, botId);
  const blob = new Blob([code], { type: 'text/x-python;charset=utf-8' });
  downloadBlob(blob, filename);
  logEvent(`Downloaded ${filename} (P${pid}).`);
}

function syncFileUploadRow(pid) {
  const input = els[`botFile${pid}`];
  const statusEl = els[`botFileStatus${pid}`];
  const curId = playerBotId[pid];
  const hasPickedFile = Boolean(input?.files?.length);
  if (statusEl) {
    if (curId && String(curId).startsWith('custom:')) {
      statusEl.textContent = `Saved bot: ${getCustomBotDisplayName(curId)}`;
    } else if (hasPickedFile && input?.files?.[0]) {
      statusEl.textContent = input.files[0].name;
    } else {
      statusEl.textContent = 'No file chosen';
    }
  }
}

function setBotFileUploadLoading(pid, isLoading) {
  setBotApplyBusy(pid, isLoading);
  const wrap = els[`botFile${pid}`]?.closest?.('.sb-file-upload-wrap');
  const statusEl = els[`botFileStatus${pid}`];
  const chooseBtn = els[`botFileChoose${pid}`];
  if (wrap) {
    wrap.classList.toggle('sb-file-upload-wrap--loading', isLoading);
    wrap.toggleAttribute('aria-busy', isLoading);
  }
  if (chooseBtn) chooseBtn.disabled = isLoading;
  if (statusEl && isLoading) {
    statusEl.innerHTML =
      '<span class="sb-spinner" aria-hidden="true"></span><span>Loading bot…</span>';
  }
}

function syncRunToggleDisabled() {
  if (!els.runToggle) return;
  const botBusy = botApplyBusyPids.size > 0;
  els.runToggle.disabled = botBusy && !running;
}

async function applyBotForPlayer(pid, botId, { isInitialLoad = false } = {}) {
  const code = await fetchBotSource(botId);
  await runners[pid].setBotCode(code);
  playerBotId[pid] = botId;
  syncFileUploadRow(pid);
  if (!isInitialLoad) {
    running = false;
    hadLiveRunThisMatch = false;
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
  renderBotPickers();
}

function openDuplicateUploadModal({ base, familyCount, fileName }) {
  return new Promise((resolve) => {
    const modal = els.duplicateUploadModal;
    const msg = els.duplicateUploadMessage;
    const nameInput = els.duplicateUploadAddName;
    const errEl = els.duplicateUploadNameError;
    const btnOw = els.btnDuplicateOverwrite;
    const btnAdd = els.btnDuplicateAdd;
    const btnCan = els.btnDuplicateCancel;
    if (!modal || !msg || !btnOw || !btnAdd || !btnCan) {
      resolve({ choice: 'cancel' });
      return;
    }

    const addLabel = `${base} (${familyCount})`;
    msg.textContent = `A bot named “${base}” is already saved in this name group.`;
    if (nameInput) {
      nameInput.value = addLabel;
      nameInput.placeholder = addLabel;
    }

    const clearNameError = () => {
      if (nameInput) {
        nameInput.classList.remove('duplicate-upload-name-input--invalid');
        nameInput.setAttribute('aria-invalid', 'false');
      }
      if (errEl) {
        errEl.textContent = '';
        errEl.hidden = true;
      }
    };

    const refreshNameCollisionUI = () => {
      const raw = (nameInput?.value ?? '').trim();
      const displayName = raw || addLabel;
      const bad = customBotDisplayNameCollides(displayName);
      btnAdd.disabled = bad;
      if (bad) {
        if (nameInput) {
          nameInput.classList.add('duplicate-upload-name-input--invalid');
          nameInput.setAttribute('aria-invalid', 'true');
        }
        if (errEl) {
          errEl.textContent =
            'That name matches a bot already saved. Pick a different name.';
          errEl.hidden = false;
        }
      } else {
        clearNameError();
      }
      return !bad;
    };

    const cleanup = (result) => {
      if (nameInput) nameInput.removeEventListener('input', onNameInput);
      clearNameError();
      btnAdd.disabled = false;
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      window.removeEventListener('keydown', onKey);
      btnOw.removeEventListener('click', onOw);
      btnAdd.removeEventListener('click', onAdd);
      btnCan.removeEventListener('click', onCan);
      modal.removeEventListener('click', onBackdrop);
      if (nameInput) nameInput.removeEventListener('keydown', onAddNameKey);
      resolve(result);
    };

    const onOw = () => cleanup({ choice: 'overwrite' });
    const onAdd = () => {
      if (!refreshNameCollisionUI()) return;
      const raw = (nameInput?.value ?? '').trim();
      const displayName = raw || addLabel;
      cleanup({ choice: 'add', displayName });
    };
    const onCan = () => cleanup({ choice: 'cancel' });
    const onNameInput = () => {
      refreshNameCollisionUI();
    };
    const onAddNameKey = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onAdd();
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup({ choice: 'cancel' });
      }
    };
    const onBackdrop = (e) => {
      if (e.target === modal) cleanup({ choice: 'cancel' });
    };

    clearNameError();
    refreshNameCollisionUI();

    btnOw.addEventListener('click', onOw);
    btnAdd.addEventListener('click', onAdd);
    btnCan.addEventListener('click', onCan);
    if (nameInput) nameInput.addEventListener('input', onNameInput);
    if (nameInput) nameInput.addEventListener('keydown', onAddNameKey);
    window.addEventListener('keydown', onKey);
    modal.addEventListener('click', onBackdrop);
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    (nameInput || btnOw).focus();
    if (nameInput) {
      try {
        nameInput.select();
      } catch {
        // ignore
      }
    }
  });
}

async function onBotFileChange(pid, input) {
  if (!botControlsReady || !input) return;
  const file = input.files?.[0];
  if (!file) {
    syncFileUploadRow(pid);
    return;
  }

  setBotFileUploadLoading(pid, true);
  try {
    let text;
    try {
      text = await file.text();
    } catch (err) {
      input.value = '';
      logEvent(`Failed to read file: ${err.message || err}`);
      return;
    }
    const shapeIssues = describeBotScriptShapeIssues(text);
    if (shapeIssues) {
      input.value = '';
      logUploadShapeFailure(pid, shapeIssues);
      return;
    }

    const base = baseDisplayName(file.name);
    const familyCount = familyCountForBase(base);

    setBotFileUploadLoading(pid, false);
    /** @type {{ choice: 'overwrite'|'add'|'cancel', displayName?: string }|null} */
    let modalResult = null;
    if (hasDuplicateFamily(base)) {
      modalResult = await openDuplicateUploadModal({ base, familyCount, fileName: file.name });
      if (modalResult.choice === 'cancel') {
        input.value = '';
        return;
      }
    }

    if (modalResult?.choice === 'overwrite') {
      setBotFileUploadLoading(pid, true);
      let owId;
      let prevSource;
      try {
        ({ id: owId, previousSource: prevSource } = overwriteCustomBotFamilyMember(base, text));
      } catch (err) {
        input.value = '';
        const detail = err?.message ?? String(err);
        logEvent(`P${pid} — overwrite failed\n${detail}`);
        return;
      }
      botSourceCache.delete(owId);
      botSourceCache.set(owId, text);
      renderBotPickers();
      const locks = [els.botPickerTrigger1, els.botPickerTrigger2].filter(Boolean);
      for (const t of locks) t.disabled = true;
      try {
        await applyBotForPlayer(pid, owId, { isInitialLoad: false });
        logEvent(`P${pid} overwrote saved bot: ${base}`);
        input.value = '';
      } catch (err) {
        setCustomBotEntrySource(owId, prevSource);
        botSourceCache.delete(owId);
        botSourceCache.set(owId, prevSource);
        renderBotPickers();
        input.value = '';
        logPythonLoadFailure(pid, err);
      } finally {
        for (const t of locks) t.disabled = false;
        syncBotPickerTriggersDisabledFromState();
      }
      return;
    }

    setBotFileUploadLoading(pid, true);
    let newId;
    try {
      if (modalResult?.choice === 'add') {
        const displayName =
          (modalResult.displayName && String(modalResult.displayName).trim()) ||
          `${base} (${familyCount})`;
        newId = appendCustomBotWithDisplayName(displayName, text);
      } else {
        newId = appendCustomBotUpload(file.name, text);
      }
    } catch (err) {
      input.value = '';
      const detail = err?.message ?? String(err);
      logEvent(`P${pid} — could not save bot to browser storage\n${detail}`);
      setPlayerCardFeedForPlayer(pid, `Could not save bot\n${detail}`, { error: true });
      setEventLogExpanded(true);
      return;
    }

    botSourceCache.set(newId, text);
    renderBotPickers();

    const locks = [els.botPickerTrigger1, els.botPickerTrigger2].filter(Boolean);
    for (const t of locks) t.disabled = true;
    try {
      await applyBotForPlayer(pid, newId, { isInitialLoad: false });
      const loadedLabel =
        modalResult?.choice === 'add' ? getCustomBotDisplayName(newId) : file.name;
      logEvent(`P${pid} saved and loaded: ${loadedLabel}`);
      input.value = '';
    } catch (err) {
      removeCustomBotById(newId);
      botSourceCache.delete(newId);
      renderBotPickers();
      input.value = '';
      logPythonLoadFailure(pid, err);
    } finally {
      for (const t of locks) t.disabled = false;
      syncBotPickerTriggersDisabledFromState();
    }
  } finally {
    setBotFileUploadLoading(pid, false);
    syncFileUploadRow(pid);
  }
}

/**
 * Resets the native file input so the same file can be chosen again.
 */
async function prepareBotFilePicker(pid) {
  if (!botControlsReady) return;
  const input = els[`botFile${pid}`];
  if (input) input.value = '';
  syncFileUploadRow(pid);
}

async function openBotFilePicker(pid) {
  await prepareBotFilePicker(pid);
  els[`botFile${pid}`]?.click();
}

async function onBotPickerOptionChosen(pid, nextBotId) {
  if (!botControlsReady) return;
  const prev = playerBotId[pid];
  if (nextBotId === prev) {
    closeBotPickerPanels();
    return;
  }
  closeBotPickerPanels();
  setBotApplyBusy(pid, true);
  const locks = [els.botPickerTrigger1, els.botPickerTrigger2].filter(Boolean);
  for (const t of locks) t.disabled = true;
  try {
    await applyBotForPlayer(pid, nextBotId, { isInitialLoad: false });
  } catch (err) {
    logPythonLoadFailure(pid, err);
    renderBotPickers();
  } finally {
    for (const t of locks) t.disabled = false;
    setBotApplyBusy(pid, false);
    syncBotPickerTriggersDisabledFromState();
  }
}

// ── Public bootstrap API ─────────────────────────────────────────────────

export function initApp() {
  els.hexGrid = document.getElementById('hex-grid');
  els.score1 = document.getElementById('score-1');
  els.score2 = document.getElementById('score-2');
  els.pct1 = document.getElementById('pct-1');
  els.pct2 = document.getElementById('pct-2');
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
  els.matchEndDismiss = document.getElementById('btn-match-end-dismiss');
  els.runToggle = document.getElementById('btn-run');
  els.botPicker1 = document.getElementById('bot-picker-1');
  els.botPicker2 = document.getElementById('bot-picker-2');
  els.botPickerTrigger1 = document.getElementById('bot-picker-trigger-1');
  els.botPickerTrigger2 = document.getElementById('bot-picker-trigger-2');
  els.botPickerPanel1 = document.getElementById('bot-picker-panel-1');
  els.botPickerPanel2 = document.getElementById('bot-picker-panel-2');
  els.deleteCustomBotModal = document.getElementById('delete-custom-bot-modal');
  els.deleteCustomBotMessage = document.getElementById('delete-custom-bot-message');
  els.btnDeleteCustomBotCancel = document.getElementById('btn-delete-custom-bot-cancel');
  els.btnDeleteCustomBotConfirm = document.getElementById('btn-delete-custom-bot-confirm');
  els.botFile1 = document.getElementById('bot-file-1');
  els.botFile2 = document.getElementById('bot-file-2');
  els.botFileChoose1 = document.getElementById('bot-file-choose-1');
  els.botFileChoose2 = document.getElementById('bot-file-choose-2');
  els.botFileStatus1 = document.getElementById('bot-file-status-1');
  els.botFileStatus2 = document.getElementById('bot-file-status-2');
  els.downloadStarterCode = document.getElementById('btn-download-starter-code');
  els.botSourceModal = document.getElementById('bot-source-modal');
  els.botSourceTitle = document.getElementById('bot-source-title');
  els.botSourceCode = document.getElementById('bot-source-code');
  els.botSourceCopy = document.getElementById('btn-bot-source-copy');
  els.botSourceDownload = document.getElementById('btn-bot-source-download');
  els.botSourceClose = document.getElementById('btn-bot-source-close');
  els.duplicateUploadModal = document.getElementById('duplicate-upload-modal');
  els.duplicateUploadMessage = document.getElementById('duplicate-upload-message');
  els.duplicateUploadAddName = document.getElementById('duplicate-upload-add-name');
  els.duplicateUploadNameError = document.getElementById('duplicate-upload-name-error');
  els.btnDuplicateOverwrite = document.getElementById('btn-duplicate-overwrite');
  els.btnDuplicateAdd = document.getElementById('btn-duplicate-add');
  els.btnDuplicateCancel = document.getElementById('btn-duplicate-cancel');
  els.welcomeModal = document.getElementById('welcome-modal');

  initDeleteCustomBotModal();
  renderBotPickers();
  initBotPickerUi();
  syncBotPickerTriggersDisabledFromState();
  if (els.botFile1) els.botFile1.addEventListener('change', () => onBotFileChange(1, els.botFile1));
  if (els.botFile2) els.botFile2.addEventListener('change', () => onBotFileChange(2, els.botFile2));
  if (els.botFileChoose1) els.botFileChoose1.addEventListener('click', () => { void openBotFilePicker(1); });
  if (els.botFileChoose2) els.botFileChoose2.addEventListener('click', () => { void openBotFilePicker(2); });
  if (els.downloadStarterCode) {
    els.downloadStarterCode.disabled = false;
    els.downloadStarterCode.addEventListener('click', () => { void downloadStarterCodeZip(); });
  }
  syncBotSourceActionButtons();
  for (const pid of [1, 2]) {
    const v = document.getElementById(`btn-bot-source-view-${pid}`);
    if (v) v.addEventListener('click', () => { void viewBotSourceForPlayer(pid); });
  }
  if (els.botSourceCopy) {
    els.botSourceCopy.addEventListener('click', () => { void copyBotSourceFromModal(); });
  }
  if (els.botSourceDownload) {
    els.botSourceDownload.addEventListener('click', () => downloadBotSourceFromModal());
  }
  if (els.botSourceClose) {
    els.botSourceClose.addEventListener('click', closeBotSourceModal);
  }
  if (els.botSourceModal) {
    els.botSourceModal.addEventListener('click', (e) => {
      if (e.target === els.botSourceModal) closeBotSourceModal();
    });
  }
  const btnWelcomeReadDocs = document.getElementById('btn-welcome-read-docs');
  const btnWelcomeWatch = document.getElementById('btn-welcome-watch-game');
  const btnWelcomeDownloadSource = document.getElementById('btn-welcome-download-source');
  const welcomeOpenStartupCb = document.getElementById('welcome-open-on-startup');
  const btnHeaderWelcome = document.getElementById('btn-header-welcome');
  if (btnWelcomeReadDocs) {
    btnWelcomeReadDocs.addEventListener('click', () => {
      window.open('docs/', '_blank');
    });
  }
  if (btnWelcomeWatch) {
    btnWelcomeWatch.addEventListener('click', () => {
      dismissWelcomeOnboarding(() => startMatchFromWelcome());
    });
  }
  if (btnWelcomeDownloadSource) {
    btnWelcomeDownloadSource.addEventListener('click', () => {
      void downloadStarterCodeZip();
    });
  }
  if (welcomeOpenStartupCb) {
    welcomeOpenStartupCb.addEventListener('change', () => {
      setWelcomeOpenOnStartup(welcomeOpenStartupCb.checked);
    });
  }
  if (btnHeaderWelcome) {
    btnHeaderWelcome.addEventListener('click', () => {
      openWelcomeModal();
    });
  }
  const btnWelcomeClose = document.getElementById('btn-welcome-close');
  if (btnWelcomeClose) {
    btnWelcomeClose.addEventListener('click', () => {
      dismissWelcomeOnboarding();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (els.welcomeModal?.classList.contains('open')) {
      dismissWelcomeOnboarding();
      return;
    }
    if (els.deleteCustomBotModal?.classList.contains('open')) {
      finishDeleteCustomBotConfirm(false);
      return;
    }
    if (botPickerOpenPid != null) {
      closeBotPickerPanels();
      return;
    }
    if (els.botSourceModal?.classList.contains('open')) closeBotSourceModal();
  });
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
      const panel = document.getElementById('event-log-panel');
      const expanded = panel ? !panel.hasAttribute('hidden') : false;
      setEventLogExpanded(!expanded);
    });
  }
  const btnEventLogClear = document.getElementById('btn-event-log-clear');
  if (btnEventLogClear) {
    btnEventLogClear.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearLog();
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
  const btnDownloadProfile = document.getElementById('btn-settings-download-profile');
  const btnUploadProfile = document.getElementById('btn-settings-upload-profile');
  const settingsProfileFile = document.getElementById('settings-profile-file');
  if (btnDownloadProfile) {
    btnDownloadProfile.addEventListener('click', () => downloadSettingsProfile());
  }
  if (btnUploadProfile && settingsProfileFile) {
    btnUploadProfile.addEventListener('click', () => settingsProfileFile.click());
    settingsProfileFile.addEventListener('change', onSettingsProfileFileChange);
  }
  els.speedSlider.addEventListener('input', (e) => setSpeed(Number(e.target.value)));
  if (els.matchEndDismiss) {
    els.matchEndDismiss.addEventListener('click', hideMatchEndModal);
  }
  document.querySelectorAll('.player-card-match-stats-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!state?.isOver) return;
      showMatchEndModal();
    });
  });

  initPlayerCardsCompactLayout();

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
  const [hg, ac, starter, dataTypes] = await Promise.all([
    fetch('python/utils/hex_grid.py').then((r) => r.text()),
    fetch('python/utils/actions.py').then((r) => r.text()),
    fetch('python/starter_code.py').then((r) => r.text()),
    fetch('python/utils/splatbot_data_types.py').then((r) => r.text()),
  ]);
  hexGridPy = hg;
  actionsPy = ac;
  starterCodePy = starter;
  splatbotDataTypesPy = dataTypes;

  updateLoadingStatus('Starting Python sandbox (first load may take a moment)...');
  for (const pid of [1, 2]) {
    runners[pid] = new BotRunner(pid, STUB_BOT_CODE);
    await runners[pid].init(hexGridPy, actionsPy, splatbotDataTypesPy);
  }

  const defaultId = getDefaultBotId(botCatalog) ?? loadCustomBotEntries()[0]?.id ?? null;
  if (defaultId) {
    updateLoadingStatus('Loading default bot...');
    await Promise.all([
      applyBotForPlayer(1, defaultId, { isInitialLoad: true }),
      applyBotForPlayer(2, defaultId, { isInitialLoad: true }),
    ]);
  }

  await consumeDocsBotImportForPlayerOne();

  botControlsReady = true;
  syncFileUploadRow(1);
  syncFileUploadRow(2);
  syncBotSourceActionButtons();
  syncBotPickerTriggersDisabledFromState();
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
  } else {
    els.status.textContent = '';
    els.status.style.color = '#4a6080';
  }

  if (els.runToggle) {
    const showResume = !running && !state.isOver && hadLiveRunThisMatch;
    if (running) {
      els.runToggle.textContent = '\u23F8  PAUSE';
      els.runToggle.setAttribute('aria-label', 'Pause match');
    } else if (showResume) {
      els.runToggle.textContent = '\u25B6  RESUME';
      els.runToggle.setAttribute('aria-label', 'Resume match');
    } else {
      els.runToggle.textContent = '\u25B6  START';
      els.runToggle.setAttribute('aria-label', 'Start match');
    }
    els.runToggle.setAttribute('aria-pressed', running ? 'true' : 'false');
    syncRunToggleDisabled();
  }

  syncStepControls();
  document.querySelectorAll('.player-card-match-stats-btn').forEach((btn) => {
    btn.disabled = !state?.isOver;
  });
  schedulePlayerCardsCompactLayout();
}

// ── Control callbacks ────────────────────────────────────────────────────

function toggleRun() {
  if (running) pauseGame();
  else void startGame();
}

async function startGame() {
  if (running) return;
  if (botApplyBusyPids.size > 0) return;
  if (state?.isOver) {
    await resetGame();
  }
  hideMatchEndModal();
  running = true;
  hadLiveRunThisMatch = true;
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
  hadLiveRunThisMatch = false;
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

  // Snapshot both bots from the same pre-action state
  const snapshots = {};
  for (const pid of [1, 2]) {
    if (runners[pid]?.ready) snapshots[pid] = state.toSnapshot(pid);
  }

  // Collect decisions — both bots see the same state
  const actions = {};
  const decidePromises = [];
  for (const pid of [1, 2]) {
    const runner = runners[pid];
    if (!runner?.ready || !snapshots[pid]) continue;
    decidePromises.push(
      runner.decide(snapshots[pid])
        .then(action => { actions[pid] = action; })
        .catch(err => {
          logEvent(`Error in bot ${pid}: ${err}`);
          actions[pid] = { type: 'skip' };
        })
    );
  }
  await Promise.all(decidePromises);

  // Resolve all actions simultaneously
  const reports = state.resolveSimultaneousTick(actions, logEvent);

  for (const pid of [1, 2]) {
    const action = actions[pid];
    if (!action) continue;
    const stats = matchStats[pid];
    const actionType = String(action.type || 'unknown');
    if (actionType === 'skip') stats.skips += 1;
    if (actionType === 'move') stats.moves += 1;
    if (actionType === 'dash') stats.dashes += 1;
    if (actionType === 'splat') stats.splats += 1;
    if (actionType === 'shoot_paintball') stats.paintballs += 1;
    const report = reports[pid];
    if (report) {
      stats.tilesMoved += Number(report.movedTiles || 0);
      stats.tilesPainted += Number(report.paintedTiles || 0);
      if (report.blocked) stats.blockedActions += 1;
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

  const disable = stepBusy || !botControlsReady || !state || state.isOver || botApplyBusyPids.size > 0;
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
  if (stepBusy || !botControlsReady || !state || state.isOver || botApplyBusyPids.size > 0) return;

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

function downloadSettingsProfile() {
  let flat;
  if (settingsForm) {
    const { clean, errors } = validateOverrides(settingsForm.getValues());
    if (errors.length > 0) {
      logEvent(`Settings profile: fix errors first — ${errors[0]}`);
      return;
    }
    flat = mergeWithDefaults(clean);
  } else {
    flat = mergeWithDefaults(loadOverrides());
  }
  const blob = new Blob([serializeSettingsProfile(flat)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'splatbot-settings.json';
  a.rel = 'noopener';
  a.click();
  URL.revokeObjectURL(url);
  logEvent('Settings profile downloaded.');
}

function onSettingsProfileFileChange(e) {
  const input = e.target;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = typeof reader.result === 'string' ? reader.result : '';
    const { clean, errors } = parseSettingsProfileJSON(text);
    if (errors.length > 0 || clean == null) {
      logEvent(`Settings profile: ${errors[0] ?? 'Invalid file'}`);
      return;
    }
    saveOverrides(clean);
    if (settingsForm) {
      settingsForm.setValues(mergeWithDefaults(clean));
    }
    logEvent('Profile loaded — review the form and press Apply to use it in a match.');
  };
  reader.onerror = () => logEvent('Settings profile: could not read file.');
  reader.readAsText(file);
}

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
