# Debugging your bot

Three tools help you see what is going on: **`print()`** (browser **console**), **Step** (advance the match slowly), and the **event log** (in the game UI). They answer different questions.

## Print and the browser console

Your bot runs in **Python** inside a **Web Worker** (via Pyodide). `print("hello")` inside `decide` does **not** appear in the in-game **event log** — it goes to the browser’s **developer console**, where messages from the worker may be grouped under that worker.

**Open the console (typical desktop browsers):**

- **Chrome / Edge:** `F12` or `Ctrl+Shift+I` (Windows/Linux) / `Cmd+Option+I` (macOS), then open the **Console** tab.
- **Firefox:** `F12` or `Ctrl+Shift+K` (Windows/Linux) / `Cmd+Option+K` (macOS) for the console directly.

If you do not see `print` output, check for a dropdown or filter that says **top** vs **worker** / your site URL and select the worker context if needed.

Use prints sparingly — each turn runs many times and too much output can slow things down.

## Step

When the match is **paused**, the **Step** control runs the simulation **one tick at a time** (or several ticks in one click if you change the number next to the menu).

Each **tick**:

1. The internal **turn** counter advances.
2. **Both** bots’ `decide` functions run (with each bot’s snapshot of the game).
3. Collisions and timers update.

So one tick is **not** “one bot only” — both players act for that step. If the match is **running** live and you click **Step**, the game **pauses** first, then steps.

Use Step when you want to watch the board and the **event log** change in sync without the match racing ahead.

## Event log

The **event log** is the panel in the Splatbot UI (you can expand it or open it in a pop-out if your browser allows). It shows messages from the game engine, for example:

- Match **started**, **paused**, **reset**, **over** (with tile counts).
- **Errors** loading a bot, **Python exceptions** inside `decide`, or a bot **hitting the time limit** (the bot **skips** that turn).
- **Blocked** actions: stunned, wrong cooldown, move off the map, invalid dash distance, etc.
- **Collisions** when two bots end up on the same hex (that tile is cleared).

**Important:** A successful **move** or **skip** often writes **nothing** to the log. No new line does **not** mean your bot failed — it may have moved quietly. Use **Step**, **print**, or watch the board to confirm behavior.

See also [Glossary: event log](../glossary/index.md#event-log) and [Writing bots](../writing-bots/index.md).

[← Docs home](../) · [← Back to the game](../../index.html)
