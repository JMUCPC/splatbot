from utils.actions import Actions


class Bot:
    def __init__(self):
        self.count = 0
    
    def decide(self, game_state):
        self.count += 1
        print(self.count)
        raise Exception("This is a test error")