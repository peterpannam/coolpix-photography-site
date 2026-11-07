# coolpix-photography-site
photography website for my father

## The map

The home page is a D3 + SVG map of the trip (`src/components/MapGallery.astro`, logic in `src/lib/map/`).
Australia is drawn from ABS council boundaries grouped into each state's official regions, and the route is the
real one from `_geoJSON-routes/route-merged.geojson`, cut into chronological segments by region.

| File | What it is |
| --- | --- |
| `src/data/australia.topo.json` | States, coast, state borders and region borders (generated, ~210 KB) |
| `src/data/journey.json` | The route by region: total km, the regions in journey order, and the segments (generated) |
| `src/data/sample-places.json` | Sample landmarks along the route, standing in until the Sanity photo documents exist |
| `src/lib/map/locate.ts` | Puts each place on the journey at build time (region + km from the start) |
| `src/lib/map/map.ts` | The map itself: zoom, callouts, selection, the intro animation |
| `scripts/geo/` | The data pipeline that writes the two generated files |

Places only need `name`, `lon`, `lat` and `photos`; `placeOnJourney()` works out the region and distance from the
nearest point of the route (the first pass, where the route goes out and back) and warns in the build log about any
place more than 25 km off the route. Panel links appear when a place has `storyHref` / `printHref`, and real
photographs replace the placeholders when it has `images`.

### Rebuilding the map data

Only needed if the route or the region lists change. The generated files are committed, so a normal
`npm run build` doesn't need any of this.

1. Get the ABS LGA 2022 boundaries (CC BY 4.0) from the absmapsdata R package. No R needed:

   ```sh
   git clone --depth 1 --filter=blob:none --sparse https://github.com/wfmackey/absmapsdata.git /tmp/absmapsdata
   git -C /tmp/absmapsdata sparse-checkout set --no-cone /data/lga2022.rda
   mkdir -p data-raw && cp /tmp/absmapsdata/data/lga2022.rda data-raw/
   ```

2. Run the pipeline (Python 3 for the first step, Node for the rest):

   ```sh
   npm run geo            # = geo:lga, then geo:regions (a few minutes), then geo:journey
   npm run geo:journey    # just the route, after changing _geoJSON-routes/route-merged.geojson
   ```

`data-raw/` is git-ignored; it holds the converted boundaries and a full-detail copy of the council polygons that
`geo:journey` uses to place every route point.

**Official regions.** `scripts/geo/regions-official.mjs` lists the councils in each region, with its sources
(WA Regional Development Commissions Act, Regional Development Victoria, NSW Regions Order 2020, SA Government Regions,
NT Government regions, Trade and Investment Queensland, Tasmania's planning regions). In WA, Victoria and NSW the
capital-city region is every council not listed elsewhere; in the other states the build stops if a council isn't
listed, and everywhere it stops if a listed name isn't found, so boundary updates can't silently misplace anything. Two SA lines
follow no council boundary (Port Adelaide Enfield's split between Northern and Western Adelaide, and the outback
between Eyre Western and Far North), so those borders aren't drawn where they're uncertain.
