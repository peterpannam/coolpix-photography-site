/**
 * Build-time only: place each photo location on the journey.
 *
 * A place takes the region and distance-along-route of the nearest point of the route. That keeps every dot
 * consistent with the line it sits on, and needs nothing but src/data/journey.json at build time. Where the route
 * passes the same spot twice (an out-and-back), the first pass wins. A photo taken
 * well off the road near a regional border could take the neighbouring region; places further than `warnKm`
 * from the route are reported in the build log (usually a side trip the route export doesn't include).
 */
import type { Journey, PlaceInput, PlacedPlace, Pt } from './types';
import { slug } from './format';

const R_KM = 6371;
const rad = Math.PI / 180;

function haversine([lon1, lat1]: Pt, [lon2, lat2]: Pt): number {
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function placeOnJourney(places: PlaceInput[], journey: Journey, warnKm = 25, samePassKm = 1): PlacedPlace[] {
  const stateOf = new Map(journey.regions.map((r) => [r.id, r.state]));
  // cumulative distance along each simplified segment, scaled to the segment's true km
  const segs = journey.segments.map((s) => {
    const cum = [0];
    for (let i = 1; i < s.route.length; i++) cum.push(cum[i - 1] + haversine(s.route[i - 1], s.route[i]));
    const len = cum[cum.length - 1] || 1;
    return { s, cum, scale: (s.km1 - s.km0) / len };
  });

  return places.map((p) => {
    // nearest point on the route's edges (not just its vertices: a long straight road has few of those),
    // measured in a local plane around the place
    const kx = 111.32 * Math.cos(p.lat * rad);
    const ky = 110.57;
    const local = ([lon, lat]: Pt): Pt => [(lon - p.lon) * kx, (lat - p.lat) * ky];
    // every edge's nearest point, in journey order
    const hits: { d: number; region: string; km: number }[] = [];
    for (const { s, cum, scale } of segs) {
      for (let i = 0; i < s.route.length; i++) {
        const [ax, ay] = local(s.route[i]);
        let t = 0;
        let dx = 0;
        let dy = 0;
        if (i + 1 < s.route.length) {
          const [bx, by] = local(s.route[i + 1]);
          dx = bx - ax;
          dy = by - ay;
          const len2 = dx * dx + dy * dy;
          t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
        }
        hits.push({
          d: Math.hypot(ax + t * dx, ay + t * dy),
          region: s.region,
          km: s.km0 + (cum[i] + t * ((cum[i + 1] ?? cum[i]) - cum[i])) * scale,
        });
      }
    }
    // The closest pass, except that a road driven twice (out and back) counts from the first time through
    // (a pass is a run of consecutive edges within samePassKm of the closest; take the nearest point of the first run)
    const best = Math.min(...hits.map((h) => h.d));
    let i = hits.findIndex((h) => h.d <= best + samePassKm);
    let pick = hits[i];
    for (; i < hits.length && hits[i].d <= best + samePassKm; i++) if (hits[i].d < pick.d) pick = hits[i];
    const { region, km } = pick;
    if (best > warnKm) {
      console.warn(`[map] "${p.name}" is ${best.toFixed(0)} km from the route; is a side trip missing from the route export?`);
    }
    return {
      ...p,
      id: slug(p.name),
      region,
      state: stateOf.get(region) ?? '',
      km: Math.round(km),
      offRouteKm: Math.round(best * 10) / 10,
    };
  });
}
