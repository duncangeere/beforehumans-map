// Main application controller

let map;
let biomeLayer;
let riverLayer;
let currentGeoJSON = null;

const BIOME_STYLES = {
  forest: {
    color: '#1a3e16',
    fillColor: '#2d5a27',
    fillOpacity: 0.75,
    weight: 0.5,
    label: 'Forest'
  },
  grassland: {
    color: '#5a8a30',
    fillColor: '#7cb342',
    fillOpacity: 0.7,
    weight: 0.5,
    label: 'Grassland'
  },
  wetland: {
    color: '#1a6b63',
    fillColor: '#26a69a',
    fillOpacity: 0.75,
    weight: 0.5,
    label: 'Wetland'
  },
  beach: {
    color: '#b8864e',
    fillColor: '#d4a76a',
    fillOpacity: 0.75,
    weight: 0.5,
    label: 'Beach'
  }
};

function initMap() {
  map = L.map('map', {
    center: [51.509, -0.118],
    zoom: 11,
    zoomControl: false
  });

  // Add zoom control to bottom-right
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Subtle grey basemap
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  // Draw boundary outline
  L.geoJSON(turf.polygon([LONDON_BOUNDARY]), {
    style: {
      color: '#ffffff',
      weight: 1.5,
      fillColor: 'transparent',
      fillOpacity: 0,
      dashArray: '6 4',
      opacity: 0.4
    }
  }).addTo(map);

  // Initialize layers
  biomeLayer = L.layerGroup().addTo(map);
  riverLayer = L.layerGroup().addTo(map);
}

