export const STATE_NAMES: Record<string, string> = {
  VIC: 'Victoria',
  NSW: 'New South Wales',
  SA: 'South Australia',
  NT: 'Northern Territory',
  WA: 'Western Australia',
  QLD: 'Queensland',
  TAS: 'Tasmania',
  ACT: 'Australian Capital Territory',
};

/** Label anchors [name, lon, lat], placed by hand rather than at centroids. */
export const STATE_LABELS: [string, number, number][] = [
  ['Western Australia', 122.4, -25.6],
  ['Northern Territory', 133.4, -19.4],
  ['South Australia', 135.4, -30.0],
  ['Queensland', 144.4, -22.6],
  ['New South Wales', 146.6, -32.2],
  ['Victoria', 144.2, -36.8],
  ['Tasmania', 146.6, -42.1],
];

export const SEA_LABELS: [string, number, number][] = [
  ['Indian Ocean', 109.8, -27.5],
  ['Timor Sea', 126.5, -11.6],
  ['Arafura Sea', 135.5, -9.6],
  ['Gulf of Carpentaria', 139.2, -14.6],
  ['Coral Sea', 152.6, -17.6],
  ['Tasman Sea', 155.2, -36.0],
  ['Great Australian Bight', 130.6, -35.2],
];

/** Placeholder photo palettes, until real photographs are loaded. */
export interface Tone { sky: [string, string]; ridges: string[]; water: string | null }

export const TONES: Record<string, Tone> = {
  coast: { sky: ['#d3dbdc', '#eef1f1'], ridges: ['#93a5a2', '#64797a', '#3e5052'], water: '#8fa3a8' },
  desert: { sky: ['#e2d3c2', '#f4ede3'], ridges: ['#c69168', '#a0603d', '#6e3b24'], water: null },
  tropic: { sky: ['#d6dccf', '#eff1ea'], ridges: ['#9fa98c', '#6f7d5f', '#465339'], water: '#93a6a0' },
  rust: { sky: ['#dfd2c0', '#f2ebdf'], ridges: ['#b8835a', '#87553a', '#523525'], water: '#8e9c95' },
  reef: { sky: ['#dcd6c8', '#f1ede4'], ridges: ['#b98a63', '#8a5d3f', '#5a3b28'], water: '#6f9fa3' },
  south: { sky: ['#d2d9dd', '#edf0f1'], ridges: ['#a0a9ac', '#717e82', '#475357'], water: '#8594a0' },
};

export const REGION_TONE: Record<string, keyof typeof TONES> = {
  'greater-melbourne': 'coast', gippsland: 'coast', hume: 'south', grampians: 'south', 'south-east-tablelands': 'coast',
  'limestone-coast': 'south', 'murray-mallee': 'south', 'adelaide-hills': 'south', 'eastern-adelaide': 'south',
  'southern-adelaide': 'south', 'western-adelaide': 'south', 'northern-adelaide': 'south', 'barossa-light-lower-north': 'south',
  'yorke-mid-north': 'desert', 'far-north-sa': 'desert', 'eyre-western': 'south', 'central-australia': 'desert',
  barkly: 'desert', 'big-rivers': 'tropic', 'top-end': 'tropic', 'greater-darwin': 'tropic', kimberley: 'rust',
  pilbara: 'rust', gascoyne: 'reef', 'mid-west': 'reef', wheatbelt: 'desert', perth: 'reef', peel: 'reef',
  'south-west': 'south', 'great-southern': 'south', 'goldfields-esperance': 'south', 'north-queensland': 'desert',
  'far-north-queensland': 'tropic',
};

export const MAX_ZOOM = 16;
/** Whole country: states only. Zoomed into a state: region callouts. Closer in, or a region chosen: place callouts. */
export const REGION_K = 1.6;
export const PLACE_K = 6;
/** Dots closer than this (px) share a callout stack */
export const CROWD_PX = 16;
export const CHIP_H = 18;
export const CHIP_GAP = 4;
export const CHIP_OFFSET = 30;
/** Duration of the route drawing on load, for the whole journey (ms) */
export const INTRO_MS = 7000;
