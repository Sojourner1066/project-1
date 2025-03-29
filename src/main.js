import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { interpolateIDWHex, attachNitrateToTracts, runRegression, computeResiduals, hexbinResidualStdDev } from './analysis.js';

const base = import.meta.env.BASE_URL;
let residualLegend; // To track and remove old legend

const map = L.map('map').setView([44.5, -89.5], 7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let cancerDataRaw, wellDataRaw;
let cancerLayer, wellLayer, hexLayer;
const overlays = {};

Promise.all([
  fetch(`${base}data/cancer_tracts.geojson`).then(res => res.json()),
  fetch(`${base}data/well_nitrate.geojson`).then(res => res.json())
]).then(([cancerData, wellData]) => {
  cancerDataRaw = cancerData;
  wellDataRaw = wellData;

  // Show cancer tracts
  cancerLayer = L.geoJSON(cancerDataRaw, {
    style: feature => ({
      fillColor: getCancerColor(feature.properties.canrate),
      weight: 1,
      opacity: 1,
      color: 'white',
      fillOpacity: 0.7
    }),
    onEachFeature: (feature, layer) => {
      const rate = feature.properties.canrate?.toFixed(3);
      layer.bindPopup(`Cancer Rate: ${rate}`);
    }
  }).addTo(map);
  enforceLayerOrder();
  overlays["Cancer Tracts"] = cancerLayer;

  // Show well points
  wellLayer = L.geoJSON(wellDataRaw, {
    pointToLayer: (feature, latlng) => {
      const value = feature.properties.nitr_ran;
      return L.circleMarker(latlng, {
        radius: 5,
        fillColor: getNitrateColor(value),
        color: '#000',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
      });
    },
    onEachFeature: (feature, layer) => {
      const nitrate = feature.properties.nitr_ran?.toFixed(2);
      layer.bindPopup(`Nitrate: ${nitrate}`);
    }
  }).addTo(map);
  enforceLayerOrder();
  overlays["Well Nitrate Points"] = wellLayer;

  // addCancerLegend();
  const nitrateLegend = addNitrateLegend();
  const cancerLegend = addCancerLegend();
  nitrateLegend.addTo(map);
  cancerLegend.addTo(map);
  L.control.layers(null, overlays).addTo(map);
  map.on('overlayadd', enforceLayerOrder);
  map.on('overlayremove', enforceLayerOrder);
});

const kInput = document.getElementById('k-input');
const hexInput = document.getElementById('hex-size');
const runButton = document.getElementById('run-analysis');

runButton.addEventListener('click', () => {
  const k = parseFloat(kInput.value);
  const hexSize = parseFloat(hexInput.value);



  if (isNaN(k) || k <= 0 || isNaN(hexSize) || hexSize <= 0) {
    alert("K values must be greater than 0.");
    return;
  }

  if (hexSize < 8 || hexSize > 80) {
    alert("Hexbin size must be between 8 and 80 kilometers squared.");
    return;
  }


  if (hexLayer) map.removeLayer(hexLayer);

  const idwHexes = interpolateIDWHex(wellDataRaw, hexSize, k);
  const enrichedTracts = attachNitrateToTracts(structuredClone(cancerDataRaw), idwHexes);
  const regression = runRegression(enrichedTracts);
  const withResiduals = computeResiduals(enrichedTracts, regression);
  const hexStdDevs = hexbinResidualStdDev(withResiduals, hexSize);

  hexLayer = L.geoJSON(hexStdDevs, {
    style: feature => ({
      fillColor: getStdDevColor(feature.properties.std_dev),
      color: '#333',
      weight: 1,
      fillOpacity: 0.6
    }),
    onEachFeature: (feature, layer) => {
      const sd = feature.properties.std_dev?.toFixed(3);
      layer.bindPopup(`Residual Std Dev: ${sd}`);
    }
  }).addTo(map);
  enforceLayerOrder();
  overlays["Residual Std Dev Hexes"] = hexLayer;
  addResidualLegend(hexStdDevs);
});

function getCancerColor(val) {
  if (val == null) return '#ccc';
  return val > 0.8 ? '#800026' :
         val > 0.6 ? '#BD0026' :
         val > 0.4 ? '#E31A1C' :
         val > 0.2 ? '#FC4E2A' :
         val > 0.1 ? '#FD8D3C' :
         val > 0.05 ? '#FEB24C' :
                     '#FFEDA0';
}

function getNitrateColor(val) {
  if (val == null) return '#ccc';
  return val > 10 ? '#084594' :
         val > 8  ? '#2171b5' :
         val > 6  ? '#4292c6' :
         val > 4  ? '#6baed6' :
         val > 2  ? '#9ecae1' :
         val > 0  ? '#c6dbef' :
                    '#eff3ff';
}

function getStdDevColor(val) {
  if (val == null) return '#ccc';
  return val > 0.5 ? '#67000d' :
         val > 0.4 ? '#a50f15' :
         val > 0.3 ? '#cb181d' :
         val > 0.2 ? '#ef3b2c' :
         val > 0.1 ? '#fb6a4a' :
         val > 0.05 ? '#fcae91' :
                     '#fee5d9';
}

function addCancerLegend() {
  const legend = L.control({ position: 'bottomright' });

  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'info legend');
    const min = 0.0;
    const max = 1.01;
    const bins = 6;
    const step = (max - min) / bins;
    const grades = Array.from({ length: bins + 1 }, (_, i) =>
      +(min + i * step).toFixed(3)
    );

    div.innerHTML = '<strong>Cancer Rate</strong><br>';
    for (let i = grades.length - 1; i >= 0; i--) {
      const from = grades[i];
      const to = grades[i + 1];
      const color = getCancerColor(from);
      div.innerHTML +=
        `<i style="background:${color}; width: 18px; height: 18px; display:inline-block; margin-right: 5px;"></i>` +
        `${from}${to ? '&ndash;' + to : '+'}<br>`;
    }

    return div;
  };

  return legend;
}

