import config from '../config.js';

const STORAGE_KEY = 'splatbot_settings_v1';
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export const SETTING_SPECS = [
  { key: 'GRID_RADIUS', kind: 'int', min: 2, max: 20, step: 1 },
  { key: 'MAX_TURNS', kind: 'int', min: 1, max: 10000, step: 1 },
  { key: 'TICK_DELAY', kind: 'float', min: 0.01, max: 5.0, step: 0.01 },
  { key: 'TIMEOUT', kind: 'float', min: 0.6, max: 30.0, step: 0.1 },
  { key: 'BOT_DISPLAY_TYPE', kind: 'enum', choices: ['circles', 'triangles'] },
  { key: 'PLAYER_TILE_COLORS.1', kind: 'color' },
  { key: 'PLAYER_TILE_COLORS.2', kind: 'color' },
  { key: 'PLAYER_BOT_COLORS.1', kind: 'color' },
  { key: 'PLAYER_BOT_COLORS.2', kind: 'color' },
  { key: 'PLAYER_BRIGHT_COLORS.1', kind: 'color' },
  { key: 'PLAYER_BRIGHT_COLORS.2', kind: 'color' },
  { key: 'TILE_NONE_COLOR', kind: 'color' },
  { key: 'TILE_STROKE_COLOR', kind: 'color' },
  { key: 'CANVAS_BG', kind: 'color' },
];

const SPEC_BY_KEY = Object.fromEntries(SETTING_SPECS.map(s => [s.key, s]));

function getDefaultFlat() {
  return {
    GRID_RADIUS: 8,
    MAX_TURNS: 200,
    TICK_DELAY: 0.15,
    TIMEOUT: 1.0,
    BOT_DISPLAY_TYPE: 'triangles',
    'PLAYER_TILE_COLORS.1': '#b84010',
    'PLAYER_TILE_COLORS.2': '#0a7090',
    'PLAYER_BOT_COLORS.1': '#ff6b2b',
    'PLAYER_BOT_COLORS.2': '#00d4ff',
    'PLAYER_BRIGHT_COLORS.1': '#ff8c50',
    'PLAYER_BRIGHT_COLORS.2': '#22e0ff',
    TILE_NONE_COLOR: '#161f30',
    TILE_STROKE_COLOR: '#090f1d',
    CANVAS_BG: '#070d1a',
  };
}

function coerceSetting(spec, rawValue) {
  if (spec.kind === 'int') {
    const v = parseInt(rawValue, 10);
    if (isNaN(v)) throw new Error(`${spec.key} must be an integer`);
    if (spec.min != null && v < spec.min) throw new Error(`${spec.key} must be >= ${spec.min}`);
    if (spec.max != null && v > spec.max) throw new Error(`${spec.key} must be <= ${spec.max}`);
    return v;
  }
  if (spec.kind === 'float') {
    const v = parseFloat(rawValue);
    if (isNaN(v)) throw new Error(`${spec.key} must be a number`);
    if (spec.min != null && v < spec.min) throw new Error(`${spec.key} must be >= ${spec.min}`);
    if (spec.max != null && v > spec.max) throw new Error(`${spec.key} must be <= ${spec.max}`);
    return v;
  }
  if (spec.kind === 'enum') {
    const v = String(rawValue);
    if (!spec.choices.includes(v)) throw new Error(`${spec.key} must be one of: ${spec.choices.join(', ')}`);
    return v;
  }
  if (spec.kind === 'color') {
    const v = String(rawValue).trim();
    if (!COLOR_RE.test(v)) throw new Error(`${spec.key} must be a hex color like #AABBCC`);
    return v.toLowerCase();
  }
  throw new Error(`Unknown setting type: ${spec.kind}`);
}

export function loadOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveOverrides(overrides) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

export function mergeWithDefaults(overrides) {
  const merged = getDefaultFlat();
  for (const spec of SETTING_SPECS) {
    if (spec.key in overrides) {
      try {
        merged[spec.key] = coerceSetting(spec, overrides[spec.key]);
      } catch { /* keep default */ }
    }
  }
  return merged;
}

