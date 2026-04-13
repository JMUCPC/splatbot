"""Random walk with occasional splat when the splat cooldown is ready."""

import random

from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def __init__(self):
        self._next_step_is_move = False

    def decide(self, game_state):
        player = game_state.me
        if player.stun > 0:
            return Actions.skip()

        if not self._next_step_is_move:
            self._next_step_is_move = True
            return Actions.face_direction(random.choice(list(HexDirection)))

        self._next_step_is_move = False
        if random.random() < 0.28 and player.splat_cooldown == 0:
            return Actions.splat()
        return Actions.move()
