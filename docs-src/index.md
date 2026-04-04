# Splatbot documentation

Splatbot is a two-player hex-grid game that runs in the browser. Bots are written in **Python** and run in Web Workers via **Pyodide**. This site explains how to author bots and how the project is structured.

## In this site

- **[Writing bots](writing-bots/)** — `Bot.decide`, game state, `move` / `skip` / `splat`, and examples.
- **[Actions](actions/)** — What each action does.
- **[Utilities](utilities/)** — `HexDirection` and other helpers exposed to bots.
- **[Architecture overview](architecture/overview/)** — UI, engine, renderer, and workers.

## Editing these pages

Sources live in `docs-src/` as Markdown. After you change them, run **`npm run docs:build`** and commit **both** the `.md` sources and the generated HTML under `docs/` (static hosting does not run Node).

[← Back to the game](../index.html)
