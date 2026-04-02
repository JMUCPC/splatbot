import { Hex, HexDirection, generateHexGrid, hexNeighbor } from "./hex-grid.js";
import config from "../config.js";

export class BotData {
  constructor(pid, position, facing) {
    this.pid = pid;
    this.position = position;
    this.facing = facing;
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

  applyAction(pid, action, logFn) {
    const bot = this.bots.get(pid);
    if (!bot) return;

    if (action.type === "move") {
      const newPos = hexNeighbor(bot.position, action.direction);
      if (this.grid.has(newPos.key)) {
        bot.position = newPos;
        bot.facing = action.direction;
        this.tilePids.set(newPos.key, pid);
      } else if (logFn) {
        logFn(`Bot ${pid} tried to move to ${newPos}, but it's not in the grid`);
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
      };
    }
    return { my_pid: pid, grid, tile_pids: tilePids, bots, turn: this.turn, max_turns: this.maxTurns };
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
