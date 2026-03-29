import time
from engine.abstract_bot import AbstractBot
from engine.actions import Action


class TimeoutBot(AbstractBot):
    def decide(self) -> Action:
        while True:
            x = 1 + 1
            # time.sleep(0.1) # makes loop way more breakable by timeout, shouldn't rely on this for proper timeout handling
