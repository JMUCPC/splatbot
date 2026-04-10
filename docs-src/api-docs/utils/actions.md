# actions

Use the [Actions](#actions) static methods to construct [Action](#action)-type objects.

**Exports:** Actions, Action, MoveAction, SkipAction, SplatAction, DashAction, ShootPaintballAction, TurnLeftAction, TurnRightAction, FaceDirectionAction, Turn180Action

## Actions

Static factories (immutable results).

### Methods

| Method                    | Returns                                       | Description                                                  |
| ------------------------- | --------------------------------------------- | ------------------------------------------------------------ |
| move()                    | [MoveAction](#moveaction)                     | Move one hex forward.                                        |
| skip()                    | [SkipAction](#skipaction)                     | Do nothing.                                                  |
| splat()                   | [SplatAction](#splataction)                   | Paint in-grid neighbors of current cell.                     |
| dash(distance)            | [DashAction](#dashaction)                     | Move distance hexes forward; paints only the destination.    |
| shoot_paintball()         | [ShootPaintballAction](#shootpaintballaction) | Paint along ray in facing until edge or another bot.         |
| turn_left(steps=1)        | [TurnLeftAction](#turnleftaction)             | Rotate left by steps.                                        |
| turn_right(steps=1)       | [TurnRightAction](#turnrightaction)           | Rotate right by steps.                                       |
| face_direction(direction) | [FaceDirectionAction](#facedirectionaction)   | direction is int or [HexDirection](hex_grid.md#hexdirection) |
| turn_180()                | [Turn180Action](#turn180action)               | Face opposite direction.                                     |

## Action

Type alias (union) for any legal return value from decide: [MoveAction](#moveaction), [SkipAction](#skipaction), [SplatAction](#splataction), [DashAction](#dashaction), [ShootPaintballAction](#shootpaintballaction), [TurnLeftAction](#turnleftaction), [TurnRightAction](#turnrightaction), [FaceDirectionAction](#facedirectionaction), [Turn180Action](#turn180action).

## MoveAction

_No instance attributes._

## SkipAction

_No instance attributes._

## SplatAction

_No instance attributes._

## DashAction

### Attributes

| Attribute | Type | Description                                              |
| --------- | ---- | -------------------------------------------------------- |
| distance  | int  | Steps straight ahead (facing); engine expects range 2–6. |

## ShootPaintballAction

_No instance attributes._

## TurnLeftAction

### Attributes

| Attribute | Type | Description                               |
| --------- | ---- | ----------------------------------------- |
| steps     | int  | Add to direction index mod 6 (default 1). |

## TurnRightAction

### Attributes

| Attribute | Type | Description                                      |
| --------- | ---- | ------------------------------------------------ |
| steps     | int  | Subtract from direction index mod 6 (default 1). |

## FaceDirectionAction

### Attributes

| Attribute | Type                                     | Description      |
| --------- | ---------------------------------------- | ---------------- |
| direction | [HexDirection](hex_grid.md#hexdirection) | Absolute facing. |

## Turn180Action

_No instance attributes._
