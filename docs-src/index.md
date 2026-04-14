# Quick Start

## What is Splatbot?

Splatbot is a game made for programmers, where players compete to color the most number of tiles in a given time frame by creating, well... **splatbots!** The game is divided up into a series of turns, also referred to as _ticks_. Each tick, the splatbots will be prompted to make a decision about what action they would like to perform. Then, the game will apply those actions to the bots.

Example of a tick:

- The game prompts both splatbots to make a decision about what action to perform.
- Splatbot 1 decides it wants to move west.
- Simultaneously, splatbot 2 decides it wants to perform a "splat".
- The game applies both of these actions at the same time.
- The game continues on to the next tick.

Example bots are provided, but it is easy to upload custom bots as well! Simply go to the home page, select the "Choose File" under whichever side the bot should play for. Then press the start button to begin the match!

## How To Write A Bot

A bot is a Python script: define a `class Bot` with `decide(self, game_state)` that returns **one** action each tick. The full walkthrough (template, memory, printing, edge cases) is in **[Writing bots](writing-bots/index.md)**.

<p><a href="../index.html#download-starter-code" class="docs-try-btn docs-try-btn--starter-download">Download starter code</a></p>

### Actions

On each tick, `decide` must return a single action. Interactive demos for each one are on the **[Actions](actions/index.md)** page.

| Action | Description |
| ------ | ----------- |
| [move](actions/index.md#move) | Step one hex forward and paint it. |
| [turn_left](actions/index.md#turn-left) | Turn left 1–5 steps. |
| [turn_right](actions/index.md#turn-right) | Turn right 1–5 steps. |
| [turn_180](actions/index.md#turn-around) | Turn around. |
| [face_direction](actions/index.md#face-direction) | Turn to face a specified direction. |
| [skip](actions/index.md#skip) | Do nothing. |
| [splat](actions/index.md#splat) | Paint all neighboring tiles. |
| [shoot_paintball](actions/index.md#shoot-paintball) | Paint a straight line forward without moving. |
| [dash](actions/index.md#dash) | Move 2–6 hexes forward; paint only the destination. |

### Utils

There are helper functions available to make writing a Bot even easier. They are desccribed in the **[Python API reference](api-docs/index.md)**.

### Reading Game State

The `game_state` passed into `decide` is **read-only**; you change the match only by **returning** an action. Field meanings (and `BotInfo` details) are documented under **[Game State in Writing bots](writing-bots/index.md#game-state)**. Hex layout and coordinates are covered on the **[Hex Grid](hex-grid/index.md)** page.

| Field | Meaning |
| ----- | ------- |
| [game_state.me](writing-bots/index.md#bot-info) | Your [BotInfo](writing-bots/index.md#bot-info) — position, facing, stun, cooldowns. |
| [game_state.opponents](api-docs/utils/splatbot_data_types.md#gamestate) | Other players' [BotInfo](writing-bots/index.md#bot-info), keyed by player id. |
| [game_state.opponent](api-docs/utils/splatbot_data_types.md#gamestate) | The single opponent in 1v1, or None in other modes. |
| [game_state.grid](hex-grid/index.md) | All hexes on the map ([Hex](hex-grid/index.md)); each tile has a controller ([BotInfo](writing-bots/index.md#bot-info) or None). |
| [game_state.turn](api-docs/utils/splatbot_data_types.md#gamestate) | Current turn index. |
| [game_state.max_turns](api-docs/utils/splatbot_data_types.md#gamestate) | Match length. |

For static typing against these shapes, use **[utils.splatbot_data_types](api-docs/utils/splatbot_data_types.md)**. Larger sample bots are in **[Examples](examples/index.md)**.

## Pages

1. **[Quick Start](./index.md)** — For people who don't want to read the entire documentation
2. **[Actions](actions/)** — What each action does, with interactive examples
3. **[Writing bots](writing-bots/)** — An overview of everything that goes into creating a bot
4. **[Examples](examples/)** — Larger bot examples
5. **[Hex Grid](hex-grid/)** — How the game represents the map and hexes
6. **[Debugging](debugging/)** — Tips and tools useful for debugging your bots