export function applyToConfig(flat) {
  config.GRID_RADIUS = flat.GRID_RADIUS;
  config.MAX_TURNS = flat.MAX_TURNS;
  config.TICK_DELAY = flat.TICK_DELAY;
  config.TIMEOUT = flat.TIMEOUT;
  config.BOT_DISPLAY_TYPE = flat.BOT_DISPLAY_TYPE;
  config.PLAYER_TILE_COLORS = { 1: flat['PLAYER_TILE_COLORS.1'], 2: flat['PLAYER_TILE_COLORS.2'] };
  config.PLAYER_BOT_COLORS = { 1: flat['PLAYER_BOT_COLORS.1'], 2: flat['PLAYER_BOT_COLORS.2'] };
  config.PLAYER_BRIGHT_COLORS = { 1: flat['PLAYER_BRIGHT_COLORS.1'], 2: flat['PLAYER_BRIGHT_COLORS.2'] };
  config.TILE_NONE_COLOR = flat.TILE_NONE_COLOR;
  config.TILE_STROKE_COLOR = flat.TILE_STROKE_COLOR;
  config.CANVAS_BG = flat.CANVAS_BG;
}

export function validateOverrides(raw) {
  const clean = {};
  const errors = [];
  for (const [key, val] of Object.entries(raw)) {
    if (!(key in SPEC_BY_KEY)) {
      errors.push(`Unknown setting: ${key}`);
      continue;
    }
    try {
      clean[key] = coerceSetting(SPEC_BY_KEY[key], val);
    } catch (e) {
      errors.push(e.message);
    }
  }
  return { clean, errors };
}

/** Build settings form inside `container`. Returns {getValues, setValues}. */
export function buildSettingsUI(container, currentValues) {
  container.innerHTML = '';
  const controls = {};

  for (const spec of SETTING_SPECS) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; align-items:center; gap:10px; width:100%; margin-bottom:8px';

    const label = document.createElement('div');
    label.className = 'sb-label-xs';
    label.style.cssText = 'width:240px; flex-shrink:0';
    label.textContent = spec.key;
    row.appendChild(label);

    let input;
    if (spec.kind === 'enum') {
      input = document.createElement('select');
      input.style.cssText =
        'flex:1; background:#070d1a; color:#607080; border:1px solid #1a2a40; ' +
        'border-radius:4px; padding:4px 8px; font-family:"Share Tech Mono",monospace; font-size:0.7rem';
      for (const choice of spec.choices) {
        const opt = document.createElement('option');
        opt.value = choice;
        opt.textContent = choice;
        if (currentValues[spec.key] === choice) opt.selected = true;
        input.appendChild(opt);
      }
    } else if (spec.kind === 'color') {
      input = document.createElement('input');
      input.type = 'color';
      input.value = currentValues[spec.key] || '#000000';
      input.style.cssText = 'flex:1; background:#070d1a; border:1px solid #1a2a40; border-radius:4px; height:30px; cursor:pointer';
    } else {
      input = document.createElement('input');
      input.type = 'number';
      input.value = currentValues[spec.key];
      if (spec.min != null) input.min = spec.min;
      if (spec.max != null) input.max = spec.max;
      if (spec.step != null) input.step = spec.step;
      input.style.cssText =
        'flex:1; background:#070d1a; color:#607080; border:1px solid #1a2a40; ' +
        'border-radius:4px; padding:4px 8px; font-family:"Share Tech Mono",monospace; font-size:0.7rem';
    }

    controls[spec.key] = input;
    row.appendChild(input);
    container.appendChild(row);
  }

  return {
    getValues() {
      const vals = {};
      for (const spec of SETTING_SPECS) {
        vals[spec.key] = controls[spec.key].value;
      }
      return vals;
    },
    setValues(vals) {
      for (const spec of SETTING_SPECS) {
        if (spec.key in vals) controls[spec.key].value = vals[spec.key];
      }
    },
  };
}
