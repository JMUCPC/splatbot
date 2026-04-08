/**
 * Web Worker that loads Pyodide and executes Python bot code.
 * Communicates with the main thread via postMessage.
 *
 * Messages IN:
 *   { type: 'init', data: { hexGridPy, actionsPy, botCode, interruptBuffer? } }
 *   { type: 'decide', data: { gameState, decisionId } }
 *   { type: 'resetMatch' } — re-run Bot() so instance state does not persist across matches
 *
 * Messages OUT:
 *   { type: 'ready' }
 *   { type: 'init-error', error: string }
 *   { type: 'match-reset-done' }
 *   { type: 'match-reset-error', error: string }
 *   { type: 'interrupt', elapsed, decisionId }
 *   { type: 'result', action: { type, direction?, distance?, steps? }, elapsed }
 *   { type: 'error', error: string, elapsed?, decisionId? }
 */

/** Must match `importScripts` below — tells Pyodide where to fetch .wasm and packages (worker `location` is this script, not the CDN). */
const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';

let pyodide = null;

/** Turn Pyodide / Python failures into a single string for the UI (often includes traceback). */
function formatPythonError(err) {
  if (err == null) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && typeof err.message === 'string' && err.message.length > 0) {
    return err.message;
  }
  try {
    return String(err);
  } catch {
    return 'Unknown error';
  }
}

