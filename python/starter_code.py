# A template for legal bot actions
from utils.actions import Actions

# Helper functions for the hex grid
from utils.hex_grid import *


class Bot:
    def __init__(self):
        # Initialize bot state here (called once per match).
        pass

    def decide(self, game_state):
        """ Quick Start Guide:
            * return an action every time this method is called to apply it to the bot
            * Optionally use game_state argument can be used to see what's happenin
            * Optionally use instance variables (self.) to remember what's happenin
        """
        return Actions.move() # Example: move forwards at all times
