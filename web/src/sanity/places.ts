import { defineQuery } from 'groq';
import { client } from './client';
import type { PlaceInput } from '../lib/map/types';

const PLACES_QUERY = defineQuery(`*[_type == "place" && defined(name) && defined(location)] | order(name asc) {
  name,
  "lon": location.lng,
  "lat": location.lat,
  "photos": count(images[defined(asset)]),
  print,
  story,
  storyHref,
  printHref,
  "images": images[defined(asset)]{ "src": asset->url + "?w=1600&auto=format", alt }
}`);

/** Published places, in the shape the map takes */
export async function getPlaces(): Promise<PlaceInput[]> {
  const places = await client.fetch(PLACES_QUERY);
  return places.map((p) => ({
    name: p.name!,
    lon: p.lon!,
    lat: p.lat!,
    photos: p.photos ?? 0,
    print: p.print ?? false,
    story: p.story ?? undefined,
    storyHref: p.storyHref ?? undefined,
    printHref: p.printHref ?? undefined,
    images: p.images?.map((image) => ({ src: image.src!, alt: image.alt ?? '' })),
  }));
}
