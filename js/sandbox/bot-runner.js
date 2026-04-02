import config from '../config.js';
import { logEvent } from '../ui/event-console.js';

/**
 * Manages a single Pyodide Web Worker for one bot.
 * Mirrors the old Python BotRunner: one persistent worker per bot,
 * timeout enforcement via worker.terminate() + respawn.
 */
export class BotRunner {
  constructor(pid, botCode) {
    this.pid = pid;
    this.botCode = botCode;
    this.worker = null;
    this.ready = false;
    this._pendingResolve = null;
    this._timeoutId = null;
    this._totalDecisionSeconds = 0;
    this._decisionCount = 0;
    this._timeoutCount = 0;
    this._hexGridPy = null;
    this._actionsPy = null;
  }

  async init(hexGridPy, actionsPy) {
    this._hexGridPy = hexGridPy;
    this._actionsPy = actionsPy;
    await this._spawnWorker();
  }

  /** Replace bot source and respawn the worker (Pyodide reloads). */
  async setBotCode(botCode) {
    this.botCode = botCode;
    this.resetTimingStats();
    await this._spawnWorker();
  }

  _spawnWorker() {
    return new Promise((resolve, reject) => {
      this.ready = false;
      if (this.worker) this.worker.terminate();

      this.worker = new Worker('js/sandbox/bot-worker.js');

      this.worker.onmessage = (e) => {
        const { type } = e.data;

        if (type === 'ready') {
          this.ready = true;
          resolve();
          return;
        }

        if (type === 'result' || type === 'error') {
          if (this._timeoutId) {
            clearTimeout(this._timeoutId);
            this._timeoutId = null;
          }
          if (type === 'result') {
            this._recordTiming(e.data.elapsed, false);
            if (this._pendingResolve) this._pendingResolve(e.data.action);
          } else {
            this._recordTiming(e.data.elapsed || 0, false);
            logEvent(`Error in bot ${this.pid}: ${e.data.error}`);
            if (this._pendingResolve) this._pendingResolve({ type: 'skip' });
          }
          this._pendingResolve = null;
          return;
        }
      };

      this.worker.onerror = (err) => {
        logEvent(`Worker error for bot ${this.pid}: ${err.message}`);
        if (this._pendingResolve) {
          this._pendingResolve({ type: 'skip' });
          this._pendingResolve = null;
        }
        reject(err);
      };

      this.worker.postMessage({
        type: 'init',
        data: {
          hexGridPy: this._hexGridPy,
          actionsPy: this._actionsPy,
          botCode: this.botCode,
        },
      });
    });
  }

  async decide(gameState) {
    if (!this.ready) return { type: 'skip' };

    return new Promise((resolve) => {
      this._pendingResolve = resolve;

      this._timeoutId = setTimeout(async () => {
        this._recordTiming(config.TIMEOUT, true);
        logEvent(`Bot ${this.pid} exceeded time limit (${config.TIMEOUT}s) — skip`);
        this._pendingResolve = null;
        this.worker.terminate();
        resolve({ type: 'skip' });

        try {
          await this._spawnWorker();
        } catch (err) {
          logEvent(`Failed to respawn worker for bot ${this.pid}`);
        }
      }, config.TIMEOUT * 1000);

      this.worker.postMessage({
        type: 'decide',
        data: { gameState },
      });
    });
  }

  _recordTiming(elapsed, timedOut) {
    this._totalDecisionSeconds += elapsed;
    this._decisionCount++;
    if (timedOut) this._timeoutCount++;
  }

  getTimingStats() {
    return {
      totalDecisionSeconds: this._totalDecisionSeconds,
      decisionCount: this._decisionCount,
      timeoutCount: this._timeoutCount,
    };
  }

  resetTimingStats() {
    this._totalDecisionSeconds = 0;
    this._decisionCount = 0;
    this._timeoutCount = 0;
  }

  shutdown() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.ready = false;
  }
}
