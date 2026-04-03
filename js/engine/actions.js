export const ActionType = Object.freeze({
  MOVE: 'move',
  SKIP: 'skip',
  SPLAT: 'splat',
});

export function MoveAction(direction) {
  return Object.freeze({ type: ActionType.MOVE, direction });
}

export function SkipAction() {
  return Object.freeze({ type: ActionType.SKIP });
}

export function SplatAction() {
  return Object.freeze({ type: ActionType.SPLAT });
}

export const Actions = {
  move(direction) {
    return MoveAction(((direction % 6) + 6) % 6);
  },
  skip() {
    return SkipAction();
  },
  splat() {
    return SplatAction();
  },
};
