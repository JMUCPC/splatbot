from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def decide(self, game_state):
        """Move in a straight line east across the grid."""
        return Actions.move(HexDirection.E)
