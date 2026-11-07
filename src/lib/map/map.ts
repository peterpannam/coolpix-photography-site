/**
 * The journey map: D3 + SVG, a flat illustrated Australia with the real route drawn on it.
 *
 * Interaction model
 *  - Whole country (zoom < REGION_K): states and the route; click a state to zoom into it.
 *  - Zoomed into a state (zoom < PLACE_K): a callout per region of the state in the middle of the view.
 *  - A region chosen, or zoomed further in: places get inline labels, or callout stacks where they crowd.
 *  - A place chosen: the panel opens with its photographs, and previous/next walk the whole journey in order.
 *  - "All locations" is a searchable list of every place; the SVG itself is hidden from screen readers.
 *
 * Markup and styles: src/components/MapGallery.astro. Elements are found by data-ref inside the root element.
 */
import { select } from 'd3-selection';
import 'd3-transition';
import { zoom as d3zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom';
import { geoConicEqualArea, geoContains, geoDistance, geoPath, type GeoProjection, type GeoPath } from 'd3-geo';
import { line as d3line } from 'd3-shape';
import { bisectLeft, groups as d3groups, max, min } from 'd3-array';
import { easeCubicInOut, easeLinear } from 'd3-ease';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry, MultiLineString, MultiPolygon, Polygon } from 'geojson';
import type { GeometryCollection, GeometryObject, Topology } from 'topojson-specification';

import {
  CROWD_PX, CHIP_H, INTRO_MS, MAX_ZOOM, PLACE_K, REGION_K, REGION_TONE, SEA_LABELS, STATE_LABELS, STATE_NAMES, TONES,
  type Tone,
} from './constants';
import { fmtCoords, fmtKm, plural } from './format';
import { chipsOf, groupCrowded, placeBlock, relax, type Block, type ChipItem, type Rect } from './layout';
import { createPanel } from './panel';
import { createPicker } from './picker';
import type { Journey, PlacedPlace, Pt, RegionInfo, Segment } from './types';

export interface MapOptions {
  topo: Topology;
  journey: Journey;
  places: PlacedPlace[];
  /** Where distances are measured from */
  startName?: string;
}

interface Region extends RegionInfo { places: Place[]; segs: Seg[]; tone: Tone; pts: Pt[]; mid: Pt }
interface Seg extends Segment { reg: Region; pts: Pt[] }
interface Place extends PlacedPlace { reg: Region; gi: number; xy: Pt; nn: number; reveal: number }
type ChipRef = { place?: Place; region?: Region };
type StateFeature = Feature<Polygon | MultiPolygon> & { id: string };

