import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { interpolateIDWHex, attachNitrateToTracts, runRegression } from './analysis.js';

const kInput = document.getElementById('k-input');
const base = import.meta.env.BASE_URL;
let colorBy = 'canrate'; // default selection

// const map = L.map('map').setView([43.0, -89.4], 8);
const map = L.map('map').setView([44.5, -89.5], 7);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

// DOM references for the slider
const slider = document.getElementById('k-slider');
const kDisplay = document.getElementById('k-value');

let wellsData, cancerData, currentLayer;

Promise.all([
  fetch(`${base}data/well_nitrate.geojson`).then(res => res.json()),
  fetch(`${base}data/cancer_tracts.geojson`).then(res => res.json())
]).then(([wells, cancer]) => {
  wellsData = wells;
  cancerData = cancer;
  updateMap(parseFloat(slider.value)); // Initial run
});

function updateMap(k) {
  // Remove old layer and regression stats
  if (currentLayer) {
    map.removeLayer(currentLayer);
  }
  document.querySelector('#regression-stats')?.remove();

  // Interpolate nitrate using current k
  const idwGrid = interpolateIDWHex(wellsData, 10, k);
  const enrichedTracts = attachNitrateToTracts(structuredClone(cancerData), idwGrid);
  const regressionResult = runRegression(enrichedTracts);

  // Add updated tracts to map
  currentLayer = L.geoJSON(enrichedTracts, {
    style: feature => ({
      fillColor: getColor(feature.properties[colorBy]),
      color: '#fff',
      weight: 1,
      fillOpacity: 0.6
    }),
    // style: feature => ({
    //   fillColor: '#cc0000',
    //   color: '#fff',
    //   weight: 1,
    //   fillOpacity: 0.4
    // }),
    onEachFeature: (feature, layer) => {
      const rate = feature.properties.canrate?.toFixed(2);
      const nitrate = feature.properties.avg_nitrate?.toFixed(2);
      layer.bindPopup(`Cancer Rate: ${rate}<br>Avg Nitrate: ${nitrate}`);
    }
  }).addTo(map);

  // Show regression info
  const statsPanel = document.createElement('div');
  statsPanel.id = 'regression-stats';
  statsPanel.style = 'position: absolute; top: 60px; right: 10px; background: white; padding: 10px; border: 1px solid #ccc; z-index: 1000;';
  statsPanel.innerHTML = `
    <strong>k = ${k.toFixed(1)}</strong><br>
    <strong>Regression:</strong><br>
    ${regressionResult.string}<br>
    <strong>R²:</strong> ${regressionResult.r2.toFixed(3)}
  `;
  document.body.appendChild(statsPanel);
}

// Update label live as user drags
slider.addEventListener('input', () => {
  const k = parseFloat(slider.value);
  kDisplay.textContent = k.toFixed(1);
});

// Only update the map after user releases the slider
slider.addEventListener('change', () => {
  const k = parseFloat(slider.value);
  updateMap(k);
});


// Only update on Enter key
kInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    let k = parseFloat(kInput.value);
    if (isNaN(k) || k <= 0) {
      alert("Please enter a number greater than 0.");
      kInput.value = slider.value;
      return;
    }

    // Sync slider and display
    slider.value = k;
    kDisplay.textContent = k.toFixed(1);
    updateMap(k);
  }
});

// Update colorBy based on radio button selection
document.querySelectorAll('input[name="colorBy"]').forEach(radio => {
  radio.addEventListener('change', () => {
    colorBy = document.querySelector('input[name="colorBy"]:checked').value;
    updateMap(parseFloat(slider.value));

    const legendBox = document.getElementById('legend-box');
    if (legendBox) {
      updateLegendContent(legendBox, colorBy);
    }
  });
});

function getColor(val) {
  if (val == null) return '#ccc';

  if (colorBy === 'canrate') {
    return val > 0.8 ? '#800026' :
           val > 0.6 ? '#BD0026' :
           val > 0.4 ? '#E31A1C' :
           val > 0.2 ? '#FC4E2A' :
           val > 0.1 ? '#FD8D3C' :
           val > 0.05 ? '#FEB24C' :
                        '#FFEDA0';
  } else if (colorBy === 'avg_nitrate') {
    return val > 10 ? '#800026' :
           val > 8  ? '#BD0026' :
           val > 6  ? '#E31A1C' :
           val > 4  ? '#FC4E2A' :
           val > 2  ? '#FD8D3C' :
           val > 0  ? '#FEB24C' :
                      '#FFEDA0';
  }

  return '#ccc'; // fallback if unexpected field
}

const legend = L.control({ position: 'bottomright' });

legend.onAdd = function () {
  const div = L.DomUtil.create('div', 'info legend');
  div.id = 'legend-box';
  updateLegendContent(div, colorBy);
  return div;
};

legend.addTo(map);

function updateLegendContent(div, variable) {
  let grades, label;

  if (variable === 'canrate') {
    grades = [0, 0.05, 0.1, 0.2, 0.4, 0.6, 0.8];
    label = 'Cancer Rate';
  } else {
    grades = [0, 2, 4, 6, 8, 10];
    label = 'Avg Nitrate';
  }

  div.innerHTML = `<strong>${label}</strong><br>`;
  for (let i = grades.length - 1; i >= 0; i--) {
    const from = grades[i];
    const to = grades[i + 1];
    const color = getColor(from);

    div.innerHTML +=
      `<i style="background:${color}; width: 18px; height: 18px; display:inline-block; margin-right: 5px;"></i> ` +
      `${from}${to ? '&ndash;' + to : '+'}<br>`;
  }
}