function addNitrateLegend() {
  const legend = L.control({ position: 'bottomright' });

  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'info legend');
    const min = 0.0;
    const max = 17.068;
    const bins = 6;
    const step = (max - min) / bins;
    const grades = Array.from({ length: bins + 1 }, (_, i) =>
      +(min + i * step).toFixed(3)
    );

    div.innerHTML = '<strong>Nitrate (ppm)</strong><br>';
    for (let i = grades.length - 1; i >= 0; i--) {
      const from = grades[i];
      const to = grades[i + 1];
      const color = getNitrateColor(from);
      div.innerHTML +=
        `<i style="background:${color}; width: 18px; height: 18px; display:inline-block; margin-right: 5px;"></i>` +
        `${from}${to ? '&ndash;' + to : '+'}<br>`;
    }

    return div;
  };

  return legend;
}

function addResidualLegend(hexStdDevs) {
  if (residualLegend) {
    map.removeControl(residualLegend);
  }

  const values = hexStdDevs.features
    .map(f => f.properties.std_dev)
    .filter(v => v != null && !isNaN(v));

  const min = Math.min(...values);
  const max = Math.max(...values);

  const binCount = 6;
  const step = (max - min) / binCount;
  const grades = Array.from({ length: binCount + 1 }, (_, i) => +(min + i * step).toFixed(3));

  residualLegend = L.control({ position: 'bottomleft' });

  residualLegend.onAdd = function () {
    const div = L.DomUtil.create('div', 'info legend');
    div.innerHTML = '<strong>Residual Std Dev</strong><br>';
    for (let i = 0; i < grades.length - 1; i++) {
      const from = grades[i];
      const to = grades[i + 1];
      const color = getStdDevColor(from); // This may need adjusting
      div.innerHTML +=
        `<i style="background:${color}; width: 18px; height: 18px; display:inline-block; margin-right: 5px;"></i>` +
        `${from} &ndash; ${to}<br>`;
    }
    return div;
  };

  residualLegend.addTo(map);
}

function enforceLayerOrder() {
  if (cancerLayer) cancerLayer.bringToBack();
  if (wellLayer) wellLayer.bringToFront();
  if (hexLayer) hexLayer.bringToFront();
}