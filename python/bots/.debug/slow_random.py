import random
import time

from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def __init__(self):
        self._move_next = False

    def decide(self, game_state):
        time.sleep(0.5)
        if game_state.my_stun > 0:
            return Actions.skip()
        if not self._move_next:
            self._move_next = True
            return Actions.face_direction(random.choice(list(HexDirection)))
        self._move_next = False
        return Actions.move()
