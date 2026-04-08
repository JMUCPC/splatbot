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

const PLAYER_BASE_COLORS = { 1: '#ff6b2b', 2: '#00d4ff' };
const p1 = derivePlayerPalette(PLAYER_BASE_COLORS[1]);
const p2 = derivePlayerPalette(PLAYER_BASE_COLORS[2]);
const BACKGROUND_BASE_COLOR = '#161f30';
const bg = deriveBackgroundPalette(BACKGROUND_BASE_COLOR);

const config = {
  GRID_RADIUS: 8,
  MAX_TURNS: 500,
  TICK_DELAY: 0.15,
  TIMEOUT: 1.0,
  TIMEOUT_INTERRUPT_GRACE: 0.35,
  /** When false, splat actions are rejected for all bots. */
  SPLAT_ALLOWED: true,
  /** When false, dash actions are rejected for all bots. */
  DASH_ALLOWED: true,
  /** When false, shoot_paintball actions are rejected for all bots. */
  SHOOT_PAINTBALL_ALLOWED: true,
  /** After splat: turns where move / dash / splat / shoot_paintball / turning are blocked. */
  SPLAT_STUN_TURNS: 3,
  /** Minimum turns between splats. */
  SPLAT_COOLDOWN_TURNS: 10,
  /** Minimum turns between dashes. */
  DASH_COOLDOWN_TURNS: 7,
  /** After dash: optional extra stun (0 = none). */
  DASH_STUN_TURNS: 0,
  /** Minimum turns between paintball shots. */
  SHOOT_PAINTBALL_COOLDOWN_TURNS: 20,
  /** After shoot_paintball: turns where move / dash / splat / shoot_paintball / turning are blocked. */
  PAINTBALL_STUN_TURNS: 7,
  BOT_DISPLAY_TYPE: "triangles",
  PLAYER_BASE_COLORS,
  PLAYER_TILE_COLORS: { 1: p1.tile, 2: p2.tile },
  PLAYER_STROKE_COLORS: { 1: p1.stroke, 2: p2.stroke },
  PLAYER_DARK_COLORS: { 1: p1.dark, 2: p2.dark },
  PLAYER_BOT_COLORS: { 1: p1.bot, 2: p2.bot },
  PLAYER_BRIGHT_COLORS: { 1: p1.bright, 2: p2.bright },
  PLAYER_BOT_TEXT_COLORS: { 1: p1.botText, 2: p2.botText },
  BACKGROUND_BASE_COLOR,
  TILE_NONE_COLOR: bg.tileNone,
  TILE_STROKE_COLOR: bg.tileStroke,
  CANVAS_BG: bg.canvasBg,
  HEX_SIZE: 26,
  LOAD_BUILTIN_BOTS: true,
  BUILTIN_BOTS_PATH: "python/bots/",
  BUILTIN_BOTS: {
    random: "random_bot.py",
    random_dash: "random_dash_bot.py",
    random_splat: "random_splat_bot.py",
    random_paintball: "random_paintball_bot.py",
    straight_line: "straight_line_bot.py",
    ping_pong: "ping_pong_bot.py",
  },
  LOAD_DEBUG_BOTS: true,
  DEBUG_BOT_PATH: "python/bots/.debug/",
  DEBUG_BOTS: {
    no_return: "no_return_bot.py",
    timeout: "timeout_bot.py",
    wrong_return: "wrong_return_bot.py",
    print: "print_bot.py",
    error: "error_bot.py",
    slow_random: "slow_random.py",
    util_prints: "util_prints.py",
    edit_game_state: "edit_game_state.py",
    print_game_state: "print_game_state.py",
    timeout_and_count: "timeout_and_count.py",
    error_and_count: "error_and_count.py",
  },
};

export default config;
