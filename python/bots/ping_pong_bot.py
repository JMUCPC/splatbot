"""Ping-pong: move forward until the map edge, then turn 180° and repeat."""

from utils.actions import Actions
from utils.hex_grid import HexUtils


class Bot:
    def decide(self, game_state):
        me = game_state.me
        hx = HexUtils(game_state)
        forward = hx.hex_neighbor(me.position, me.facing)
        if forward not in game_state.grid:
            return Actions.turn_180()
        return Actions.move()
