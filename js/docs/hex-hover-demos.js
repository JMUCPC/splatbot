import { axialToPixel, generateHexGrid, hexCorners } from '../engine/hex-grid.js';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildGeometry(radius, hexSize) {
  const hexes = [...generateHexGrid(radius).values()];
  const centers = new Map();
  for (const h of hexes) {
    centers.set(h.key, axialToPixel(h.q, h.r, hexSize));
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [cx, cy] of centers.values()) {
    if (cx < minX) minX = cx;
    if (cx > maxX) maxX = cx;
    if (cy < minY) minY = cy;
    if (cy > maxY) maxY = cy;
  }
  const padX = hexSize * 1.2;
  const padY = hexSize * 1.2;
  minX -= padX;
  maxX += padX;
  minY -= padY;
  maxY += padY;

  return {
    hexes,
    centers,
    minX,
    minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function axisPath(geo, predicate, sortFn) {
  const points = geo.hexes
    .filter(predicate)
    .sort(sortFn)
    .map((h) => geo.centers.get(h.key));
  if (points.length < 2) return '';
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
}

function renderMap(geo, hoveredKey, labelMode) {
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${geo.minX.toFixed(2)} ${geo.minY.toFixed(2)} ${geo.width.toFixed(2)} ${geo.height.toFixed(2)}" preserveAspectRatio="xMidYMid meet" width="100%" height="100%" style="display:block;background:#070d1a">`,
  ];

  let q0 = null;
  let r0 = null;
  let s0 = null;
  const includeS = labelMode === 'qrs';
  if (hoveredKey) {
    const [qStr, rStr] = hoveredKey.split(',');
    q0 = Number.parseInt(qStr, 10);
    r0 = Number.parseInt(rStr, 10);
    s0 = -q0 - r0;
    const qAxis = axisPath(geo, (h) => h.q === q0, (a, b) => a.r - b.r);
    const rAxis = axisPath(geo, (h) => h.r === r0, (a, b) => a.q - b.q);
    const sAxis = includeS ? axisPath(geo, (h) => -h.q - h.r === s0, (a, b) => a.q - b.q) : '';
    if (qAxis) parts.push(`<path d="${qAxis}" stroke="#ff6b8a" stroke-width="2.2" opacity="0.95" fill="none" pointer-events="none"/>`);
    if (rAxis) parts.push(`<path d="${rAxis}" stroke="#53d97a" stroke-width="2.2" opacity="0.95" fill="none" pointer-events="none"/>`);
    if (sAxis) parts.push(`<path d="${sAxis}" stroke="#b58dff" stroke-width="2.2" opacity="0.95" fill="none" pointer-events="none"/>`);
  }

  for (const h of geo.hexes) {
    const [cx, cy] = geo.centers.get(h.key);
    const points = hexCorners(cx, cy, 18).map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
    const active = h.key === hoveredKey;
    let fill = '#0f1b2e';
    if (!active && hoveredKey) {
      const onQ = h.q === q0;
      const onR = h.r === r0;
      const onS = includeS && (-h.q - h.r === s0);
      if (onQ) fill = '#2a1621';
      if (onR) fill = '#142a1d';
      if (onS) fill = '#221b35';
      if ((onQ && onR) || (onQ && onS) || (onR && onS)) {
        fill = '#253751';
      }
    }
    if (active) fill = '#173159';
    const stroke = active ? '#00d4ff' : '#2a3f62';
    const s = -h.q - h.r;
    const onQ = hoveredKey ? h.q === q0 : false;
    const onR = hoveredKey ? h.r === r0 : false;
    const onS = includeS && hoveredKey ? (-h.q - h.r) === s0 : false;
    const qColor = onQ ? (active ? '#ff9cb0' : '#ff6b8a') : '#dfe7ef';
    const rColor = onR ? (active ? '#8ee7a6' : '#53d97a') : '#dfe7ef';
    const sColor = onS ? (active ? '#c8b2ff' : '#b58dff') : '#dfe7ef';
    const sepColor = active ? '#dff8ff' : '#a9b7c6';

    parts.push(`<polygon data-hex-key="${escapeHtml(h.key)}" points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${active ? 2 : 1.2}"/>`);
    if (labelMode === 'qrs') {
      parts.push(
        `<text x="${cx.toFixed(2)}" y="${cy.toFixed(2)}" text-anchor="middle" dominant-baseline="central" font-size="5.0" font-family="'Share Tech Mono', monospace" pointer-events="none"><tspan fill="${qColor}">${h.q}</tspan><tspan fill="${sepColor}">,</tspan><tspan fill="${rColor}">${h.r}</tspan><tspan fill="${sepColor}">,</tspan><tspan fill="${sColor}">${s}</tspan></text>`,
      );
    } else {
      parts.push(
        `<text x="${cx.toFixed(2)}" y="${cy.toFixed(2)}" text-anchor="middle" dominant-baseline="central" font-size="5.2" font-family="'Share Tech Mono', monospace" pointer-events="none"><tspan fill="${qColor}">${h.q}</tspan><tspan fill="${sepColor}">,</tspan><tspan fill="${rColor}">${h.r}</tspan></text>`,
      );
    }
  }

  parts.push('</svg>');
  return parts.join('\n');
}

function mount(container) {
  const mapQrs = container.querySelector('[data-hex-map-qrs]');
  const mapQr = container.querySelector('[data-hex-map-qr]');
  const readout = container.querySelector('[data-hex-readout]');
  const qrReadout = container.querySelector('[data-hex-readout-qr]');
  if (!mapQrs || !mapQr || !readout || !qrReadout) return;

  const radius = Math.max(1, Number.parseInt(container.getAttribute('data-hex-radius') || '3', 10) || 3);
  const geo = buildGeometry(radius, 20);
  let hoveredKey = null;

  function update() {
    mapQrs.innerHTML = renderMap(geo, hoveredKey, 'qrs');
    mapQr.innerHTML = renderMap(geo, hoveredKey, 'qr');
    if (!hoveredKey) {
      readout.innerHTML = '<span class="hex-axis-q">q=</span> <span class="hex-axis-value">?</span> <span class="hex-axis-r">r=</span> <span class="hex-axis-value">?</span> <span class="hex-axis-s">s=</span> <span class="hex-axis-value">?</span>';
      qrReadout.innerHTML = '<span class="hex-axis-q">q=</span> <span class="hex-axis-value">?</span> <span class="hex-axis-r">r=</span> <span class="hex-axis-value">?</span>';
      return;
    }
    const [qStr, rStr] = hoveredKey.split(',');
    const q = Number.parseInt(qStr, 10);
    const r = Number.parseInt(rStr, 10);
    const s = -q - r;
    readout.innerHTML = `<span class="hex-axis-q">q=</span> <span class="hex-axis-value">${q}</span> <span class="hex-axis-r">r=</span> <span class="hex-axis-value">${r}</span> <span class="hex-axis-s">s=</span> <span class="hex-axis-value">${s}</span>`;
    qrReadout.innerHTML = `<span class="hex-axis-q">q=</span> <span class="hex-axis-value">${q}</span> <span class="hex-axis-r">r=</span> <span class="hex-axis-value">${r}</span>`;
  }

  function onPointerMove(ev) {
    const el = ev.target.closest('[data-hex-key]');
    const next = el ? el.getAttribute('data-hex-key') : null;
    if (next !== hoveredKey) {
      hoveredKey = next;
      update();
    }
  }

  function onPointerLeave() {
    if (hoveredKey !== null) {
      hoveredKey = null;
      update();
    }
  }

  mapQrs.addEventListener('pointermove', onPointerMove);
  mapQr.addEventListener('pointermove', onPointerMove);
  mapQrs.addEventListener('pointerleave', onPointerLeave);
  mapQr.addEventListener('pointerleave', onPointerLeave);

  update();
}

document.querySelectorAll('[data-hex-hover-demo]').forEach(mount);
