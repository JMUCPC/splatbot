# A template for legal bot actions
from utils.actions import Actions

# Hex grid helpers (construct HexUtils each turn with game_state)
from utils.hex_grid import HexUtils

# Optional typing references for editor hints
from utils.splatbot_data_types import GameState

# Used in decision-making for this bot. All Python stdlib imports should be available
import random


class Bot:
    def __init__(self):
        """Initialize bot state here (called once at the start of the match)."""
        # Optional Strategy: use instance variables to store data between turns
        self.persistent_data = None

    def decide(self, game_state: GameState):
        """Quick Start Guide:
        * return an action every time this method is called to apply it to the bot
        * Optionally use game_state and HexUtils(game_state) for grid helpers
        * Optionally use instance variables (self.) to remember what's happening
        
        This bot is functionally identical to the game's default random bot.
        """
        # use the game_state argument to see everything happening in the game
        player = game_state.me

        # Skip this turn if stunned
        if player.stun:
            return Actions.skip()

        # Optional Strategy: provided utilities for hex grid operations
        hex_utils = HexUtils(game_state)

        # Create a list of actions this bot may take
        action_choices = [Actions.move()]

        # Add an action to turn in a random direction
        turn = Actions.turn_left(random.randint(1, 5))
        action_choices.append(turn)

        # Add splat action if off cooldown
        if player.splat_cooldown == 0:
            splat = Actions.splat()
            action_choices.append(splat)

        # Add dash action if off cooldown
        if player.dash_cooldown == 0:
            distance = random.randint(2, 6)  # can dash anywhere between 2-6 tiles
            dash = Actions.dash(distance)
            action_choices.append(dash)

        # Add paintball action if off cooldown
        if player.paintball_cooldown == 0:
            paintball = Actions.shoot_paintball()
            action_choices.append(paintball)

        # randomly choose one of the valid actions
        chosen_action = random.choice(action_choices)
        return chosen_action
