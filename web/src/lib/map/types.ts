import type { Topology } from 'topojson-specification';

export type Pt = [number, number];

/** One official region the route passes through (from src/data/journey.json). */
export interface RegionInfo {
  id: string;
  title: string;
  /** State code: VIC, NSW, SA, NT, WA, QLD, TAS, ACT */
  state: string;
  /** Kilometres of the route inside this region, summed over every visit */
  kmDriven: number;
  /** Kilometres from the start of the journey where the route first enters the region */
  firstKm: number;
  /** How many separate times the route passes through */
  visits: number;
}

/** A chronological piece of the route that lies inside one region. */
export interface Segment {
  region: string;
  km0: number;
  km1: number;
  /** [lon, lat] pairs, simplified to 250 m */
  route: Pt[];
}

export interface Journey {
  totalKm: number;
  regions: RegionInfo[];
  segments: Segment[];
}

/** A place with photographs, as authored (sample data now, Sanity photo documents later). */
export interface PlaceInput {
  name: string;
  lon: number;
  lat: number;
  photos: number;
  print?: boolean;
  story?: string;
  /** Optional links; only rendered when present */
  storyHref?: string;
  printHref?: string;
  /** Real images once they exist; placeholders are drawn until then */
  images?: { src: string; alt: string }[];
}

/** A place after it has been located on the journey at build time. */
export interface PlacedPlace extends PlaceInput {
  id: string;
  region: string;
  state: string;
  /** Kilometres from the start of the journey to the nearest point of the route */
  km: number;
  /** Distance from the place to that nearest route point */
  offRouteKm: number;
}

export interface MapData {
  topo: Topology;
  journey: Journey;
  places: PlacedPlace[];
}
