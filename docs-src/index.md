# Splatbot Documentation

## What is Splatbot?

Splatbot is a game made for programmers, where players compete to color the most number of tiles in a given time frame by creating, well... **splatbots!** The game is divided up into a series of turns, also referred to as _ticks_. Each tick, the splatbots will be prompted to make a decision about what action they would like to perform. Then, the game will apply those actions to the bots.

Example of a tick:

- The game prompts both splatbots to make a decision about what action to perform.
- Splatbot 1 decides it wants to move west.
- Simultaneously, splatbot 2 decides it wants to perform a "splat".
- The game applies both of these actions at the same time.
- The game continues on to the next tick.

Example bots are provided, but it is easy to upload custom bots as well! Simply go to the home page, select the "Choose File" under whichever side the bot should play for. Then press the start button to begin the match!

## Pages

1. **[Actions](actions/)** — What each action does, with interactive examples
2. **[Writing bots](writing-bots/)** — An overview of everything that goes into creating a bot
3. **[Examples](examples/)** — Larger bot examples
4. **[Hex Grid](hex-grid/)** — How the game represents the map and hexes
5. **[Debugging](debugging/)** — Tips and tools useful for debugging your bots
