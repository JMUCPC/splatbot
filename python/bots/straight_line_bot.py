import random
from engine.actions import Actions
from engine.hex_grid import HexDirection


def decide(game_state):
    return Actions.move(HexDirection.E)
