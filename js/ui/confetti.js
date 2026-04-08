import config from '../config.js';

function parseHex(hex) {
  const s = hex.replace('#', '');
  if (s.length === 3) {
    return {
      r: parseInt(s[0] + s[0], 16),
      g: parseInt(s[1] + s[1], 16),
      b: parseInt(s[2] + s[2], 16),
    };
  }
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}

function mix(a, b, t) {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function rgbStr({ r, g, b }) {
  return `rgb(${r},${g},${b})`;
}

/**
 * Full-screen confetti burst themed for the winning player.
 * @param {1 | 2} playerId
 */
export function fireWinCelebration(playerId) {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const bright = parseHex(config.PLAYER_BRIGHT_COLORS[playerId]);
  const bot = parseHex(config.PLAYER_BOT_COLORS[playerId]);
  const palette = [
    rgbStr(bright),
    rgbStr(bot),
    rgbStr(mix(bright, bot, 0.45)),
    '#f0e8d8',
    '#fff8f0',
  ];

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:500';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let w = 0;
  let h = 0;

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  const onResize = () => resize();
  window.addEventListener('resize', onResize);

  const cx = w * 0.5;
  const cy = h * 0.35;
  const count = Math.min(140, Math.floor((w * h) / 12000) + 70);

  const particles = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.random() - 0.5) * Math.PI * 1.1 + Math.PI * 1.5;
    const speed = 3.4 + Math.random() * 8.6;
    particles.push({
      x: cx + (Math.random() - 0.5) * 80,
      y: cy + (Math.random() - 0.5) * 40,
      vx: Math.cos(angle) * speed * (0.85 + Math.random() * 0.3),
      vy: Math.sin(angle) * speed * (0.85 + Math.random() * 0.3),
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.35,
      w: 5 + Math.random() * 7,
      h: 8 + Math.random() * 10,
      color: palette[i % palette.length],
      ay: 0.1 + Math.random() * 0.06,
      life: 1,
    });
  }

  const duration = 4300;
  const t0 = performance.now();

  function frame(now) {
    const elapsed = now - t0;
    const t = Math.min(1, elapsed / duration);

    ctx.clearRect(0, 0, w, h);

    for (const p of particles) {
      p.vy += p.ay;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life = 1 - t * t;

      const alpha = Math.max(0, p.life * (1 - Math.max(0, t - 0.65) * 2.8));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w * 0.5, -p.h * 0.5, p.w, p.h);
      ctx.restore();
    }

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      window.removeEventListener('resize', onResize);
      canvas.remove();
    }
  }

  requestAnimationFrame(frame);
}
