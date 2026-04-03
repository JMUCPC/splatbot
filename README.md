# splatbot

A two-player hex-grid programming game that runs entirely in the browser.
Players write Python bot scripts that compete to paint the most tiles.

## Running Locally

Serve the project root with any static file server:

```bash
npx serve .
```

Then open http://localhost:3000 (or whichever port your server uses).

The first load downloads Pyodide (~10 MB, cached by the browser afterward) to run
Python bot code client-side in Web Workers.

## Documentation site

Authoring content lives under `docs/src/` as Markdown. Generated HTML is written next to it under `docs/` (for example `docs/writing-bots/index.html`).

```bash
npm install
npm run docs:build
```

Commit **both** the `.md` sources and the generated `.html` so static hosting does not need Node. Use `npm run docs:watch` to rebuild when files change while editing.

Browse locally at `/docs/` (for example `http://localhost:3000/docs/`).

## Writing Bots

Bots are Python scripts that define a `class Bot` with `decide(self, game_state)`:

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def decide(self, game_state):
        # game_state.my_pid       — this bot's player id (1 or 2)
        # game_state.grid         — frozenset of Hex tiles
        # game_state.tile_pids    — dict[Hex, int] (0=unpainted, 1/2=player)
        # game_state.bots         — dict[int, BotInfo] with .position, .facing, .splat_cooldown, .splat_interval, .dash_interval
        # game_state.my_splat_cooldown — turns left before move/splat (after splat)
        # game_state.my_splat_interval — turns until splat is allowed again (one splat every 10 turns)
        # game_state.my_dash_interval — turns until dash is allowed again (one dash every 7 turns)
        # game_state.turn         — current turn number
        # game_state.max_turns    — total turns in the match
        # Also: Actions.skip(), Actions.splat(), Actions.dash(direction, distance) — dash up to 2-6 tiles; paints only where you land (clamped to map edge if needed)
        return Actions.move(HexDirection.E)
```

`Bot()` is created once when your script loads in the worker; use `self` to keep state between turns.

Available imports inside the sandbox: `utils.hex_grid` and `utils.actions`.

## Settings

- Click **SETTINGS** in the top bar to edit runtime game/render settings.
- Settings are persisted per browser via `localStorage`.
- `js/config.js` holds the default values (including splat/dash cooldown and interval; editable in **SETTINGS**).
- Applying settings resets the current match.
