from engine.abstract_bot import AbstractBot
from engine.actions import Action, Actions
from engine.hex_grid import HexDirection


class StraightLineBot(AbstractBot):
    def decide(self) -> Action:
        return Actions.move(HexDirection.E)