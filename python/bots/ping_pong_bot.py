"""Ping-pong east/west using bot-managed direction state."""

from utils.actions import Actions
from utils.hex_grid import HexDirection, hex_neighbor


class Bot:
    def __init__(self):
        self._going_east = True

    def decide(self, game_state):
        me = game_state.bots[game_state.my_pid]
        d = HexDirection.E if self._going_east else HexDirection.W
        nbr = hex_neighbor(me.position, d)
        if nbr not in game_state.grid:
            self._going_east = not self._going_east
            d = HexDirection.E if self._going_east else HexDirection.W
        return Actions.move(d)
