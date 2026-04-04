# Architecture overview

Splatbot runs **entirely in the browser**:

1. **UI** — HTML/CSS and modules under `js/ui/` drive controls, settings, and the event log.
2. **Rendering** — `js/renderer/` builds an **SVG** hex grid from `js/engine/` game state.
3. **Game logic** — `js/engine/` is authoritative for turns, tiles, and actions; Python bots run in workers via **Pyodide**.

Python bot code is loaded from bundled files under `python/` and executed in a sandboxed worker so both players’ scripts stay isolated.

For how to author bots, see **[Writing bots](../writing-bots/)**.
