"""Random walk with occasional paintball shot when that cooldown is ready."""

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
        if player.paintball_cooldown == 0 and random.random() < 0.25:
            return Actions.shoot_paintball()
        return Actions.move()
