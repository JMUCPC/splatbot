from utils.hex_grid import Hex, HexDirection, HexUtils
from utils.actions import Actions


class Bot:
    def decide(self, game_state):
        hx = HexUtils(game_state)
        mid = Hex(0, 0)
        print(f"mid: {mid}")
        print(f"hex_neighbors(mid): {hx.hex_neighbors(mid)}")
        print(f"hex_neighbor(mid, HexDirection.E): {hx.hex_neighbor(mid, HexDirection.E)}")
        print(f"hex_distance(mid, Hex(2,1)): {hx.hex_distance(mid, Hex(2, 1))}")
        return Actions.skip()
        