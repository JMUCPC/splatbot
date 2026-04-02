import random
from utils.actions import Actions
from utils.hex_grid import HexDirection


def decide(game_state):
    """ This bot will move in a straight line east across the grid. """
    return Actions.move(HexDirection.E)
