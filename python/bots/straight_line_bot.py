from utils.actions import Actions


class Bot:
    def decide(self, game_state):
        """Move in a straight line in the initial facing direction."""
        return Actions.move()
