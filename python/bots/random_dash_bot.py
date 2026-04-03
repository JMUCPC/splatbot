import random

from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def decide(self, game_state):
        if game_state.my_dash_interval == 0 and random.random() < 0.25:
            direction = random.choice(list(HexDirection))
            distance = random.randint(2, 6)
            return Actions.dash(direction, distance)
        return Actions.move(random.choice(list(HexDirection)))
