// Biome map generation algorithm
// Generates Voronoi-based biome polygons within the Greater London boundary

function generateBiomeMap(seed) {
  const rng = seededRandom(seed);
  const noise = new SimplexNoise(seed);
  const boundary = turf.polygon([LONDON_BOUNDARY]);
  const bbox = turf.bbox(boundary);

  // Step 1: Generate sample points within boundary
  const points = generatePoints(boundary, bbox, rng);

  // Step 2: Create Voronoi cells
  const cells = createVoronoiCells(points, bbox, boundary);

  // Step 3: Assign biomes to each cell
  const biomeAssignments = assignBiomes(cells, noise);

  // Step 4: Merge adjacent same-biome cells
  const mergedPolygons = mergeBiomeCells(cells, biomeAssignments);

  // Step 5: Build Thames polygon
  const thamesFeature = buildThamesFeature(boundary);

  // Step 6: Cut Thames out of biome polygons so it sits cleanly in the map
  const cutPolygons = thamesFeature && thamesFeature.geometry.type !== 'LineString'
    ? subtractThames(mergedPolygons, thamesFeature)
    : mergedPolygons;

  // Step 7: Build river features
  const riverFeatures = buildRiverFeatures(boundary);

  // Step 8: Assemble output — Thames is part of the base polygons, not an overlay
  return assembleGeoJSON(cutPolygons, riverFeatures, thamesFeature);
}

// Seeded PRNG (mulberry32)
function seededRandom(seed) {
  let s = seed | 0;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generatePoints(boundary, bbox, rng) {
  const points = [];
  const [minLng, minLat, maxLng, maxLat] = bbox;

  // Target ~900m spacing (slightly coarser for speed)
  const step = 0.009;

  // Pre-compute boundary ring for fast ray-cast point-in-polygon
  const ring = boundary.geometry.coordinates[0];

  for (let lng = minLng; lng <= maxLng; lng += step) {
    for (let lat = minLat; lat <= maxLat; lat += step) {
      const jLng = lng + (rng() - 0.5) * step * 0.8;
      const jLat = lat + (rng() - 0.5) * step * 0.8;

      // Fast ray-cast point-in-polygon (avoids turf.point + turf.booleanPointInPolygon overhead)
      if (pointInRing(jLng, jLat, ring)) {
        points.push([jLng, jLat]);
      }
    }
  }

  return points;
}

// Fast ray-casting point-in-polygon (no Turf overhead)
function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function createVoronoiCells(points, bbox, boundary) {
  const pointCollection = turf.featureCollection(
    points.map(p => turf.point(p))
  );

  const voronoi = turf.voronoi(pointCollection, { bbox });
  const cells = [];

  for (let i = 0; i < voronoi.features.length; i++) {
    const cell = voronoi.features[i];
    if (!cell) continue;

    try {
      const clipped = turf.intersect(
        turf.featureCollection([cell, boundary])
      );
      if (clipped) {
        clipped.properties = { index: cells.length, centroid: points[i] };
        cells.push(clipped);
      }
    } catch (e) {
      // Skip invalid geometries
    }
  }

  return cells;
}

function getElevation(lng, lat) {
  let weightedSum = 0;
  let weightSum = 0;

  for (const pt of ELEVATION_POINTS) {
    const dx = (lng - pt.lng) * 70;
    const dy = (lat - pt.lat) * 111;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.01) return pt.elev;

    const weight = 1 / (dist * dist);
    weightedSum += pt.elev * weight;
    weightSum += weight;
  }

  return weightedSum / weightSum;
}

