from engine.abstract_bot import AbstractBot
from engine.actions import Action


class ErrorBot(AbstractBot):
    def decide(self) -> Action:
        raise Exception("Error")
