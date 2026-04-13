"""Walk forward every turn in the starting facing direction (no turns)."""

from utils.actions import Actions


class Bot:
    def decide(self, game_state):
        return Actions.move()
