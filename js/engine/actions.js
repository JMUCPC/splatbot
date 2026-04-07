export const ActionType = Object.freeze({
  MOVE: 'move',
  SKIP: 'skip',
  SPLAT: 'splat',
  DASH: 'dash',
  SHOOT_PAINTBALL: 'shoot_paintball',
  TURN_LEFT: 'turn_left',
  TURN_RIGHT: 'turn_right',
  FACE_DIRECTION: 'face_direction',
  TURN_180: 'turn_180',
});

export function MoveAction() {
  return Object.freeze({ type: ActionType.MOVE });
}

export function SkipAction() {
  return Object.freeze({ type: ActionType.SKIP });
}

export function SplatAction() {
  return Object.freeze({ type: ActionType.SPLAT });
}

export function DashAction(distance) {
  return Object.freeze({
    type: ActionType.DASH,
    distance: Math.trunc(Number(distance)),
  });
}

export function ShootPaintballAction() {
  return Object.freeze({ type: ActionType.SHOOT_PAINTBALL });
}

export function TurnLeftAction(steps = 1) {
  return Object.freeze({
    type: ActionType.TURN_LEFT,
    steps: Math.trunc(Number(steps)),
  });
}

export function TurnRightAction(steps = 1) {
  return Object.freeze({
    type: ActionType.TURN_RIGHT,
    steps: Math.trunc(Number(steps)),
  });
}

export function FaceDirectionAction(direction) {
  return Object.freeze({
    type: ActionType.FACE_DIRECTION,
    direction: ((direction % 6) + 6) % 6,
  });
}

export function Turn180Action() {
  return Object.freeze({ type: ActionType.TURN_180 });
}

export const Actions = {
  move() {
    return MoveAction();
  },
  skip() {
    return SkipAction();
  },
  splat() {
    return SplatAction();
  },
  dash(distance) {
    return DashAction(distance);
  },
  shoot_paintball() {
    return ShootPaintballAction();
  },
  turn_left(steps = 1) {
    return TurnLeftAction(steps);
  },
  turn_right(steps = 1) {
    return TurnRightAction(steps);
  },
  face_direction(direction) {
    return FaceDirectionAction(direction);
  },
  turn_180() {
    return Turn180Action();
  },
};
