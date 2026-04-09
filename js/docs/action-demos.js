/**
 * Interactive mini hex grids on docs/actions — one Play per reset, real GameState.applyAction.
 */
import { renderHexGrid } from '../renderer/hex-renderer.js';
import { GameState, BotData } from '../engine/game-state.js';
import { Hex, HexDirection, generateHexGrid } from '../engine/hex-grid.js';

const DEMO_HEX_SIZE = 22;

/**
 * @param {number} radius
 * @param {Array<{ pid: number, qr: [number, number], facing?: number, stun?: number, splatCooldown?: number, dashCooldown?: number, paintballCooldown?: number }>} botSpecs
 */
function makeDemoState(radius, botSpecs) {
  const grid = generateHexGrid(radius);
  const bots = new Map();
  for (const spec of botSpecs) {
    const pos = new Hex(spec.qr[0], spec.qr[1]);
    const b = new BotData(
      spec.pid,
      pos,
      spec.facing ?? HexDirection.E,
      spec.stun ?? 0,
      spec.splatCooldown ?? 0,
      spec.dashCooldown ?? 0,
      spec.paintballCooldown ?? 0,
    );
    bots.set(spec.pid, b);
    const h = grid.get(pos.key);
    if (h) h.controller = b;
  }
  return new GameState(grid, bots, 0, 200, radius);
}

const DEMOS = {
  skip: {
    build: () => makeDemoState(3, [{ pid: 1, qr: [0, 0] }]),
    action: { type: 'skip' },
  },
  move: {
    build: () => makeDemoState(3, [{ pid: 1, qr: [-1, 0], facing: HexDirection.E }]),
    action: { type: 'move' },
  },
  splat: {
    build: () => makeDemoState(3, [{ pid: 1, qr: [0, 0] }]),
    action: { type: 'splat' },
  },
  'shoot-paintball-edge': {
    build: () => makeDemoState(3, [{ pid: 1, qr: [-1, 0], facing: HexDirection.E }]),
    action: { type: 'shoot_paintball' },
  },
  'shoot-paintball': {
    build: () => makeDemoState(3, [
      { pid: 1, qr: [-1, 0], facing: HexDirection.E },
      { pid: 2, qr: [2, 0] },
    ]),
    action: { type: 'shoot_paintball' },
  },
  dash: {
    build: () => makeDemoState(3, [{ pid: 1, qr: [-2, 0], facing: HexDirection.E }]),
    action: { type: 'dash', distance: 4 },
  },
  'turn-left': {
    build: () => makeDemoState(3, [{ pid: 1, qr: [0, 0], facing: HexDirection.E }]),
    action: { type: 'turn_left', steps: 1 },
  },
  'turn-left-2': {
    build: () => makeDemoState(3, [{ pid: 1, qr: [0, 0], facing: HexDirection.E }]),
    action: { type: 'turn_left', steps: 2 },
  },
  'face-direction': {
    build: () => makeDemoState(3, [{ pid: 1, qr: [0, 0], facing: HexDirection.E }]),
    action: { type: 'face_direction', direction: HexDirection.SW },
  },
  'turn-180': {
    build: () => makeDemoState(3, [{ pid: 1, qr: [0, 0], facing: HexDirection.E }]),
    action: { type: 'turn_180' },
  },

  // ── hex-grid page demos ────────────────────────────────────────────────
  'hex-move-east': {
    build: () => makeDemoState(3, [{ pid: 1, qr: [0, 0], facing: HexDirection.E }]),
    action: { type: 'move' },
  },
  'hex-move-nw': {
    build: () => makeDemoState(3, [{ pid: 1, qr: [0, 0], facing: HexDirection.NW }]),
    action: { type: 'move' },
  },
  'hex-move-ne': {
    build: () => makeDemoState(3, [{ pid: 1, qr: [0, 0], facing: HexDirection.NE }]),
    action: { type: 'move' },
  },
  'hex-neighbors': {
    build: () => makeDemoState(3, [{ pid: 1, qr: [0, 0] }]),
    action: { type: 'splat' },
  },
  'hex-dash-3': {
    build: () => makeDemoState(3, [{ pid: 1, qr: [-1, 0], facing: HexDirection.E }]),
    action: { type: 'dash', distance: 3 },
  },
  'hex-turn-right': {
    build: () => makeDemoState(3, [{ pid: 1, qr: [0, 0], facing: HexDirection.E }]),
    action: { type: 'turn_right', steps: 1 },
  },
  'hex-opposite': {
    build: () => makeDemoState(3, [{ pid: 1, qr: [0, 0], facing: HexDirection.E }]),
    action: { type: 'turn_180' },
  },
};

function mount(container) {
  const kind = container.getAttribute('data-action-demo');
  const spec = DEMOS[kind];
  if (!spec) return;

  const gridEl = container.querySelector('.action-demo-grid');
  const playBtn = container.querySelector('[data-demo-play]');
  const resetBtn = container.querySelector('[data-demo-reset]');
  if (!gridEl || !playBtn || !resetBtn) return;

  let state = spec.build();
  let played = false;

  function paint() {
    gridEl.innerHTML = renderHexGrid(state, DEMO_HEX_SIZE);
  }

  function reset() {
    state = spec.build();
    played = false;
    playBtn.disabled = false;
    paint();
  }

  function play() {
    if (played) return;
    state.resetPaintClaims();
    state.applyAction(1, spec.action, () => {});
    state.flushPaintClaims();
    played = true;
    playBtn.disabled = true;
    paint();
  }

  playBtn.addEventListener('click', play);
  resetBtn.addEventListener('click', reset);
  paint();
}

document.querySelectorAll('[data-action-demo]').forEach(mount);
