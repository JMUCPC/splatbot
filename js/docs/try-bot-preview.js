/**
 * Minimal Splatbot runner for docs “Try it out” — same simulation as the main app,
 * compact layout styled like interactive docs demos (see css/docs.css).
 */
import config from '../config.js';
import { makeInitialState } from '../engine/game-state.js';
import { renderHexGrid } from '../renderer/hex-renderer.js';
import { BotRunner } from '../sandbox/bot-runner.js';
import { STUB_BOT_CODE } from '../bots/catalog.js';
import { describeBotScriptShapeIssues } from '../bot-script-shape.js';
import { clearLog } from '../ui/event-console.js';

function noopLog() {}

function getSiteRootUrl() {
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

function fetchTextAtRoot(relPath) {
  const u = new URL(relPath, getSiteRootUrl());
  return fetch(u.href).then((r) => {
    if (!r.ok) throw new Error(`${relPath} (${r.status})`);
    return r.text();
  });
}

const TICK_DELAY = config.TICK_DELAY;

/**
 * @param {HTMLElement} container
 * @param {{ source: string }} options
 * @returns {Promise<() => void>}
 */
export async function mountTryBotPreview(container, { source }) {
  const shapeIssues = describeBotScriptShapeIssues(source);
  if (shapeIssues) {
    throw new Error(shapeIssues);
  }

  const [hexGridPy, actionsPy] = await Promise.all([
    fetchTextAtRoot('python/utils/hex_grid.py'),
    fetchTextAtRoot('python/utils/actions.py'),
  ]);

  let state = null;
  let running = false;
  let lastTick = 0;
  let stepBusy = false;
  let destroyed = false;

  const runners = {
    1: new BotRunner(1, STUB_BOT_CODE),
  };

  await runners[1].init(hexGridPy, actionsPy);
  await runners[1].setBotCode(source);

  container.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'docs-try-mini action-demo';
  root.innerHTML = `
    <div class="docs-try-mini-toolbar">
      <p class="hex-hover-title docs-try-mini-heading">Your bot</p>
      <div class="action-demo-buttons docs-try-mini-buttons">
        <button type="button" class="action-demo-btn" data-try-run>&#9654;  START</button>
        <button type="button" class="action-demo-btn action-demo-btn--secondary" data-try-step>Step 1 tick</button>
        <button type="button" class="action-demo-btn action-demo-btn--secondary" data-try-reset>Reset</button>
      </div>
    </div>
    <div class="docs-try-mini-grid action-demo-grid" aria-hidden="false"></div>
  `;
  container.appendChild(root);

  const gridEl = root.querySelector('.docs-try-mini-grid');
  const btnRun = root.querySelector('[data-try-run]');
  const btnStep = root.querySelector('[data-try-step]');
  const btnReset = root.querySelector('[data-try-reset]');

  function makeSoloInitialState() {
    const s = makeInitialState();
    s.bots.delete(2);
    for (const h of s.grid.values()) {
      if (h.controller?.pid === 2) h.controller = null;
    }
    return s;
  }

  state = makeSoloInitialState();

  function push() {
    if (!state || !gridEl) return;
    gridEl.innerHTML = renderHexGrid(state, config.HEX_SIZE);

    const busy = stepBusy;
    const over = state.isOver;
    if (btnRun) {
      btnRun.textContent = running ? '\u23F8  PAUSE' : '\u25B6  START';
      btnRun.setAttribute('aria-pressed', running ? 'true' : 'false');
      btnRun.disabled = busy;
    }
    if (btnStep) btnStep.disabled = busy || over;
    if (btnReset) btnReset.disabled = busy;
  }

  async function advanceSingleTick() {
    if (!state || state.isOver || destroyed) return;

    const runner = runners[1];
    if (!runner || !runner.ready) return;

    state.advanceTurn();
    state.resetPaintClaims();

    try {
      const snapshot = state.toSnapshot(1);
      const action = await runner.decide(snapshot);
      state.applyAction(1, action, noopLog);
    } catch (err) {
      console.error('Try preview bot 1:', err);
    }

    state.flushPaintClaims();
    state.neutralizeCollidingTiles(noopLog);
    state.tickBotTimers();

    if (state.isOver) {
      running = false;
    }

    push();
  }

  async function gameLoop() {
    while (!destroyed) {
      await new Promise((r) => requestAnimationFrame(r));
      if (destroyed) break;
      if (stepBusy) continue;
      if (!running) continue;

      const now = performance.now();
      if (now - lastTick < TICK_DELAY * 1000) continue;
      lastTick = now;

      if (!state || state.isOver) {
        running = false;
        push();
        continue;
      }

      try {
        await advanceSingleTick();
      } catch (err) {
        console.error('Try preview tick:', err);
        running = false;
        push();
      }
    }
  }

  void gameLoop();

  function toggleRun() {
    if (running) {
      running = false;
    } else {
      if (state?.isOver) {
        void resetMatch();
        return;
      }
      running = true;
      lastTick = performance.now();
    }
    push();
  }

  async function runStepTicks() {
    if (stepBusy || !state || state.isOver || destroyed) return;
    stepBusy = true;
    push();
    if (running) {
      running = false;
    }
    try {
      await advanceSingleTick();
    } finally {
      stepBusy = false;
      push();
    }
  }

  async function resetMatch() {
    if (destroyed) return;
    running = false;
    runners[1].resetTimingStats();
    await runners[1].resetBotInstance();
    state = makeSoloInitialState();
    push();
  }

  btnRun.addEventListener('click', () => toggleRun());
  btnStep.addEventListener('click', () => { void runStepTicks(); });
  btnReset.addEventListener('click', () => { void resetMatch(); });

  push();

  return () => {
    destroyed = true;
    running = false;
    clearLog();
    runners[1].shutdown();
    container.innerHTML = '';
  };
}
