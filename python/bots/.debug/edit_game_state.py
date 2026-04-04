from utils.actions import Actions

class Bot: 
    def decide(self, game_state):
        for hex in game_state.grid:
            game_state.tile_pids[hex] = game_state.my_pid
        return Actions.skip()