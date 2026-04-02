import random
from utils.actions import Actions
from utils.hex_grid import HexDirection


def decide(game_state):
    return Actions.move(random.choice(list(HexDirection)))
