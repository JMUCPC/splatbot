from utils.hex_grid import Hex, HexDirection, hex_distance, hex_neighbor, hex_neighbors
from utils.actions import Actions


class Bot:
    def decide(self, game_state):
        mid = Hex(0,0)
        print(f"mid: {mid}")
        print(f"hex_neighbors(mid): {hex_neighbors(mid)}")
        print(f"hex_neighbor(mid, HexDirection.E): {hex_neighbor(mid, HexDirection.E)}")
        print(f"hex_distance(mid, Hex(2,1)): {hex_distance(mid, Hex(2,1))}")
        return Actions.skip()
        