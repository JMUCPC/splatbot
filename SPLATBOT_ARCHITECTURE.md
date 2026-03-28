# Splatbot — Architecture & Design Plan

## Overview

Splatbot is a two-player programming game. Each player writes a Python script
that controls a bot moving across a hex grid. As bots move, they paint tiles
their color. After a fixed number of turns, the player with the most painted
tiles wins. Matches are displayed in real-time through a GUI.

---

## Directory Structure

```
splatbot/
├── engine/
│   ├── __init__.py
│   ├── hex_grid.py          # Axial coordinate hex grid + neighbor logic
│   ├── game_state.py        # Authoritative, immutable-ish game state
│   ├── bot_context.py       # The sandboxed API object injected into bots
│   ├── actions.py           # Action dataclasses (MoveAction, SkipAction, SpecialAction)
│   ├── collision.py         # Collision resolution logic
│   ├── turn_runner.py       # Resolves a single turn: collect → resolve → apply
│   └── match_runner.py      # Full match loop + result reporting
│
├── sandbox/
│   ├── __init__.py
│   └── executor.py          # Loads & runs bot scripts, enforces per-turn timeout
│
├── frontend/
│   ├── __init__.py
│   ├── app.py               # NiceGUI entry point, wires UI to match runner
│   ├── hex_renderer.py      # Builds the SVG hex grid from game state
│   └── controls.py          # Start/stop/speed controls, score display
│
├── bots/
│   └── random.py    # Reference bot: moves randomly to a valid adjacent tile
│
├── config.py                # Default grid radius, turn count, tick speed, colors
└── main.py                  # Entry point — launches NiceGUI app
```

---

## Component Breakdown

### 1. `engine/hex_grid.py` — Hex Grid

Uses **axial coordinates** (q, r). This is the standard recommended by
redblobgames.com and avoids the ambiguity of offset coordinates.

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class Hex:
    q: int
    r: int

# The 6 axial direction vectors
HEX_DIRECTIONS = [
    Hex(1, 0), Hex(1, -1), Hex(0, -1),
    Hex(-1, 0), Hex(-1, 1), Hex(0, 1),
]

def hex_neighbor(h: Hex, direction: int) -> Hex:
    """direction: 0–5, clockwise from east"""
    d = HEX_DIRECTIONS[direction % 6]
    return Hex(h.q + d.q, h.r + d.r)

def hex_distance(a: Hex, b: Hex) -> int:
    return (abs(a.q - b.q) + abs(a.q + a.r - b.q - b.r) + abs(a.r - b.r)) // 2

def generate_hex_grid(radius: int) -> set[Hex]:
    """All hexes within `radius` steps of the origin."""
    return {
        Hex(q, r)
        for q in range(-radius, radius + 1)
        for r in range(-radius, radius + 1)
        if abs(q + r) <= radius
    }
```

### 2. `engine/game_state.py` — Game State

The single source of truth. Never mutated in-place during a turn — a new
`GameState` is produced each tick so the frontend always has a consistent
snapshot.

```python
from dataclasses import dataclass, field
from enum import Enum

class Owner(Enum):
    NONE = 0
    PLAYER_1 = 1
    PLAYER_2 = 2

@dataclass
class GameState:
    grid: set[Hex]                          # All valid hex positions
    tile_owners: dict[Hex, Owner]           # Who has painted each hex
    bot_positions: dict[int, Hex]           # player_id → current Hex
    turn: int = 0
    max_turns: int = 200
    radius: int = 10

    @property
    def is_over(self) -> bool:
        return self.turn >= self.max_turns

    def score(self) -> dict[int, int]:
        return {
            1: sum(1 for o in self.tile_owners.values() if o == Owner.PLAYER_1),
            2: sum(1 for o in self.tile_owners.values() if o == Owner.PLAYER_2),
        }
```

### 3. `engine/actions.py` — Action Types

```python
from dataclasses import dataclass
from typing import Any

@dataclass
class MoveAction:
    direction: int          # 0–5

@dataclass
class SkipAction:
    pass

@dataclass
class SpecialAction:
    name: str               # e.g. "ink_bomb", "dash"
    params: dict[str, Any]  # extensible payload
