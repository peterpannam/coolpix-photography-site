/** Seeded placeholder "photographs" (sky, ridgelines, water, grain), drawn until real images exist. */
import type { Tone } from './constants';

export function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function paintPlaceholder(canvas: HTMLCanvasElement, seed: number, tone: Tone): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 360;
  const h = canvas.clientHeight || 240;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  const rand = rng(seed);

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, tone.sky[0]);
  sky.addColorStop(1, tone.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(w * (0.15 + rand() * 0.7), h * (0.16 + rand() * 0.16), h * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const horizon = h * (0.4 + rand() * 0.14);
  tone.ridges.forEach((col, i) => {
    const base = horizon + i * h * 0.13;
    const amp = h * (0.13 - i * 0.025);
    const f1 = 0.004 + rand() * 0.01;
    const f2 = 0.015 + rand() * 0.02;
    const p1 = rand() * 6;
    const p2 = rand() * 6;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 2) {
      ctx.lineTo(x, base - amp * (0.55 + 0.35 * Math.sin(x * f1 + p1) + 0.12 * Math.sin(x * f2 + p2)));
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  });

  if (tone.water) {
    const y0 = h * (0.8 + rand() * 0.06);
    ctx.fillStyle = tone.water;
    ctx.fillRect(0, y0, w, h - y0);
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 1;
    for (let y = y0 + 4; y < h; y += 5 + rand() * 4) {
      const x = rand() * w * 0.7;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 20 + rand() * w * 0.3, y);
      ctx.stroke();
    }
  }

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 14;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}
