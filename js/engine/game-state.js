import { Hex, HexDirection, generateHexGrid, hexNeighbor } from "./hex-grid.js";
import config from "../config.js";

export const DASH_MIN_DISTANCE = 2;
export const DASH_MAX_DISTANCE = 6;

export class BotData {
  constructor(
    pid,
    position,
    facing,
    stun = 0,
    splatCooldown = 0,
    dashCooldown = 0,
    paintballCooldown = 0,
  ) {
    this.pid = pid;
    this.position = position;
    this.facing = facing;
    /** Turns remaining where move / dash / splat / shoot_paintball / turning are blocked (`skip` still allowed). */
    this.stun = stun;
    /** Turns until splat is allowed again (see `config.SPLAT_COOLDOWN_TURNS`). */
    this.splatCooldown = splatCooldown;
    /** Turns until dash is allowed again (see `config.DASH_COOLDOWN_TURNS`). */
    this.dashCooldown = dashCooldown;
    /** Turns until shoot_paintball is allowed again (see `config.SHOOT_PAINTBALL_COOLDOWN_TURNS`). */
    this.paintballCooldown = paintballCooldown;
  }
}

function normFacing(d) {
  return ((Math.trunc(Number(d)) % 6) + 6) % 6;
}

function normTurnSteps(steps) {
  const raw = steps === undefined || steps === null ? 1 : steps;
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n) || n === 0) return 0;
  return ((n % 6) + 6) % 6;
}

/**
 * Compute where a bot ends up this tick without mutating anything.
 * First pass to determine opponent destinations for paintball LOS.
 */
function computeEndPosition(bot, action, grid) {
  if (action.type === "move") {
    if (bot.stun > 0) return bot.position;
    const dir = normFacing(bot.facing);
    const newPos = hexNeighbor(bot.position, dir);
    return grid.has(newPos.key) ? newPos : bot.position;
  }
  if (action.type === "dash") {
    if (!config.DASH_ALLOWED || bot.stun > 0 || bot.dashCooldown > 0) return bot.position;
    const dist = Math.trunc(Number(action.distance));
    if (!Number.isFinite(dist) || dist < DASH_MIN_DISTANCE || dist > DASH_MAX_DISTANCE) return bot.position;
    const facDir = normFacing(bot.facing);
    let dest = bot.position;
    for (let i = 0; i < dist; i++) {
      const next = hexNeighbor(dest, facDir);
      if (!grid.has(next.key)) break;
      dest = next;
    }
    return dest;
  }
  return bot.position;
}

/**
 * Plan the full effect of a bot's action from frozen pre-tick state.
 * Pure: does not mutate bot or grid.
 * @param {number} pid
 * @param {object} action
 * @param {BotData} bot
 * @param {Map<string, Hex>} grid
 * @param {Set<string>} opponentEndKeys — hex keys where opponents will end up (paintball LOS blocking)
 * @param {function} [logFn]
 */