export function initMap(root: HTMLElement, { topo, journey, places, startName = 'Melbourne' }: MapOptions): void {
  const $ = <T extends Element = HTMLElement>(ref: string) => {
    const el = root.querySelector<T>(`[data-ref="${ref}"]`);
    if (!el) throw new Error(`[map] missing element data-ref="${ref}"`);
    return el;
  };

  /* ---------- data ---------- */
  const objects = topo.objects as unknown as Record<'states' | 'coast' | 'stateBorders' | 'regionBorders', GeometryObject>;
  const GEO = {
    states: feature(topo, objects.states as GeometryCollection) as unknown as FeatureCollection<Polygon | MultiPolygon> & { features: StateFeature[] },
    coast: (feature(topo, objects.coast) as Feature<MultiLineString>).geometry,
    borders: (feature(topo, objects.stateBorders) as Feature<MultiLineString>).geometry,
    regionBorders: (feature(topo, objects.regionBorders) as Feature<MultiLineString>).geometry,
  };

  const REGIONS: Region[] = journey.regions.map((r) => ({
    ...r, places: [], segs: [], tone: TONES[REGION_TONE[r.id]] ?? TONES.coast, pts: [], mid: [0, 0],
  }));
  const regionById = new Map(REGIONS.map((r) => [r.id, r]));
  const SEGMENTS: Seg[] = journey.segments.map((s) => {
    const reg = regionById.get(s.region);
    if (!reg) throw new Error(`[map] segment region "${s.region}" is not in journey.regions`);
    const sg = { ...s, reg, pts: [] as Pt[] };
    reg.segs.push(sg);
    return sg;
  });
  const PLACES: Place[] = places
    .filter((p) => regionById.has(p.region))
    .sort((a, b) => a.km - b.km) // journey order
    .map((p, gi) => ({ ...p, reg: regionById.get(p.region)!, gi, xy: [0, 0] as Pt, nn: Infinity, reveal: 0 }));
  PLACES.forEach((p) => p.reg.places.push(p));
  const placeById = new Map(PLACES.map((p) => [p.id, p]));
  const regionKm = (r: Region) => `${fmtKm(r.kmDriven)} km driven`;

  /* ---------- elements and state ---------- */
  const stage = $('stage');
  const tooltip = $('tooltip');
  const live = $('live');
  const reduceToggle = $<HTMLInputElement>('reduce-motion');
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = motionQuery.matches;
  reduceToggle.checked = reduced;

  let W = 0;
  let H = 0;
  let projection: GeoProjection = geoConicEqualArea();
  let path: GeoPath = geoPath(projection);
  let transform: ZoomTransform = zoomIdentity;
  let selected: Place | null = null;
  let activeRegion: Region | null = null;
  let introDone = false;
  let lastTrigger: HTMLElement | null = null;
  const panel = createPanel($('panel'), (dir) => step(dir), () => closePanel());

  /* ---------- svg scaffold ---------- */
  const svg = select($<SVGSVGElement>('svg'));
  const sea = svg.append('rect').attr('class', 'sea');
  const world = svg.append('g').attr('class', 'world');
  const gStates = world.append('g');
  const pRegions = world.append('path').attr('class', 'region-borders');
  const pBorders = world.append('path').attr('class', 'borders');
  const pCoast = world.append('path').attr('class', 'coast');
  const gRoutes = world.append('g');
  const overlay = svg.append('g').attr('class', 'overlay');
  const gSea = overlay.append('g');
  const gStateLabels = overlay.append('g');
  const gLeaders = overlay.append('g').attr('class', 'leaders');
  const gPlaces = overlay.append('g');
  const gChips = overlay.append('g').attr('class', 'chips');

  const routeSel = () => gRoutes.selectAll<SVGGElement, Seg>('g.route');
  const placeSel = () => gPlaces.selectAll<SVGGElement, Place>('g.place');
  const chipSel = () => gChips.selectAll<SVGGElement, ChipItem<ChipRef>>('g.chip');

  /* Text measurement for chips and labels (same font as the CSS for .chip text and .place .label) */
  const measure = document.createElement('canvas').getContext('2d')!;
  const monoFont = getComputedStyle(root).getPropertyValue('--tp-font-mono').trim() || 'monospace';
  const widths = new Map<string, number>();
  function textWidth(t: string): number {
    let w = widths.get(t);
    if (w === undefined) {
      measure.font = `500 10px ${monoFont}`;
      w = measure.measureText(t).width + 0.8 * t.length; // + letter-spacing .08em
      widths.set(t, w);
    }
    return w;
  }

  /* ---------- build / rebuild for the current size ---------- */
  const zoom = d3zoom<SVGSVGElement, unknown>()
    .scaleExtent([1, MAX_ZOOM])
    .clickDistance(4)
    .on('start', () => hideTooltip())
    .on('zoom', (ev) => {
      svg.classed('is-moving', true); // set here, not on 'start', which also fires on a plain mousedown
      transform = ev.transform;
      world.attr('transform', transform.toString());
      if (ev.sourceEvent && !introDone) finishIntro();
      position();
    })
    .on('end', () => {
      svg.classed('is-moving', false);
      annotate();
      updateControls();
    });
  svg.call(zoom).on('dblclick.zoom', null);

  function build() {
    W = stage.clientWidth;
    H = stage.clientHeight;
    const narrow = W < 720;
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    sea.attr('width', W).attr('height', H);
    const pad = narrow ? [64, 16, 56, 16] : [72, 64, 60, 64]; // top right bottom left
    projection = geoConicEqualArea()
      .parallels([-18, -36])
      .rotate([-133, 0])
      .fitExtent([[pad[3], pad[0]], [W - pad[1], H - pad[2]]], GEO.states);
    path = geoPath(projection);

    gStates.selectAll<SVGPathElement, StateFeature>('path').data(GEO.states.features).join('path')
      .attr('class', 'state').attr('d', (d) => path(d)).attr('data-state', (d) => d.id);
    pRegions.attr('d', path(GEO.regionBorders));
    pBorders.attr('d', path(GEO.borders));
    pCoast.attr('d', path(GEO.coast));

    const line = d3line(); // the real route is already dense; no smoothing
    const routes = routeSel().data(SEGMENTS).join((enter) => {
      const g = enter.append('g').attr('class', 'route').attr('data-region', (d) => d.region);
      g.append('path').attr('class', 'route-hit');
      g.append('path').attr('class', 'route-line');
      return g;
    });
    SEGMENTS.forEach((sg) => { sg.pts = sg.route.map((c) => projection(c) as Pt); });
    REGIONS.forEach((r) => {
      r.pts = r.segs.flatMap((sg) => sg.pts);
      // callout anchor: halfway along the region's longest segment
      const longest = r.segs.reduce((a, b) => (b.km1 - b.km0 > a.km1 - a.km0 ? b : a));
      const cum = [0];
      for (let j = 1; j < longest.pts.length; j++) {
        cum.push(cum[j - 1] + Math.hypot(longest.pts[j][0] - longest.pts[j - 1][0], longest.pts[j][1] - longest.pts[j - 1][1]));
      }
      r.mid = longest.pts[Math.min(longest.pts.length - 1, bisectLeft(cum, cum[cum.length - 1] / 2))];
    });
    routes.select('.route-hit').attr('d', (d) => line(d.pts));
    routes.select('.route-line').attr('d', (d) => line(d.pts));

    PLACES.forEach((p) => { p.xy = projection([p.lon, p.lat]) as Pt; });
    // nearest-neighbour distance at zoom 1, used to choose how far to fly in
    PLACES.forEach((p) => {
      p.nn = min(PLACES.filter((q) => q !== p), (q) => Math.hypot(q.xy[0] - p.xy[0], q.xy[1] - p.xy[1])) ?? Infinity;
    });

    placeSel().data(PLACES, (d) => d.id).join((enter) => {
      const g = enter.append('g').attr('class', 'place').attr('data-place', (d) => d.id);
      g.append('circle').attr('class', 'hit').attr('r', 11);
      g.append('circle').attr('class', 'ring').attr('r', 9);
      g.append('circle').attr('class', 'dot').attr('r', (d) => Math.min(5, 3 + d.photos * 0.55));
      g.append('text').attr('class', 'label').attr('dy', '0.35em').text((d) => d.name.toUpperCase());
      return g;
    }).classed('in-region', (d) => d.reg === activeRegion);

    gStateLabels.selectAll('text').data(STATE_LABELS).join('text').attr('class', 'state-label').text((d) => d[0].toUpperCase());
    gSea.selectAll('text').data(SEA_LABELS).join('text').attr('class', 'sea-label').text((d) => d[0]);

    zoom.extent([[0, 0], [W, H]]).translateExtent([[-W * 0.15, -H * 0.15], [W * 1.15, H * 1.15]]);
  }

  /* ---------- zoom ---------- */
  function position() {
    placeSel().attr('transform', (d) => `translate(${transform.apply(d.xy)})`);
    gStateLabels.selectAll<SVGTextElement, [string, number, number]>('text')
      .attr('transform', (d) => `translate(${transform.apply(projection([d[1], d[2]]) as Pt)})`);
    gSea.selectAll<SVGTextElement, [string, number, number]>('text').each(function (d) {
      const [x, y] = transform.apply(projection([d[1], d[2]]) as Pt);
      const half = d[0].length * 3.6; // drop sea names that would be cut off at the frame edge
      select(this).attr('transform', `translate(${x},${y})`)
        .attr('display', x - half < 6 || x + half > W - 6 || y < 70 || y > H - 50 ? 'none' : null);
    });
    svg.classed('is-deep', transform.k > 5).classed('show-regions', transform.k >= REGION_K || !!activeRegion);
    updateScale();
  }

  function go(t: ZoomTransform, duration = 1600) {
    if (reduced || duration === 0) svg.interrupt().call(zoom.transform, t);
    else svg.transition().duration(duration).ease(easeCubicInOut).call(zoom.transform, t);
  }

  /** The part of the map not covered by the detail panel */
  function visibleRect(): Rect {
    const r = { x: 0, y: 0, w: W, h: H };
    if (panel.isOpen()) {
      const b = panel.el.getBoundingClientRect();
      if (W < 720) r.h = H - b.height;
      else r.w = W - b.width;
    }
    return r;
  }

  function fitBounds([[x0, y0], [x1, y1]]: [Pt, Pt], padding = 72): ZoomTransform {
    const r = visibleRect();
    const k = Math.max(1, Math.min(MAX_ZOOM, (r.w - padding * 2) / Math.max(x1 - x0, 1), (r.h - padding * 2) / Math.max(y1 - y0, 1)));
    return zoomIdentity.translate(r.x + r.w / 2, r.y + r.h / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
  }

  /* ---------- annotation: inline labels + callout stacks with leader lines ---------- */
  function annotate() {
    if (!introDone) return;
    const r = visibleRect();
    const inView = ([x, y]: Pt) => x > r.x + 8 && x < r.x + r.w - 8 && y > r.y + 8 && y < r.y + r.h - 8;
    const candidates = PLACES.filter((p) => !activeRegion || p.reg === activeRegion)
      .map((p) => ({ p, x: transform.applyX(p.xy[0]), y: transform.applyY(p.xy[1]) }))
      .filter((c) => inView([c.x, c.y]));
    const groups = groupCrowded(candidates, CROWD_PX); // dots too close to read as separate places

    const overview = !activeRegion && transform.k < REGION_K;
    const regionMode = !activeRegion && !overview && transform.k < PLACE_K;
    const blocks: Block<ChipRef>[] = [];

    if (regionMode) {
      // Zoomed into a state: one callout per region of the state at the centre of the view
      const c0 = projection.invert?.(transform.invert([r.x + r.w / 2, r.y + r.h / 2]));
      const under = c0 ? GEO.states.features.find((f) => geoContains(f, c0)) : undefined;
      const focus = under && REGIONS.some((t) => t.state === under.id) ? under.id : null;
      for (const t of REGIONS) {
        if (focus && t.state !== focus) continue;
        const mid = transform.apply(t.mid) as Pt;
        if (!inView(mid)) continue;
        const text = t.title.toUpperCase();
        const item: ChipItem<ChipRef> = { key: `region-${t.id}`, ref: { region: t }, text, w: textWidth(text) + 12, ax: mid[0], ay: mid[1] };
        blocks.push(placeBlock([item], t.pts.map((q) => transform.applyX(q[0])), r, true));
      }
    } else if (!overview) {
      for (const g of groups.filter((x) => x.length > 1)) {
        g.sort((a, b) => a.y - b.y);
        const items = g.map((c): ChipItem<ChipRef> => {
          const text = c.p.name.toUpperCase();
          return { key: c.p.id, ref: { place: c.p }, text, w: textWidth(text) + 12, ax: c.x, ay: c.y };
        });
        blocks.push(placeBlock(items, g.map((c) => c.x), r));
      }
    }
    relax(blocks, r);
    const chips = chipsOf(blocks);

    // inline labels for places that stand alone; skip any that would collide
    type Box = { x0: number; y0: number; x1: number; y1: number; own?: Place };
    const boxes: Box[] = chips.map((b) => ({ x0: b.x - 2, y0: b.y - 2, x1: b.x + b.w + 2, y1: b.y + b.h + 2 }));
    candidates.forEach((c) => boxes.push({ x0: c.x - 5, y0: c.y - 5, x1: c.x + 5, y1: c.y + 5, own: c.p }));
    const hits = (b: Box, own: Place) => boxes.some((o) => o.own !== own && b.x0 < o.x1 && o.x0 < b.x1 && b.y0 < o.y1 && o.y0 < b.y1);
    const labelled = new Map<string, 1 | -1>();
    const singles = regionMode || overview ? [] : groups.filter((g) => g.length === 1).map((g) => g[0]);
    singles.sort((a, b) => b.p.photos - a.p.photos).forEach((c) => {
      const w = textWidth(c.p.name.toUpperCase());
      for (const side of [1, -1] as const) {
        const b: Box = side > 0 ? { x0: c.x + 9, x1: c.x + 11 + w, y0: c.y - 7, y1: c.y + 7 } : { x0: c.x - 11 - w, x1: c.x - 9, y0: c.y - 7, y1: c.y + 7 };
        if (b.x0 > r.x + 4 && b.x1 < r.x + r.w - 4 && !hits(b, c.p)) {
          boxes.push(b);
          labelled.set(c.p.id, side);
          break;
        }
      }
    });
    placeSel().each(function (d) {
      const side = labelled.get(d.id);
      const sel = select(this).classed('show-label', !!side);
      if (side) sel.select('.label').attr('x', side * 10).attr('text-anchor', side > 0 ? 'start' : 'end');
    });

    gChips.selectAll<SVGGElement, (typeof chips)[number]>('g.chip').data(chips, (d) => d.key).join((enter) => {
      const g = enter.append('g').attr('class', 'chip');
      g.append('rect').attr('height', CHIP_H).attr('rx', 2);
      g.append('text').attr('x', 6).attr('y', 12.6);
      return g;
    })
      .attr('data-place', (d) => d.ref.place?.id ?? null)
      .attr('data-region-chip', (d) => d.ref.region?.id ?? null)
      .classed('is-selected', (d) => !!d.ref.place && d.ref.place === selected)
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .call((g) => g.select('rect').attr('width', (d) => d.w))
      .call((g) => g.select('text').text((d) => d.text));

    gLeaders.selectAll<SVGLineElement, (typeof chips)[number]>('line').data(chips, (d) => d.key).join('line')
      .attr('class', 'leader')
      .attr('x1', (d) => d.ax + (d.ref.place ? d.side * 4 : 0)).attr('y1', (d) => d.ay)
      .attr('x2', (d) => (d.side > 0 ? d.x : d.x + d.w)).attr('y2', (d) => d.y + d.h / 2);
  }

  /* ---------- hover: one delegated listener per layer ---------- */
  function setHover(id: string | null) {
    placeSel().classed('is-hover', (d) => d.id === id);
    chipSel().classed('is-hover', (d) => !!d.ref.place && d.ref.place.id === id);
  }
  function showTooltip(x: number, y: number, title: string, sub: string) {
    tooltip.querySelector('strong')!.textContent = title;
    tooltip.querySelector('span')!.textContent = sub;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    tooltip.classList.add('is-visible');
  }
  function hideTooltip() {
    tooltip.classList.remove('is-visible');
    setHover(null);
  }
  const preview = (r: Region | null) => routeSel().classed('is-preview', (d) => !!r && d.reg === r);
  const closestTo = (ev: Event, sel: string) => (ev.target as Element).closest<HTMLElement | SVGElement>(sel);

  overlay
    .on('pointerover', (ev: PointerEvent) => {
      const rc = closestTo(ev, '[data-region-chip]');
      if (rc) {
        const t = regionById.get(rc.dataset.regionChip!)!;
        select(rc).classed('is-hover', true);
        preview(t);
        const b = rc.getBoundingClientRect();
        const s = stage.getBoundingClientRect();
        showTooltip(b.left - s.left + b.width / 2, b.top - s.top, STATE_NAMES[t.state], `${regionKm(t)} · ${plural(t.places.length, 'place')}`);
        return;
      }
      const el = closestTo(ev, '[data-place]');
      if (!el) return;
      const p = placeById.get(el.dataset.place!)!;
      setHover(p.id);
      const [x, y] = transform.apply(p.xy);
      showTooltip(x, y, p.name, `${fmtCoords(p)} · ${plural(p.photos, 'photo')}`);
    })
    .on('pointerout', (ev: PointerEvent) => {
      const rc = closestTo(ev, '[data-region-chip]');
      if (rc) {
        select(rc).classed('is-hover', false);
        preview(null);
        hideTooltip();
        return;
      }
      if (closestTo(ev, '[data-place]')) hideTooltip();
    })
    .on('click', (ev: MouseEvent) => {
      const rc = closestTo(ev, '[data-region-chip]');
      if (rc) {
        ev.stopPropagation();
        hideTooltip();
        preview(null);
        lastTrigger = null;
        selectRegion(regionById.get(rc.dataset.regionChip!)!);
        return;
      }
      const el = closestTo(ev, '[data-place]');
      if (!el) return;
      ev.stopPropagation();
      lastTrigger = null;
      selectPlace(placeById.get(el.dataset.place!)!);
    });

  world
    .on('pointerover', (ev: PointerEvent) => {
      const el = closestTo(ev, '.route');
      if (!el) return;
      const t = regionById.get(el.dataset.region!)!;
      const b = stage.getBoundingClientRect();
      preview(t);
      showTooltip(ev.clientX - b.left, ev.clientY - b.top, t.title, `${STATE_NAMES[t.state]} · ${regionKm(t)}`);
    })
    .on('pointerout', (ev: PointerEvent) => {
      if (!closestTo(ev, '.route')) return;
      preview(null);
      hideTooltip();
    })
    .on('click', (ev: MouseEvent) => {
      const route = closestTo(ev, '.route');
      if (route) {
        lastTrigger = null;
        selectRegion(regionById.get(route.dataset.region!)!);
        return;
      }
      const state = closestTo(ev, '.state');
      if (state) zoomToState(state.dataset.state!);
    });

  /* ---------- selection ---------- */
  function setActiveRegion(region: Region | null) {
    activeRegion = region;
    svg.classed('has-active', !!region).classed('show-regions', transform.k >= REGION_K || !!region);
    routeSel().classed('is-active', (d) => !!region && d.reg === region).filter((d) => !!region && d.reg === region).raise();
    placeSel().classed('in-region', (d) => d.reg === region);
    root.querySelectorAll<HTMLButtonElement>('.region-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.region === region?.id)));
  }

  function selectPlace(p: Place, focus = false) {
    if (!introDone) finishIntro();
    selected = p;
    setActiveRegion(p.reg);
    placeSel().classed('is-selected', (d) => d === p);
    panel.open(p, { region: p.reg, index: p.gi, total: PLACES.length, prev: PLACES[p.gi - 1], next: PLACES[p.gi + 1], tone: p.reg.tone, startName }, focus);
    stage.classList.add('panel-open');
    const k = Math.max(transform.k, Math.min(MAX_ZOOM, Math.max(6, 56 / Math.max(p.nn, 0.5))));
    const r = visibleRect();
    go(zoomIdentity.translate(r.x + r.w / 2, r.y + r.h / 2).scale(k).translate(-p.xy[0], -p.xy[1]));
    live.textContent = `${p.name}, ${p.reg.title}. ${plural(p.photos, 'photograph')}.`;
  }

  function selectRegion(region: Region) {
    if (!introDone) finishIntro();
    closePanel(false);
    setActiveRegion(region);
    const xs = region.pts.map((d) => d[0]);
    const ys = region.pts.map((d) => d[1]);
    go(fitBounds([[min(xs)!, min(ys)!], [max(xs)!, max(ys)!]], 96));
    live.textContent = `${region.title}, ${STATE_NAMES[region.state]}. ${plural(region.places.length, 'place')}.`;
  }

  function zoomToState(id: string) {
    const features = GEO.states.features.filter((f) => f.id === id);
    const b = path.bounds({ type: 'FeatureCollection', features } as FeatureCollection<Geometry>) as [Pt, Pt];
    closePanel(false);
    go(fitBounds(b, 48));
  }

  function reset() {
    closePanel(false);
    setActiveRegion(null);
    go(zoomIdentity, 1200);
    live.textContent = 'Showing all of Australia.';
  }

  /* ---------- panel ---------- */
  function closePanel(restoreFocus = true) {
    if (!panel.close()) return;
    stage.classList.remove('panel-open');
    selected = null;
    placeSel().classed('is-selected', false);
    chipSel().classed('is-selected', false);
    if (restoreFocus && lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
    setTimeout(annotate, 560);
  }

  function step(dir: -1 | 1) {
    if (!selected) return;
    const n = PLACES[selected.gi + dir];
    if (n) selectPlace(n);
  }

  document.addEventListener('keydown', (e) => {
    if (!panel.isOpen()) return;
    if (e.key === 'Escape') closePanel();
    const typing = (e.target as Element | null)?.closest?.('input, textarea, select');
    if (!typing && e.key === 'ArrowLeft') step(-1);
    if (!typing && e.key === 'ArrowRight') step(1);
  });

  /* ---------- controls ---------- */
  const zoomIn = $<HTMLButtonElement>('zoom-in');
  const zoomOut = $<HTMLButtonElement>('zoom-out');
  const scaleBy = (f: number) => (reduced ? svg.call(zoom.scaleBy, f) : svg.transition().duration(450).call(zoom.scaleBy, f));
  zoomIn.addEventListener('click', () => scaleBy(2));
  zoomOut.addEventListener('click', () => scaleBy(0.5));
  $('zoom-reset').addEventListener('click', reset);
  function updateControls() {
    zoomIn.disabled = transform.k >= MAX_ZOOM - 0.01;
    zoomOut.disabled = transform.k <= 1.01;
  }

  const scaleBar = select($<SVGSVGElement>('scalebar'));
  const scaleText = $('scale-text');
  function updateScale() {
    const r = visibleRect();
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const a = projection.invert?.(transform.invert([cx - 50, cy]));
    const b = projection.invert?.(transform.invert([cx + 50, cy]));
    if (!a || !b) return;
    const kmPerPx = (geoDistance(a, b) * 6371) / 100;
    const nice = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].filter((n) => n / kmPerPx <= 110).pop() ?? 1;
    const px = Math.round(nice / kmPerPx);
    scaleBar.attr('width', px + 1);
    scaleBar.select('.scale-line').attr('x2', px);
    scaleBar.select('.scale-r').attr('x1', px - 0.5).attr('x2', px - 0.5);
    scaleText.textContent = `${nice} km`;
  }

  /* ---------- region strip, grouped by state in the order the journey reaches them ---------- */
  $('legend-label').textContent = `The journey · ${fmtKm(journey.totalKm)} km`;
  const strip = $<HTMLUListElement>('regions');
  for (const [state, regs] of d3groups(REGIONS, (t) => t.state)) {
    const sli = document.createElement('li');
    sli.className = 'state-group';
    const sb = document.createElement('button');
    sb.type = 'button';
    sb.className = 'state-tag';
    sb.textContent = state;
    sb.title = `Zoom to ${STATE_NAMES[state]}`;
    sb.addEventListener('click', () => {
      lastTrigger = sb;
      setActiveRegion(null);
      zoomToState(state);
    });
    sli.append(sb);
    strip.append(sli);
    for (const t of regs) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'region-btn';
      b.dataset.region = t.id;
      b.setAttribute('aria-pressed', 'false');
      const title = document.createElement('span');
      title.className = 'region-title';
      title.textContent = t.title;
      const meta = document.createElement('span');
      meta.className = 'region-meta';
      meta.textContent = `${fmtKm(t.kmDriven)} KM`;
      b.append(title, meta);
      b.title = `${regionKm(t)} · ${plural(t.places.length, 'place')}${t.visits > 1 ? ` · passed through ${t.visits} times` : ''}`;
      b.addEventListener('click', () => {
        lastTrigger = b;
        if (activeRegion === t && !selected) reset();
        else selectRegion(t);
      });
      b.addEventListener('pointerenter', () => preview(t));
      b.addEventListener('pointerleave', () => preview(null));
      li.append(b);
      strip.append(li);
    }
  }

  /* ---------- location picker ---------- */
  createPicker(root, REGIONS.filter((r) => r.places.length).map((r) => ({ region: r, places: r.places })), (p, trigger) => {
    lastTrigger = trigger;
    selectPlace(placeById.get(p.id)!, true);
  });

  /* ---------- intro: the route draws itself in order, dots arrive as the line reaches them ---------- */
  let introTimer: ReturnType<typeof setTimeout> | undefined;
  function playIntro() {
    if (reduced) {
      finishIntro();
      return;
    }
    const t0 = 300;
    const at = (km: number) => t0 + (INTRO_MS * km) / journey.totalKm;
    routeSel().each(function (sg) {
      const p = select(this).select<SVGPathElement>('.route-line');
      const len = p.node()!.getTotalLength();
      p.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len)
        .transition('intro').delay(at(sg.km0)).duration(at(sg.km1) - at(sg.km0)).ease(easeLinear).attr('stroke-dashoffset', 0)
        .on('end', () => { p.attr('stroke-dasharray', null).attr('stroke-dashoffset', null); });
    });
    PLACES.forEach((p) => { p.reveal = at(p.km); });
    placeSel().style('opacity', 0).transition('intro').delay((d) => d.reveal).duration(500).style('opacity', 1);
    introTimer = setTimeout(finishIntro, at(journey.totalKm) + 500);
  }
  function finishIntro() {
    if (introDone) return;
    introDone = true;
    clearTimeout(introTimer);
    gRoutes.selectAll('.route-line').interrupt('intro').attr('stroke-dasharray', null).attr('stroke-dashoffset', null);
    placeSel().interrupt('intro').style('opacity', null);
    annotate();
  }

  reduceToggle.addEventListener('change', () => {
    reduced = reduceToggle.checked;
    if (reduced) finishIntro();
  });
  motionQuery.addEventListener('change', (e) => {
    reduced = e.matches;
    reduceToggle.checked = reduced;
  });

  /* ---------- start ---------- */
  build();
  position();
  updateControls();
  playIntro();

  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (stage.clientWidth === W && stage.clientHeight === H) return;
      build();
      transform = zoomIdentity;
      svg.call(zoom.transform, transform);
      if (selected) selectPlace(selected);
      else if (activeRegion) selectRegion(activeRegion);
      position();
      annotate();
    }, 150);
  }).observe(stage);

  document.fonts?.ready.then(() => {
    widths.clear();
    annotate();
  });
}

