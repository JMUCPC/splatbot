from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def decide(self, game_state):
        print("This bot is printing info, hoping to debug itself")
        return Actions.skip()
