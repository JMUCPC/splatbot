/**
 * Axial-coordinate hex grid utilities (pointy-top orientation).
 * Port of engine/hex_grid.py.
 */

export class Hex {
  constructor(q, r) {
    this.q = q;
    this.r = r;
  }
  get key() { return `${this.q},${this.r}`; }
  add(other) { return new Hex(this.q + other.q, this.r + other.r); }
  sub(other) { return new Hex(this.q - other.q, this.r - other.r); }
  equals(other) { return this.q === other.q && this.r === other.r; }
  toString() { return `Hex(${this.q}, ${this.r})`; }
}

export const HexDirection = Object.freeze({
  E: 0, NE: 1, NW: 2, W: 3, SW: 4, SE: 5,
});

export const HEX_DIRECTIONS = Object.freeze([
  new Hex(1, 0),   // E
  new Hex(1, -1),  // NE
  new Hex(0, -1),  // NW
  new Hex(-1, 0),  // W
  new Hex(-1, 1),  // SW
  new Hex(0, 1),   // SE
]);

export function hexNeighbor(h, direction) {
  return h.add(HEX_DIRECTIONS[((direction % 6) + 6) % 6]);
}

export function hexDistance(a, b) {
  const d = a.sub(b);
  return (Math.abs(d.q) + Math.abs(d.q + d.r) + Math.abs(d.r)) / 2;
}

/** All hexes whose axial distance from the origin is <= radius. */
export function generateHexGrid(radius) {
  const grid = new Map();
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (Math.abs(q + r) <= radius) {
        const h = new Hex(q, r);
        grid.set(h.key, h);
      }
    }
  }
  return grid;
}

/** Pointy-top: axial (q,r) -> pixel center. */
export function axialToPixel(q, r, size) {
  const x = size * Math.sqrt(3) * (q + r / 2);
  const y = size * 1.5 * r;
  return [x, y];
}

/** Six corner points for a pointy-top hex (size = center to vertex). */
export function hexCorners(cx, cy, size) {
  const corners = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i - 90;
    corners.push([
      cx + size * Math.cos(angleDeg * Math.PI / 180),
      cy + size * Math.sin(angleDeg * Math.PI / 180),
    ]);
  }
  return corners;
}
