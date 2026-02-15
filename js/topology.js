// London topography - known elevation points and features
// Elevation in metres above sea level
// Used for biome assignment via inverse distance weighting

const ELEVATION_POINTS = [
  // === HIGH GROUND (hills) ===
  // North
  { lng: -0.1780, lat: 51.5630, elev: 130, name: "Hampstead Heath" },
  { lng: -0.1500, lat: 51.5710, elev: 128, name: "Highgate Hill" },
  { lng: -0.1420, lat: 51.5560, elev: 98, name: "Parliament Hill" },
  { lng: -0.1080, lat: 51.5940, elev: 100, name: "Alexandra Palace" },
  { lng: -0.1050, lat: 51.5680, elev: 80, name: "Crouch Hill" },
  { lng: -0.0760, lat: 51.5650, elev: 50, name: "Stoke Newington" },
  { lng: -0.3370, lat: 51.5730, elev: 125, name: "Harrow on the Hill" },
  { lng: -0.2700, lat: 51.5590, elev: 85, name: "Horsenden Hill" },
  { lng: -0.1980, lat: 51.5400, elev: 60, name: "Primrose Hill" },
  { lng: -0.2850, lat: 51.5150, elev: 50, name: "Hanger Hill" },
  { lng: -0.1630, lat: 51.5200, elev: 30, name: "Regent's Park" },
  { lng: -0.0150, lat: 51.5800, elev: 30, name: "Epping Forest South" },
  { lng: -0.0500, lat: 51.6050, elev: 40, name: "Chingford" },

  // South
  { lng: 0.0770, lat: 51.4720, elev: 132, name: "Shooters Hill" },
  { lng: -0.0720, lat: 51.4180, elev: 110, name: "Crystal Palace" },
  { lng: -0.0860, lat: 51.4320, elev: 90, name: "Sydenham Hill" },
  { lng: -0.0040, lat: 51.4440, elev: 60, name: "Blackheath" },
  { lng: -0.1960, lat: 51.4280, elev: 55, name: "Wimbledon Common" },
  { lng: -0.2130, lat: 51.4400, elev: 65, name: "Putney Heath" },
  { lng: -0.1730, lat: 51.4100, elev: 50, name: "Mitcham Common" },
  { lng: -0.1280, lat: 51.4340, elev: 50, name: "Streatham Common" },
  { lng: -0.0580, lat: 51.3900, elev: 85, name: "Addington Hills" },
  { lng: 0.0250, lat: 51.4350, elev: 45, name: "Eltham" },
  { lng: -0.2830, lat: 51.4170, elev: 60, name: "Richmond Hill" },
  { lng: -0.3050, lat: 51.4470, elev: 55, name: "Richmond Park" },

  // West
  { lng: -0.4100, lat: 51.5050, elev: 40, name: "Northolt" },
  { lng: -0.4600, lat: 51.5100, elev: 35, name: "Hillingdon" },

  // East
  { lng: 0.1200, lat: 51.5050, elev: 20, name: "Barking" },
  { lng: 0.1800, lat: 51.4900, elev: 15, name: "Rainham" },

  // === LOW GROUND (valleys, floodplains, marshes) ===
  // Thames floodplain
  { lng: -0.1200, lat: 51.5000, elev: 3, name: "Westminster" },
  { lng: -0.0900, lat: 51.5080, elev: 4, name: "City of London (river)" },
  { lng: -0.0200, lat: 51.5050, elev: 2, name: "Isle of Dogs" },
  { lng: 0.0600, lat: 51.4950, elev: 1, name: "Woolwich" },
  { lng: 0.0950, lat: 51.4850, elev: 0, name: "Thamesmead" },
  { lng: -0.2000, lat: 51.4800, elev: 5, name: "Fulham" },
  { lng: -0.2500, lat: 51.4850, elev: 4, name: "Chiswick" },
  { lng: -0.3100, lat: 51.4700, elev: 5, name: "Kew" },

  // Lea Valley
  { lng: -0.0350, lat: 51.5500, elev: 5, name: "Hackney Marshes" },
  { lng: -0.0300, lat: 51.5700, elev: 8, name: "Walthamstow Marshes" },
  { lng: -0.0250, lat: 51.5900, elev: 10, name: "Lea Valley North" },

  // South bank marshes
  { lng: -0.0700, lat: 51.5000, elev: 2, name: "Bermondsey" },
  { lng: -0.1050, lat: 51.5020, elev: 3, name: "Southwark" },
  { lng: -0.1150, lat: 51.4900, elev: 3, name: "Lambeth" },
  { lng: 0.0100, lat: 51.4900, elev: 1, name: "Greenwich Marshes" },
  { lng: 0.0400, lat: 51.5000, elev: 1, name: "Silvertown" },

  // River valleys
  { lng: -0.1050, lat: 51.5200, elev: 15, name: "Fleet Valley" },
  { lng: -0.2000, lat: 51.4500, elev: 8, name: "Wandle Valley" },
  { lng: -0.2700, lat: 51.5000, elev: 10, name: "Brent Valley" },
];

