export const ActionType = Object.freeze({
  MOVE: 'move',
  SKIP: 'skip',
  SPLAT: 'splat',
  DASH: 'dash',
  SHOOT_PAINTBALL: 'shoot_paintball',
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

export function DashAction(direction, distance) {
  return Object.freeze({
    type: ActionType.DASH,
    direction: ((direction % 6) + 6) % 6,
    distance: Math.trunc(Number(distance)),
  });
}

export function ShootPaintballAction(direction) {
  return Object.freeze({
    type: ActionType.SHOOT_PAINTBALL,
    direction: ((direction % 6) + 6) % 6,
  });
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
  dash(direction, distance) {
    return DashAction(((direction % 6) + 6) % 6, distance);
  },
  shoot_paintball(direction) {
    return ShootPaintballAction(((direction % 6) + 6) % 6);
  },
};
