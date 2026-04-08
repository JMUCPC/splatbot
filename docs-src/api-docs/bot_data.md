# Bot info API Reference

`BotInfo` is a **read-only** object describing one player's bot. You access instances via `game_state.me` (your bot), `game_state.opponents[pid]` (other players), or `game_state.opponent` (the single opponent in a 1v1). Assigning attributes raises `AttributeError`.

The worker's internal class mirrors the engine's bot state (cooldowns, stun, position, facing). Field names in Python use **snake_case** as below.

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

The bot's current cell in axial coordinates.

### `facing: HexDirection`

The direction the bot is facing (same six-way scheme as `HexDirection` in `utils.hex_grid`).

### `stun: int`

Turns remaining where **move**, **dash**, **splat**, **shoot_paintball**, and **turning** are disallowed (**skip** still allowed). When greater than zero, those actions should be avoided; the engine will reject or no-op them similarly.

### `splat_cooldown: int`

Turns until **splat** may be used again (`0` = ready). Tuned by game config in the engine.

### `dash_cooldown: int`

Turns until **dash** may be used again (`0` = ready).

### `paintball_cooldown: int`

Turns until **shoot_paintball** may be used again (`0` = ready).

---

## Equality

Two `BotInfo` instances are equal if they have the same `pid`. This means comparisons like `hex.controller == game_state.me` work as expected.

---

## Accessing `BotInfo`

| Expression | What it gives you |
| --- | --- |
| `game_state.me` | Your bot's `BotInfo`. |
| `game_state.opponent` | The single opponent in 1v1 (`None` otherwise). |
| `game_state.opponents[pid]` | A specific opponent by player id. |
| `hex.controller` | The `BotInfo` that controls this tile, or `None`. |
