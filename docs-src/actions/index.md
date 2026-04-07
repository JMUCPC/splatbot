# Actions

Each time your bot's `decide` runs, it must return **exactly one** action built with the **`Actions`** helpers below. Think of it as picking a single move from a small menu: walk, stand still, splat, dash, or fire a paintball.

- **Cooldowns:** After splat, dash, or paintball, counters on `game_state.me` must tick down before you can repeat that same action (see [Writing bots](../writing-bots/) for field names).
- **Stun:** After some moves you may be unable to act for several turns except `skip` — check `game_state.me.stun`.
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

The move action tells a splatbot to move in a given direction. The direction given may be either an integer or (recommended) a [HexDirection](../utilities/index.md#hexdirection). A splatbot will move one tile in the given direction, and paint the tile that it lands on. If the movement would result in the splatbot moving to an invalid position, then nothing will happen.

<div class="action-demo" data-action-demo="move" role="region" aria-label="Move action example">
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Player 1 moves one hex east (<code>HexDirection.E</code>) and paints the landing tile.</p>
</div>

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def decide(self, game_state):
        """ This bot will move in a straight line east across the grid. """
        return Actions.move(HexDirection.E)
```

## Splat

`Actions.splat()` paints every **in-grid neighbor** of your current hex (not the tile you stand on).

After splat:

1. **Stun** — for a number of turns you cannot **move**, **dash**, **splat**, or **shoot paintball** (`game_state.me.stun`). Use `Actions.skip()` if you have no other option. Duration is configurable as **Splat stun** in **SETTINGS**.
2. **Splat cooldown** — you cannot **splat** again until this reaches `0` (`game_state.me.splat_cooldown`; default spacing enforces at most about one splat every 10 turns). You may **move** once stun ends even if splat cooldown is still counting down.

<div class="action-demo" data-action-demo="splat" role="region" aria-label="Splat action example">
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">All in-grid neighbors of the bot are painted; the bot's own tile is not.</p>
</div>

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def decide(self, game_state):
        if game_state.me.stun > 0:
            return Actions.skip()
        if game_state.me.splat_cooldown == 0:
            return Actions.splat()
        return Actions.move(HexDirection.E)
```

See [Writing bots](../writing-bots/) for the full game state reference.

## Shoot paintball

`Actions.shoot_paintball(direction)` does **not** move your bot. It paints every in-grid hex in a straight line in `direction`, starting from the first hex **beyond** your current tile, until the ray leaves the map or reaches a hex occupied by the **other** bot (that hex is **not** painted; the ray stops there).

You cannot use paintball while **stunned** (`game_state.me.stun`). After a shot, you are **stunned** for a number of turns (default **7**; **Paintball stun** in **SETTINGS**). Separately, by default you can shoot again only after **20** turns (`game_state.me.paintball_cooldown`; **Paintball cooldown** in **SETTINGS**).

<div class="action-demo" data-action-demo="shoot-paintball-edge" role="region" aria-label="Shoot paintball toward map edge">
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Only player 1 (orange): a paintball east paints every hex along the line until the ray leaves the grid. Your own tile is not painted.</p>
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
        if game_state.me.stun > 0:
            return Actions.skip()
        if game_state.me.paintball_cooldown == 0:
            return Actions.shoot_paintball(HexDirection.E)
        return Actions.move(HexDirection.E)
```

## Dash

`Actions.dash(direction, distance)` moves a bot **2–6** hexes in the given `direction` and paints **only the destination** hex.

A bot can dash once every **7 turns** by default; check `game_state.me.dash_cooldown` (`0` = dash available). Optionally, a **Dash stun** in **SETTINGS** (default **0**) applies stun after a dash the same way as splat/paintball.

If the full distance would leave the grid, you stop at the **last in-grid hex** along that direction (the edge), paint only that hex, and the dash cooldown still applies.

<div class="action-demo" data-action-demo="dash" role="region" aria-label="Dash action example">
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Player 1 dashes four steps east; only the final hex is painted (not the path).</p>
</div>

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def decide(self, game_state):
        if game_state.me.stun > 0:
            return Actions.skip()
        if game_state.me.dash_cooldown == 0:
            return Actions.dash(HexDirection.E, 4)
        return Actions.move(HexDirection.E)
```
