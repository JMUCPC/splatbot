import { Hex, HexDirection, generateHexGrid, hexNeighbor } from "./hex-grid.js";
import config from "../config.js";

/** After splat: no move/splat for this many turns. */
export const SPLAT_ACTION_LOCKOUT_TURNS = 3;
/** Minimum gap between splats (turns remaining until splat is allowed again). */
export const SPLAT_INTERVAL_TURNS = 10;

export class BotData {
  constructor(pid, position, facing, splatCooldown = 0, splatInterval = 0) {
    this.pid = pid;
    this.position = position;
    this.facing = facing;
    /** Turns remaining before move/splat allowed after using splat. */
    this.splatCooldown = splatCooldown;
    /** Turns until splat is allowed again (at most one splat per SPLAT_INTERVAL_TURNS). */
    this.splatInterval = splatInterval;
  }
}

export class GameState {
  constructor(grid, tilePids, bots, turn = 0, maxTurns = 200, radius = 8) {
    this.grid = grid; // Map<string, Hex>
    this.tilePids = tilePids; // Map<string, number>  (hex key -> player id, 0=unpainted)
    this.bots = bots; // Map<number, BotData>
    this.turn = turn;
    this.maxTurns = maxTurns;
    this.radius = radius;
  }

  get isOver() {
    return this.turn >= this.maxTurns;
  }

  score() {
    const sc = { 1: 0, 2: 0 };
    for (const pid of this.tilePids.values()) {
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
   * After both bots have moved in a turn: any hex with more than one bot is
   * reset to unpainted (no race for which player "owns" the tile).
   */
  /** Call once per game tick after both bots have acted. */
  tickSplatCooldowns() {
    for (const bot of this.bots.values()) {
      if (bot.splatCooldown > 0) bot.splatCooldown -= 1;
      if (bot.splatInterval > 0) bot.splatInterval -= 1;
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
        this.tilePids.set(key, 0);
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
      if (bot.splatCooldown > 0) {
        if (logFn) {
          logFn(
            `Bot ${pid} is on splat cooldown (${bot.splatCooldown} turn${bot.splatCooldown === 1 ? "" : "s"} left) — cannot move`,
          );
        }
        return;
      }
      const newPos = hexNeighbor(bot.position, action.direction);
      if (this.grid.has(newPos.key)) {
        bot.position = newPos;
        bot.facing = action.direction;
        this.tilePids.set(newPos.key, pid);
      } else if (logFn) {
        logFn(`Bot ${pid} tried to move to ${newPos}, but it's not in the grid`);
      }
    } else if (action.type === "splat") {
      if (bot.splatCooldown > 0) {
        if (logFn) {
          logFn(
            `Bot ${pid} is on splat cooldown (${bot.splatCooldown} turn${bot.splatCooldown === 1 ? "" : "s"} left) — cannot splat`,
          );
        }
        return;
      }
      if (bot.splatInterval > 0) {
        if (logFn) {
          logFn(
            `Bot ${pid} cannot splat for ${bot.splatInterval} more turn(s) (one splat every ${SPLAT_INTERVAL_TURNS} turns)`,
          );
        }
        return;
      }
      for (let d = 0; d < 6; d++) {
        const n = hexNeighbor(bot.position, d);
        if (this.grid.has(n.key)) {
          this.tilePids.set(n.key, pid);
        }
      }
      bot.splatCooldown = SPLAT_ACTION_LOCKOUT_TURNS;
      bot.splatInterval = SPLAT_INTERVAL_TURNS;
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
      grid.push([h.q, h.r]);
    }
    const tilePids = {};
    for (const [key, owner] of this.tilePids.entries()) {
      tilePids[key] = owner;
    }
    const bots = {};
    for (const [botPid, bot] of this.bots.entries()) {
      bots[botPid] = {
        pid: bot.pid,
        position: [bot.position.q, bot.position.r],
        facing: bot.facing,
        splat_cooldown: bot.splatCooldown,
        splat_interval: bot.splatInterval,
      };
    }
    const me = this.bots.get(pid);
    return {
      my_pid: pid,
      my_splat_cooldown: me ? me.splatCooldown : 0,
      my_splat_interval: me ? me.splatInterval : 0,
      grid,
      tile_pids: tilePids,
      bots,
      turn: this.turn,
      max_turns: this.maxTurns,
    };
  }
}

export function makeInitialState(radius, maxTurns) {
  const r = radius ?? config.GRID_RADIUS;
  const mt = maxTurns ?? config.MAX_TURNS;
  const grid = generateHexGrid(r);
  const pos1 = new Hex(-(r - 1), 0);
  const pos2 = new Hex(r - 1, 0);

  const tilePids = new Map();
  tilePids.set(pos1.key, 1);
  tilePids.set(pos2.key, 2);

  const bots = new Map();
  bots.set(1, new BotData(1, pos1, HexDirection.E));
  bots.set(2, new BotData(2, pos2, HexDirection.W));

  return new GameState(grid, tilePids, bots, 0, mt, r);
}