function planAction(pid, action, bot, grid, opponentEndKeys, logFn) {
  const report = {
    actionType: String(action?.type || "unknown"),
    executed: false,
    blocked: false,
    movedTiles: 0,
    paintedTiles: 0,
  };
  const plan = {
    report,
    endPosition: bot.position,
    endFacing: bot.facing,
    stun: bot.stun,
    splatCooldown: bot.splatCooldown,
    dashCooldown: bot.dashCooldown,
    paintballCooldown: bot.paintballCooldown,
    paintIntentKeys: [],
  };

  if (action.type === "move") {
    if (bot.stun > 0) {
      report.blocked = true;
      if (logFn) {
        logFn(
          `Bot ${pid} is stunned (${bot.stun} turn${bot.stun === 1 ? "" : "s"} left) — cannot move`,
        );
      }
      return plan;
    }
    const dir = normFacing(bot.facing);
    const newPos = hexNeighbor(bot.position, dir);
    if (grid.has(newPos.key)) {
      report.executed = true;
      report.movedTiles = 1;
      report.paintedTiles = 1;
      plan.endPosition = newPos;
      plan.endFacing = dir;
      plan.paintIntentKeys.push(newPos.key);
    } else {
      report.blocked = true;
      if (logFn) {
        logFn(`Bot ${pid} tried to move to ${newPos}, but it's not in the grid`);
      }
    }
  } else if (action.type === "dash") {
    if (!config.DASH_ALLOWED) {
      report.blocked = true;
      if (logFn) logFn(`Bot ${pid} tried to dash but dash is disabled in match rules`);
      return plan;
    }
    if (bot.stun > 0) {
      report.blocked = true;
      if (logFn) {
        logFn(
          `Bot ${pid} is stunned (${bot.stun} turn${bot.stun === 1 ? "" : "s"} left) — cannot dash`,
        );
      }
      return plan;
    }
    if (bot.dashCooldown > 0) {
      report.blocked = true;
      if (logFn) {
        logFn(
          `Bot ${pid} cannot dash for ${bot.dashCooldown} more turn(s) (one dash every ${config.DASH_COOLDOWN_TURNS} turns)`,
        );
      }
      return plan;
    }

    const dist = Math.trunc(Number(action.distance));
    if (!Number.isFinite(dist) || dist < DASH_MIN_DISTANCE || dist > DASH_MAX_DISTANCE) {
      report.blocked = true;
      if (logFn) {
        logFn(`Bot ${pid} tried to dash with invalid distance ${action.distance} (expected ${DASH_MIN_DISTANCE}-${DASH_MAX_DISTANCE})`);
      }
      return plan;
    }

    const facDir = normFacing(bot.facing);
    let dest = bot.position;
    let moved = 0;
    for (let i = 0; i < dist; i++) {
      const next = hexNeighbor(dest, facDir);
      if (!grid.has(next.key)) break;
      dest = next;
      moved += 1;
    }

    report.executed = true;
    report.movedTiles = moved;
    plan.dashCooldown = config.DASH_COOLDOWN_TURNS;
    plan.stun = Math.max(bot.stun, config.DASH_STUN_TURNS);
    if (!dest.equals(bot.position)) {
      report.paintedTiles = 1;
      plan.endPosition = dest;
      plan.endFacing = facDir;
      plan.paintIntentKeys.push(dest.key);
    }
  } else if (action.type === "splat") {
    if (!config.SPLAT_ALLOWED) {
      report.blocked = true;
      if (logFn) logFn(`Bot ${pid} tried to splat but splat is disabled in match rules`);
      return plan;
    }
    if (bot.stun > 0) {
      report.blocked = true;
      if (logFn) {
        logFn(
          `Bot ${pid} is stunned (${bot.stun} turn${bot.stun === 1 ? "" : "s"} left) — cannot splat`,
        );
      }
      return plan;
    }
    if (bot.splatCooldown > 0) {
      report.blocked = true;
      if (logFn) {
        logFn(
          `Bot ${pid} cannot splat for ${bot.splatCooldown} more turn(s) (one splat every ${config.SPLAT_COOLDOWN_TURNS} turns)`,
        );
      }
      return plan;
    }
    report.executed = true;
    let painted = 0;
    for (let d = 0; d < 6; d++) {
      const n = hexNeighbor(bot.position, d);
      if (grid.has(n.key)) {
        plan.paintIntentKeys.push(n.key);
        painted += 1;
      }
    }
    report.paintedTiles = painted;
    plan.stun = config.SPLAT_STUN_TURNS;
    plan.splatCooldown = config.SPLAT_COOLDOWN_TURNS;
  } else if (action.type === "shoot_paintball") {
    if (!config.SHOOT_PAINTBALL_ALLOWED) {
      report.blocked = true;
      if (logFn) logFn(`Bot ${pid} tried to shoot paintball but paintball is disabled in match rules`);
      return plan;
    }
    if (bot.stun > 0) {
      report.blocked = true;
      if (logFn) {
        logFn(
          `Bot ${pid} is stunned (${bot.stun} turn${bot.stun === 1 ? "" : "s"} left) — cannot shoot paintball`,
        );
      }
      return plan;
    }
    if (bot.paintballCooldown > 0) {
      report.blocked = true;
      if (logFn) {
        logFn(
          `Bot ${pid} cannot shoot paintball for ${bot.paintballCooldown} more turn(s) (one shot every ${config.SHOOT_PAINTBALL_COOLDOWN_TURNS} turns)`,
        );
      }
      return plan;
    }
    report.executed = true;
    let painted = 0;
    const dir = normFacing(bot.facing);
    let cur = bot.position;
    while (true) {
      cur = hexNeighbor(cur, dir);
      if (!grid.has(cur.key)) break;
      if (opponentEndKeys.has(cur.key)) break;
      plan.paintIntentKeys.push(cur.key);
      painted += 1;
    }
    report.paintedTiles = painted;
    plan.paintballCooldown = config.SHOOT_PAINTBALL_COOLDOWN_TURNS;
    plan.stun = config.PAINTBALL_STUN_TURNS;
  } else if (
    action.type === "turn_left" ||
    action.type === "turn_right" ||
    action.type === "face_direction" ||
    action.type === "turn_180"
  ) {
    if (bot.stun > 0) {
      report.blocked = true;
      if (logFn) {
        logFn(
          `Bot ${pid} is stunned (${bot.stun} turn${bot.stun === 1 ? "" : "s"} left) — cannot turn`,
        );
      }
      return plan;
    }
    report.executed = true;
    if (action.type === "turn_left") {
      const s = normTurnSteps(action.steps);
      if (s !== 0) plan.endFacing = (bot.facing + s) % 6;
    } else if (action.type === "turn_right") {
      const s = normTurnSteps(action.steps);
      if (s !== 0) plan.endFacing = ((bot.facing - s) % 6 + 6) % 6;
    } else if (action.type === "face_direction") {
      plan.endFacing = normFacing(action.direction);
    } else {
      plan.endFacing = (bot.facing + 3) % 6;
    }
  } else if (action.type === "skip") {
    report.executed = true;
  } else {
    report.blocked = true;
    if (logFn) {
      logFn(`Bot ${pid} tried to perform unknown action: ${action}`);
    }
  }
  return plan;
}

