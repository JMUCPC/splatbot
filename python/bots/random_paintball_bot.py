import random

from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def __init__(self):
        self._move_next = False

    def decide(self, game_state):
        if game_state.me.stun > 0:
            return Actions.skip()
        if not self._move_next:
            self._move_next = True
            return Actions.face_direction(random.choice(list(HexDirection)))
        self._move_next = False
        if game_state.me.paintball_cooldown == 0 and random.random() < 0.25:
            return Actions.shoot_paintball()
        return Actions.move()
