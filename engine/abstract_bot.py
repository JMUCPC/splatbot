from engine.actions import Action


class AbstractBot:
    def decide(self) -> Action:
        raise NotImplementedError
