from engine.game_state import GameStateSingleton
from engine.abstract_bot import AbstractBot
from frontend.event_console import log_event


def run_turn() -> None:
    """Run a single turn of a match."""
    # TODO: support N bots
    # TODO: limit bot execution time
    # TODO: error handling
    state = GameStateSingleton().current
    for pid, bot_data in state.bots.items():
        try:
            action = bot_data.bot.decide()
            state.apply_action(pid, action)
        except Exception as e:
            log_event(f"Error in bot {pid}: {e}")
