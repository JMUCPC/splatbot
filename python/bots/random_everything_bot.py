"""Pick splat, dash, or paintball at random when each cooldown allows; otherwise move."""

import random

from utils.actions import Actions


class Bot:
    def decide(self, game_state):
        # Skip if stunned
        player = game_state.me
        if player.stun > 0:
            return Actions.skip()

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
            distance = random.randint(2, 6) # can dash anywhere between 2-6 tiles
            dash = Actions.dash(distance)
            action_choices.append(dash)

        # Add paintball action if off cooldown
        if player.paintball_cooldown == 0:
            paintball = Actions.shoot_paintball()
            action_choices.append(paintball)

        # randomly choose one of the valid actions
        chosen_action = random.choice(action_choices)
        return chosen_action
