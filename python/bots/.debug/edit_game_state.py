from utils.actions import Actions

class Bot: 
    def decide(self, game_state):
        for hex in game_state.grid:
            hex.controller = game_state.me
        return Actions.skip()
