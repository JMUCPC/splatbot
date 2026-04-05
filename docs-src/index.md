# Splatbot documentation

Splatbot is a two-player hex-grid game that runs in the browser. Bots are written in **Python** and run in Web Workers via **Pyodide**. This site explains how to author bots and how the project is structured.

## In this site

- **[Writing bots](writing-bots/)** — `Bot.decide`, game state, `move` / `skip` / `splat`, and examples.
- **[Actions](actions/)** — What each action does.
- **[Utilities](utilities/)** — `HexDirection` and other helpers exposed to bots.

## Editing these pages

Sources live in `docs-src/` as Markdown. After you change them, run **`npm run docs:build`** and commit **both** the `.md` sources and the generated HTML under `docs/` (static hosting does not run Node).

The [Actions](actions/) page embeds small interactive hex demos as HTML inside `docs-src/actions/index.md`. Edit that Markdown (or `js/docs/action-demos.js` for behavior), then rebuild — do not hand-edit the generated `docs/actions/index.html` or your changes will be lost on the next build.

[← Back to the game](../index.html)
