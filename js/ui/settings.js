import config from '../config.js';

/** Wrapped JSON files; plain objects with only setting keys are also accepted. */
export const SETTINGS_PROFILE_FORMAT = 'splatbot-settings-profile';
export const SETTINGS_PROFILE_VERSION = 1;

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** Session-only overrides (no localStorage). */
let memoryOverrides = {};

try {
  localStorage.removeItem('splatbot_settings_v1');
} catch {
  /* ignore */
}

/** Tab ids used by `SETTING_SPECS[].tab`. */
export const SETTINGS_TABS = [
  { id: 'match', label: 'Match' },
  { id: 'rules', label: 'Rules' },
  { id: 'appearance', label: 'Appearance' },
];

const SETTINGS_TAB_DESCRIPTIONS = {
  match: 'Adjust game size, pacing, and turn timing.',
  rules: 'Configure which abilities are allowed and their stun/cooldown values.',
  appearance: 'Customize bot markers and the match color palette.',
};

/** Rows for the Rules tab matrix (special abilities). Order matches UI. */
export const RULE_ABILITY_ROWS = [
  {
    label: 'Splat',
    allowKey: 'SPLAT_ALLOWED',
    stunKey: 'SPLAT_STUN_TURNS',
    cooldownKey: 'SPLAT_COOLDOWN_TURNS',
  },
  {
    label: 'Dash',
    allowKey: 'DASH_ALLOWED',
    stunKey: 'DASH_STUN_TURNS',
    cooldownKey: 'DASH_COOLDOWN_TURNS',
  },
  {
    label: 'Paintball',
    allowKey: 'SHOOT_PAINTBALL_ALLOWED',
    stunKey: 'PAINTBALL_STUN_TURNS',
    cooldownKey: 'SHOOT_PAINTBALL_COOLDOWN_TURNS',
  },
];

