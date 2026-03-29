import random

from engine.actions import Actions
from engine.hex_grid import HexDirection
from engine.abstract_bot import AbstractBot
from engine.actions import Action


class RandomBot(AbstractBot):
    def decide(self) -> Action:
        return Actions.move(random.choice(list(HexDirection)))
