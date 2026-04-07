from utils.actions import Actions
from utils.hex_grid import *

class Bot:
    def __init__(self):
        self.count = 0
    
    def decide(self, game_state):
        self.count += 1
        print(self.count)
        raise Exception("This is a test error")