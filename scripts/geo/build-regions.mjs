// Build the map's base layers from ABS LGA 2022 council boundaries grouped into each state's official regions.
//
//   npm run geo:regions                      (same as below, with the defaults)
//   node scripts/geo/build-regions.mjs [data-raw/lga2022.geojson] [keep = 0.15]
//
// Writes
//   src/data/australia.topo.json   display topology: states (polygons), coast, stateBorders, regionBorders (lines),
//                                  simplified so they still meet exactly (about 210 KB)
//   data-raw/lga-units.json        full-detail council polygons with their region, used by build-journey.mjs to place
//                                  the route (large; not committed)
//
// Boundaries: ABS Australian Statistical Geography Standard, LGA 2022 (CC BY 4.0).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile, filter, filterWeight, sphericalTriangleArea, sphericalRingArea } from 'topojson-simplify';
import { merge, mesh } from 'topojson-client';
import { geoArea, geoCentroid, geoDistance } from 'd3-geo';
import { group, mean, rollup } from 'd3-array';
import { REGIONS } from './regions-official.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const input = path.resolve(root, process.argv[2] ?? 'data-raw/lga2022.geojson');
const keep = Number(process.argv[3] ?? 0.15);
const outTopo = path.join(root, 'src/data/australia.topo.json');
const outUnits = path.join(root, 'data-raw/lga-units.json');

const STATE = {
  'New South Wales': 'NSW', Victoria: 'VIC', Queensland: 'QLD', 'South Australia': 'SA', 'Western Australia': 'WA',
  Tasmania: 'TAS', 'Northern Territory': 'NT', 'Australian Capital Territory': 'ACT', 'Other Territories': 'OT',
};
/** Regions that take every council of their state not listed elsewhere */
const CATCH_ALL = Object.fromEntries(
  Object.entries(REGIONS).flatMap(([st, regs]) => Object.entries(regs).filter(([, [, list]]) => list === null).map(([id]) => [st, id])),
);

const src = JSON.parse(fs.readFileSync(input, 'utf8'));
const lgaRegion = new Map(); // "STATE|council name" -> region id
for (const [st, regs] of Object.entries(REGIONS)) {
  for (const [id, [, list]] of Object.entries(regs)) for (const name of list ?? []) lgaRegion.set(`${st}|${name}`, id);
}

const polys = (g) => (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]);
const areaKm2 = (p) => geoArea({ type: 'Polygon', coordinates: p }) * 6371 * 6371;
const centroid = (p) => geoCentroid({ type: 'Polygon', coordinates: p });

// 1) Units: one per council, except unincorporated areas, which are split into their separate parts
const units = [];
const unmatched = [];
for (const f of src.features) {
  const name = f.properties.lga_name_2022;
  const st = STATE[f.properties.state_name_2021];
  if (!f.geometry || !st || /^(Migratory|No usual address|Outside Australia)/.test(name)) continue;

  if (st === 'OT') {
    // Other Territories: keep only Jervis Bay Territory, so the NSW coast has no hole in it
    for (const p of polys(f.geometry)) {
      const [lon] = centroid(p);
      if (lon > 150 && lon < 151) units.push({ name: 'Jervis Bay Territory', state: 'JBT', region: null, special: null, polys: [p] });
    }
    continue;
  }

  if (/^Unincorp/.test(name) && st !== 'ACT') {
    for (const p of polys(f.geometry)) {
      const [lon] = centroid(p);
      const km2 = areaKm2(p);
      if (st === 'NSW' && lon > 154) continue; // Lord Howe Island: outside the mainland regions
      const u = { name, state: st, region: undefined, special: null, polys: [p] };
      if (st === 'NSW') u.region = 'far-west'; // "the Unincorporated Area" is in Far West (Regions Order 2020)
      else if (st === 'SA' && km2 > 100000) {
        // The SA outback is split between Eyre Western and Far North by the official description; that is done
        // point by point in build-journey.mjs, and its border with Eyre Western is only drawn where it is certain
        u.region = 'far-north-sa';
        u.special = 'sa-outback';
      } else if (st === 'NT' && km2 > 1000) u.region = 'top-end'; // Unincorporated Top End Region
      units.push(u); // any other part takes the region of the nearest council (below)
    }
    continue;
  }

  let region = lgaRegion.get(`${st}|${name}`) ?? CATCH_ALL[st];
  let special = null;
  if (st === 'SA' && name === 'Port Adelaide Enfield') {
    // Officially split between Northern and Western Adelaide along a line no council boundary follows
    region = 'northern-adelaide';
    special = 'pae';
  }
  if (!region) {
    unmatched.push(`${st}|${name}`);
    continue;
  }
  units.push({ name, state: st, region, special, polys: polys(f.geometry) });
}
if (unmatched.length) {
  console.error('Councils with no region (add them to regions-official.mjs):', unmatched);
  process.exit(1);
}
const seen = new Set(units.map((u) => `${u.state}|${u.name}`));
const missing = [...lgaRegion.keys()].filter((k) => !seen.has(k));
if (missing.length) {
  console.error('Listed in regions-official.mjs but not in the boundaries (typo, or renamed council?):', missing);
  process.exit(1);
}

