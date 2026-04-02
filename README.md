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

Bots are Python scripts that define a `decide(game_state)` function:

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection

def decide(game_state):
    # game_state.my_pid       — this bot's player id (1 or 2)
    # game_state.grid         — frozenset of Hex tiles
    # game_state.tile_pids    — dict[Hex, int] (0=unpainted, 1/2=player)
    # game_state.bots         — dict[int, BotInfo] with .position, .facing
    # game_state.turn         — current turn number
    # game_state.max_turns    — total turns in the match
    return Actions.move(HexDirection.E)
```

Available imports inside the sandbox: `utils.hex_grid` and `utils.actions`.

## Settings

- Click **SETTINGS** in the top bar to edit runtime game/render settings.
- Settings are persisted per browser via `localStorage`.
- `js/config.js` holds the default values.
- Applying settings resets the current match.
