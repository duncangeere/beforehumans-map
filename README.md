# Before Humans — London Map

Procedural biome map of London before human settlement. Perlin noise + real river paths + elevation data → biomes on a Leaflet map.

## Run

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Files

- `index.html` — page, styles, map setup
- `data-london-boundary.json` — Greater London GeoJSON boundary
- `js/app.js` — init and Leaflet config
- `js/generate.js` — biome generation
- `js/noise.js` — Perlin noise
- `js/rivers.js` — river paths and proximity
- `js/topology.js` — elevation data
- `js/boundary.js` — boundary loading/clipping

Uses Leaflet and Turf.js (loaded from CDN). No build step.
