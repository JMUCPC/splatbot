# splatbot_data_types

Data types used to communicate game information to the bots. These are meant to be used for type hinting in code editors, as the game runner contstructs instances of these data classes on the fly.

**Exports:** BotInfo, GameState

## BotInfo

Immutable dataclass representing all the info associated with some bot.

### Attributes

| Attribute          | Type                                     | Description                                               |
| ------------------ | ---------------------------------------- | --------------------------------------------------------- |
| pid                | int                                      | Player id.                                                |
| position           | [Hex](hex_grid.md#hex)                   | Hex tile the bot is occupying.                            |
| facing             | [HexDirection](hex_grid.md#hexdirection) | Direction the bot is facing.                              |
| stun               | int                                      | Number of turns left stunned.                             |
| splat_cooldown     | int                                      | Number of turns until the bot can splat again.            |
| dash_cooldown      | int                                      | Number of turns until the bot can dash again.             |
| paintball_cooldown | int                                      | Number of turns until the bot can fire a paintball again. |

### Methods

| Method            | Returns | Description                                                                       |
| ----------------- | ------- | --------------------------------------------------------------------------------- |
| \_\_eq\_\_(other) | bool    | Do the two BotInfo classes being compared have identical pids (only pid is used)? |
| \_\_hash\_\_()    | int     | Hash (based on pid).                                                              |

## GameState

Immutable dataclass representing all the info associated with the state of the game.

### Attributes

| Attribute | Type                                | Description                                          |
| --------- | ----------------------------------- | ---------------------------------------------------- |
| me        | [BotInfo](#botinfo)                 | Your bot.                                            |
| opponents | MappingProxyType[int, BotInfo]      | Other players by id; values are [BotInfo](#botinfo). |
| opponent  | [BotInfo](#botinfo) or None         | Single-opponent shortcut - **used in 1v1**.          |
| grid      | frozenset of [Hex](hex_grid.md#hex) | Map tiles.                                           |
| turn      | int                                 | Current turn.                                        |
| max_turns | int                                 | Turn limit.                                          |

### Methods

| Method                | Returns                                | Description              |
| --------------------- | -------------------------------------- | ------------------------ |
| get_grid_as_2D_list() | list of list of [Hex](hex_grid.md#hex) | Rows by r, columns by q. |
