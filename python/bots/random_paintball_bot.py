import random

from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def decide(self, game_state):
        if game_state.my_splat_cooldown > 0 or game_state.my_paintball_cooldown > 0:
            return Actions.skip()
        if game_state.my_paintball_interval == 0 and random.random() < 0.25:
            return Actions.shoot_paintball(random.choice(list(HexDirection)))
        return Actions.move(random.choice(list(HexDirection)))
