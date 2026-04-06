# Splatbot documentation

Welcome. These pages help you **write Python bots** for Splatbot: a two-player game on a hex map where bots compete to paint tiles.

You paste your code into the game, press **START**, and your bot’s `decide` function runs once per turn. You do **not** need to know how the website is built — only a little Python.

## Suggested order

1. **[Writing bots](writing-bots/)** — What a bot is, a minimal template, and how to read `game_state`.
2. **[Actions](actions/)** — What each move does (move, skip, splat, dash, paintball), with small interactive examples.
3. **[Utilities](utilities/)** — Directions (`HexDirection`) and the hex helpers you can import.
4. **[Examples](examples/)** — Longer example bots with step-by-step explanations.
5. **[Debugging](debugging/)** — `print` output, the **Step** button, and the event log.
6. **[Glossary](glossary/)** — Short definitions of terms used across these docs.

Stuck on vocabulary? Open the [glossary](glossary/) or jump from linked terms on other pages.

Repository contributors: to **edit or build** this documentation site from source, see **`README.md`** at the root of the repo (Markdown under `docs-src/`, `npm run docs:build`, commit generated HTML).

[← Back to the game](../index.html)