/**
 * When the bot's hex does not change this tick, they claim the tile underfoot if it is
 * still neutral and this action did not already paint that hex (e.g. move/dash onto it).
 * Covers skip, turn, splat, paintball, blocked actions, etc. Flush / collision rules still apply.
 */
function shouldRecordStandingPaintClaim(plan, startKey, grid) {
  if (plan.paintIntentKeys.includes(startKey)) return false;
  const hex = grid.get(startKey);
  return !!(hex && hex.controller == null);
}

export class GameState {
  constructor(grid, bots, turn = 0, maxTurns = 200, radius = 8) {
    this.grid = grid; // Map<string, Hex> — Hex.controller holds owner BotData|null
    this.bots = bots; // Map<number, BotData>
    this.turn = turn;
    this.maxTurns = maxTurns;
    this.radius = radius;
    /** @type {Map<string, Set<number>>} Hex keys touched by paint/move this tick → which pids tried to color them. */
    this._paintClaims = new Map();
  }

  /** Set the controller (owner) of the tile at `key` to the given BotData (or null). */
  _paint(key, bot) {
    const h = this.grid.get(key);
    if (h) h.controller = bot;
  }

  get isOver() {
    return this.turn >= this.maxTurns;
  }

  score() {
    const sc = { 1: 0, 2: 0 };
    for (const h of this.grid.values()) {
      const pid = h.controller?.pid;
      if (pid === 1 || pid === 2) sc[pid]++;
    }
    return sc;
  }

  totalTiles() {
    return this.grid.size;
  }

  /**
   * Hexes as nested arrays: outer dimension is axial `r` (ascending), inner is `q` (ascending).
   * `result[i][j]` is the hex at sorted `(r, q)`; only tiles in `grid` appear (no placeholders).
   * @returns {Hex[][]}
   */
  getGridAs2DList() {
    const byR = new Map();
    for (const h of this.grid.values()) {
      if (!byR.has(h.r)) byR.set(h.r, new Map());
      byR.get(h.r).set(h.q, h);
    }
    if (byR.size === 0) return [];
    const rows = [...byR.entries()].sort((a, b) => a[0] - b[0]);
    return rows.map(([, m]) => {
      const qs = [...m.keys()].sort((a, b) => a - b);
      return qs.map((q) => m.get(q));
    });
  }

