import random

from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def decide(self, game_state):
        if game_state.my_stun > 0:
            return Actions.skip()
        if random.random() < 0.28 and game_state.my_splat_cooldown == 0:
            return Actions.splat()
        return Actions.move(random.choice(list(HexDirection)))
