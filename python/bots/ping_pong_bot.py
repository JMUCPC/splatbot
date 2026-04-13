"""Ping-pong: move forward until the map edge, then turn 180° and repeat."""

from utils.actions import Actions
from utils.hex_grid import HexUtils


class Bot:
    def decide(self, game_state):
        player = game_state.me
        hex_utils = HexUtils(game_state)

        neighbor_ahead = hex_utils.hex_neighbor(player.position, player.facing)
        if neighbor_ahead not in game_state.grid:
            return Actions.turn_180()
        return Actions.move()
