// Cut the real route into chronological segments by official region.
//
//   npm run geo:journey                      (same as below, with the defaults)
//   node scripts/geo/build-journey.mjs [_geoJSON-routes/route-merged.geojson] [data-raw/lga-units.json]
//
// Every point of the route is placed in a council with point-in-polygon against the full-detail ABS boundaries from
// build-regions.mjs, so a segment changes region exactly where the road crosses a council boundary. Runs under 1 km
// (the road running along a boundary) are folded into their neighbours, and each segment is simplified to 250 m.
//
// Writes src/data/journey.json: { totalKm, regions: [{ id, title, state, kmDriven, firstKm, visits }],
// segments: [{ region, km0, km1, route: [[lon, lat], ...] }] }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoDistance } from 'd3-geo';
import { mean, sum } from 'd3-array';
import { REGIONS } from './regions-official.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const routeFile = path.resolve(root, process.argv[2] ?? '_geoJSON-routes/route-merged.geojson');
const unitsFile = path.resolve(root, process.argv[3] ?? 'data-raw/lga-units.json');
const outFile = path.join(root, 'src/data/journey.json');

/** Kilometres to leave off the start of the route (0 = draw it all) */
const TRIM_KM = 0;
/** Region runs shorter than this are folded into the neighbouring region */
const SLIVER_KM = 1;
/** Douglas–Peucker tolerance for the published route */
const SIMPLIFY_KM = 0.25;

if (!fs.existsSync(unitsFile)) {
  console.error(`${path.relative(root, unitsFile)} not found: run npm run geo:regions first (see README).`);
  process.exit(1);
}
const units = JSON.parse(fs.readFileSync(unitsFile, 'utf8'));
const route = JSON.parse(fs.readFileSync(routeFile, 'utf8'));
const geometry = route.type === 'FeatureCollection' ? route.features[0].geometry : route.type === 'Feature' ? route.geometry : route;
const coords = geometry.type === 'MultiLineString' ? geometry.coordinates.flat() : geometry.coordinates;

const NAME = {};
for (const [st, regs] of Object.entries(REGIONS)) for (const [id, [title]] of Object.entries(regs)) NAME[id] = { title, state: st };

// Grid index (1° cells) of polygon parts, for point-in-polygon
const parts = [];
units.forEach((u, ui) =>
  u.polys.forEach((p) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of p[0]) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    parts.push({ ui, p, bb: [x0, y0, x1, y1] });
  }),
);
const cellKey = (i, j) => i * 1000 + j;
const grid = new Map();
parts.forEach((pt, k) => {
  for (let i = Math.floor(pt.bb[0]); i <= Math.floor(pt.bb[2]); i++) {
    for (let j = Math.floor(pt.bb[1]); j <= Math.floor(pt.bb[3]); j++) {
      const key = cellKey(i, j);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(k);
    }
  }
});
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function unitAt([x, y]) {
  for (const k of grid.get(cellKey(Math.floor(x), Math.floor(y))) ?? []) {
    const { p, bb, ui } = parts[k];
    if (x < bb[0] || x > bb[2] || y < bb[1] || y > bb[3]) continue;
    if (inRing(x, y, p[0]) && !p.slice(1).some((hole) => inRing(x, y, hole))) return units[ui];
  }
  return null; // at sea (a ferry, or a coastal road just outside the boundary data)
}
function regionOf(u, [x, y]) {
  // SA outback: the coastal west (to the WA border) is Eyre Western; everything inland and north is Far North
  if (u.special === 'sa-outback') return y < -30.5 && x < 133.6 ? 'eyre-western' : 'far-north-sa';
  return u.region;
}

const distKm = (a, b) => geoDistance(a, b) * 6371;
const cum = [0];
for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + distKm(coords[i - 1], coords[i]));
const start = Math.max(0, cum.findIndex((k) => k >= TRIM_KM));

// Region of every route point; points at sea keep the region they were last in
const reg = new Array(coords.length).fill(null);
let last = null;
let atSea = 0;
let paeHits = 0;
for (let i = start; i < coords.length; i++) {
  const u = unitAt(coords[i]);
  if (u) {
    last = regionOf(u, coords[i]);
    if (u.special === 'pae') paeHits++;
  } else atSea++;
  reg[i] = last;
}
const first = reg.find((r, i) => i >= start && r);
for (let i = start; reg[i] === null; i++) reg[i] = first;

// Runs of the same region, folding in slivers
const runs = [];
for (let i = start; i < coords.length; i++) {
  const prev = runs[runs.length - 1];
  if (prev && prev.r === reg[i]) prev.b = i;
  else runs.push({ r: reg[i], a: prev ? prev.b : i, b: i });
}
let changed = true;
while (changed) {
  changed = false;
  for (let k = 0; k < runs.length && runs.length > 1; k++) {
    if (cum[runs[k].b] - cum[runs[k].a] < SLIVER_KM) {
      if (runs[k - 1]) runs[k - 1].b = runs[k].b;
      else runs[k + 1].a = runs[k].a;
      runs.splice(k, 1);
      changed = true;
      break;
    }
  }
  for (let k = 1; k < runs.length; k++) {
    if (runs[k].r === runs[k - 1].r) {
      runs[k - 1].b = runs[k].b;
      runs.splice(k, 1);
      changed = true;
      break;
    }
  }
}

// Douglas–Peucker in a local equirectangular plane (km)
function simplifyLine(pts, tolKm) {
  const lat0 = (mean(pts, (p) => p[1]) * Math.PI) / 180;
  const kx = 111.32 * Math.cos(lat0);
  const ky = 110.57;
  const P = pts.map((p) => [p[0] * kx, p[1] * ky]);
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0;
    let index = -1;
    const [ax, ay] = P[a];
    const dx = P[b][0] - ax;
    const dy = P[b][1] - ay;
    const len2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = P[i];
      const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d > max) {
        max = d;
        index = i;
      }
    }
    if (max > tolKm) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  return pts.filter((_, i) => keep[i]).map((p) => [+p[0].toFixed(4), +p[1].toFixed(4)]);
}

const segments = runs.map((r) => ({
  region: r.r,
  km0: Math.round(cum[r.a]),
  km1: Math.round(cum[r.b]),
  route: simplifyLine(coords.slice(r.a, r.b + 1), SIMPLIFY_KM),
}));
const regions = [...new Set(runs.map((r) => r.r))]
  .map((id) => {
    const segs = segments.filter((s) => s.region === id);
    return {
      id,
      title: NAME[id].title,
      state: NAME[id].state,
      kmDriven: Math.round(sum(segs, (s) => s.km1 - s.km0)),
      firstKm: segs[0].km0,
      visits: segs.length,
    };
  })
  .sort((a, b) => a.firstKm - b.firstKm);

const journey = { totalKm: Math.round(cum[cum.length - 1]), regions, segments };
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(journey));

console.log(`${path.relative(root, outFile)}: ${journey.totalKm} km, ${segments.length} segments, ${regions.length} regions, ${fs.statSync(outFile).size} bytes`);
console.log(`route points at sea: ${atSea}; in Port Adelaide Enfield (counted as Northern Adelaide): ${paeHits}`);
for (const s of segments) {
  console.log(`  ${String(s.km0).padStart(6)} → ${String(s.km1).padStart(6)}  ${String(s.km1 - s.km0).padStart(5)} km  ${NAME[s.region].state.padEnd(4)}${NAME[s.region].title}`);
}
