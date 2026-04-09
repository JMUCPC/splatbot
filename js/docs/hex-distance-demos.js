/**
 * Distance ring demo: hover sets origin; dropdown selects ring distance N;
 * highlights all hexes exactly N steps from origin and colors Δq,Δr,Δs by dominance.
 */
import { axialToPixel, generateHexGrid, hexCorners, hexDistance } from '../engine/hex-grid.js';

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
    hexSize,
  };
}

function cubeDelta(origin, h) {
  const dq = h.q - origin.q;
  const dr = h.r - origin.r;
  const ds = (-h.q - h.r) - (-origin.q - origin.r);
  return { dq, dr, ds };
}

function dominantMask(dq, dr, ds) {
  const aq = Math.abs(dq);
  const ar = Math.abs(dr);
  const as = Math.abs(ds);
  const m = Math.max(aq, ar, as);
  return {
    q: aq === m,
    r: ar === m,
    s: as === m,
  };
}

/** Inflate SVG text/stroke units so labels stay readable after the map is scaled to the CSS max-height box. */
const MAP_SCREEN_SCALE = 2.85;

function renderMap(geo, originKey, ringN) {
  const k = MAP_SCREEN_SCALE;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${geo.minX.toFixed(2)} ${geo.minY.toFixed(2)} ${geo.width.toFixed(2)} ${geo.height.toFixed(2)}" preserveAspectRatio="xMidYMid meet" width="100%" height="100%" style="display:block;background:#070d1a">`,
  ];

  const origin = originKey ? geo.hexes.find((h) => h.key === originKey) : null;

  const cornerR = geo.hexSize * 0.9;
  for (const h of geo.hexes) {
    const [cx, cy] = geo.centers.get(h.key);
    const points = hexCorners(cx, cy, cornerR).map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
    const s = -h.q - h.r;

    let fill = '#0f1b2e';
    let stroke = '#2a3f62';
    let sw = 1.2 * k;

    if (origin) {
      const d = hexDistance(origin, h);
      if (h.key === originKey) {
        fill = '#173159';
        stroke = '#00d4ff';
        sw = 2 * k;
      } else if (d === ringN && ringN > 0) {
        fill = '#1a3048';
        stroke = '#4a6a8a';
        sw = 1.4 * k;
      }
    }

    parts.push(`<polygon data-hex-key="${escapeHtml(h.key)}" points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`);

    const sepColor = '#a9b7c6';
    const baseQ = '#dfe7ef';
    const baseR = '#dfe7ef';
    const baseS = '#dfe7ef';

    if (origin && h.key !== originKey && hexDistance(origin, h) === ringN && ringN > 0) {
      const { dq, dr, ds } = cubeDelta(origin, h);
      const dom = dominantMask(dq, dr, ds);
      const qColor = dom.q ? '#ff6b8a' : baseQ;
      const rColor = dom.r ? '#53d97a' : baseR;
      const sColor = dom.s ? '#b58dff' : baseS;
      const dqStr = dq >= 0 ? `+${dq}` : String(dq);
      const drStr = dr >= 0 ? `+${dr}` : String(dr);
      const dsStr = ds >= 0 ? `+${ds}` : String(ds);
      const dy = 5 * k;
      parts.push(
        `<text x="${cx.toFixed(2)}" y="${(cy - dy).toFixed(2)}" text-anchor="middle" dominant-baseline="central" font-size="${4.4 * k}" font-family="'Share Tech Mono', monospace" pointer-events="none"><tspan fill="${baseQ}">${h.q}</tspan><tspan fill="${sepColor}">,</tspan><tspan fill="${baseR}">${h.r}</tspan><tspan fill="${sepColor}">,</tspan><tspan fill="${baseS}">${s}</tspan></text>`,
      );
      parts.push(
        `<text x="${cx.toFixed(2)}" y="${(cy + dy).toFixed(2)}" text-anchor="middle" dominant-baseline="central" font-size="${3.6 * k}" font-family="'Share Tech Mono', monospace" pointer-events="none"><tspan fill="${qColor}">Δq${dqStr}</tspan><tspan fill="${sepColor}"> </tspan><tspan fill="${rColor}">Δr${drStr}</tspan><tspan fill="${sepColor}"> </tspan><tspan fill="${sColor}">Δs${dsStr}</tspan></text>`,
      );
    } else {
      parts.push(
        `<text x="${cx.toFixed(2)}" y="${cy.toFixed(2)}" text-anchor="middle" dominant-baseline="central" font-size="${5.0 * k}" font-family="'Share Tech Mono', monospace" pointer-events="none"><tspan fill="${baseQ}">${h.q}</tspan><tspan fill="${sepColor}">,</tspan><tspan fill="${baseR}">${h.r}</tspan><tspan fill="${sepColor}">,</tspan><tspan fill="${baseS}">${s}</tspan></text>`,
      );
    }
  }

  parts.push('</svg>');
  return parts.join('\n');
}

