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
} from './player-card-log-feed.js';
import {
  loadOverrides, saveOverrides, mergeWithDefaults, applyToConfig,
  buildSettingsUI, validateOverrides, SETTING_SPECS,
} from './settings.js';
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
let botControlsReady = false;

const els = {};

let eventLogPopoutWin = null;
let eventLogPopoutDetach = null;

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
  html, body { height: 100%; margin: 0; overflow: hidden; }
  body { display: flex; flex-direction: column; background: #080c14; }
</style>
</head>
<body>
  <div id="event-log-pop" class="event-log event-log--popout-fill"></div>
</body>
</html>`);
  w.document.close();

  const inner = w.document.getElementById('event-log-pop');
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

/** Heuristic: bot script should define class Bot with decide(self, ...) for Pyodide. */
const BOT_CLASS_RE = /\bclass\s+Bot\b/;
const BOT_INSTANCE_DECIDE_RE = /\bdef\s+decide\s*\(\s*self\b/;

function looksLikeUploadableBot(source) {
  return BOT_CLASS_RE.test(source) && BOT_INSTANCE_DECIDE_RE.test(source);
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

async function applyBotForPlayer(pid, botId, { isInitialLoad = false } = {}) {
  const code = await fetchBotSource(botId);
  await runners[pid].setBotCode(code);
  playerBotId[pid] = botId;
  const sel = els[`botSelect${pid}`];
  if (sel) sel.value = botId;
  if (!isInitialLoad) {
    running = false;
    for (const p of [1, 2]) {
      if (runners[p]) runners[p].resetTimingStats();
    }
    state = makeInitialState();
    push();
    logEvent(`P${pid} bot changed — match reset.`);
  }
}

async function onBotFileChange(pid, input) {
  if (!botControlsReady || !input) return;
  const file = input.files?.[0];
  if (!file) return;
  const botId = `upload:${pid}`;
  let text;
  try {
    text = await file.text();
  } catch (err) {
    input.value = '';
    logEvent(`Failed to read file: ${err.message || err}`);
    return;
  }
  if (!looksLikeUploadableBot(text)) {
    input.value = '';
    logEvent('Uploaded file must define class Bot with decide(self, game_state): ...');
    return;
  }
  botSourceCache.set(botId, text);
  const locks = [els.botSelect1, els.botSelect2].filter(Boolean);
  for (const s of locks) s.disabled = true;
  try {
    await applyBotForPlayer(pid, botId, { isInitialLoad: false });
    logEvent(`P${pid} using uploaded bot: ${file.name}`);
  } catch (err) {
    logEvent(`Failed to load uploaded bot: ${err.message || err}`);
  } finally {
    for (const s of locks) s.disabled = false;
  }
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
    logEvent(`Failed to load bot: ${err.message || err}`);
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
  els.runToggle = document.getElementById('btn-run');
  els.botSelect1 = document.getElementById('bot-select-1');
  els.botSelect2 = document.getElementById('bot-select-2');
  els.botFile1 = document.getElementById('bot-file-1');
  els.botFile2 = document.getElementById('bot-file-2');

  populateBotSelects();
  if (els.botSelect1) els.botSelect1.disabled = true;
  if (els.botSelect2) els.botSelect2.disabled = true;
  if (els.botSelect1) els.botSelect1.addEventListener('change', () => onBotSelectChange(1));
  if (els.botSelect2) els.botSelect2.addEventListener('change', () => onBotSelectChange(2));
  if (els.botFile1) els.botFile1.addEventListener('change', () => onBotFileChange(1, els.botFile1));
  if (els.botFile2) els.botFile2.addEventListener('change', () => onBotFileChange(2, els.botFile2));

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
  tickDelay = config.TICK_DELAY;
  if (els.speedSlider) {
    els.speedSlider.min = String(SPEED_SLIDER_MIN);
    els.speedSlider.max = String(SPEED_SLIDER_MAX);
    els.speedSlider.value = String(sliderValueFromTickDelay(tickDelay));
  }

  state = makeInitialState();

  if (els.runToggle) els.runToggle.addEventListener('click', toggleRun);
  initStepControl();
  document.getElementById('btn-reset').addEventListener('click', () => resetGame({ clearEventLog: true }));
  document.getElementById('btn-settings').addEventListener('click', openSettings);
  document.getElementById('btn-settings-reset').addEventListener('click', resetSettingsForm);
  document.getElementById('btn-settings-cancel').addEventListener('click', closeSettings);
  document.getElementById('btn-settings-apply').addEventListener('click', applySettings);
  els.speedSlider.addEventListener('input', (e) => setSpeed(Number(e.target.value)));

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

  const noBots = botCatalog.length === 0;
  if (els.botSelect1) els.botSelect1.disabled = noBots;
  if (els.botSelect2) els.botSelect2.disabled = noBots;

  botControlsReady = true;
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
  else startGame();
}

function startGame() {
  if (running) return;
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

function resetGame(options = {}) {
  const { clearEventLog = false } = options;
  running = false;
  if (clearEventLog) clearLog();
  for (const pid of Object.keys(runners)) {
    runners[pid].resetTimingStats();
  }
  state = makeInitialState();
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

  for (const pid of [1, 2]) {
    const runner = runners[pid];
    if (!runner || !runner.ready) continue;
    try {
      const snapshot = state.toSnapshot(pid);
      const action = await runner.decide(snapshot);
      state.applyAction(pid, action, logEvent);
    } catch (err) {
      logEvent(`Error in bot ${pid}: ${err}`);
    }
  }

  state.neutralizeCollidingTiles(logEvent);
  state.tickBotTimers();

  push();

  if (state.isOver) {
    running = false;
    const sc = state.score();
    logEvent(`Match over — P1: ${sc[1]} tiles  |  P2: ${sc[2]} tiles`);
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
  tickDelay = config.TICK_DELAY;
  if (els.speedSlider) {
    els.speedSlider.value = String(sliderValueFromTickDelay(tickDelay));
  }
  if (running) {
    logEvent('Settings changed while live — pausing and resetting match.');
  }
  resetGame();
  closeSettings();
  logEvent('Settings applied.');
}
