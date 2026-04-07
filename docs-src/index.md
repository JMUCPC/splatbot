# Splatbot documentation

## What is Splatbot?

Splatbot is a game made for programmers, where players compete to color the most number of tiles in a given time frame  by creating, well... **splatbots!** The game is divided up into a series of turns, also referred to as *ticks*. Each tick, the splatbots will be prompted to make a decision about what action they would like to perform this tick. Then, the game will apply those actions to the bots. 

Example of a tick:
- The game prompts both splatbots to make a decision about what action to perform.
- Splatbot 1 decides it wants to move west.
- Simultaneously, splatbot 2 decides it wants to perform a "splat".
- The game applies both of these actions at the same time.
- The game continues on to the next tick.

Example bots are provided, but it is easy to upload custom bots as well! Simply go to the home page, select the "Upload File" under whichever side the bot should play for. Then press the start button to begin the match!

## Pages

1. **[Writing bots](writing-bots/)** — What a bot is, a minimal template, and how to read `game_state`.
2. **[Actions](actions/)** — What each action does (move, turning, skip, splat, dash, paintball), with small interactive examples.
3. **[Utilities](utilities/)** — Provided functions to ease development of Splatbots.
4. **[Examples](examples/)** — Longer example bots with step-by-step explanations.
5. **[Debugging](debugging/)** — `print` output, the step button, and the event log.
6. **[Glossary](glossary/)** — Short definitions of terms used across these docs.

Stuck on vocabulary? Open the [glossary](glossary/) or jump from linked terms on other pages.

[← Back to the game](../index.html)