function distanceToLine(lng, lat, lineCoords) {
  let minDistSq = Infinity;
  const KM_PER_DEG_LNG = 70;
  const KM_PER_DEG_LAT = 111;

  for (let i = 0; i < lineCoords.length - 1; i++) {
    const x1 = lineCoords[i][0], y1 = lineCoords[i][1];
    const x2 = lineCoords[i + 1][0], y2 = lineCoords[i + 1][1];

    const dx = (x2 - x1) * KM_PER_DEG_LNG;
    const dy = (y2 - y1) * KM_PER_DEG_LAT;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0) {
      t = ((lng - x1) * KM_PER_DEG_LNG * dx + (lat - y1) * KM_PER_DEG_LAT * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const projX = (x1 + t * (x2 - x1)) * KM_PER_DEG_LNG;
    const projY = (y1 + t * (y2 - y1)) * KM_PER_DEG_LAT;
    const px = lng * KM_PER_DEG_LNG;
    const py = lat * KM_PER_DEG_LAT;
    const dSq = (px - projX) * (px - projX) + (py - projY) * (py - projY);

    if (dSq < minDistSq) minDistSq = dSq;
  }

  return Math.sqrt(minDistSq);
}

function nearestRiverDistance(lng, lat) {
  let minDist = Infinity;
  for (const river of LOST_RIVERS) {
    const d = distanceToLine(lng, lat, river.coordinates);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

function thamesDistance(lng, lat) {
  return distanceToLine(lng, lat, THAMES_CENTERLINE);
}

function inKnownMarsh(lng, lat) {
  for (const marsh of KNOWN_MARSHES) {
    const dx = (lng - marsh.lng) * 70;
    const dy = (lat - marsh.lat) * 111;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < marsh.radius) return true;
  }
  return false;
}

function inKnownForest(lng, lat) {
  for (const forest of KNOWN_FORESTS) {
    const dx = (lng - forest.lng) * 70;
    const dy = (lat - forest.lat) * 111;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < forest.radius) return true;
  }
  return false;
}

// Distance from a point to the nearest edge of the Thames polygon (in km)
// Uses fast math instead of Turf for each segment
function distanceToThamesEdge(lng, lat) {
  // Quick check: if far from Thames lat range, skip
  if (lat > 51.52 || lat < 51.43) return 10;

  // Check if inside the Thames polygon (fast ray-cast)
  if (pointInRing(lng, lat, THAMES_POLYGON)) return 0;

  // Find nearest edge segment using fast approximate distance
  let minDistSq = Infinity;
  const KM_PER_DEG_LNG = 70; // at London's latitude
  const KM_PER_DEG_LAT = 111;

  for (let i = 0; i < THAMES_POLYGON.length - 1; i++) {
    const x1 = THAMES_POLYGON[i][0], y1 = THAMES_POLYGON[i][1];
    const x2 = THAMES_POLYGON[i + 1][0], y2 = THAMES_POLYGON[i + 1][1];

    // Quick skip: if segment is far away in latitude
    if (lat > Math.max(y1, y2) + 0.02 || lat < Math.min(y1, y2) - 0.02) continue;
    // Quick skip: if segment is far away in longitude
    if (lng > Math.max(x1, x2) + 0.02 || lng < Math.min(x1, x2) - 0.02) continue;

    // Point-to-segment distance in km (projected coordinates)
    const dx = (x2 - x1) * KM_PER_DEG_LNG;
    const dy = (y2 - y1) * KM_PER_DEG_LAT;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0) {
      t = ((lng - x1) * KM_PER_DEG_LNG * dx + (lat - y1) * KM_PER_DEG_LAT * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const projX = (x1 + t * (x2 - x1)) * KM_PER_DEG_LNG;
    const projY = (y1 + t * (y2 - y1)) * KM_PER_DEG_LAT;
    const px = lng * KM_PER_DEG_LNG;
    const py = lat * KM_PER_DEG_LAT;
    const dSq = (px - projX) * (px - projX) + (py - projY) * (py - projY);

    if (dSq < minDistSq) minDistSq = dSq;
  }

  return Math.sqrt(minDistSq);
}

// Estimate Thames latitude at a given longitude (for south bank detection)
function estimateThamesLat(lng) {
  for (let i = 0; i < THAMES_CENTERLINE.length - 1; i++) {
    const [lng0, lat0] = THAMES_CENTERLINE[i];
    const [lng1, lat1] = THAMES_CENTERLINE[i + 1];
    if (lng >= lng0 && lng <= lng1) {
      const t = (lng - lng0) / (lng1 - lng0);
      return lat0 + t * (lat1 - lat0);
    }
  }
  // Outside range - use nearest endpoint
  if (lng < THAMES_CENTERLINE[0][0]) return THAMES_CENTERLINE[0][1];
  return THAMES_CENTERLINE[THAMES_CENTERLINE.length - 1][1];
}

function assignBiomes(cells, noise) {
  const assignments = [];

  for (const cell of cells) {
    const [lng, lat] = cell.properties.centroid;
    const elev = getElevation(lng, lat);
    const riverDist = nearestRiverDistance(lng, lat);
    const tDist = thamesDistance(lng, lat);

    // Multiple noise octaves at different frequencies for variety
    const n1 = noise.fbm(lng * 80, lat * 80, 4);   // Large-scale terrain
    const n2 = noise.fbm(lng * 200, lat * 200, 3);  // Fine detail
    const n3 = noise.fbm(lng * 40, lat * 40, 2);    // Very large variation
    // Extra noise layers for forest/grassland breaking
    const n4 = noise.fbm(lng * 150 + 50, lat * 150 + 50, 3); // Medium patchy
    const n5 = noise.fbm(lng * 300 + 100, lat * 300 + 100, 2); // Fine patchy

    let scores = { beach: 0, wetland: 0, forest: 0, grassland: 0 };

    // Is this point south of the Thames centerline?
    const isSouthBank = lat < estimateThamesLat(lng);

    // Distance to the Thames polygon edge (not centerline)
    const tPolyDist = distanceToThamesEdge(lng, lat);

    // Beach: gravel/sand shores at the water's edge
    // Must be RIGHT at the Thames edge - a narrow band
    // This is scored BEFORE wetland and gets an override bonus
    if (tPolyDist < 0.8 && elev < 12) {
      const edgeProximity = 1 - tPolyDist / 0.8;
      scores.beach = edgeProximity * 4.0;
      // Noise makes it patchy - some stretches are muddy (wetland), some sandy (beach)
      scores.beach *= Math.max(0, 0.4 + n5 * 0.8);
      // Gravel terraces slightly above water level
      if (elev > 2 && elev < 10) {
        scores.beach += 1.0;
      }
    }
    // Beach at tributary mouths
    if (riverDist < 0.4 && tDist < 2.5 && elev < 10) {
      scores.beach += (1 - riverDist / 0.4) * 2.0 * Math.max(0, 0.3 + n5 * 0.8);
    }

    // Wetland: THE dominant biome in low-lying areas
    if (elev < 15) {
      scores.wetland = (1 - elev / 15) * 2.5;
    }
    if (riverDist < 2.0 && elev < 25) {
      scores.wetland += (1 - riverDist / 2.0) * (1 - elev / 30) * 2.0;
    }
    if (tDist < 3.0 && elev < 15) {
      scores.wetland += (1 - tDist / 3.0) * (1 - elev / 15) * 3.0;
    }
    // South bank was overwhelmingly wetland
    if (isSouthBank && elev < 20 && tDist < 5.0) {
      scores.wetland += (1 - tDist / 5.0) * 2.0;
    }
    if (inKnownMarsh(lng, lat)) {
      scores.wetland += 3.0 + n1 * 0.5;
    }
    scores.wetland *= (0.8 + n1 * 0.4);
    // Suppress wetland RIGHT at the water's edge where beach should appear
    if (tPolyDist < 0.5 && scores.beach > 1.0) {
      scores.wetland *= 0.4;
    }

    // Forest: higher elevation, known woodland areas, AND noise-driven patches
    if (elev > 20) {
      scores.forest = (elev - 20) / 60 * 2.0;
    }
    if (inKnownForest(lng, lat)) {
      scores.forest += 2.5 + n1 * 0.5;
    }
    // Noise-driven forest patches - creates alternation with grassland
    const forestNoise = n3 * 0.6 + n4 * 0.8 + n5 * 0.4;
    scores.forest += Math.max(0, forestNoise * 1.8);
    if (elev > 15 && elev < 80) {
      scores.forest += 0.6;
    }
    scores.forest *= (0.5 + n2 * 0.6);
    // Suppress forest in very wet areas
    if (elev < 8) {
      scores.forest *= 0.2;
    }

    // Grassland: clearings, river meadows, drier transitions
    const grassNoise = noise.fbm(lng * 120 + 200, lat * 120 + 200, 3);
    scores.grassland = 0.8 + grassNoise * 0.8;
    if (elev > 10 && elev < 60) {
      scores.grassland += 0.4;
    }
    if (riverDist > 0.3 && riverDist < 2.0) {
      scores.grassland += 0.3;
    }
    // Suppress grassland in very wet areas
    if (elev < 8) {
      scores.grassland *= 0.3;
    }

    // Pick highest-scoring biome
    let bestBiome = 'grassland';
    let bestScore = -Infinity;
    for (const [biome, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestBiome = biome;
      }
    }

    assignments.push(bestBiome);
  }

  return assignments;
}

function mergeBiomeCells(cells, assignments) {
  const biomeGroups = { forest: [], grassland: [], wetland: [], beach: [] };
  cells.forEach((cell, i) => {
    biomeGroups[assignments[i]].push(cell);
  });

  const mergedFeatures = [];

  for (const [biome, biomeCells] of Object.entries(biomeGroups)) {
    if (biomeCells.length === 0) continue;

    const merged = treeUnion(biomeCells);
    if (!merged) continue;

    extractPolygons(merged, biome, mergedFeatures);
  }

  return mergedFeatures;
}

function treeUnion(polygons) {
  if (polygons.length === 0) return null;
  if (polygons.length === 1) return polygons[0];

  let current = [...polygons];

  while (current.length > 1) {
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      if (i + 1 < current.length) {
        try {
          const u = turf.union(turf.featureCollection([current[i], current[i + 1]]));
          next.push(u || current[i]);
        } catch (e) {
          next.push(current[i]);
          next.push(current[i + 1]);
        }
      } else {
        next.push(current[i]);
      }
    }
    current = next;
  }

  return current[0];
}

function extractPolygons(feature, biome, output) {
  if (!feature || !feature.geometry) return;

  if (feature.geometry.type === 'MultiPolygon') {
    for (const coords of feature.geometry.coordinates) {
      try {
        const poly = turf.polygon(coords);
        const area = turf.area(poly);
        poly.properties = {
          biome,
          area_sqm: Math.round(area),
          area_ha: Math.round(area / 10000 * 10) / 10
        };
        output.push(poly);
      } catch (e) {}
    }
  } else if (feature.geometry.type === 'Polygon') {
    try {
      const area = turf.area(feature);
      feature.properties = {
        biome,
        area_sqm: Math.round(area),
        area_ha: Math.round(area / 10000 * 10) / 10
      };
      output.push(feature);
    } catch (e) {}
  }
}

function subtractThames(biomePolygons, thamesFeature) {
  const result = [];
  for (const poly of biomePolygons) {
    try {
      const diff = turf.difference(turf.featureCollection([poly, thamesFeature]));
      if (diff) {
        // Preserve properties and extract any resulting polygons
        if (diff.geometry.type === 'MultiPolygon') {
          for (const coords of diff.geometry.coordinates) {
            try {
              const p = turf.polygon(coords);
              const area = turf.area(p);
              p.properties = {
                biome: poly.properties.biome,
                area_sqm: Math.round(area),
                area_ha: Math.round(area / 10000 * 10) / 10
              };
              result.push(p);
            } catch (e) {}
          }
        } else {
          const area = turf.area(diff);
          diff.properties = {
            biome: poly.properties.biome,
            area_sqm: Math.round(area),
            area_ha: Math.round(area / 10000 * 10) / 10
          };
          result.push(diff);
        }
      }
    } catch (e) {
      // If difference fails, keep original polygon
      result.push(poly);
    }
  }
  return result;
}

function buildRiverFeatures(boundary) {
  const features = [];
  const ring = boundary.geometry.coordinates[0];

  for (const river of LOST_RIVERS) {
    const coords = river.coordinates.filter(c => pointInRing(c[0], c[1], ring));

    if (coords.length >= 2) {
      features.push(turf.lineString(coords, {
        type: 'river',
        name: river.name,
        category: 'lost_river'
      }));
    }
  }

  return features;
}

function buildThamesFeature(boundary) {
  const props = { type: 'thames', name: 'River Thames', category: 'major_river' };

  // Try polygon approach
  try {
    const thamesPoly = turf.polygon([THAMES_POLYGON]);

    // Try clipping to boundary
    try {
      const clipped = turf.intersect(
        turf.featureCollection([thamesPoly, boundary])
      );
      if (clipped) {
        clipped.properties = props;
        return clipped;
      }
    } catch (e) {
      console.warn('Thames intersect failed, using unclipped polygon:', e.message);
    }

    // If intersect fails, return the raw polygon (it's roughly within London anyway)
    thamesPoly.properties = props;
    return thamesPoly;
  } catch (e) {
    console.warn('Thames polygon creation failed:', e.message);
  }

  // Last resort fallback: centerline
  const thamesCoords = THAMES_CENTERLINE.filter(c => {
    try {
      return turf.booleanPointInPolygon(turf.point(c), boundary);
    } catch { return true; }
  });
  if (thamesCoords.length >= 2) {
    return turf.lineString(thamesCoords, props);
  }
  return null;
}

function assembleGeoJSON(polygons, rivers, thames) {
  const features = [...polygons, ...rivers];
  if (thames) features.push(thames);
  return turf.featureCollection(features);
}