export const SETTING_SPECS = [
  { key: 'GRID_RADIUS', tab: 'match', label: 'Grid radius', kind: 'int', min: 2, max: 20, step: 1 },
  { key: 'MAX_TURNS', tab: 'match', label: 'Max turns', kind: 'int', min: 1, max: 10000, step: 1 },
  { key: 'TICK_DELAY', tab: 'match', label: 'Tick delay (s)', kind: 'float', min: 0.01, max: 5.0, step: 0.01 },
  { key: 'TIMEOUT', tab: 'match', label: 'Bot timeout (s)', kind: 'float', min: 0.6, max: 30.0, step: 0.1 },
  { key: 'TIMEOUT_INTERRUPT_GRACE', tab: 'match', label: 'Timeout interrupt grace (s)', kind: 'float', min: 0.05, max: 5.0, step: 0.01 },
  { key: 'SPLAT_ALLOWED', tab: 'rules', label: 'Splat allowed', kind: 'bool' },
  { key: 'DASH_ALLOWED', tab: 'rules', label: 'Dash allowed', kind: 'bool' },
  { key: 'SHOOT_PAINTBALL_ALLOWED', tab: 'rules', label: 'Paintball allowed', kind: 'bool' },
  {
    key: 'SPLAT_STUN_TURNS',
    tab: 'rules',
    label: 'Splat stun (turns)',
    kind: 'int',
    min: 0,
    max: 100,
    step: 1,
  },
  {
    key: 'SPLAT_COOLDOWN_TURNS',
    tab: 'rules',
    label: 'Splat cooldown (turns)',
    kind: 'int',
    min: 0,
    max: 100,
    step: 1,
  },
  {
    key: 'DASH_COOLDOWN_TURNS',
    tab: 'rules',
    label: 'Dash cooldown (turns)',
    kind: 'int',
    min: 0,
    max: 100,
    step: 1,
  },
  {
    key: 'DASH_STUN_TURNS',
    tab: 'rules',
    label: 'Dash stun (turns)',
    kind: 'int',
    min: 0,
    max: 100,
    step: 1,
  },
  {
    key: 'PAINTBALL_STUN_TURNS',
    tab: 'rules',
    label: 'Paintball stun (turns)',
    kind: 'int',
    min: 0,
    max: 100,
    step: 1,
  },
  {
    key: 'SHOOT_PAINTBALL_COOLDOWN_TURNS',
    tab: 'rules',
    label: 'Paintball cooldown (turns)',
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
  { key: 'BOT_MARKER_SHOW_IDS', tab: 'appearance', label: 'Show bot id on map', kind: 'bool' },
  { key: 'PLAYER_BASE_COLORS.1', tab: 'appearance', label: 'Player 1 color', kind: 'color' },
  { key: 'PLAYER_BASE_COLORS.2', tab: 'appearance', label: 'Player 2 color', kind: 'color' },
  { key: 'BACKGROUND_BASE_COLOR', tab: 'appearance', label: 'Background color', kind: 'color' },
];

const SPEC_BY_KEY = Object.fromEntries(SETTING_SPECS.map(s => [s.key, s]));

/** Map legacy profile keys to current keys (old field names / appearance split colors). */
function migrateLegacySettingsKeys(overrides) {
  const o = { ...overrides };
  const pairs = [
    ['SPLAT_ACTION_LOCKOUT_TURNS', 'SPLAT_STUN_TURNS'],
    ['SPLAT_INTERVAL_TURNS', 'SPLAT_COOLDOWN_TURNS'],
    ['DASH_INTERVAL_TURNS', 'DASH_COOLDOWN_TURNS'],
    ['SHOOT_PAINTBALL_ACTION_LOCKOUT_TURNS', 'PAINTBALL_STUN_TURNS'],
    ['SHOOT_PAINTBALL_INTERVAL_TURNS', 'SHOOT_PAINTBALL_COOLDOWN_TURNS'],
  ];
  for (const [oldKey, newKey] of pairs) {
    if (oldKey in o && !(newKey in o)) o[newKey] = o[oldKey];
  }
  // Old appearance settings used 3 separate colors per player; use bot color as
  // canonical base shade, then fall back to highlight, then tile.
  const appearancePairs = [
    ['PLAYER_BOT_COLORS.1', 'PLAYER_BASE_COLORS.1'],
    ['PLAYER_BOT_COLORS.2', 'PLAYER_BASE_COLORS.2'],
    ['PLAYER_BRIGHT_COLORS.1', 'PLAYER_BASE_COLORS.1'],
    ['PLAYER_BRIGHT_COLORS.2', 'PLAYER_BASE_COLORS.2'],
    ['PLAYER_TILE_COLORS.1', 'PLAYER_BASE_COLORS.1'],
    ['PLAYER_TILE_COLORS.2', 'PLAYER_BASE_COLORS.2'],
    ['TILE_NONE_COLOR', 'BACKGROUND_BASE_COLOR'],
    ['TILE_STROKE_COLOR', 'BACKGROUND_BASE_COLOR'],
    ['CANVAS_BG', 'BACKGROUND_BASE_COLOR'],
  ];
  for (const [oldKey, newKey] of appearancePairs) {
    if (oldKey in o && !(newKey in o)) o[newKey] = o[oldKey];
  }
  return o;
}

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
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

function readableTextOn(bgHex) {
  const dark = '#0b111e';
  const light = '#f3f8ff';
  return contrastRatio(bgHex, dark) >= contrastRatio(bgHex, light) ? dark : light;
}

function derivePlayerPalette(baseHex) {
  return {
    tile: mixHex(baseHex, '#000000', 0.28),
    stroke: mixHex(baseHex, '#000000', 0.45),
    dark: mixHex(baseHex, '#000000', 0.24),
    bot: baseHex,
    bright: mixHex(baseHex, '#ffffff', 0.18),
    botText: readableTextOn(baseHex),
  };
}

function deriveBackgroundPalette(baseHex) {
  return {
    tileNone: baseHex,
    tileStroke: mixHex(baseHex, '#000000', 0.45),
    canvasBg: mixHex(baseHex, '#000000', 0.58),
  };
}

function getDefaultFlat() {
  return {
    GRID_RADIUS: 8,
    MAX_TURNS: 500,
    TICK_DELAY: 0.15,
    TIMEOUT: 1.0,
    TIMEOUT_INTERRUPT_GRACE: 0.35,
    SPLAT_ALLOWED: true,
    DASH_ALLOWED: true,
    SHOOT_PAINTBALL_ALLOWED: true,
    SPLAT_STUN_TURNS: 3,
    SPLAT_COOLDOWN_TURNS: 10,
    DASH_COOLDOWN_TURNS: 7,
    DASH_STUN_TURNS: 0,
    PAINTBALL_STUN_TURNS: 7,
    SHOOT_PAINTBALL_COOLDOWN_TURNS: 20,
    BOT_DISPLAY_TYPE: 'triangles',
    BOT_MARKER_SHOW_IDS: false,
    'PLAYER_BASE_COLORS.1': '#ff6b2b',
    'PLAYER_BASE_COLORS.2': '#00d4ff',
    BACKGROUND_BASE_COLOR: '#161f30',
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
  if (spec.kind === 'bool') {
    if (rawValue === true || rawValue === 'true' || rawValue === 1 || rawValue === '1') return true;
    if (rawValue === false || rawValue === 'false' || rawValue === 0 || rawValue === '0') return false;
    throw new Error(`${spec.key} must be true or false`);
  }
  throw new Error(`Unknown setting type: ${spec.kind}`);
}

export function loadOverrides() {
  return { ...memoryOverrides };
}

export function saveOverrides(overrides) {
  memoryOverrides = { ...overrides };
}

/**
 * @param {string} text
 * @returns {{ clean: Record<string, unknown> | null, errors: string[] }}
 */
export function parseSettingsProfileJSON(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { clean: null, errors: [`Invalid JSON: ${e.message}`] };
  }
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return { clean: null, errors: ['Profile must be a JSON object'] };
  }
  let rawSettings;
  if (data.format === SETTINGS_PROFILE_FORMAT) {
    if (data.version !== SETTINGS_PROFILE_VERSION) {
      return {
        clean: null,
        errors: [`Unsupported profile version (expected ${SETTINGS_PROFILE_VERSION}): ${data.version}`],
      };
    }
    if (data.settings == null || typeof data.settings !== 'object' || Array.isArray(data.settings)) {
      return { clean: null, errors: ['Profile is missing a "settings" object'] };
    }
    rawSettings = data.settings;
  } else {
    rawSettings = data;
  }
  const migrated = migrateLegacySettingsKeys(rawSettings);
  const picked = {};
  for (const spec of SETTING_SPECS) {
    if (spec.key in migrated) picked[spec.key] = migrated[spec.key];
  }
  return validateOverrides(picked);
}