  coveragePct() {
    const sc = this.score();
    const total = Math.max(1, this.totalTiles());
    return {
      1: (100 * sc[1]) / total,
      2: (100 * sc[2]) / total,
    };
  }

  winner() {
    if (!this.isOver) return null;
    const sc = this.score();
    if (sc[1] > sc[2]) return 1;
    if (sc[2] > sc[1]) return 2;
    return null;
  }

  advanceTurn() {
    this.turn++;
  }

  /**
   * Start of each simulation tick: clear pending paint claims before applyAction runs.
   */
  resetPaintClaims() {
    this._paintClaims.clear();
  }

  /**
   * After all bots have applied actions this tick: each hex claimed by more than one
   * player becomes unpainted (0); a single claimant gets the tile. Runs before
   * neutralizeCollidingTiles so move/dash/splat/paintball ties are not last-writer-wins.
   */
  flushPaintClaims() {
    for (const [key, pids] of this._paintClaims) {
      if (pids.size > 1) {
        this._paint(key, null);
      } else if (pids.size === 1) {
        const pid = [...pids][0];
        this._paint(key, this.bots.get(pid) ?? null);
      }
    }
    this._paintClaims.clear();
  }

  _recordPaintIntent(hexKey, pid) {
    let s = this._paintClaims.get(hexKey);
    if (!s) {
      s = new Set();
      this._paintClaims.set(hexKey, s);
    }
    s.add(pid);
  }

  /**
   * After both bots have moved in a turn: any hex with more than one bot is
   * reset to unpainted (no race for which player "owns" the tile).
   */
  /** Call once per game tick after both bots have acted. */
  tickBotTimers() {
    for (const bot of this.bots.values()) {
      if (bot.stun > 0) bot.stun -= 1;
      if (bot.splatCooldown > 0) bot.splatCooldown -= 1;
      if (bot.dashCooldown > 0) bot.dashCooldown -= 1;
      if (bot.paintballCooldown > 0) bot.paintballCooldown -= 1;
    }
  }

  neutralizeCollidingTiles(logFn) {
    const startKeys = this._tickStartPositionKeys;
    const byKey = new Map();
    for (const bot of this.bots.values()) {
      const k = bot.position.key;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(bot.pid);
    }
    for (const [key, pids] of byKey) {
      if (pids.length > 1) {
        if (startKeys) {
          const movers = pids.filter(pid => startKeys.get(pid) !== key);
          if (movers.length === 1) {
            this._paint(key, this.bots.get(movers[0]) ?? null);
            if (logFn) {
              logFn(`Bot ${movers[0]} moved onto occupied hex ${key} — tile painted by mover`);
            }
            continue;
          }
        }
        this._paint(key, null);
        if (logFn) {
          logFn(`Collision on hex ${key} — tile cleared (bots ${pids.join(", ")})`);
        }
      }
    }
    this._tickStartPositionKeys = null;
  }