```

### 4. `engine/bot_context.py` — The Bot API

This is the object injected into each bot's script as `bot`. Players call
methods on it to act and sense. All mutation goes through this interface —
bots never touch `GameState` directly.

```python
class BotContext:
    def __init__(self, player_id: int, state: GameState):
        self._player_id = player_id
        self._state = state
        self._action = None             # Set once per turn

    # ── Action methods (call at most once per turn) ──────────────────────

    def move(self, direction: int):
        """Queue a move in direction 0–5."""
        if self._action is not None:
            return  # silently ignore extra calls
        self._action = MoveAction(direction % 6)

    def skip(self):
        """Do nothing this turn."""
        if self._action is None:
            self._action = SkipAction()

    def special(self, name: str, **params):
        """Trigger a special ability (stub — validated by turn runner)."""
        if self._action is None:
            self._action = SpecialAction(name, params)

    # ── Sensing methods ──────────────────────────────────────────────────

    def get_position(self) -> Hex:
        return self._state.bot_positions[self._player_id]

    def get_opponent_position(self) -> Hex:
        opponent = 2 if self._player_id == 1 else 1
        return self._state.bot_positions[opponent]

    def get_neighbors(self) -> list[Hex]:
        """Valid hex neighbors of current position."""
        pos = self.get_position()
        return [
            hex_neighbor(pos, d) for d in range(6)
            if hex_neighbor(pos, d) in self._state.grid
        ]

    def get_tile_owner(self, hex: Hex) -> Owner:
        return self._state.tile_owners.get(hex, Owner.NONE)

    def get_my_color(self) -> Owner:
        return Owner.PLAYER_1 if self._player_id == 1 else Owner.PLAYER_2

    def get_turn(self) -> int:
        return self._state.turn

    def get_score(self) -> dict:
        return self._state.score()

    # ── Internal ─────────────────────────────────────────────────────────

    def _collect_action(self) -> MoveAction | SkipAction | SpecialAction:
        return self._action if self._action is not None else SkipAction()
```

### 5. `sandbox/executor.py` — Bot Executor

Loads a player's Python file and calls their `decide(bot)` function each turn
with a timeout. Uses `threading` with a daemon thread and a `threading.Event`
for the timeout — simple and dependency-free given the "trust players" stance.

```python
import importlib.util, threading, traceback
from engine.bot_context import BotContext
from engine.game_state import GameState

TURN_TIMEOUT_SECONDS = 0.5  # configurable

