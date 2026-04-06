# Example bots

Full scripts below, then a short **how it works** list. Assumes you have read [Writing bots](../writing-bots/) and skimmed [Actions](../actions/).

## Ping-pong (east / west)

Same idea as on the writing-bots page, with a bit more narration.

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection, hex_neighbor


class Bot:
    def __init__(self):
        self._going_east = True

    def decide(self, game_state):
        me = game_state.bots[game_state.my_pid]
        d = HexDirection.E if self._going_east else HexDirection.W
        nbr = hex_neighbor(me.position, d)
        if nbr not in game_state.grid:
            self._going_east = not self._going_east
            d = HexDirection.E if self._going_east else HexDirection.W
        return Actions.move(d)
```

**How it works**

1. Remember a boolean `_going_east` on `self` so the choice survives after `decide` returns.
2. Look up this bot’s position: `game_state.bots[game_state.my_pid].position`.
3. Pick east or west from that boolean; compute the neighbor hex in that direction.
4. If that neighbor is **not** on the map (`not in game_state.grid`), flip direction and recompute the move direction.
5. Return `Actions.move(d)`.

**Takeaways:** `hex_neighbor`, `game_state.grid`, and stored state on `self`.

## Splat when ready, otherwise move

Uses [stun](../glossary/index.md#stun) and [cooldown](../glossary/index.md#cooldown) checks from `game_state` before calling special actions.

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def decide(self, game_state):
        if game_state.my_stun > 0:
            return Actions.skip()
        if game_state.my_splat_cooldown == 0:
            return Actions.splat()
        return Actions.move(HexDirection.E)
```

**How it works**

1. While stunned, the only safe choice is usually `skip` (you cannot splat or move depending on rules; here we skip whenever `my_stun > 0`).
2. When splat is off cooldown, splat to paint neighbors.
3. Otherwise default to moving east.

**Takeaways:** Order matters — check stun before spending cooldowns. Tune the `else` branch for your strategy.

## Greedy: step onto an unpainted tile

Prefer any neighbor that is still neutral (`tile_pids` is `0`); otherwise fall back to moving east.

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection, hex_neighbor


class Bot:
    def decide(self, game_state):
        me = game_state.bots[game_state.my_pid]
        for d in HexDirection:
            nbr = hex_neighbor(me.position, d)
            if nbr not in game_state.grid:
                continue
            if game_state.tile_pids.get(nbr, 0) == 0:
                return Actions.move(d)
        return Actions.move(HexDirection.E)
```

**How it works**

1. Loop the six directions in `HexDirection` order.
2. Skip neighbors that are off the map.
3. If a neighbor is unpainted (`0`), move there immediately.
4. If none are unpainted, keep moving east so the bot still does something.

**Takeaways:** `tile_pids`, iterating directions, and a simple priority rule.

---

[Writing bots](../writing-bots/) · [Glossary](../glossary/) · [← Docs home](../index.md) · [← Back to the game](../../index.html)
