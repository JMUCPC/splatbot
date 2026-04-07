# Actions

Each time your bot’s `decide` runs, it must return **exactly one** action built with the **`Actions`** helpers below. Think of it as picking a single choice from a small menu: turn, step forward, stand still, splat, dash, or fire a paintball.

- **Facing:** [Move](#move), [dash](#dash), and [shoot paintball](#shoot-paintball) all use your bot’s current **facing** (see [`facing` in BotInfo](../glossary/index.md#botinfo)). Change facing with the [turning](#facing-and-turning) actions.
- **Cooldowns:** After splat, dash, or paintball, counters on `game_state` must tick down before you can repeat that same action (see [Writing bots](../writing-bots/) for field names).
- **Stun:** After some moves you may be unable to act for several turns except `skip` — check `game_state.my_stun`. While stunned you cannot **move**, **dash**, **splat**, **shoot paintball**, or **turn** (`skip` still works).
- **Details:** The [Writing bots](../writing-bots/) page summarizes; this page explains each action in full, with demos.

Interactive examples below use the same rules as the main game (mini grid, player 1 in orange). **Play** applies the action once; **Reset** restores the starting position.

## Skip

The skip action tells a splatbot to skip a turn.

<div class="action-demo" data-action-demo="skip" role="region" aria-label="Skip action example">
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Skip does not move or paint — the board stays the same.</p>
</div>

```python
from utils.actions import Actions


class Bot:
    def decide(self, game_state):
        """ This bot will not do anything. How lazy! """
        return Actions.skip()
```

## Move

`Actions.move()` moves **one hex straight ahead** in your bot’s current **facing** and paints the tile you land on. It does not take a direction argument.

If the step would leave the grid, nothing happens.

<div class="action-demo" data-action-demo="move" role="region" aria-label="Move action example">
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Player 1 faces east; move steps one hex east and paints the landing tile.</p>
</div>

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def decide(self, game_state):
        """Face east, then step forward each time this runs (two phases in practice)."""
        me = game_state.bots[game_state.my_pid]
        if me.facing != HexDirection.E:
            return Actions.face_direction(HexDirection.E)
        return Actions.move()
```

## Facing and turning

Your bot always has a `facing` value (`game_state.bots[game_state.my_pid].facing`), a [HexDirection](../utilities/index.md#hexdirection). Each turning action below costs **one tick**.

- **`Actions.turn_left(steps=1)`** — Add `steps` to the direction index (mod 6); e.g. with `steps=1`, **E → NE**. Matches pivoting the marker **left** on the default map view. Default `steps` is `1`. One tick; `steps` is reduced mod 6 (e.g. `6` = full rotation = no net turn).
- **`Actions.turn_right(steps=1)`** — Subtract `steps` from the direction index (mod 6); e.g. with `steps=1`, **E → SE**. Matches pivoting the marker **right** on the default map view. Default `steps` is `1`.
- **`Actions.face_direction(direction)`** — Set facing to the given `HexDirection` or integer `0`–`5` (normalized with `% 6`). Use this when you want an absolute heading.
- **`Actions.turn_180()`** — Turn to face the opposite hex direction (three 60° steps in one tick).

You cannot use any of these while **stunned** (`game_state.my_stun > 0`); the engine will no-op them like other blocked actions.

Turning does **not** move the bot or paint tiles — only the **facing** changes (the triangle marker on the hex shows which way you point).

<div class="action-demo" data-action-demo="turn-left" role="region" aria-label="Turn left example">
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Player 1 starts facing east. <strong>Play</strong> applies <code>Actions.turn_left()</code> once — the marker pivots **left** on the map (<strong>E → NE</strong> in <code>HexDirection</code> index). No movement.</p>
</div>

<div class="action-demo" data-action-demo="turn-left-2" role="region" aria-label="Turn left two steps example">
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Same start. <strong>Play</strong> applies <code>Actions.turn_left(2)</code> — one tick, two left steps on the map (<strong>E → NW</strong>).</p>
</div>

<div class="action-demo" data-action-demo="face-direction" role="region" aria-label="Face direction example">
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Same start. <strong>Play</strong> applies <code>Actions.face_direction(HexDirection.SW)</code> — jump straight to an absolute heading (southwest here).</p>
</div>

<div class="action-demo" data-action-demo="turn-180" role="region" aria-label="Turn 180 example">
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Same start (facing east). <strong>Play</strong> applies <code>Actions.turn_180()</code> — face the opposite way on the hex grid (<strong>E → W</strong>) in one tick. No movement.</p>
</div>

## Splat

`Actions.splat()` paints every **in-grid neighbor** of your current hex (not the tile you stand on).

After splat:

1. **Stun** — for a number of turns you cannot **move**, **dash**, **splat**, **shoot paintball**, or **turn** (`game_state.my_stun`). Use `Actions.skip()` if you have no other option. Duration is configurable as **Splat stun** in **SETTINGS**.
2. **Splat cooldown** — you cannot **splat** again until this reaches `0` (`game_state.my_splat_cooldown`; default spacing enforces at most about one splat every 10 turns). You may **move** once stun ends even if splat cooldown is still counting down.

<div class="action-demo" data-action-demo="splat" role="region" aria-label="Splat action example">
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">All in-grid neighbors of the bot are painted; the bot’s own tile is not.</p>
</div>

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def decide(self, game_state):
        if game_state.my_stun > 0:
            return Actions.skip()
        if game_state.my_splat_cooldown == 0:
            return Actions.splat()
        me = game_state.bots[game_state.my_pid]
        if me.facing != HexDirection.E:
            return Actions.face_direction(HexDirection.E)
        return Actions.move()
```

See [Writing bots](../writing-bots/) for the full game state reference.

## Shoot paintball

`Actions.shoot_paintball()` does **not** move your bot. It fires along your current **facing**: every in-grid hex **beyond** your current tile in a straight line is painted until the ray leaves the map or reaches a hex occupied by the **other** bot (that hex is **not** painted; the ray stops there).

You cannot use paintball while **stunned** (`game_state.my_stun`). After a shot, you are **stunned** for a number of turns (default **7**; **Paintball stun** in **SETTINGS**). Separately, by default you can shoot again only after **20** turns (`game_state.my_paintball_cooldown`; **Paintball cooldown** in **SETTINGS**).

<div class="action-demo" data-action-demo="shoot-paintball-edge" role="region" aria-label="Shoot paintball toward map edge">
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Only player 1 (orange), facing east: a paintball paints every hex along the line until the ray leaves the grid. Your own tile is not painted.</p>
</div>

<div class="action-demo" data-action-demo="shoot-paintball" role="region" aria-label="Shoot paintball blocked by other bot">
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">With player 2 in the way: the ray travels east, painting each hex until it reaches the other bot — that hex is not painted.</p>
</div>

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def decide(self, game_state):
        if game_state.my_stun > 0:
            return Actions.skip()
        me = game_state.bots[game_state.my_pid]
        if me.facing != HexDirection.E:
            return Actions.face_direction(HexDirection.E)
        if game_state.my_paintball_cooldown == 0:
            return Actions.shoot_paintball()
        return Actions.move()
```

## Dash

`Actions.dash(distance)` moves **2–6** hexes straight ahead in your current **facing** and paints **only the destination** hex.

`distance` is the only argument; direction comes from **facing**.

A bot can dash once every **7 turns** by default; check `game_state.my_dash_cooldown` (`0` = dash available). Optionally, a **Dash stun** in **SETTINGS** (default **0**) applies stun after a dash the same way as splat/paintball.

If the full distance would leave the grid, you stop at the **last in-grid hex** along that direction (the edge), paint only that hex, and the dash cooldown still applies.

<div class="action-demo" data-action-demo="dash" role="region" aria-label="Dash action example">
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Player 1 faces east and dashes four steps; only the final hex is painted (not the path).</p>
</div>

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def decide(self, game_state):
        if game_state.my_stun > 0:
            return Actions.skip()
        me = game_state.bots[game_state.my_pid]
        if me.facing != HexDirection.E:
            return Actions.face_direction(HexDirection.E)
        if game_state.my_dash_cooldown == 0:
            return Actions.dash(4)
        return Actions.move()
```
