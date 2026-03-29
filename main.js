import './style.css';
import L from 'leaflet';

// ============================================
// SISTEMA DE "TEMAS" REACTIVOS AL AIRE
// ============================================
const AQI_THEMES = [
  { maxPM25: 12, label: "Bueno", color: "#00ff88", glow: "rgba(0, 255, 136, 0.4)", density: 20 },
  { maxPM25: 35.4, label: "Moderado", color: "#ffd500", glow: "rgba(255, 213, 0, 0.4)", density: 50 },
  { maxPM25: 55.4, label: "Dañino (Grupos Sensibles)", color: "#ff8c00", glow: "rgba(255, 140, 0, 0.5)", density: 100 },
  { maxPM25: 150.4, label: "Dañino", color: "#ff0044", glow: "rgba(255, 0, 68, 0.6)", density: 200 },
  { maxPM25: 250.4, label: "Muy Dañino", color: "#a200ff", glow: "rgba(162, 0, 255, 0.7)", density: 400 },
  { maxPM25: 9999, label: "Peligroso!", color: "#6b001a", glow: "rgba(107, 0, 26, 0.9)", density: 700 }
];

function getThemeByPM25(value) {
  for (let theme of AQI_THEMES) {
    if (value <= theme.maxPM25) return theme;
  }
  return AQI_THEMES[0];
}

function applyTheme(value) {
  const theme = getThemeByPM25(value);
  document.documentElement.style.setProperty('--accent-color', theme.color);
  document.documentElement.style.setProperty('--particle-color', theme.glow);
  document.documentElement.style.setProperty('--glow', `0 0 30px ${theme.glow}`);

  // Actualizar densidad de partículas
  targetParticleCount = theme.density;
  return theme;
}

// ============================================
// EFECTO DE PARTÍCULAS (CANVAS 2D)
// ============================================
const canvas = document.getElementById('particles-canvas');
const ctx = canvas.getContext('2d');

let particlesArray = [];
let targetParticleCount = 20;

function initCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', initCanvas);
initCanvas();

class Particle {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.size = Math.random() * 3 + 1;
    this.speedX = Math.random() * 1 - 0.5;
    this.speedY = Math.random() * 1 - 0.5;
  }
  update() {
    this.x += this.speedX;
    this.y += this.speedY;

    if (this.x > canvas.width || this.x < 0) this.speedX = -this.speedX;
    if (this.y > canvas.height || this.y < 0) this.speedY = -this.speedY;
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    // Tomamos el color computado del CSS variable
    const colorStr = getComputedStyle(document.documentElement).getPropertyValue('--particle-color').trim();
    ctx.fillStyle = colorStr || 'rgba(255,255,255,0.5)';
    ctx.fill();
  }
}

function handleParticles() {
  // Ajustar cantidad suavemente
  if (particlesArray.length < targetParticleCount) {
    particlesArray.push(new Particle());
  } else if (particlesArray.length > targetParticleCount) {
    particlesArray.pop();
  }

  for (let i = 0; i < particlesArray.length; i++) {
    particlesArray[i].update();
    particlesArray[i].draw();
  }
}

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  handleParticles();
  requestAnimationFrame(animateParticles);
}

// Iniciar loop
animateParticles();


// ============================================
// MAPA LEAFLET E INTEGRACIÓN OPENAQ API
// ============================================
const map = L.map('map', {
  center: [4.6097, -74.0817], // Inicia en Bogotá
  zoom: 11,
  zoomControl: false
});

// Layer Dark
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: 'Map tiles by Carto, under CC BY 3.0. Data by OpenStreetMap, under ODbL.',
  subdomains: 'abcd',
  maxZoom: 20
}).addTo(map);

// Open-Meteo Air Quality API (Cities in Colombia)
const COLOMBIA_CITIES = [
  { location: "Estación Centro", city: "Bogotá", coordinates: { latitude: 4.6097, longitude: -74.0817 } },
  { location: "Estación El Poblado", city: "Medellín", coordinates: { latitude: 6.2442, longitude: -75.5812 } },
  { location: "Estación San Antonio", city: "Cali", coordinates: { latitude: 3.4516, longitude: -76.5320 } },
  { location: "Estación Norte", city: "Barranquilla", coordinates: { latitude: 10.9685, longitude: -74.7813 } },
  { location: "Estación Centro Histórico", city: "Cartagena", coordinates: { latitude: 10.3997, longitude: -75.5144 } },
  { location: "Estación Cabecera", city: "Bucaramanga", coordinates: { latitude: 7.1254, longitude: -73.1198 } },
  { location: "Estación Centro", city: "Pereira", coordinates: { latitude: 4.8133, longitude: -75.6961 } },
  { location: "Estación Cable", city: "Manizales", coordinates: { latitude: 5.0689, longitude: -75.5174 } },
  { location: "Estación Vanguardia", city: "Villavicencio", coordinates: { latitude: 4.1420, longitude: -73.6266 } },
  { location: "Estación Centro", city: "Leticia", coordinates: { latitude: -4.2153, longitude: -69.9406 } },
  { location: "Estación Aeropuerto", city: "San Andrés", coordinates: { latitude: 12.5847, longitude: -81.7006 } },
  { location: "Estación Centro", city: "Pasto", coordinates: { latitude: 1.2136, longitude: -77.2811 } }
];

