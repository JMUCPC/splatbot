"""Ping-pong east/west along the q-axis using facing + ``face_direction`` at edges."""

from utils.actions import Actions
from utils.hex_grid import HexDirection, hex_neighbor


class Bot:
    def __init__(self):
        self._going_east = True

    def decide(self, game_state):
        me = game_state.me
        d = HexDirection.E if self._going_east else HexDirection.W
        nbr = hex_neighbor(me.position, d)
        if nbr not in game_state.grid:
            self._going_east = not self._going_east
            d = HexDirection.E if self._going_east else HexDirection.W
        if me.facing != d:
            return Actions.face_direction(d)
        return Actions.move()
