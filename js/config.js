const config = {
  GRID_RADIUS: 8,
  MAX_TURNS: 200,
  TICK_DELAY: 0.15,
  TIMEOUT: 1.0,
  /** After splat: turns where move/splat are blocked. */
  SPLAT_ACTION_LOCKOUT_TURNS: 3,
  /** Turns between splats (minimum gap). */
  SPLAT_INTERVAL_TURNS: 10,
  /** Turns between dashes (minimum gap). */
  DASH_INTERVAL_TURNS: 7,
  /** Turns between shoot_paintball uses (minimum gap). */
  SHOOT_PAINTBALL_INTERVAL_TURNS: 20,
  /** After shoot_paintball: turns where move/dash/splat/paintball are blocked. */
  SHOOT_PAINTBALL_ACTION_LOCKOUT_TURNS: 7,
  BOT_DISPLAY_TYPE: "triangles",
  PLAYER_TILE_COLORS: { 1: "#b84010", 2: "#0a7090" },
  PLAYER_BOT_COLORS: { 1: "#ff6b2b", 2: "#00d4ff" },
  PLAYER_BRIGHT_COLORS: { 1: "#ff8c50", 2: "#22e0ff" },
  TILE_NONE_COLOR: "#161f30",
  TILE_STROKE_COLOR: "#090f1d",
  CANVAS_BG: "#070d1a",
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
  },
};

export default config;
