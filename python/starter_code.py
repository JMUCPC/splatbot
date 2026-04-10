# A template for legal bot actions
from utils.actions import Actions

# Hex grid helpers (construct HexUtils each turn with game_state)
from utils.hex_grid import HexUtils

# Optional typing references for editor hints
from utils.splatbot_data_types import GameState


class Bot:
    def __init__(self):
        """ Initialize bot state here (called once at the start of the match)."""
        self.persistent_data = None # Optional: use this to store data between turns

    def decide(self, game_state: GameState):
        """ Quick Start Guide:
            * return an action every time this method is called to apply it to the bot
            * Optionally use game_state and HexUtils(game_state) for grid helpers
            * Optionally use instance variables (self.) to remember what's happenin
        """
        hex_utils = HexUtils(game_state) # Optional: provided utilities for hex grid operations
        return Actions.move() # Example: move forwards
