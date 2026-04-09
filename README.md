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

The timeout system supports a two-tier path when `SharedArrayBuffer` is available:
it first signals a soft interrupt, then only hard-terminates the worker if Python
does not stop within the grace window. This requires cross-origin isolation
headers (`Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy`).
This repository includes an `_headers` file with:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: credentialless`

Without those headers, the app falls back to hard termination at timeout.

## Documentation site

The player-facing docs (how to write bots, actions, examples, debugging, glossary) live under **`docs-src/`** as Markdown. The static site under **`docs/`** is **generated** — for example `docs/writing-bots/index.html` comes from `docs-src/writing-bots.md`.

```bash
npm install
npm run docs:build
```

Commit **both** the `.md` sources and the generated `.html` so static hosting does not need Node. Use `npm run docs:watch` to rebuild when files change while editing.

Browse locally at `/docs/` (for example `http://localhost:3000/docs/`).

### Editing the docs (contributors)

- Change **Markdown only** under `docs-src/` (do not hand-edit generated `docs/**/*.html` or those edits will be overwritten on the next build).
- The [Actions](docs/actions/) page includes **interactive hex demos** embedded as HTML in [`docs-src/actions/index.md`](docs-src/actions/index.md). To change demo **behavior**, edit [`js/docs/action-demos.js`](js/docs/action-demos.js), then run `npm run docs:build` again.
- Code fences can include a toolbar label using a `title` attribute in the fence info string:
  - ````md
    ```python title="Minimal bot"
    # your code...
    ```
    ````
  - Keep the language token first (`python`, `js`, etc.) so syntax highlighting still works.

## Writing Bots

Bots are Python scripts that define a `class Bot` with `decide(self, game_state)`:

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def decide(self, game_state):
        # game_state.me.pid       — this bot's player id (1 or 2)
        # game_state.me           — BotInfo for this bot (.position, .facing, .stun, cooldowns)
        # game_state.opponent     — BotInfo for the other bot in 1v1 (None otherwise)
        # game_state.opponents    — dict[int, BotInfo] of all other players
        # game_state.grid         — frozenset of Hex tiles; each has .controller (BotInfo or None)
        # game_state.turn         — current turn number
        # game_state.max_turns    — total turns in the match
        # Also: Actions.skip(), Actions.splat(), turning helpers, Actions.dash(distance), Actions.shoot_paintball()
        me = game_state.me
        if me.facing != HexDirection.E:
            return Actions.face_direction(HexDirection.E)
        return Actions.move()
```

`Bot()` is created once when your script loads in the worker; use `self` to keep state between turns.

Available imports inside the sandbox: `utils.hex_grid` and `utils.actions`.

## Settings

- Click **SETTINGS** in the top bar to edit runtime game/render settings.
- Settings are persisted per browser via `localStorage`.
- `js/config.js` holds the default values (including splat/dash/paintball stun and cooldown; editable in **SETTINGS**).
- Applying settings resets the current match.

## License

**Splatbot** © 2026 by Nate and Layla is licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). See the [`LICENSE`](LICENSE) file in this repository.