/** @param {Record<string, unknown>} flat effective values (all SETTING_SPECS keys) */
export function serializeSettingsProfile(flat) {
  const settings = {};
  for (const spec of SETTING_SPECS) {
    settings[spec.key] = flat[spec.key];
  }
  return `${JSON.stringify(
    {
      format: SETTINGS_PROFILE_FORMAT,
      version: SETTINGS_PROFILE_VERSION,
      settings,
    },
    null,
    2,
  )}\n`;
}

export function mergeWithDefaults(overrides) {
  const migrated = migrateLegacySettingsKeys(overrides);
  const merged = getDefaultFlat();
  for (const spec of SETTING_SPECS) {
    if (spec.key in migrated) {
      try {
        merged[spec.key] = coerceSetting(spec, migrated[spec.key]);
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
  config.TIMEOUT_INTERRUPT_GRACE = flat.TIMEOUT_INTERRUPT_GRACE;
  config.SPLAT_ALLOWED = flat.SPLAT_ALLOWED;
  config.DASH_ALLOWED = flat.DASH_ALLOWED;
  config.SHOOT_PAINTBALL_ALLOWED = flat.SHOOT_PAINTBALL_ALLOWED;
  config.SPLAT_STUN_TURNS = flat.SPLAT_STUN_TURNS;
  config.SPLAT_COOLDOWN_TURNS = flat.SPLAT_COOLDOWN_TURNS;
  config.DASH_COOLDOWN_TURNS = flat.DASH_COOLDOWN_TURNS;
  config.DASH_STUN_TURNS = flat.DASH_STUN_TURNS;
  config.PAINTBALL_STUN_TURNS = flat.PAINTBALL_STUN_TURNS;
  config.SHOOT_PAINTBALL_COOLDOWN_TURNS = flat.SHOOT_PAINTBALL_COOLDOWN_TURNS;
  config.BOT_DISPLAY_TYPE = flat.BOT_DISPLAY_TYPE;
  config.BOT_MARKER_SHOW_IDS = flat.BOT_MARKER_SHOW_IDS;
  const p1 = derivePlayerPalette(flat['PLAYER_BASE_COLORS.1']);
  const p2 = derivePlayerPalette(flat['PLAYER_BASE_COLORS.2']);
  const bg = deriveBackgroundPalette(flat.BACKGROUND_BASE_COLOR);
  config.PLAYER_BASE_COLORS = { 1: flat['PLAYER_BASE_COLORS.1'], 2: flat['PLAYER_BASE_COLORS.2'] };
  config.PLAYER_TILE_COLORS = { 1: p1.tile, 2: p2.tile };
  config.PLAYER_STROKE_COLORS = { 1: p1.stroke, 2: p2.stroke };
  config.PLAYER_DARK_COLORS = { 1: p1.dark, 2: p2.dark };
  config.PLAYER_BOT_COLORS = { 1: p1.bot, 2: p2.bot };
  config.PLAYER_BRIGHT_COLORS = { 1: p1.bright, 2: p2.bright };
  config.PLAYER_BOT_TEXT_COLORS = { 1: p1.botText, 2: p2.botText };
  config.BACKGROUND_BASE_COLOR = flat.BACKGROUND_BASE_COLOR;
  config.TILE_NONE_COLOR = bg.tileNone;
  config.TILE_STROKE_COLOR = bg.tileStroke;
  config.CANVAS_BG = bg.canvasBg;
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

function appendSettingRow(parent, spec, currentValues, defaultValues, controls) {
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
  } else if (spec.kind === 'bool') {
    row.classList.add('settings-field-row--bool');
    input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'settings-input settings-input--checkbox';
    input.checked = Boolean(currentValues[spec.key]);
    input.setAttribute('aria-label', spec.label ?? spec.key);
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
  if (spec.kind === 'color') {
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'sb-btn sb-btn--compact settings-reset-btn';
    resetBtn.textContent = 'Reset';
    resetBtn.setAttribute('aria-label', `Reset ${spec.label ?? spec.key} to default`);
    const defaultColor = (defaultValues[spec.key] || '#000000').toLowerCase();
    function syncResetVisibility() {
      const matchesDefault = String(input.value || '').toLowerCase() === defaultColor;
      resetBtn.hidden = matchesDefault;
      resetBtn.disabled = matchesDefault;
    }
    resetBtn.addEventListener('click', () => {
      input.value = defaultColor;
      syncResetVisibility();
    });
    input.addEventListener('input', syncResetVisibility);
    input.addEventListener('change', syncResetVisibility);
    syncResetVisibility();
    row.appendChild(resetBtn);
  }
  parent.appendChild(row);
}

function appendRulesMatrix(panel, currentValues, controls) {
  const syncDisabledFns = [];
  const wrap = document.createElement('div');
  wrap.className = 'settings-rules-matrix';

  const header = document.createElement('div');
  header.className = 'settings-rules-matrix-row settings-rules-matrix-row--header';
  for (const text of ['Ability', 'Allow', 'Stun', 'Cooldown']) {
    const cell = document.createElement('div');
    cell.className = 'settings-rules-matrix-cell';
    if (text === 'Ability') cell.classList.add('settings-rules-matrix-cell--name');
    cell.textContent = text;
    header.appendChild(cell);
  }
  wrap.appendChild(header);

  for (const row of RULE_ABILITY_ROWS) {
    const r = document.createElement('div');
    r.className = 'settings-rules-matrix-row';

    const nameCell = document.createElement('div');
    nameCell.className = 'settings-rules-matrix-cell settings-rules-matrix-cell--name';
    nameCell.textContent = row.label;
    r.appendChild(nameCell);

    const allowCb = document.createElement('input');
    allowCb.type = 'checkbox';
    allowCb.className = 'settings-input settings-input--checkbox';
    allowCb.checked = currentValues[row.allowKey] !== false;
    allowCb.setAttribute('aria-label', `Allow ${row.label}`);
    controls[row.allowKey] = allowCb;
    const allowCell = document.createElement('div');
    allowCell.className = 'settings-rules-matrix-cell settings-rules-matrix-cell--center';
    allowCell.appendChild(allowCb);
    r.appendChild(allowCell);

    const stunSpec = SPEC_BY_KEY[row.stunKey];
    const stunInput = document.createElement('input');
    stunInput.type = 'number';
    stunInput.className = 'settings-input settings-input--number';
    stunInput.value = currentValues[row.stunKey];
    stunInput.setAttribute('aria-label', `${row.label} stun (turns)`);
    if (stunSpec.min != null) stunInput.min = stunSpec.min;
    if (stunSpec.max != null) stunInput.max = stunSpec.max;
    if (stunSpec.step != null) stunInput.step = stunSpec.step;
    controls[row.stunKey] = stunInput;
    const stunCell = document.createElement('div');
    stunCell.className = 'settings-rules-matrix-cell';
    stunCell.appendChild(stunInput);
    r.appendChild(stunCell);

    const cdSpec = SPEC_BY_KEY[row.cooldownKey];
    const cdInput = document.createElement('input');
    cdInput.type = 'number';
    cdInput.className = 'settings-input settings-input--number';
    cdInput.value = currentValues[row.cooldownKey];
    cdInput.setAttribute('aria-label', `${row.label} cooldown (turns)`);
    if (cdSpec.min != null) cdInput.min = cdSpec.min;
    if (cdSpec.max != null) cdInput.max = cdSpec.max;
    if (cdSpec.step != null) cdInput.step = cdSpec.step;
    controls[row.cooldownKey] = cdInput;
    const cdCell = document.createElement('div');
    cdCell.className = 'settings-rules-matrix-cell';
    cdCell.appendChild(cdInput);
    r.appendChild(cdCell);

    function syncDisabled() {
      const on = allowCb.checked;
      stunInput.disabled = !on;
      cdInput.disabled = !on;
    }
    allowCb.addEventListener('change', syncDisabled);
    syncDisabled();
    syncDisabledFns.push(syncDisabled);

    wrap.appendChild(r);
  }

  panel.appendChild(wrap);
  return () => {
    for (const fn of syncDisabledFns) fn();
  };
}

/** Build settings form inside `container`. Returns {getValues, setValues}. */
export function buildSettingsUI(container, currentValues) {
  container.innerHTML = '';
  const controls = {};
  const defaultValues = getDefaultFlat();

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
    const desc = SETTINGS_TAB_DESCRIPTIONS[t.id];
    if (desc) {
      const descEl = document.createElement('p');
      descEl.className = 'settings-tab-description';
      descEl.textContent = desc;
      panel.appendChild(descEl);
    }
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
    if (panel && spec.tab !== 'rules') appendSettingRow(panel, spec, currentValues, defaultValues, controls);
  }
  const syncRulesMatrix = appendRulesMatrix(panelsById.rules, currentValues, controls);

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
        const c = controls[spec.key];
        if (spec.kind === 'bool') vals[spec.key] = c.checked;
        else vals[spec.key] = c.value;
      }
      return vals;
    },
    setValues(vals) {
      for (const spec of SETTING_SPECS) {
        if (!(spec.key in vals)) continue;
        const c = controls[spec.key];
        if (spec.kind === 'bool') c.checked = Boolean(vals[spec.key]);
        else c.value = vals[spec.key];
      }
      syncRulesMatrix();
    },
  };
}