function displayGeoJSON(geojson) {
  clearMap();
  currentGeoJSON = geojson;

  // Separate features by type
  const biomePolygons = geojson.features.filter(f =>
    (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') &&
    f.properties.biome
  );
  const thamesFeatures = geojson.features.filter(f =>
    f.properties.type === 'thames'
  );
  const rivers = geojson.features.filter(f =>
    (f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString') &&
    f.properties.type === 'river'
  );

  // Add biome polygons
  for (const feature of biomePolygons) {
    const biome = feature.properties.biome;
    const style = BIOME_STYLES[biome] || BIOME_STYLES.grassland;

    const layer = L.geoJSON(feature, {
      style: {
        color: style.color,
        fillColor: style.fillColor,
        fillOpacity: style.fillOpacity,
        weight: style.weight
      },
      onEachFeature: (feat, lyr) => {
        lyr.on('mouseover', function(e) {
          this.setStyle({ weight: 2, fillOpacity: 0.9 });
          showInfo(feat.properties);
        });
        lyr.on('mouseout', function(e) {
          this.setStyle({ weight: style.weight, fillOpacity: style.fillOpacity });
          hideInfo();
        });
        lyr.on('click', function(e) {
          showInfo(feat.properties, true);
        });
      }
    });

    biomeLayer.addLayer(layer);
  }

  // Add Thames as part of the base polygon layer (not an overlay)
  for (const feature of thamesFeatures) {
    const isPolygon = feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon';

    const thamesStyle = isPolygon ? {
      color: '#0d47a1',
      fillColor: '#1565c0',
      fillOpacity: 0.7,
      weight: 0.5
    } : {
      color: '#1565c0',
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round'
    };

    const layer = L.geoJSON(feature, {
      style: thamesStyle,
      onEachFeature: (feat, lyr) => {
        lyr.on('mouseover', function() {
          if (isPolygon) {
            this.setStyle({ fillOpacity: 0.85, weight: 2 });
          } else {
            this.setStyle({ weight: 7, opacity: 1 });
          }
          showInfo({ type: 'thames', name: 'River Thames', category: 'major_river' });
        });
        lyr.on('mouseout', function() {
          this.setStyle(thamesStyle);
          hideInfo();
        });
      }
    });

    biomeLayer.addLayer(layer);
  }

  // Add tributary rivers
  for (const feature of rivers) {
    const layer = L.geoJSON(feature, {
      style: {
        color: '#42a5f5',
        weight: 2,
        opacity: 0.7,
        lineCap: 'round',
        lineJoin: 'round'
      },
      onEachFeature: (feat, lyr) => {
        lyr.on('mouseover', function() {
          this.setStyle({ weight: 4, opacity: 1 });
          showInfo({ type: 'river', name: feat.properties.name, category: feat.properties.category });
        });
        lyr.on('mouseout', function() {
          this.setStyle({ weight: 2, opacity: 0.7 });
          hideInfo();
        });
      }
    });

    riverLayer.addLayer(layer);
  }

  // Enable save/discard buttons
  document.getElementById('btn-save').disabled = false;
  document.getElementById('btn-discard').disabled = false;

  // Show stats
  updateStats(biomePolygons, rivers, thamesFeatures);
}

function clearMap() {
  biomeLayer.clearLayers();
  riverLayer.clearLayers();
  currentGeoJSON = null;
  document.getElementById('btn-save').disabled = true;
  document.getElementById('btn-discard').disabled = true;
  document.getElementById('stats').innerHTML = '';
  hideInfo();
}

function showInfo(props, pinned = false) {
  const info = document.getElementById('info');

  if (props.biome) {
    const style = BIOME_STYLES[props.biome];
    const areaHa = props.area_ha || 0;
    const walkMin = Math.round(Math.sqrt(areaHa * 10000) / 80); // ~80m/min walking
    info.innerHTML = `
      <span class="biome-dot" style="background: ${style.fillColor}"></span>
      <strong>${style.label}</strong>
      <span class="info-detail">${areaHa} ha · ~${walkMin} min walk across</span>
    `;
  } else if (props.type === 'river' || props.type === 'thames') {
    const color = props.type === 'thames' ? '#1565c0' : '#42a5f5';
    const label = props.type === 'thames' ? 'Major river' :
                  props.category === 'major_river' ? 'Major river' : 'Lost river';
    info.innerHTML = `
      <span class="biome-dot" style="background: ${color}"></span>
      <strong>${props.name}</strong>
      <span class="info-detail">${label}</span>
    `;
  }

  info.classList.add('visible');
}

function hideInfo() {
  document.getElementById('info').classList.remove('visible');
}

function updateStats(polygons, rivers, thamesFeatures) {
  const counts = { forest: 0, grassland: 0, wetland: 0, beach: 0 };
  const areas = { forest: 0, grassland: 0, wetland: 0, beach: 0 };

  for (const f of polygons) {
    const b = f.properties.biome;
    if (!b) continue;
    counts[b] = (counts[b] || 0) + 1;
    areas[b] = (areas[b] || 0) + (f.properties.area_ha || 0);
  }

  const totalArea = Object.values(areas).reduce((a, b) => a + b, 0);

  const stats = document.getElementById('stats');
  stats.innerHTML = Object.entries(BIOME_STYLES).map(([biome, style]) => {
    const pct = totalArea > 0 ? Math.round(areas[biome] / totalArea * 100) : 0;
    return `<div class="stat-item">
      <span class="biome-dot" style="background: ${style.fillColor}"></span>
      <span class="stat-label">${style.label}</span>
      <span class="stat-value">${pct}%</span>
    </div>`;
  }).join('') + `<div class="stat-item">
    <span class="biome-dot" style="background: #42a5f5"></span>
    <span class="stat-label">Rivers</span>
    <span class="stat-value">${rivers.length}</span>
  </div>`;
}

async function handleGenerate() {
  const seedInput = document.getElementById('seed-input');
  const seed = seedInput.value ? parseInt(seedInput.value) : Math.floor(Math.random() * 100000);
  seedInput.value = seed;

  const btn = document.getElementById('btn-generate');
  const spinner = document.getElementById('spinner');

  btn.disabled = true;
  spinner.classList.add('visible');
  document.getElementById('status-text').textContent = 'Generating biome map...';

  // Use requestAnimationFrame to let the UI update before heavy computation
  await new Promise(r => requestAnimationFrame(r));
  await new Promise(r => setTimeout(r, 50));

  try {
    const geojson = generateBiomeMap(seed);
    displayGeoJSON(geojson);
    document.getElementById('status-text').textContent = `Map generated (seed: ${seed})`;
  } catch (e) {
    console.error('Generation failed:', e);
    document.getElementById('status-text').textContent = 'Generation failed — try another seed';
  }

  btn.disabled = false;
  spinner.classList.remove('visible');
}

function handleSave() {
  if (!currentGeoJSON) return;

  const seed = document.getElementById('seed-input').value;
  const blob = new Blob([JSON.stringify(currentGeoJSON, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `before-humans-london-${seed}.geojson`;
  a.click();
  URL.revokeObjectURL(url);

  document.getElementById('status-text').textContent = `Saved as before-humans-london-${seed}.geojson`;
}

function handleDiscard() {
  clearMap();
  document.getElementById('status-text').textContent = 'Map discarded';
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  initMap();

  document.getElementById('btn-generate').addEventListener('click', handleGenerate);
  document.getElementById('btn-save').addEventListener('click', handleSave);
  document.getElementById('btn-discard').addEventListener('click', handleDiscard);

  // Enter key on seed input triggers generate
  document.getElementById('seed-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleGenerate();
  });
});
