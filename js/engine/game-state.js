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
      if (pids.size > 1) this.tilePids.set(key, 0);
      else this.tilePids.set(key, [...pids][0]);
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
    const byKey = new Map();
    for (const bot of this.bots.values()) {
      const k = bot.position.key;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(bot.pid);
    }
    for (const [key, pids] of byKey) {
      if (pids.length > 1) {
        this._paint(key, null);
        if (logFn) {
          logFn(`Collision on hex ${key} — tile cleared (bots ${pids.join(", ")})`);
        }
      }
    }
  }

  applyAction(pid, action, logFn) {
    const bot = this.bots.get(pid);
    if (!bot) return;

    if (action.type === "move") {
      if (bot.stun > 0) {
        if (logFn) {
          logFn(
            `Bot ${pid} is stunned (${bot.stun} turn${bot.stun === 1 ? "" : "s"} left) — cannot move`,
          );
        }
        return;
      }
      const dir = normFacing(bot.facing);
      const newPos = hexNeighbor(bot.position, dir);
      if (this.grid.has(newPos.key)) {
        bot.position = newPos;
        bot.facing = dir;
        this._recordPaintIntent(newPos.key, pid);
      } else if (logFn) {
        logFn(`Bot ${pid} tried to move to ${newPos}, but it's not in the grid`);
      }
    } else if (action.type === "dash") {
      if (bot.stun > 0) {
        if (logFn) {
          logFn(
            `Bot ${pid} is stunned (${bot.stun} turn${bot.stun === 1 ? "" : "s"} left) — cannot dash`,
          );
        }
        return;
      }
      if (bot.dashCooldown > 0) {
        if (logFn) {
          logFn(
            `Bot ${pid} cannot dash for ${bot.dashCooldown} more turn(s) (one dash every ${config.DASH_COOLDOWN_TURNS} turns)`,
          );
        }
        return;
      }

      const dist = Math.trunc(Number(action.distance));
      if (!Number.isFinite(dist) || dist < DASH_MIN_DISTANCE || dist > DASH_MAX_DISTANCE) {
        if (logFn) {
          logFn(`Bot ${pid} tried to dash with invalid distance ${action.distance} (expected ${DASH_MIN_DISTANCE}-${DASH_MAX_DISTANCE})`);
        }
        return;
      }

      const facDir = normFacing(bot.facing);
      const start = bot.position;
      let dest = start;
      for (let i = 0; i < dist; i++) {
        const next = hexNeighbor(dest, facDir);
        if (!this.grid.has(next.key)) break;
        dest = next;
      }

      bot.dashCooldown = config.DASH_COOLDOWN_TURNS;
      bot.stun = Math.max(bot.stun, config.DASH_STUN_TURNS);
      if (!dest.equals(start)) {
        bot.position = dest;
        bot.facing = facDir;
        // Dash paints only the destination hex (last hex reached, possibly short of requested distance).
        this._recordPaintIntent(dest.key, pid);
      }
    } else if (action.type === "splat") {
      if (bot.stun > 0) {
        if (logFn) {
          logFn(
            `Bot ${pid} is stunned (${bot.stun} turn${bot.stun === 1 ? "" : "s"} left) — cannot splat`,
          );
        }
        return;
      }
      if (bot.splatCooldown > 0) {
        if (logFn) {
          logFn(
            `Bot ${pid} cannot splat for ${bot.splatCooldown} more turn(s) (one splat every ${config.SPLAT_COOLDOWN_TURNS} turns)`,
          );
        }
        return;
      }
      for (let d = 0; d < 6; d++) {
        const n = hexNeighbor(bot.position, d);
        if (this.grid.has(n.key)) {
          this._recordPaintIntent(n.key, pid);
        }
      }
      bot.stun = config.SPLAT_STUN_TURNS;
      bot.splatCooldown = config.SPLAT_COOLDOWN_TURNS;
    } else if (action.type === "shoot_paintball") {
      if (bot.stun > 0) {
        if (logFn) {
          logFn(
            `Bot ${pid} is stunned (${bot.stun} turn${bot.stun === 1 ? "" : "s"} left) — cannot shoot paintball`,
          );
        }
        return;
      }
      if (bot.paintballCooldown > 0) {
        if (logFn) {
          logFn(
            `Bot ${pid} cannot shoot paintball for ${bot.paintballCooldown} more turn(s) (one shot every ${config.SHOOT_PAINTBALL_COOLDOWN_TURNS} turns)`,
          );
        }
        return;
      }
      const dir = normFacing(bot.facing);
      let cur = bot.position;
      while (true) {
        cur = hexNeighbor(cur, dir);
        if (!this.grid.has(cur.key)) break;
        let blocked = false;
        for (const [opid, other] of this.bots) {
          if (opid !== pid && other.position.key === cur.key) {
            blocked = true;
            break;
          }
        }
        if (blocked) break;
        this._recordPaintIntent(cur.key, pid);
      }
      bot.paintballCooldown = config.SHOOT_PAINTBALL_COOLDOWN_TURNS;
      bot.stun = config.PAINTBALL_STUN_TURNS;
    } else if (
      action.type === "turn_left" ||
      action.type === "turn_right" ||
      action.type === "face_direction" ||
      action.type === "turn_180"
    ) {
      if (bot.stun > 0) {
        if (logFn) {
          logFn(
            `Bot ${pid} is stunned (${bot.stun} turn${bot.stun === 1 ? "" : "s"} left) — cannot turn`,
          );
        }
        return;
      }
      if (action.type === "turn_left") {
        const s = normTurnSteps(action.steps);
        if (s === 0) return;
        bot.facing = (bot.facing + s) % 6;
      } else if (action.type === "turn_right") {
        const s = normTurnSteps(action.steps);
        if (s === 0) return;
        bot.facing = ((bot.facing - s) % 6 + 6) % 6;
      } else if (action.type === "face_direction") {
        bot.facing = normFacing(action.direction);
      } else {
        bot.facing = (bot.facing + 3) % 6;
      }
    } else if (action.type === "skip") {
      // do nothing
    } else {
      if (logFn) {
        logFn(`Bot ${pid} tried to perform unknown action: ${action}`);
      }
    }
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
      pid,
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
