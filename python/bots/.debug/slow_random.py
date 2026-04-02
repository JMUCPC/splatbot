import time
import random
from engine.actions import Actions
from engine.hex_grid import HexDirection


def decide(game_state):
    time.sleep(.5)
    return Actions.move(random.choice(list(HexDirection)))