const latParams = COLOMBIA_CITIES.map(c => c.coordinates.latitude).join(',');
const lonParams = COLOMBIA_CITIES.map(c => c.coordinates.longitude).join(',');
const OPEN_METEO_URL = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latParams}&longitude=${lonParams}&current=pm2_5`;

const statusPanel = document.getElementById('status-panel');
let currentMarkers = [];

async function fetchAirQuality() {
  try {
    const response = await fetch(OPEN_METEO_URL);
    if (!response.ok) throw new Error("API Limit o Network Error");
    const data = await response.json();
    return COLOMBIA_CITIES.map((city, index) => {
      const apiResult = Array.isArray(data) ? data[index] : data;
      return {
        location: city.location,
        city: city.city,
        coordinates: city.coordinates,
        measurements: [{
          parameter: 'pm25',
          value: apiResult.current.pm2_5,
          lastUpdated: apiResult.current.time
        }]
      };
    });
  } catch (error) {
    console.error("Open-Meteo API Error:", error);
    statusPanel.innerHTML = `<div class="loader-msg" style="color:#ff0044">Error conectando con Open-Meteo... Vuelve a intentar más tarde.</div>`;
    return [];
  }
}

function updateUI(locationData) {
  if (!locationData) return;
  // Buscamos medición PM2.5
  const pm25 = locationData.measurements.find(m => m.parameter === 'pm25');
  if (!pm25) return;

  const value = pm25.value;
  const theme = applyTheme(value);

  // Focus Mapa
  if (locationData.coordinates) {
    map.flyTo([locationData.coordinates.latitude, locationData.coordinates.longitude], 12, { duration: 1.5 });
  }

  statusPanel.innerHTML = `
    <div class="aqi-display">
      <div class="aqi-value">${Math.round(value)}</div>
      <div class="aqi-label">PM2.5</div>
    </div>
    
    <div style="text-align:center; font-weight: bold; margin-bottom: 20px; font-size: 1.2rem; color: ${theme.color}">
      ${theme.label}
    </div>

    <div class="station-details">
      <div class="station-name">${locationData.location}</div>
      <div class="parameter-row">
        <span>Ciudad</span>
        <span>${locationData.city || 'Desconocido'}</span>
      </div>
      <div class="parameter-row">
        <span>Última Actualización</span>
        <span>${new Date(pm25.lastUpdated).toLocaleTimeString()}</span>
      </div>
      <div class="parameter-row">
        <span>Fuente</span>
        <span>Open-Meteo</span>
      </div>
    </div>
  `;
}

function drawMarkers(locations) {
  locations.forEach(loc => {
    if (!loc.coordinates) return;

    const pm25 = loc.measurements.find(m => m.parameter === 'pm25');
    if (!pm25) return;

    const val = pm25.value;
    const theme = getThemeByPM25(val);

    const icon = L.divIcon({
      className: 'aqi-marker',
      html: `<div>${Math.round(val)}</div>`,
      iconSize: [30, 30]
    });

    const marker = L.marker([loc.coordinates.latitude, loc.coordinates.longitude], { icon }).addTo(map);

    // Al añadirlo, manipulamos manualmente el color de fondo para inyectarle el tema
    marker.on('add', function () {
      const el = marker.getElement();
      if (el) {
        el.style.backgroundColor = theme.color;
        el.style.boxShadow = `0 0 15px ${theme.color}`;
      }
    });

    marker.on('click', () => updateUI(loc));
    currentMarkers.push(marker);
  });
}

// Inicialización
async function initApp() {
  const data = await fetchAirQuality();
  if (data && data.length > 0) {
    drawMarkers(data);
    // Auto-seleccionar el primer lugar con problemas o el primero de la lista
    const badPlace = data.find(l => {
      const m = l.measurements.find(x => x.parameter === 'pm25');
      return m && m.value > 30;
    }) || data[0];

    updateUI(badPlace);
  } else if (data && data.length === 0) {
    statusPanel.innerHTML = `<div class="loader-msg">No se encontraron estaciones activas en Colombia en este momento...</div>`;
  }
}

initApp();