// Known historical marsh/wetland areas (used as additional biome hints)
// The south bank of the Thames was almost entirely wetland before human settlement
// Archaeological evidence shows vast marshes from Lambeth to Woolwich
const KNOWN_MARSHES = [
  // === SOUTH BANK - massive Thames floodplain wetlands ===
  // These were the dominant landscape south of the river
  { lng: -0.1150, lat: 51.4900, radius: 2.0, name: "Lambeth Marsh" },
  { lng: -0.1050, lat: 51.4950, radius: 2.0, name: "Southwark Marshes" },
  { lng: -0.0700, lat: 51.4950, radius: 2.5, name: "Bermondsey Marshes" },
  { lng: -0.0400, lat: 51.4950, radius: 2.5, name: "Rotherhithe Marshes" },
  { lng: -0.0200, lat: 51.5000, radius: 2.5, name: "Isle of Dogs Marshes" },
  { lng: 0.0100, lat: 51.4850, radius: 3.0, name: "Greenwich Marshes" },
  { lng: 0.0400, lat: 51.4900, radius: 3.5, name: "Plaistow/Silvertown Marshes" },
  { lng: 0.0700, lat: 51.4850, radius: 3.5, name: "Barking Level" },
  { lng: 0.0950, lat: 51.4800, radius: 4.0, name: "Erith/Thamesmead Marshes" },
  { lng: 0.1300, lat: 51.4750, radius: 4.0, name: "Rainham Marshes" },
  { lng: 0.1600, lat: 51.4700, radius: 3.5, name: "Wennington Marshes" },
  // Wandle/Battersea area
  { lng: -0.1700, lat: 51.4750, radius: 1.5, name: "Battersea Marshes" },
  { lng: -0.2000, lat: 51.4600, radius: 1.5, name: "Wandle Delta" },

  // === NORTH BANK wetlands ===
  { lng: -0.0350, lat: 51.5500, radius: 2.0, name: "Hackney Marshes" },
  { lng: -0.0300, lat: 51.5700, radius: 1.5, name: "Walthamstow Marshes" },
  { lng: -0.0250, lat: 51.5900, radius: 1.5, name: "Lea Valley Marshes" },
  { lng: 0.0400, lat: 51.5100, radius: 2.0, name: "East Ham/Beckton Marshes" },

  // === RIVER VALLEY wetlands ===
  { lng: -0.4400, lat: 51.4900, radius: 1.5, name: "Colne Valley" },
  { lng: -0.2700, lat: 51.5000, radius: 1.0, name: "Brent Valley" },
  { lng: -0.1050, lat: 51.5200, radius: 0.8, name: "Fleet Valley" },
];

// Known historical forest areas
const KNOWN_FORESTS = [
  { lng: -0.0150, lat: 51.5800, radius: 3.0, name: "Epping Forest" },
  { lng: -0.1780, lat: 51.5630, radius: 1.5, name: "Hampstead/Highgate Woods" },
  { lng: -0.0860, lat: 51.4320, radius: 1.5, name: "Great North Wood" },
  { lng: -0.1960, lat: 51.4280, radius: 2.0, name: "Wimbledon Common" },
  { lng: -0.3050, lat: 51.4470, radius: 2.5, name: "Richmond Great Park" },
  { lng: 0.0770, lat: 51.4720, radius: 1.5, name: "Oxleas/Shooters Hill Woods" },
  { lng: -0.3370, lat: 51.5730, radius: 1.0, name: "Harrow Weald" },
  { lng: -0.1080, lat: 51.5940, radius: 1.0, name: "Highgate/Alexandra Woods" },
];