self.onmessage = async function (e) {
  const { type, data } = e.data;

  if (type === 'init') {
    try {
      importScripts(`${PYODIDE_INDEX_URL}pyodide.js`);
      pyodide = await loadPyodide({ indexURL: PYODIDE_INDEX_URL });
      if (data.interruptBuffer) {
        pyodide.setInterruptBuffer(data.interruptBuffer);
      }

      pyodide.FS.mkdirTree('/lib/utils');
      pyodide.FS.writeFile('/lib/utils/__init__.py', '');
      pyodide.FS.writeFile('/lib/utils/hex_grid.py', data.hexGridPy);
      pyodide.FS.writeFile('/lib/utils/actions.py', data.actionsPy);

      pyodide.runPython("import sys; sys.path.insert(0, '/lib')");

      // Snapshot infrastructure and imports cached across turns
      pyodide.runPython(`
from types import MappingProxyType as _MPT
from utils.hex_grid import Hex as _Hex, HexDirection as _HD
from utils.actions import MoveAction as _MA, SkipAction as _SA, SplatAction as _SpA, DashAction as _DA, ShootPaintballAction as _SPB, TurnLeftAction as _TLA, TurnRightAction as _TRA, FaceDirectionAction as _FDA, Turn180Action as _T18A
import json as _json

class _BotInfo:
    __slots__ = ('pid', 'position', 'facing', 'stun', 'splat_cooldown', 'dash_cooldown', 'paintball_cooldown')
    def __init__(self, pid, position, facing, stun=0, splat_cooldown=0, dash_cooldown=0, paintball_cooldown=0):
        object.__setattr__(self, 'pid', pid)
        object.__setattr__(self, 'position', position)
        object.__setattr__(self, 'facing', facing)
        object.__setattr__(self, 'stun', int(stun))
        object.__setattr__(self, 'splat_cooldown', int(splat_cooldown))
        object.__setattr__(self, 'dash_cooldown', int(dash_cooldown))
        object.__setattr__(self, 'paintball_cooldown', int(paintball_cooldown))
    def __setattr__(self, *a):
        raise AttributeError("BotInfo is read-only")
    def __eq__(self, other):
        if not isinstance(other, _BotInfo):
            return NotImplemented
        return self.pid == other.pid
    def __hash__(self):
        return hash(self.pid)
    def __repr__(self):
        return f"BotInfo(pid={self.pid}, pos={self.position}, facing={self.facing})"

def _parse_bot(bd):
    return _BotInfo(
        int(bd['pid']),
        _Hex(*bd['position']),
        _HD(bd['facing']),
        int(bd.get('stun', 0)),
        int(bd.get('splat_cooldown', 0)),
        int(bd.get('dash_cooldown', 0)),
        int(bd.get('paintball_cooldown', 0)),
    )

class _Snapshot:
    __slots__ = ('pid', 'me', 'opponents', 'opponent', 'grid', 'turn', 'max_turns')
    def __init__(self, d):
        pid = d['pid']
        object.__setattr__(self, 'pid', pid)

        me = _parse_bot(d['me'])
        object.__setattr__(self, 'me', me)

        opps = {}
        for ps, bd in d['opponents'].items():
            opps[int(ps)] = _parse_bot(bd)
        opps = _MPT(opps)
        object.__setattr__(self, 'opponents', opps)
        object.__setattr__(self, 'opponent', next(iter(opps.values())) if len(opps) == 1 else None)

        # Build pid -> BotInfo lookup for grid tile controllers
        _by_pid = {pid: me}
        for p, bi in opps.items():
            _by_pid[p] = bi

        tiles = frozenset(
            _Hex(t[0], t[1], controller=(_by_pid.get(t[2]) if t[2] else None))
            for t in d['grid']
        )
        object.__setattr__(self, 'grid', tiles)
        object.__setattr__(self, 'turn', d['turn'])
        object.__setattr__(self, 'max_turns', d['max_turns'])
    def get_grid_as_2D_list(self):
        """Nested lists by axial r then q; result[i][j] matches sorted (r, q); no placeholders."""
        by_r = {}
        for h in self.grid:
            by_r.setdefault(h.r, {})[h.q] = h
        if not by_r:
            return []
        return [[m[q] for q in sorted(m)] for r, m in sorted(by_r.items())]
    def __setattr__(self, *a):
        raise AttributeError("GameStateSnapshot is read-only")
`);

      // Load bot code (must define class Bot with decide(self, game_state))
      pyodide.runPython(data.botCode);
      pyodide.runPython(`
if 'Bot' not in globals():
    raise ValueError("Bot script must define class Bot with decide(self, game_state)")
_bot = Bot()
`);

      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'init-error', error: formatPythonError(err) });
    }
    return;
  }

  if (type === 'resetMatch') {
    if (!pyodide) {
      self.postMessage({ type: 'match-reset-error', error: 'Not initialized' });
      return;
    }
    try {
      pyodide.runPython(`
if 'Bot' not in globals():
    raise ValueError("Bot script must define class Bot with decide(self, game_state)")
_bot = Bot()
`);
      self.postMessage({ type: 'match-reset-done' });
    } catch (err) {
      self.postMessage({ type: 'match-reset-error', error: formatPythonError(err) });
    }
    return;
  }

  if (type === 'decide') {
    const decisionId = data?.decisionId;
    if (!pyodide) {
      self.postMessage({ type: 'error', error: 'Not initialized', decisionId });
      return;
    }
    const start = performance.now();
    try {
      pyodide.globals.set('_raw_json', JSON.stringify(data.gameState));

      pyodide.runPython(`
_gs = _Snapshot(_json.loads(_raw_json))
_action = _bot.decide(_gs)
_rdist = -1
_rdir = -1
_rsteps = 1
if isinstance(_action, _MA):
    _rtype = 'move'
elif isinstance(_action, _SA):
    _rtype = 'skip'
elif isinstance(_action, _SpA):
    _rtype = 'splat'
elif isinstance(_action, _DA):
    _rtype = 'dash'
    _rdist = int(_action.distance)
elif isinstance(_action, _SPB):
    _rtype = 'shoot_paintball'
elif isinstance(_action, _TLA):
    _rtype = 'turn_left'
    _rsteps = int(_action.steps)
elif isinstance(_action, _TRA):
    _rtype = 'turn_right'
    _rsteps = int(_action.steps)
elif isinstance(_action, _FDA):
    _rtype = 'face_direction'
    _rdir = int(_action.direction)
elif isinstance(_action, _T18A):
    _rtype = 'turn_180'
else:
    raise TypeError(f"Bot.decide must return Action, got {type(_action).__name__}")
`);

      const rtype = pyodide.globals.get('_rtype');
      const rdir = pyodide.globals.get('_rdir');
      const rdist = pyodide.globals.get('_rdist');
      const rsteps = pyodide.globals.get('_rsteps');
      const elapsed = (performance.now() - start) / 1000;

      const action = rtype === 'move'
        ? { type: 'move' }
        : rtype === 'dash'
          ? { type: 'dash', distance: rdist }
          : rtype === 'splat'
            ? { type: 'splat' }
            : rtype === 'shoot_paintball'
              ? { type: 'shoot_paintball' }
              : rtype === 'turn_left'
                ? { type: 'turn_left', steps: rsteps }
                : rtype === 'turn_right'
                  ? { type: 'turn_right', steps: rsteps }
                  : rtype === 'face_direction'
                    ? { type: 'face_direction', direction: rdir }
                    : rtype === 'turn_180'
                      ? { type: 'turn_180' }
                      : { type: 'skip' };
      self.postMessage({ type: 'result', action, elapsed, decisionId });
    } catch (err) {
      const elapsed = (performance.now() - start) / 1000;
      const error = formatPythonError(err);
      if (error.includes('KeyboardInterrupt')) {
        self.postMessage({ type: 'interrupt', elapsed, decisionId });
        return;
      }
      self.postMessage({ type: 'error', error, elapsed, decisionId });
    }
  }
};
