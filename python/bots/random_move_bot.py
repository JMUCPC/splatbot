"""Random walk: alternate facing a random direction, then stepping forward once."""

import random

from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def __init__(self):
        # False → this turn we pick a new facing; True → we move one hex in that facing.
        self._next_step_is_move = False

    def decide(self, game_state):
        player = game_state.me
        if player.stun > 0:
            return Actions.skip()

        if not self._next_step_is_move:
            self._next_step_is_move = True
            return Actions.face_direction(random.choice(list(HexDirection)))

        self._next_step_is_move = False
        return Actions.move()
