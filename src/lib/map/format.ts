export const pad2 = (n: number): string => String(n).padStart(2, '0');

export const fmtKm = (n: number): string => n.toLocaleString('en-AU');

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

export const slug = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Degrees, minutes, seconds, e.g. 16°05′17″S */
export function dms(value: number, pos: string, neg: string): string {
  const hemi = value < 0 ? neg : pos;
  const a = Math.abs(value);
  let d = Math.floor(a);
  const mf = (a - d) * 60;
  let m = Math.floor(mf);
  let s = Math.round((mf - m) * 60);
  if (s === 60) { s = 0; m += 1; }
  if (m === 60) { m = 0; d += 1; }
  return `${d}°${pad2(m)}′${pad2(s)}″${hemi}`;
}

export const fmtCoords = (p: { lat: number; lon: number }): string =>
  `${dms(p.lat, 'N', 'S')} ${dms(p.lon, 'E', 'W')}`;
