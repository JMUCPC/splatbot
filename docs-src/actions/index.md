# Actions

Each time your bot's `decide` method runs, it must return **exactly one** action built with the `Actions` helpers below. The game will then apply that action's effect to your bot. Most actions are _directional_ - they will behave differently depending on the direction a bot is facing.

## Basic Actions

Basic actions can be performed at any point a bot is not stunned. These are less powerful than special actions as they are a lot more limited in what they allow the bot to do, however, they have no cooldowns and can thus be performed more frequently.

### Move

`Actions.move()` moves one hex straight ahead in the direction a bot is currently facing, and paints the tile it lands on.

If the step would leave the grid, nothing happens.

<div class="action-demo" data-action-demo="move" role="region" aria-label="Move action example">
<h4> Move East </h4>
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Player 1 faces east. Play applies <code>Actions.move()</code> - step one hex east and paint the landing tile.</p>
</div>

```python title="First Steps for Botkind"
from utils.actions import Actions


class Bot:
    def decide(self, game_state):
        """This bot will move in a straight line forever."""
        return Actions.move()
```

### Facing and Turning

Moving around would be useless without a way for a bot to control its direction. To change which direction it is facing, there are a few actions that a bot can take:

#### Turn Left

`Actions.turn_left(steps=1)` — Turn some number of steps left (default to 1 step)

<div class="action-demo" data-action-demo="turn-left" role="region" aria-label="Turn left example">
<h4>Turn One Step Left</h4>
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Play applies <code>Actions.turn_left()</code> - the marker pivots left (<strong>E → NE</strong>).</p>
</div>

#### Turn Right

`Actions.turn_right(steps=1)` — Turn some number of steps right (default to 1 step)

<div class="action-demo" data-action-demo="turn-right-2" role="region" aria-label="Turn right two steps example">
<h4>Turn Two Steps Right</h4>
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Play applies <code>Actions.turn_right(2)</code> - the marker pivots 2 tiles right (<strong>E → SW</strong>).</p>
</div>

#### Turn Around

`Actions.turn_180()` — Turn to face the opposite direction.

<div class="action-demo" data-action-demo="turn-180" role="region" aria-label="Turn 180 example">
<h4>Turn 180 Degrees</h4>
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Play applies <code>Actions.turn_180()</code> - the marker faces the opposite directions (<strong>E → W</strong>).</p>
</div>

#### Face Direction

`Actions.face_direction(direction)` — Set facing to the given `HexDirection` or integer `0`–`5`.

<div class="action-demo" data-action-demo="face-direction" role="region" aria-label="Face direction example">
<h4>Face Southwest</h4>
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Play applies <code>Actions.face_direction(HexDirection.SW)</code> - turn to that direction (<strong>E → SW</strong>).</p>
</div>

Turning does **not** move the bot or paint tiles - only the direction the bot faces changes.

### Skip

The skip action tells a splatbot to skip a turn. It is the only legal action for a bot to take while it is stunned.

<div class="action-demo" data-action-demo="skip" role="region" aria-label="Skip action example">
<h4>Skip</h4>
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Play applies <code>Actions.skip()</code> - nothing happens.</p>
</div>

```python title="Lazy Bot"
from utils.actions import Actions


class Bot:
    def decide(self, game_state):
        """ This bot will not do anything. How lazy! """
        return Actions.skip()
```

## Special Actions

Special actions are more powerful than basic actions. However, these actions have a cooldown that must finish before the action is allowed to be performed again.

Especially powerful special actions will also stun the user for a few turns, preventing them from taking any actions at all until the stun expires. The exact values of these penalties are configurable in the settings menu of the game.

| Definitions:                                                                      |
| --------------------------------------------------------------------------------- |
| **Stun:** A number of turns a bot cannot perform any action                       |
| **Cooldown:** A number of turns before a bot can repeat the action "cooling down" |

### Splat

`Actions.splat()` paints every neighbor of a bot's current hex.

Default settings:

- Stun: 3 turns
- Cooldown: 10 turns

<div class="action-demo" data-action-demo="splat" role="region" aria-label="Splat action example">
<h4> Splat! </h4>
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Play applies <code>Actions.splat()</code> - all tiles neighboring the bot are painted.</p>
</div>

```python title="Splat Bot"
from utils.actions import Actions


class Bot:
    def decide(self, game_state):
        # If stunned, do nothing
        if game_state.me.stun > 0:
            return Actions.skip()
        # Splat if possible
        if game_state.me.splat_cooldown == 0:
            return Actions.splat()
        # Otherwise, move forwards
        return Actions.move()
```

_The `game_state` variable will be explained more in [Writing Bots](../writing-bots/#game-state)._

### Shoot paintball

`Actions.shoot_paintball()` will fire a paintball in the direction a bot is currently facing. Thanks to _advanced bot technology™_, paintballs travel instantaneously. A paintball will travel until it collides with either another bot or the edge of the map.

Default settings:

- Stun: 7 turns
- Cooldown: 20 turns

<div class="action-demo" data-action-demo="shoot-paintball-edge" role="region" aria-label="Shoot paintball toward map edge">
<h4>Shoot Paintball</h4>
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Play applies <code>Actions.shoot_paintball()</code> - all tiles in front of the bot are painted up to the edge of the map.</p>
</div>

<div class="action-demo" data-action-demo="shoot-paintball" role="region" aria-label="Shoot paintball blocked by other bot">
<h4>Shoot Paintball (Bot Collision)</h4>
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Play applies <code>Actions.shoot_paintball()</code> - all tiles in front of the bot are painted until the paintball hits another bot.</p>
</div>

```python title="Paintball Bot"
from utils.actions import Actions


class Bot:
    def decide(self, game_state):
        # If stunned, do nothing
        if game_state.me.stun > 0:
            return Actions.skip()
        # If a paintball can be shot, use it
        if game_state.me.paintball_cooldown == 0:
            return Actions.shoot_paintball()
        # Otherwise, move forwards
        return Actions.move()
```

### Dash

`Actions.dash(distance)` moves a bot **2–6** hexes straight ahead, and only paints the destination hex.

Default settings:

- Stun: 0 turns
- Cooldown: 7 turns

If the full distance of a dash would have the bot leave the grid, it will stop at the **last in-grid hex** along that direction (the edge of the grid).

<div class="action-demo" data-action-demo="dash" role="region" aria-label="Dash action example">
<h4>Dash Bot</h4>
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Play applies <code>Actions.dash(4)</code> - the bot moves 4 and paints the tile it lands on.</p>
</div>

```python title="The Flash"
from utils.actions import Actions


class Bot:
    def decide(self, game_state):
        # If stunned, do nothing
        if game_state.me.stun > 0:
            return Actions.skip()
        # Dash if possible
        if game_state.me.dash_cooldown == 0:
            return Actions.dash(6)
        # Otherwise, just walk like a normal person
        return Actions.move()
```
