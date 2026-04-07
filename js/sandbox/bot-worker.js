/**
 * Web Worker that loads Pyodide and executes Python bot code.
 * Communicates with the main thread via postMessage.
 *
 * Messages IN:
 *   { type: 'init', data: { hexGridPy, actionsPy, botCode } }
 *   { type: 'decide', data: { gameState } }
 *   { type: 'resetMatch' } — re-run Bot() so instance state does not persist across matches
 *
 * Messages OUT:
 *   { type: 'ready' }
 *   { type: 'init-error', error: string }
 *   { type: 'match-reset-done' }
 *   { type: 'match-reset-error', error: string }
 *   { type: 'result', action: { type, direction? }, elapsed }
 *   { type: 'error', error: string, elapsed? }
 */

/** Must match `importScripts` below — tells Pyodide where to fetch .wasm and packages (worker `location` is this script, not the CDN). */
const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';

let pyodide = null;

self.onmessage = async function (e) {
  const { type, data } = e.data;

  if (type === 'init') {
    try {
      importScripts(`${PYODIDE_INDEX_URL}pyodide.js`);
      pyodide = await loadPyodide({ indexURL: PYODIDE_INDEX_URL });

      pyodide.FS.mkdirTree('/lib/utils');
      pyodide.FS.writeFile('/lib/utils/__init__.py', '');
      pyodide.FS.writeFile('/lib/utils/hex_grid.py', data.hexGridPy);
      pyodide.FS.writeFile('/lib/utils/actions.py', data.actionsPy);

      pyodide.runPython("import sys; sys.path.insert(0, '/lib')");

      // Snapshot infrastructure and imports cached across turns
      pyodide.runPython(`
from types import MappingProxyType as _MPT
from utils.hex_grid import Hex as _Hex, HexDirection as _HD
from utils.actions import MoveAction as _MA, SkipAction as _SA, SplatAction as _SpA, DashAction as _DA, ShootPaintballAction as _SPB
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
    def __repr__(self):
        return f"BotInfo(pid={self.pid}, pos={self.position}, facing={self.facing})"

class _Snapshot:
    __slots__ = ('my_pid', 'my_stun', 'my_splat_cooldown', 'my_dash_cooldown', 'my_paintball_cooldown', 'grid', 'tile_pids', 'bots', 'turn', 'max_turns')
    def __init__(self, d):
        object.__setattr__(self, 'my_pid', d['my_pid'])
        object.__setattr__(self, 'my_stun', int(d.get('my_stun', 0)))
        object.__setattr__(self, 'my_splat_cooldown', int(d.get('my_splat_cooldown', 0)))
        object.__setattr__(self, 'my_dash_cooldown', int(d.get('my_dash_cooldown', 0)))
        object.__setattr__(self, 'my_paintball_cooldown', int(d.get('my_paintball_cooldown', 0)))
        object.__setattr__(self, 'grid', frozenset(_Hex(q, r) for q, r in d['grid']))
        tp = {}
        for k, v in d['tile_pids'].items():
            q, r = k.split(',')
            tp[_Hex(int(q), int(r))] = v
        object.__setattr__(self, 'tile_pids', _MPT(tp))
        bots = {}
        for ps, bd in d['bots'].items():
            p = int(ps)
            st = int(bd.get('stun', 0))
            sc = int(bd.get('splat_cooldown', 0))
            dc = int(bd.get('dash_cooldown', 0))
            pc = int(bd.get('paintball_cooldown', 0))
            bots[p] = _BotInfo(p, _Hex(*bd['position']), _HD(bd['facing']), st, sc, dc, pc)
        object.__setattr__(self, 'bots', _MPT(bots))
        object.__setattr__(self, 'turn', d['turn'])
        object.__setattr__(self, 'max_turns', d['max_turns'])
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
      self.postMessage({ type: 'init-error', error: String(err) });
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
      self.postMessage({ type: 'match-reset-error', error: String(err) });
    }
    return;
  }

  if (type === 'decide') {
    if (!pyodide) {
      self.postMessage({ type: 'error', error: 'Not initialized' });
      return;
    }
    const start = performance.now();
    try {
      pyodide.globals.set('_raw_json', JSON.stringify(data.gameState));

      pyodide.runPython(`
_gs = _Snapshot(_json.loads(_raw_json))
_action = _bot.decide(_gs)
_rdist = -1
if isinstance(_action, _MA):
    _rtype = 'move'
    _rdir = int(_action.direction)
elif isinstance(_action, _SA):
    _rtype = 'skip'
    _rdir = -1
elif isinstance(_action, _SpA):
    _rtype = 'splat'
    _rdir = -1
elif isinstance(_action, _DA):
    _rtype = 'dash'
    _rdir = int(_action.direction)
    _rdist = int(_action.distance)
elif isinstance(_action, _SPB):
    _rtype = 'shoot_paintball'
    _rdir = int(_action.direction)
else:
    raise TypeError(f"Bot.decide must return Action, got {type(_action).__name__}")
`);

      const rtype = pyodide.globals.get('_rtype');
      const rdir = pyodide.globals.get('_rdir');
      const rdist = pyodide.globals.get('_rdist');
      const elapsed = (performance.now() - start) / 1000;

      const action = rtype === 'move'
        ? { type: 'move', direction: rdir }
        : rtype === 'dash'
          ? { type: 'dash', direction: rdir, distance: rdist }
          : rtype === 'splat'
            ? { type: 'splat' }
            : rtype === 'shoot_paintball'
              ? { type: 'shoot_paintball', direction: rdir }
              : { type: 'skip' };
      self.postMessage({ type: 'result', action, elapsed });
    } catch (err) {
      const elapsed = (performance.now() - start) / 1000;
      self.postMessage({ type: 'error', error: String(err), elapsed });
    }
  }
};
