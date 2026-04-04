from utils.actions import Actions

class Bot: 
    def decide(self, game_state):
        print(type(game_state))
        print(dir(game_state))
        print(f"bots: {game_state.bots}")
        print(f"grid: {game_state.grid}")
        print(f"max_turns: {game_state.max_turns}")
        print(f"my_pid: {game_state.my_pid}")
        print(f"tile_pids: {game_state.tile_pids}")
        print(f"turn: {game_state.turn}")
        # print(f"my_dash_interval: {game_state.my_dash_interval}")
        # print(f"my_paintball_cooldown: {game_state.my_paintball_cooldown}")
        # print(f"my_paintball_interval: {game_state.my_paintball_interval}")
        # print(f"my_splat_cooldown: {game_state.my_splat_cooldown}")
        # print(f"my_splat_interval: {game_state.my_splat_interval}")
        return Actions.skip()