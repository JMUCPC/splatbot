from utils.actions import Actions

class Bot: 
    def decide(self, game_state):
        print(type(game_state))
        print(dir(game_state))
        print(f"pid: {game_state.pid}")
        print(f"me: {game_state.me}")
        print(f"opponents: {game_state.opponents}")
        print(f"opponent: {game_state.opponent}")
        print(f"grid: {game_state.grid}")
        print(f"max_turns: {game_state.max_turns}")
        print(f"turn: {game_state.turn}")
        return Actions.skip()