function mount(container) {
  const mapEl = container.querySelector('[data-hex-dist-map]');
  const readout = container.querySelector('[data-hex-dist-readout]');
  const select = container.querySelector('[data-hex-dist-n]');
  if (!mapEl || !readout || !select) return;

  const radius = Math.max(1, Number.parseInt(container.getAttribute('data-hex-radius') || '4', 10) || 4);
  const geo = buildGeometry(radius, 30);
  let originKey = null;
  let ringN = 1;

  function fillSelectOptions() {
    const maxN = Math.min(radius * 2, 8);
    select.innerHTML = '';
    for (let n = 1; n <= maxN; n++) {
      const opt = document.createElement('option');
      opt.value = String(n);
      opt.textContent = String(n);
      select.appendChild(opt);
    }
    if (ringN > maxN) ringN = maxN;
    select.value = String(ringN);
  }

  fillSelectOptions();
  ringN = Math.max(1, Number.parseInt(select.value, 10) || 1);

  function update() {
    mapEl.innerHTML = renderMap(geo, originKey, ringN);
    if (!originKey) {
      readout.innerHTML =
        '<span class="hex-axis-q">Origin</span> <span class="hex-axis-value">—</span> · ' +
        '<span class="hex-dist-ring-label">Ring N=</span> <span class="hex-axis-value">' +
        ringN +
        '</span><br><span class="hex-dist-hint">Hover a hex to set the origin. Distance uses max(|Δq|,|Δr|,|Δs|) with Δq+Δr+Δs=0.</span>';
      return;
    }
    const [qStr, rStr] = originKey.split(',');
    const q = Number.parseInt(qStr, 10);
    const r = Number.parseInt(rStr, 10);
    const s = -q - r;
    readout.innerHTML =
      `<span class="hex-axis-q">Origin</span> ` +
      `<span class="hex-axis-q">q=</span><span class="hex-axis-value">${q}</span> ` +
      `<span class="hex-axis-r">r=</span><span class="hex-axis-value">${r}</span> ` +
      `<span class="hex-axis-s">s=</span><span class="hex-axis-value">${s}</span> · ` +
      `<span class="hex-dist-ring-label">Ring <span class="hex-axis-value">N</span>=</span> <span class="hex-axis-value">${ringN}</span> — ` +
      `<span class="hex-dist-hint">All tiles exactly ${ringN} steps away. On each ring tile, the <strong>Δq Δr Δs</strong> line colors the component(s) with largest |Δ| — that max equals distance.</span>`;
  }

  select.addEventListener('change', () => {
    ringN = Math.max(1, Number.parseInt(select.value, 10) || 1);
    update();
  });

  mapEl.addEventListener('pointermove', (ev) => {
    const el = ev.target.closest('[data-hex-key]');
    const next = el ? el.getAttribute('data-hex-key') : null;
    if (next !== originKey) {
      originKey = next;
      update();
    }
  });

  mapEl.addEventListener('pointerleave', () => {
    if (originKey !== null) {
      originKey = null;
      update();
    }
  });

  update();
}

document.querySelectorAll('[data-hex-dist-demo]').forEach(mount);