def load_bot(path: str):
    """Load a bot module from a file path."""
    spec = importlib.util.spec_from_file_location("bot_module", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert hasattr(module, "decide"), f"{path} must define decide(bot)"
    return module

def get_action(bot_module, player_id: int, state: GameState):
    """
    Run bot_module.decide(bot) in a thread with a timeout.
    Returns a (BotContext, exception_or_None) tuple.
    """
    ctx = BotContext(player_id, state)
    error = None
    done = threading.Event()

    def run():
        nonlocal error
        try:
            bot_module.decide(ctx)
        except Exception:
            error = traceback.format_exc()
        finally:
            done.set()

    t = threading.Thread(target=run, daemon=True)
    t.start()
    timed_out = not done.wait(timeout=TURN_TIMEOUT_SECONDS)

    if timed_out:
        error = f"Player {player_id}: turn timed out ({TURN_TIMEOUT_SECONDS}s)"

    return ctx, error
```

**Note on timeouts:** The daemon thread will keep running after timeout (Python
can't force-kill threads), but because it holds a snapshot of game state
(not a live reference) it cannot corrupt the match. The next turn creates a
fresh context, so stale threads become harmless.

### 6. `engine/collision.py` — Collision Resolution

Collision is resolved **before** positions are committed. Two cases:

```
Case A — Head-on swap:
  Bot 1 at hex A wants to move to hex B.
  Bot 2 at hex B wants to move to hex A.
  → Both are moving into each other's pre-move tile.
  → Both bounce back (no movement).

Case B — Same-target collision:
  Both bots want to move to hex C (currently empty).
  → Both bounce back.

Case C — One-sided:
  Bot 1 wants to move to hex B (occupied by Bot 2, who is moving away).
  Bot 2 wants to move to hex D.
  → Bot 2 vacates B, so Bot 1 can proceed — UNLESS we resolve simultaneously,
     in which case we treat pre-move positions as occupied.
  → Decision: treat all pre-move positions as occupied for collision purposes.
     This means: if Bot 1's target == Bot 2's pre-move position, Bot 1 bounces.
```

```python
def resolve_collisions(
    positions: dict[int, Hex],
    intended: dict[int, Hex],  # player_id → intended next position
    grid: set[Hex],
) -> dict[int, Hex]:
    """
    Returns the resolved next positions for each player.
    """
    p1, p2 = 1, 2
    next1, next2 = intended[p1], intended[p2]

    # Clamp to grid
    if next1 not in grid: next1 = positions[p1]
    if next2 not in grid: next2 = positions[p2]

    # Case A: head-on swap (moving into each other's current tile)
    if next1 == positions[p2] or next2 == positions[p1]:
        return positions.copy()

    # Case B: same target
    if next1 == next2:
        return positions.copy()

    return {p1: next1, p2: next2}
```

### 7. `engine/turn_runner.py` — Single Turn

```python
def run_turn(
    state: GameState,
    bot1_module,
    bot2_module,
) -> tuple[GameState, list[str]]:
    """
    Execute one turn. Returns (new_state, list_of_errors).
    """
    errors = []

    # 1. Collect actions (in parallel via threads inside get_action)
    ctx1, err1 = get_action(bot1_module, 1, state)
    ctx2, err2 = get_action(bot2_module, 2, state)
    if err1: errors.append(err1)
    if err2: errors.append(err2)

    # 2. Determine intended positions
    def apply_action(action, player_id, state):
        pos = state.bot_positions[player_id]
        if isinstance(action, MoveAction):
            return hex_neighbor(pos, action.direction)
        return pos  # SkipAction or unrecognised SpecialAction

    intended = {
        1: apply_action(ctx1._collect_action(), 1, state),
        2: apply_action(ctx2._collect_action(), 2, state),
    }

    # 3. Resolve collisions
    new_positions = resolve_collisions(state.bot_positions, intended, state.grid)

    # 4. Paint tiles
    new_owners = dict(state.tile_owners)
    for player_id, pos in new_positions.items():
        new_owners[pos] = Owner.PLAYER_1 if player_id == 1 else Owner.PLAYER_2

    # 5. Build new state
    new_state = GameState(
        grid=state.grid,
        tile_owners=new_owners,
        bot_positions=new_positions,
        turn=state.turn + 1,
        max_turns=state.max_turns,
        radius=state.radius,
    )

    return new_state, errors
```

### 8. `engine/match_runner.py` — Full Match

```python
import asyncio

class MatchRunner:
    def __init__(self, state, bot1_module, bot2_module, on_state_update, on_error):
        self.state = state
        self.bot1 = bot1_module
        self.bot2 = bot2_module
        self.on_state_update = on_state_update  # async callback → frontend
        self.on_error = on_error
        self._running = False
        self.tick_delay = 0.1  # seconds between turns (adjustable)

    async def run(self):
        self._running = True
        while not self.state.is_over and self._running:
            self.state, errors = run_turn(self.state, self.bot1, self.bot2)
            for e in errors:
                self.on_error(e)
            await self.on_state_update(self.state)
            await asyncio.sleep(self.tick_delay)

    def stop(self):
        self._running = False
```

---

## Frontend — NiceGUI

**Recommendation: NiceGUI** over PyWebView for this project.

NiceGUI runs a local FastAPI/WebSocket server and renders in the browser (or a
bundled webview window via `native=True`). This means:

- State updates push instantly via WebSocket — no polling.
- SVG rendering of the hex grid is first-class in a browser.
- All UI code is pure Python (no JS required unless you want custom hex
  animations).
- `ui.timer()` can drive the match loop.
- You get a browser's dev tools for debugging the frontend.

**Key NiceGUI patterns used:**

```python
# frontend/app.py (sketch)
from nicegui import ui, app
import asyncio

hex_svg = ui.html("")          # SVG hex grid, updated each tick
score_label = ui.label("")
error_log = ui.log()

async def on_state_update(state: GameState):
    hex_svg.content = render_hex_grid(state)   # from hex_renderer.py
    score = state.score()
    score_label.text = f"P1: {score[1]}  |  P2: {score[2]}  |  Turn: {state.turn}"

def on_error(msg: str):
    error_log.push(msg)

# Start/stop buttons, speed slider, file pickers for bot scripts
```

### `frontend/hex_renderer.py` — SVG Hex Grid

Converts `GameState` to an SVG string. Hexes are drawn as `<polygon>` elements
using flat-top hex geometry. Each hex is coloured by its `Owner`.

```python
import math

COLORS = {
    "NONE":     "#e8e8e8",
    "PLAYER_1": "#f97316",   # orange
    "PLAYER_2": "#3b82f6",   # blue
}

def flat_hex_corners(cx, cy, size):
    """6 corner points for a flat-top hex centered at (cx, cy)."""
    return [
        (cx + size * math.cos(math.radians(60 * i)),
         cy + size * math.sin(math.radians(60 * i)))
        for i in range(6)
    ]

def axial_to_pixel(q, r, size):
    """Axial → pixel center (flat-top layout)."""
    x = size * (3/2 * q)
    y = size * (math.sqrt(3)/2 * q + math.sqrt(3) * r)
    return x, y

def render_hex_grid(state: GameState, hex_size: int = 30) -> str:
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" ...>']
    for h in state.grid:
        cx, cy = axial_to_pixel(h.q, h.r, hex_size)
        # offset to canvas center...
        owner = state.tile_owners.get(h, Owner.NONE).name
        color = COLORS[owner]
        corners = flat_hex_corners(cx, cy, hex_size - 1)
        pts = " ".join(f"{x:.1f},{y:.1f}" for x, y in corners)
        parts.append(f'<polygon points="{pts}" fill="{color}" stroke="#fff" stroke-width="1"/>')

    # Draw bots as circles on top
    for pid, pos in state.bot_positions.items():
        cx, cy = axial_to_pixel(pos.q, pos.r, hex_size)
        color = "#ea580c" if pid == 1 else "#1d4ed8"
        parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{hex_size*0.4:.1f}" fill="{color}" stroke="white" stroke-width="2"/>')

    parts.append("</svg>")
    return "\n".join(parts)
```

---

## Bot Script Format

Players write a Python file with a single required function:

```python
# bots/my_bot.py

def decide(bot):
    """Called once per turn. Use bot.* methods to act and sense."""
    neighbors = bot.get_neighbors()
    my_pos    = bot.get_position()
    opp_pos   = bot.get_opponent_position()

    # Example: move toward an unpainted neighbor
    for i, n in enumerate(neighbors):
        if bot.get_tile_owner(n).name == "NONE":
            bot.move(i)
            return

    bot.skip()
```

**Rules enforced at runtime:**
- `decide(bot)` must complete within `TURN_TIMEOUT_SECONDS` (default 0.5s).
- Calling `bot.move()` more than once per turn is silently ignored.
- Crashing or timing out results in a `SkipAction` for that turn; the error is
  logged but the match continues.
- Bots receive a **snapshot** of game state — they cannot modify it.

---

## Special Abilities (Extensibility Stub)

Add abilities by:
1. Adding a new action handler in `turn_runner.py` inside an `isinstance(action, SpecialAction)` branch.
2. Defining cooldown state as an extra field on `GameState` (e.g. `special_cooldowns: dict[int, int]`).
3. Exposing the ability via `BotContext.special("ink_bomb")` — no API changes needed.

Planned abilities:
- **Ink Bomb** — paints all 6 adjacent hexes the bot's color (instant, 5-turn cooldown).
- **Dash** — moves 2 hexes in one turn along a direction (collision still applies at both steps).

---

## Configuration (`config.py`)

```python
GRID_RADIUS   = 10          # hexes from center
MAX_TURNS     = 200
TICK_DELAY    = 0.1         # seconds between turns (can be changed at runtime)
TIMEOUT       = 0.5         # per-bot per-turn execution budget
PLAYER_COLORS = {1: "#f97316", 2: "#3b82f6"}
BOT_COLORS    = {1: "#ea580c", 2: "#1d4ed8"}
```

---

## Data Flow Summary

```
main.py
  └─ launches NiceGUI app (frontend/app.py)
       ├─ user picks bot scripts via file picker
       ├─ user sets grid radius + turn count
       └─ on "Start":
            ├─ load_bot(path1), load_bot(path2)   [sandbox/executor.py]
            ├─ build initial GameState             [engine/game_state.py]
            └─ MatchRunner.run() (async loop)
                 ├─ run_turn(state, bot1, bot2)   [engine/turn_runner.py]
                 │    ├─ get_action() × 2         [sandbox/executor.py]
                 │    ├─ resolve_collisions()      [engine/collision.py]
                 │    └─ paint tiles → new state
                 └─ on_state_update(state)
                      └─ render_hex_grid(state)   [frontend/hex_renderer.py]
                           └─ push SVG to NiceGUI ui.html element (WebSocket)
```

---

## Implementation Order (Suggested)

1. `hex_grid.py` — grid generation, neighbor lookup, pixel conversion
2. `game_state.py` + `actions.py` — data model
3. `bot_context.py` — the bot API (no UI needed to test this)
4. `sandbox/executor.py` — load and run a bot in isolation
5. `collision.py` + `turn_runner.py` — headless match loop
6. Write a CLI runner (`main_headless.py`) that prints state each turn — validates the engine works before adding UI
7. `frontend/hex_renderer.py` — SVG generation (test by writing HTML to a file)
8. `frontend/app.py` + `controls.py` — wire NiceGUI to the engine
9. Polish: speed controls, error log, score display, end-of-match summary
10. Special abilities
