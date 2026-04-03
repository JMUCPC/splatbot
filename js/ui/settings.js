import config from '../config.js';

const STORAGE_KEY = 'splatbot_settings_v1';
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** Tab ids used by `SETTING_SPECS[].tab`. */
export const SETTINGS_TABS = [
  { id: 'match', label: 'Match' },
  { id: 'rules', label: 'Rules' },
  { id: 'appearance', label: 'Appearance' },
];

export const SETTING_SPECS = [
  { key: 'GRID_RADIUS', tab: 'match', label: 'Grid radius', kind: 'int', min: 2, max: 20, step: 1 },
  { key: 'MAX_TURNS', tab: 'match', label: 'Max turns', kind: 'int', min: 1, max: 10000, step: 1 },
  { key: 'TICK_DELAY', tab: 'match', label: 'Tick delay (s)', kind: 'float', min: 0.01, max: 5.0, step: 0.01 },
  { key: 'TIMEOUT', tab: 'match', label: 'Bot timeout (s)', kind: 'float', min: 0.6, max: 30.0, step: 0.1 },
  {
    key: 'SPLAT_ACTION_LOCKOUT_TURNS',
    tab: 'rules',
    label: 'Splat lockout (turns)',
    kind: 'int',
    min: 0,
    max: 100,
    step: 1,
  },
  {
    key: 'SPLAT_INTERVAL_TURNS',
    tab: 'rules',
    label: 'Splat interval (turns)',
    kind: 'int',
    min: 0,
    max: 100,
    step: 1,
  },
  {
    key: 'DASH_INTERVAL_TURNS',
    tab: 'rules',
    label: 'Dash interval (turns)',
    kind: 'int',
    min: 0,
    max: 100,
    step: 1,
  },
  {
    key: 'BOT_DISPLAY_TYPE',
    tab: 'appearance',
    label: 'Bot marker shape',
    kind: 'enum',
    choices: ['circles', 'triangles'],
  },
  { key: 'PLAYER_TILE_COLORS.1', tab: 'appearance', label: 'Player 1 tile', kind: 'color' },
  { key: 'PLAYER_TILE_COLORS.2', tab: 'appearance', label: 'Player 2 tile', kind: 'color' },
  { key: 'PLAYER_BOT_COLORS.1', tab: 'appearance', label: 'Player 1 bot', kind: 'color' },
  { key: 'PLAYER_BOT_COLORS.2', tab: 'appearance', label: 'Player 2 bot', kind: 'color' },
  { key: 'PLAYER_BRIGHT_COLORS.1', tab: 'appearance', label: 'Player 1 highlight', kind: 'color' },
  { key: 'PLAYER_BRIGHT_COLORS.2', tab: 'appearance', label: 'Player 2 highlight', kind: 'color' },
  { key: 'TILE_NONE_COLOR', tab: 'appearance', label: 'Empty tile', kind: 'color' },
  { key: 'TILE_STROKE_COLOR', tab: 'appearance', label: 'Hex stroke', kind: 'color' },
  { key: 'CANVAS_BG', tab: 'appearance', label: 'Canvas background', kind: 'color' },
];

const SPEC_BY_KEY = Object.fromEntries(SETTING_SPECS.map(s => [s.key, s]));

function getDefaultFlat() {
  return {
    GRID_RADIUS: 8,
    MAX_TURNS: 200,
    TICK_DELAY: 0.15,
    TIMEOUT: 1.0,
    SPLAT_ACTION_LOCKOUT_TURNS: 3,
    SPLAT_INTERVAL_TURNS: 10,
    DASH_INTERVAL_TURNS: 7,
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
  config.SPLAT_ACTION_LOCKOUT_TURNS = flat.SPLAT_ACTION_LOCKOUT_TURNS;
  config.SPLAT_INTERVAL_TURNS = flat.SPLAT_INTERVAL_TURNS;
  config.DASH_INTERVAL_TURNS = flat.DASH_INTERVAL_TURNS;
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

function appendSettingRow(parent, spec, currentValues, controls) {
  const row = document.createElement('div');
  row.className = 'settings-field-row';

  const label = document.createElement('div');
  label.className = 'sb-label-xs settings-field-label';
  label.textContent = spec.label ?? spec.key;
  row.appendChild(label);

  let input;
  if (spec.kind === 'enum') {
    input = document.createElement('select');
    input.className = 'settings-input settings-input--enum';
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
    input.className = 'settings-input settings-input--color';
    input.value = currentValues[spec.key] || '#000000';
  } else {
    input = document.createElement('input');
    input.type = 'number';
    input.className = 'settings-input settings-input--number';
    input.value = currentValues[spec.key];
    if (spec.min != null) input.min = spec.min;
    if (spec.max != null) input.max = spec.max;
    if (spec.step != null) input.step = spec.step;
  }

  controls[spec.key] = input;
  row.appendChild(input);
  parent.appendChild(row);
}

/** Build settings form inside `container`. Returns {getValues, setValues}. */
export function buildSettingsUI(container, currentValues) {
  container.innerHTML = '';
  const controls = {};

  const tabRow = document.createElement('div');
  tabRow.className = 'settings-tab-row';
  tabRow.setAttribute('role', 'tablist');
  tabRow.setAttribute('aria-label', 'Settings sections');

  const panelsById = {};
  for (const t of SETTINGS_TABS) {
    const panel = document.createElement('div');
    panel.className = 'settings-tab-panel';
    panel.id = `settings-tabpanel-${t.id}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `settings-tab-${t.id}`);
    panelsById[t.id] = panel;
  }

  const firstTabId = SETTINGS_TABS[0].id;
  const tabButtons = {};

  function activateTab(tabId) {
    for (const t of SETTINGS_TABS) {
      const active = t.id === tabId;
      const btn = tabButtons[t.id];
      btn.classList.toggle('settings-tab--active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.tabIndex = active ? 0 : -1;
      panelsById[t.id].hidden = !active;
    }
  }

  const tabIds = SETTINGS_TABS.map((x) => x.id);

  for (const t of SETTINGS_TABS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'settings-tab';
    if (t.id === firstTabId) btn.classList.add('settings-tab--active');
    btn.id = `settings-tab-${t.id}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', t.id === firstTabId ? 'true' : 'false');
    btn.setAttribute('aria-controls', `settings-tabpanel-${t.id}`);
    btn.tabIndex = t.id === firstTabId ? 0 : -1;
    btn.textContent = t.label;
    btn.addEventListener('click', () => activateTab(t.id));
    tabButtons[t.id] = btn;
    tabRow.appendChild(btn);
  }

  tabRow.addEventListener('keydown', (e) => {
    const i = tabIds.findIndex((id) => tabButtons[id] === document.activeElement);
    if (i < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % tabIds.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabIds.length) % tabIds.length;
    if (next < 0) return;
    e.preventDefault();
    const id = tabIds[next];
    activateTab(id);
    tabButtons[id].focus();
  });

  for (const spec of SETTING_SPECS) {
    const panel = panelsById[spec.tab];
    if (panel) appendSettingRow(panel, spec, currentValues, controls);
  }

  for (const t of SETTINGS_TABS) {
    panelsById[t.id].hidden = t.id !== firstTabId;
  }

  container.appendChild(tabRow);
  const panelsWrap = document.createElement('div');
  panelsWrap.className = 'settings-panels-wrap';
  for (const t of SETTINGS_TABS) {
    panelsWrap.appendChild(panelsById[t.id]);
  }
  container.appendChild(panelsWrap);

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