  /**
   * Resolve a tick where all bots decided simultaneously from the same pre-tick state.
   * Both bots see the same snapshot; actions are planned without mutations, then committed together.
   * @param {Object<number, object>} actions — pid → action object
   * @param {function} [logFn]
   * @returns {Object<number, object>} pid → action report
   */
  resolveSimultaneousTick(actions, logFn) {
    this._tickStartPositionKeys = new Map();
    for (const [pid, bot] of this.bots) {
      this._tickStartPositionKeys.set(pid, bot.position.key);
    }

    const endPositions = new Map();
    for (const [pid, bot] of this.bots) {
      const action = actions[pid] || { type: "skip" };
      endPositions.set(pid, computeEndPosition(bot, action, this.grid));
    }

    const plans = new Map();
    for (const [pid, bot] of this.bots) {
      const opponentEndKeys = new Set();
      for (const [opid, endPos] of endPositions) {
        if (opid !== pid) opponentEndKeys.add(endPos.key);
      }
      const action = actions[pid] || { type: "skip" };
      plans.set(pid, planAction(pid, action, bot, this.grid, opponentEndKeys, logFn));
    }

    for (const [pid, plan] of plans) {
      const bot = this.bots.get(pid);
      bot.position = plan.endPosition;
      bot.facing = plan.endFacing;
      bot.stun = plan.stun;
      bot.splatCooldown = plan.splatCooldown;
      bot.dashCooldown = plan.dashCooldown;
      bot.paintballCooldown = plan.paintballCooldown;
      for (const key of plan.paintIntentKeys) {
        this._recordPaintIntent(key, pid);
      }
    }

    for (const [pid, plan] of plans) {
      const startKey = this._tickStartPositionKeys.get(pid);
      const bot = this.bots.get(pid);
      if (!bot || bot.position.key !== startKey) continue;
      if (!shouldRecordStandingPaintClaim(plan, startKey, this.grid)) continue;
      this._recordPaintIntent(startKey, pid);
      plan.report.paintedTiles += 1;
    }

    const reports = {};
    for (const [pid, plan] of plans) {
      reports[pid] = plan.report;
    }
    return reports;
  }

  /** Single-bot apply used by docs/demos. Delegates to planAction then commits. */
  applyAction(pid, action, logFn) {
    const bot = this.bots.get(pid);
    if (!bot) return null;
    const startKey = bot.position.key;
    const opponentEndKeys = new Set();
    for (const [opid, other] of this.bots) {
      if (opid !== pid) opponentEndKeys.add(other.position.key);
    }
    const plan = planAction(pid, action, bot, this.grid, opponentEndKeys, logFn);
    bot.position = plan.endPosition;
    bot.facing = plan.endFacing;
    bot.stun = plan.stun;
    bot.splatCooldown = plan.splatCooldown;
    bot.dashCooldown = plan.dashCooldown;
    bot.paintballCooldown = plan.paintballCooldown;
    for (const key of plan.paintIntentKeys) {
      this._recordPaintIntent(key, pid);
    }
    if (bot.position.key === startKey && shouldRecordStandingPaintClaim(plan, startKey, this.grid)) {
      this._recordPaintIntent(startKey, pid);
      plan.report.paintedTiles += 1;
    }
    return plan.report;
  }

  /** Serialize to a plain object suitable for JSON / Web Worker transfer. */
  toSnapshot(pid) {
    const grid = [];
    for (const h of this.grid.values()) {
      const ownerPid = h.controller ? h.controller.pid : 0;
      grid.push([h.q, h.r, ownerPid]);
    }

    function serializeBot(bot) {
      return {
        pid: bot.pid,
        position: [bot.position.q, bot.position.r],
        facing: bot.facing,
        stun: bot.stun,
        splat_cooldown: bot.splatCooldown,
        dash_cooldown: bot.dashCooldown,
        paintball_cooldown: bot.paintballCooldown,
      };
    }

    const meBot = this.bots.get(pid);
    const me = meBot ? serializeBot(meBot) : null;
    const opponents = {};
    for (const [botPid, bot] of this.bots.entries()) {
      if (botPid !== pid) {
        opponents[botPid] = serializeBot(bot);
      }
    }

    return {
      me,
      opponents,
      grid,
      turn: this.turn,
      max_turns: this.maxTurns,
    };
  }
}

export function makeInitialState(radius, maxTurns) {
  const r = radius ?? config.GRID_RADIUS;
  const mt = maxTurns ?? config.MAX_TURNS;
  const grid = generateHexGrid(r);

  const bots = new Map();
  const pos1 = new Hex(-(r - 1), 0);
  const pos2 = new Hex(r - 1, 0);
  bots.set(1, new BotData(1, pos1, HexDirection.E));
  bots.set(2, new BotData(2, pos2, HexDirection.W));

  // Paint starting tiles
  const h1 = grid.get(pos1.key);
  if (h1) h1.controller = bots.get(1);
  const h2 = grid.get(pos2.key);
  if (h2) h2.controller = bots.get(2);

  return new GameState(grid, bots, 0, mt, r);
}
