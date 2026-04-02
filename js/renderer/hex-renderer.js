/**
 * Converts a GameState snapshot to an SVG string.
 * Port of frontend/hex_renderer.py.
 */
import { HEX_DIRECTIONS, axialToPixel, hexCorners } from '../engine/hex-grid.js';
import config from '../config.js';

function facingAngleRad(facing) {
  const d = HEX_DIRECTIONS[((facing % 6) + 6) % 6];
  const [vx, vy] = axialToPixel(d.q, d.r, 1.0);
  return Math.atan2(vy, vx);
}

function arrowTrianglePoints(cx, cy, a0, hexSize) {
  const fx = Math.cos(a0), fy = Math.sin(a0);
  const px = -fy, py = fx;
  const baseBack = hexSize * 0.55;
  const tipForward = hexSize * 0.6;
  const halfBase = hexSize * 0.5;
  return [
    [cx + tipForward * fx, cy + tipForward * fy],
    [cx - baseBack * fx + halfBase * px, cy - baseBack * fy + halfBase * py],
    [cx - baseBack * fx - halfBase * px, cy - baseBack * fy - halfBase * py],
  ];
}

export function renderHexGrid(state, hexSize) {
  hexSize = hexSize ?? 26;

  const tileFill = {
    0: config.TILE_NONE_COLOR,
    1: config.PLAYER_TILE_COLORS[1],
    2: config.PLAYER_TILE_COLORS[2],
  };
  const tileStroke = { 0: config.TILE_STROKE_COLOR, 1: '#8b2e06', 2: '#065066' };
  const botFill = config.PLAYER_BOT_COLORS;
  const botBright = config.PLAYER_BRIGHT_COLORS;
  const padding = hexSize * 1.8;

  const centers = new Map();
  for (const h of state.grid.values()) {
    centers.set(h.key, axialToPixel(h.q, h.r, hexSize));
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [cx, cy] of centers.values()) {
    if (cx < minX) minX = cx;
    if (cx > maxX) maxX = cx;
    if (cy < minY) minY = cy;
    if (cy > maxY) maxY = cy;
  }
  const halfW = hexSize * Math.sqrt(3) / 2;
  const halfH = hexSize;
  minX -= halfW + padding;
  maxX += halfW + padding;
  minY -= halfH + padding;
  maxY += halfH + padding;
  const W = maxX - minX;
  const H = maxY - minY;
  const ox = -minX, oy = -minY;

  const botHexes = new Map();
  const occupied = new Set();
  for (const bot of state.bots.values()) {
    botHexes.set(bot.pid, bot.position.key);
    occupied.add(bot.position.key);
  }

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" width="100%" style="display:block;background:${config.CANVAS_BG}">`,
  ];

  // Hex tiles
  for (const h of state.grid.values()) {
    const [rawCx, rawCy] = centers.get(h.key);
    const cx = rawCx + ox, cy = rawCy + oy;
    const paintPid = state.tilePids.get(h.key) || 0;
    const isOccupied = occupied.has(h.key);

    let fill, stroke, sw;
    if (isOccupied) {
      let pid = 0;
      for (const [p, posKey] of botHexes) {
        if (posKey === h.key) { pid = p; break; }
      }
      fill = botBright[pid];
      stroke = tileStroke[paintPid];
      sw = 2.0;
    } else {
      fill = tileFill[paintPid];
      stroke = tileStroke[paintPid];
      sw = 1.2;
    }

    const corners = hexCorners(cx, cy, hexSize - 0.8);
    const pts = corners.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
    parts.push(`<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`);
  }

  // Bot markers
  const display = config.BOT_DISPLAY_TYPE;
  for (const bot of state.bots.values()) {
    if (!centers.has(bot.position.key)) continue;
    const [rawCx, rawCy] = centers.get(bot.position.key);
    const cx = rawCx + ox, cy = rawCy + oy;
    const botColor = botFill[bot.pid];

    if (display === 'triangles') {
      const a0 = facingAngleRad(bot.facing);
      const triPts = arrowTrianglePoints(cx, cy, a0, hexSize);
      const ptsStr = triPts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
      parts.push(
        `<polygon points="${ptsStr}" fill="none" stroke="white" stroke-width="2.5" opacity="0.6" stroke-linejoin="round"/>`,
      );
      parts.push(
        `<polygon points="${ptsStr}" fill="${botColor}" stroke="rgba(0,0,0,0.35)" stroke-width="1" stroke-linejoin="round"/>`,
      );
    } else {
      const rOuter = hexSize * 0.40;
      const rInner = hexSize * 0.20;
      parts.push(`<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(rOuter + 2.5).toFixed(2)}" fill="none" stroke="white" stroke-width="2" opacity="0.6"/>`);
      parts.push(`<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${rOuter.toFixed(2)}" fill="${botColor}"/>`);
      parts.push(`<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${rInner.toFixed(2)}" fill="rgba(0,0,0,0.3)"/>`);
    }

    const fs = Math.max(9, Math.floor(hexSize * 0.36));
    parts.push(
      `<text x="${cx.toFixed(2)}" y="${cy.toFixed(2)}" text-anchor="middle" dominant-baseline="central" fill="white" font-size="${fs}" font-weight="700" font-family="monospace" opacity="0.9">${bot.pid}</text>`,
    );
  }

  parts.push('</svg>');
  return parts.join('\n');
}
