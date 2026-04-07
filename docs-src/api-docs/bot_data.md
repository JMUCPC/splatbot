# Bot info API Reference

Each entry in `game_state.bots` is a **read-only** object describing one player’s bot. You do not import this type; you access instances via `game_state.bots[pid]` (and your own id via `game_state.my_pid`). Assigning attributes raises `AttributeError`.

The worker’s internal class mirrors the engine’s bot state (cooldowns, stun, position, facing). Field names in Python use **snake_case** as below.

## Type overview

```python
# Illustrative — injected read-only type; repr uses the name BotInfo.
class BotInfo:
    pid: int
    position: Hex
    facing: HexDirection
    stun: int
    splat_cooldown: int
    dash_cooldown: int
    paintball_cooldown: int
```

`Hex` and `HexDirection` come from [`utils.hex_grid`](utils/hex_grid.md).

---

## Fields

### `pid: int`

Player id for this bot (e.g. `1` or `2`).

### `position: Hex`

The bot’s current cell in axial coordinates.

### `facing: HexDirection`

The direction the bot is facing (same six-way scheme as `HexDirection` in `utils.hex_grid`).

### `stun: int`

Turns remaining where **move**, **dash**, **splat**, and **shoot_paintball** are disallowed (**skip** still allowed). When greater than zero, those actions should be avoided; the engine will reject or no-op them similarly.

### `splat_cooldown: int`

Turns until **splat** may be used again (`0` = ready). Tuned by game config in the engine.

### `dash_cooldown: int`

Turns until **dash** may be used again (`0` = ready).

### `paintball_cooldown: int`

Turns until **shoot_paintball** may be used again (`0` = ready).

---

## Relationship to `game_state`

For **your** bot, the same cooldown and stun values appear on both:

- `game_state.bots[game_state.my_pid]` (this object), and  
- the convenience fields `game_state.my_stun`, `game_state.my_splat_cooldown`, `game_state.my_dash_cooldown`, `game_state.my_paintball_cooldown` on the snapshot (see [Game state](game_data.md)).

Use either; they should stay in sync for a given `decide` call.
