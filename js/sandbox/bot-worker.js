/**
 * Web Worker that loads Pyodide and executes Python bot code.
 * Communicates with the main thread via postMessage.
 *
 * Messages IN:
 *   { type: 'init', data: { hexGridPy, actionsPy, botCode } }
 *   { type: 'decide', data: { gameState } }
 *
 * Messages OUT:
 *   { type: 'ready' }
 *   { type: 'result', action: { type, direction? }, elapsed }
 *   { type: 'error', error: string, elapsed? }
 */

let pyodide = null;

self.onmessage = async function (e) {
  const { type, data } = e.data;

  if (type === 'init') {
    try {
      importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');
      pyodide = await loadPyodide();

      pyodide.FS.mkdirTree('/lib/utils');
      pyodide.FS.writeFile('/lib/utils/__init__.py', '');
      pyodide.FS.writeFile('/lib/utils/hex_grid.py', data.hexGridPy);
      pyodide.FS.writeFile('/lib/utils/actions.py', data.actionsPy);

      pyodide.runPython("import sys; sys.path.insert(0, '/lib')");

      // Snapshot infrastructure and imports cached across turns
      pyodide.runPython(`
from types import MappingProxyType as _MPT
from utils.hex_grid import Hex as _Hex, HexDirection as _HD
from utils.actions import MoveAction as _MA, SkipAction as _SA
import json as _json

class _BotInfo:
    __slots__ = ('pid', 'position', 'facing')
    def __init__(self, pid, position, facing):
        object.__setattr__(self, 'pid', pid)
        object.__setattr__(self, 'position', position)
        object.__setattr__(self, 'facing', facing)
    def __setattr__(self, *a):
        raise AttributeError("BotInfo is read-only")
    def __repr__(self):
        return f"BotInfo(pid={self.pid}, pos={self.position}, facing={self.facing})"

class _Snapshot:
    __slots__ = ('my_pid', 'grid', 'tile_pids', 'bots', 'turn', 'max_turns')
    def __init__(self, d):
        object.__setattr__(self, 'my_pid', d['my_pid'])
        object.__setattr__(self, 'grid', frozenset(_Hex(q, r) for q, r in d['grid']))
        tp = {}
        for k, v in d['tile_pids'].items():
            q, r = k.split(',')
            tp[_Hex(int(q), int(r))] = v
        object.__setattr__(self, 'tile_pids', _MPT(tp))
        bots = {}
        for ps, bd in d['bots'].items():
            p = int(ps)
            bots[p] = _BotInfo(p, _Hex(*bd['position']), _HD(bd['facing']))
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
      self.postMessage({ type: 'error', error: String(err) });
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
if isinstance(_action, _MA):
    _rtype = 'move'
    _rdir = int(_action.direction)
elif isinstance(_action, _SA):
    _rtype = 'skip'
    _rdir = -1
else:
    raise TypeError(f"Bot.decide must return Action, got {type(_action).__name__}")
`);

      const rtype = pyodide.globals.get('_rtype');
      const rdir = pyodide.globals.get('_rdir');
      const elapsed = (performance.now() - start) / 1000;

      const action = rtype === 'move'
        ? { type: 'move', direction: rdir }
        : { type: 'skip' };
      self.postMessage({ type: 'result', action, elapsed });
    } catch (err) {
      const elapsed = (performance.now() - start) / 1000;
      self.postMessage({ type: 'error', error: String(err), elapsed });
    }
  }
};