// Small unincorporated parts take the region of the nearest council in the same state
const named = units.filter((u) => u.region !== undefined && u.special === null && u.state !== 'JBT');
const samples = named.map((u) => ({ u, pts: u.polys.flatMap((p) => p[0].filter((_, i) => i % 5 === 0)) }));
for (const u of units.filter((x) => x.region === undefined)) {
  const c = centroid(u.polys[0]);
  let best = Infinity;
  let nearest = null;
  for (const s of samples) {
    if (s.u.state !== u.state) continue;
    for (const q of s.pts) {
      const d = geoDistance(c, q);
      if (d < best) {
        best = d;
        nearest = s.u;
      }
    }
  }
  u.region = nearest.region;
}

// 2) Simplified topology of every unit, so the derived layers share their arcs and meet exactly
const fc = {
  type: 'FeatureCollection',
  features: units.map((u, i) => ({
    type: 'Feature',
    id: i,
    properties: { s: u.state, r: u.region, x: u.special },
    geometry: { type: 'MultiPolygon', coordinates: u.polys },
  })),
};
let topo = topology({ units: fc }, 1e6);
topo = presimplify(topo, sphericalTriangleArea);
topo = simplify(topo, quantile(topo, keep));
topo = filter(topo, filterWeight(topo, 2e-7, sphericalRingArea)); // drop specks under about 8 km²
const unitsObj = topo.objects.units;

const states = {
  type: 'FeatureCollection',
  features: [...group(unitsObj.geometries, (g) => g.properties.s)].map(([s, gs]) => ({
    type: 'Feature',
    id: s,
    properties: {},
    geometry: merge(topo, gs),
  })),
};
const coast = mesh(topo, unitsObj, (a, b) => a === b);
const stateBorders = mesh(topo, unitsObj, (a, b) => a !== b && a.properties.s !== b.properties.s);

// Region borders inside each state, leaving out the two lines no council boundary defines:
// Port Adelaide Enfield against Northern and Western Adelaide, and the SA outback against Eyre Western
const isPair = (pa, pb, special, region) => (pa.x === special && pb.r === region) || (pb.x === special && pa.r === region);
const regionBorders = mesh(topo, unitsObj, (a, b) => {
  const pa = a.properties;
  const pb = b.properties;
  if (a === b || pa.s !== pb.s || pa.r === pb.r) return false;
  return !(isPair(pa, pb, 'pae', 'western-adelaide') || isPair(pa, pb, 'sa-outback', 'eyre-western'));
});
// The SA outback against Eyre Western councils is certain east of 134°E (the Gawler Ranges side), so draw that part
const outbackEyre = mesh(topo, unitsObj, (a, b) => isPair(a.properties, b.properties, 'sa-outback', 'eyre-western'));
regionBorders.coordinates.push(...outbackEyre.coordinates.filter((line) => mean(line, (p) => p[0]) > 134));

// 3) Compact output: just the display layers
const out = topology(
  {
    states,
    coast: { type: 'Feature', properties: {}, geometry: coast },
    stateBorders: { type: 'Feature', properties: {}, geometry: stateBorders },
    regionBorders: { type: 'Feature', properties: {}, geometry: regionBorders },
  },
  1e5,
);
fs.mkdirSync(path.dirname(outTopo), { recursive: true });
fs.writeFileSync(outTopo, JSON.stringify(out));
fs.mkdirSync(path.dirname(outUnits), { recursive: true });
fs.writeFileSync(
  outUnits,
  JSON.stringify(units.map((u) => ({ name: u.name, state: u.state, region: u.region, special: u.special, polys: u.polys }))),
);

const points = out.arcs.reduce((n, a) => n + a.length, 0);
console.log(`${units.length} units → ${path.relative(root, outTopo)}: ${points} points, ${fs.statSync(outTopo).size} bytes`);
const counts = rollup(units.filter((u) => u.state !== 'JBT'), (v) => new Set(v.map((u) => u.name)).size, (u) => u.state, (u) => u.region);
for (const [s, m] of counts) console.log(' ', s, [...m].map(([r, n]) => `${r}:${n}`).join(' '));
