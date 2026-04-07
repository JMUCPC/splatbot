from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def decide(self, game_state):
        """Move in a straight line east across the grid."""
        me = game_state.bots[game_state.my_pid]
        if me.facing != HexDirection.E:
            return Actions.face_direction(HexDirection.E)
        return Actions.move()
