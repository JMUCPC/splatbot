from __future__ import annotations

import asyncio
import multiprocessing
import multiprocessing.context
import queue
import time
from typing import Optional

import config
from engine.abstract_bot import AbstractBot
from engine.actions import Action, MoveAction, SkipAction
from engine.game_state import GameStateSingleton
from frontend.event_console import log_event

_MP_CTX: multiprocessing.context.SpawnContext = multiprocessing.get_context("spawn")


class BotDecideTimeout(Exception):
    """Raised when bot.decide() exceeds config.TIMEOUT."""


# ---------------------------------------------------------------------------
# Child-process entry point (persistent — loops until poison-pilled or killed)
# ---------------------------------------------------------------------------

def _persistent_worker(
    task_q: multiprocessing.Queue,  # type: ignore[type-arg]
    result_q: multiprocessing.Queue,  # type: ignore[type-arg]
) -> None:
    """Receives a bot object each turn, calls decide(), sends back the result.

    Runs indefinitely until it receives None (shutdown) or is SIGKILL'd.
    The bot is re-sent each turn so the parent's mutated state is always used.
    """
    while True:
        bot = task_q.get()
        if bot is None:
            return  # clean shutdown
        try:
            result_q.put(("ok", bot.decide()))
        except BaseException as exc:  # noqa: BLE001
            result_q.put(("err", exc))


# ---------------------------------------------------------------------------
# Per-bot runner — owns exactly one worker process for the game's lifetime
# ---------------------------------------------------------------------------

class BotRunner:
    """Wraps a bot with a persistent worker process.

    Spawn cost is paid once at construction, not on every turn.
    If a bot times out and is killed, the runner automatically respawns
    a fresh worker so later turns are not affected.
    """

    def __init__(self, bot: AbstractBot) -> None:
        self._bot = bot
        self._task_q: multiprocessing.Queue = _MP_CTX.Queue()   # type: ignore[type-arg]
        self._result_q: multiprocessing.Queue = _MP_CTX.Queue() # type: ignore[type-arg]
        self._proc: multiprocessing.Process = self._spawn()

    def _spawn(self) -> multiprocessing.Process:
        p = _MP_CTX.Process(
            target=_persistent_worker,
            args=(self._task_q, self._result_q),
            daemon=True,
        )
        p.start()
        return p

    def decide(self) -> Action:
        """Send current bot state to the worker and wait up to config.TIMEOUT.

        Blocking — call via asyncio.to_thread to avoid stalling the event loop.
        """
        # Re-send the bot each turn so the worker sees any state mutations
        # (e.g. internal counters, learned data) applied since last turn.
        self._task_q.put(self._bot)

        try:
            status, value = self._result_q.get(timeout=config.TIMEOUT)
        except queue.Empty:
            # True timeout — nuke the worker and respawn for next turn.
            self._proc.kill()
            self._proc.join()
            # Drain any stale result that arrived in the race window.
            try:
                self._result_q.get_nowait()
            except queue.Empty:
                pass
            self._proc = self._spawn()
            raise BotDecideTimeout

        # Process crashed (segfault, OOM) without enqueuing a result.
        # result_q.get() would have raised Empty above if the queue was empty,
        # so reaching here means we have a real status/value pair.
        if status == "err":
            raise value  # re-raise original exception from child

        if isinstance(value, (MoveAction, SkipAction)):
            return value

        raise TypeError(f"decide() must return Action, got {type(value).__name__}")

    def shutdown(self) -> None:
        """Graceful shutdown — send poison pill, SIGKILL if it lingers."""
        try:
            self._task_q.put(None)
            self._proc.join(timeout=2)
        finally:
            if self._proc.is_alive():
                self._proc.kill()
                self._proc.join()


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _timeout_message(pid: int) -> str:
    return f"Bot {pid} exceeded time limit ({config.TIMEOUT}s) — skip"


def _handle_bot_turn(pid: int, runner: BotRunner) -> None:
    state = GameStateSingleton().current
    try:
        action = runner.decide()
        state.apply_action(pid, action)
    except BotDecideTimeout:
        log_event(_timeout_message(pid))
        state.apply_action(pid, SkipAction())
    except Exception as e:
        log_event(f"Error in bot {pid}: {e}")


# ---------------------------------------------------------------------------
# Public API — callers create BotRunners once, reuse them across turns
# ---------------------------------------------------------------------------

def run_turn(runners: dict[int, BotRunner]) -> None:
    """Synchronous turn runner for CLI / tests."""
    for pid, runner in runners.items():
        _handle_bot_turn(pid, runner)


async def run_turn_async(runners: dict[int, BotRunner]) -> None:
    """Async turn runner — never blocks the NiceGUI event loop."""
    for pid, runner in runners.items():
        await asyncio.to_thread(_handle_bot_turn, pid, runner)