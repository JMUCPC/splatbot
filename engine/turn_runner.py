from engine.game_state import GameStateSingleton
from engine.abstract_bot import AbstractBot


def run_turn() -> None:
    """Run a single turn of a match."""
    # TODO: support N bots
    # TODO: limit bot execution time
    # TODO: error handling
    state = GameStateSingleton().current
    bot1 = state.bots[1].bot
    bot2 = state.bots[2].bot
    action1 = bot1.decide()
    action2 = bot2.decide()
    state.apply_action(1, action1)
    state.apply_action(2, action2)
