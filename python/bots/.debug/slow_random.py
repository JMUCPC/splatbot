import time
import random
from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def decide(self, game_state):
        time.sleep(.5)
        return Actions.move(random.choice(list(HexDirection)))
