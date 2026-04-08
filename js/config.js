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
    timeout_and_count: "timeout_and_count.py",
    error_and_count: "error_and_count.py",
  },
};

export default config;
