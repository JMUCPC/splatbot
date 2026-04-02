import time
import random
from utils.actions import Actions
from utils.hex_grid import HexDirection


def decide(game_state):
    time.sleep(.5)
    return Actions.move(random.choice(list(HexDirection)))