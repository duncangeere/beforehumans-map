# Before Humans: Pre-Settlement London Biome Map Generator

## Overview
A local web tool that generates plausible maps of what London looked like before human settlement. Outputs GeoJSON with biome polygons (forest, grassland, wetland, beach) and lost river line features.

## Architecture
Single-page web app served locally via Python's `http.server` (no build step). All generation runs client-side in the browser.

### Tech Stack
- **Map rendering**: Leaflet.js (CDN)
- **Geo operations**: Turf.js (CDN) — for voronoi, boolean operations, merging polygons
- **Noise**: Simple open-noise-js or inline simplex implementation
- **Serving**: `python3 -m http.server 8000`

### Files
```
beforehumans/
├── index.html          # Single entry point, includes CSS
├── js/
│   ├── app.js          # Main app controller, UI logic
│   ├── generate.js     # Biome generation algorithm
│   ├── rivers.js       # Lost river coordinate data + Thames
│   ├── boundary.js     # Greater London boundary GeoJSON
│   ├── topology.js     # Encoded elevation knowledge for London
│   └── noise.js        # Simplex noise implementation
├── PLAN.md
└── README.md (not creating)
```

## Data Sources (Embedded)

### 1. Greater London Boundary
Fetched once from GitHub (utisz/compound-cities) and embedded in `boundary.js`. Single polygon outline.

### 2. Lost Rivers (Hardcoded Coordinates)
Approximate paths based on known geography, encoded as LineString coordinates:
- **North bank tributaries**: Fleet, Tyburn, Westbourne, Walbrook, Counter's Creek, Stamford Brook, Moselle, Hackney Brook, Black Ditch
- **South bank tributaries**: Effra, Neckinger, Falcon Brook, Earl's Sluice, Ravensbourne, Quaggy, Wandle, Peck
- **Thames**: Historical wider/marshier path

### 3. Topography (Encoded Knowledge)
Key elevation points hardcoded (no DEM download needed):
- **High ground**: Hampstead Heath (~130m), Highgate (~130m), Shooters Hill (~130m), Crystal Palace (~110m), Harrow (~125m), Alexandra Palace (~100m), Parliament Hill, Sydenham Hill
- **Low ground**: Thames floodplain (~0-5m), Lea Valley (~5m), marshes at Greenwich, Bermondsey, Southwark, Westminster
- Interpolation between known points using inverse distance weighting

## Generation Algorithm

### Step 1: Point Sampling
- Generate ~2000-4000 random points within the Greater London boundary using Turf.js `randomPoint` + `pointsWithinPolygon`
- Density adjusted so resulting Voronoi cells are 400m–5km across (5 min to 1 hour walking)

### Step 2: Voronoi Tessellation
- Create Voronoi diagram from points using Turf.js `voronoi`
- Clip cells to Greater London boundary

### Step 3: Biome Assignment
For each Voronoi cell centroid, compute:
- `elevation` — interpolated from known high/low points
- `riverDist` — distance to nearest lost river or Thames
- `thamesDist` — distance specifically to Thames
- `noise` — multi-octave simplex noise at that location

**Rules:**
1. **Beach**: Only along Thames riverbank where elevation < 5m AND within ~200m of Thames. Narrow strips.
2. **Wetland**: Near rivers (within ~500m) AND low elevation (<15m), OR in known marsh areas (Bermondsey, Hackney Marshes, Lea Valley). Noise modulates boundaries.
3. **Forest**: Higher elevation (>30m) OR moderate elevation with favorable noise. Dense on hills.
4. **Grassland**: Default biome. Mid-elevation areas, clearings, transitions between forest and wetland.

Noise adds natural irregularity so boundaries aren't purely geometric.

### Step 4: Polygon Merging
- Merge adjacent Voronoi cells sharing the same biome using Turf.js `union`
- Validate merged polygons meet size constraints (split if too large, merge if too small)

### Step 5: Output Assembly
- Combine biome polygons + river LineStrings into single FeatureCollection
- Each feature has properties: `type` (biome name or "river"), `name` (for rivers)

## UI Design

### Layout
- Full-screen map (Leaflet, dark/terrain basemap or no basemap)
- Floating control panel (top-right):
  - **"Generate" button** — creates new map with random seed
  - **Seed input** — optional, for reproducibility
  - **"Save GeoJSON" button** — downloads the file
  - **"Discard" button** — clears the map
- Bottom info bar showing hovered feature details

### Styling
- Each biome gets a distinct natural colour:
  - Forest: deep green (#2d5a27)
  - Grassland: golden green (#7cb342)
  - Wetland: teal blue (#26a69a)
  - Beach: sandy (#d4a76a)
- Rivers: blue lines (#1565c0) with varying width
- Thames: wider blue line
- Smooth transitions, slight transparency for layering over basemap
- Pleasant typography, subtle animations on generate

### Interaction
- Click any polygon to see biome type + area
- Hover highlights features
- Generate button shows brief loading spinner
- Save triggers immediate download of `.geojson` file

## Implementation Order
1. Set up `index.html` with Leaflet + Turf.js CDN links, basic layout
2. Create `boundary.js` with Greater London boundary data
3. Create `rivers.js` with all lost river paths
4. Create `topology.js` with elevation points
5. Create `noise.js` with simplex noise
6. Create `generate.js` with the generation algorithm
7. Create `app.js` to wire everything together
8. Test and refine biome distribution, colours, polygon sizes
