import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { interpolateIDWHex, attachNitrateToTracts, runRegression } from './analysis.js';

const base = import.meta.env.BASE_URL;

const map = L.map('map').setView([43.0, -89.4], 8); // Center on WI

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

let idwGrid, cancerData;

Promise.all([
  fetch(`${base}data/well_nitrate.geojson`).then(res => res.json()),
  fetch(`${base}data/cancer_tracts.geojson`).then(res => res.json())
]).then(([wells, cancer]) => {
  // Perform IDW
  idwGrid = interpolateIDWHex(wells, 2, 2);

  // Attach nitrate values to cancer tracts
  cancerData = attachNitrateToTracts(cancer, idwGrid);

  // Run regression
  const regressionResult = runRegression(cancerData);
  console.log('Regression:', regressionResult);

  // Visualize tracts with popups
  L.geoJSON(cancerData, {
    style: feature => ({
      fillColor: '#cc0000',
      color: '#fff',
      weight: 1,
      fillOpacity: 0.4
    }),
    onEachFeature: (feature, layer) => {
      const rate = feature.properties.canrate?.toFixed(2);
      const nitrate = feature.properties.avg_nitrate?.toFixed(2);
      layer.bindPopup(`Cancer Rate: ${rate}<br>Avg Nitrate: ${nitrate}`);
    }
  }).addTo(map);

  // Display regression result in a floating div
  const statsPanel = document.createElement('div');
  statsPanel.style = 'position: absolute; top: 10px; right: 10px; background: white; padding: 10px; border: 1px solid #ccc; z-index: 1000;';
  statsPanel.innerHTML = `
    <strong>Regression Equation:</strong><br>
    ${regressionResult.string}<br>
    <strong>R²:</strong> ${regressionResult.r2.toFixed(3)}
  `;
  document.body.appendChild(statsPanel);
});

// Optional color scale helper
function getColor(val) {
  return val > 10 ? '#800026' :
         val > 8  ? '#BD0026' :
         val > 6  ? '#E31A1C' :
         val > 4  ? '#FC4E2A' :
         val > 2  ? '#FD8D3C' :
         val > 0  ? '#FEB24C' :
                    '#FFEDA0';
}
// import L from 'leaflet';
// import 'leaflet/dist/leaflet.css';
// import { interpolateIDWHex, attachNitrateToTracts } from './analysis.js';
// import { runRegression } from './analysis.js';

// const base = import.meta.env.BASE_URL;

// // import markerIcon from 'leaflet/dist/images/marker-icon.png';
// // import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// // delete L.Icon.Default.prototype._getIconUrl;

// // L.Icon.Default.mergeOptions({
// //   iconUrl: markerIcon,
// //   shadowUrl: markerShadow,
// // });

// const map = L.map('map').setView([43.0, -89.4], 8); // center on WI

// L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//   attribution: '&copy; OpenStreetMap contributors',
// }).addTo(map);



// let idwGrid, cancerData;

// Promise.all([
//   fetch(`${base}data/well_nitrate.geojson`).then(res => res.json()),
//   fetch(`${base}data/cancer_tracts.geojson`).then(res => res.json())
// ]).then(([wells, cancer]) => {
//   // Perform IDW
//   idwGrid = interpolateIDWHex(wells, 2, 2);

//   // Attach nitrate values to cancer tracts
//   // cancerData = attachNitrateToTracts(cancer, idwGrid);
  

//   // Visualize tracts with popups
//   L.geoJSON(cancerData, {
//     style: feature => ({
//       fillColor: '#cc0000',
//       color: '#fff',
//       weight: 1,
//       fillOpacity: 0.4
//     }),
//     onEachFeature: (feature, layer) => {
//       const rate = feature.properties.canrate?.toFixed(2);
//       const nitrate = feature.properties.avg_nitrate?.toFixed(2);
//       layer.bindPopup(`Cancer Rate: ${rate}<br>Avg Nitrate: ${nitrate}`);
//     }
//   }).addTo(map);
// });


// function getColor(val) {
//   return val > 10 ? '#800026' :
//          val > 8  ? '#BD0026' :
//          val > 6  ? '#E31A1C' :
//          val > 4  ? '#FC4E2A' :
//          val > 2  ? '#FD8D3C' :
//          val > 0  ? '#FEB24C' :
//                     '#FFEDA0';
// }


// // After attaching nitrate to tracts:
// const enrichedTracts = attachNitrateToTracts(cancerData, idwGrid);

// // Run regression
// const regressionResult = runRegression(enrichedTracts);
// console.log("Regression:", regressionResult);

// // Optional: display it on screen
// const statsPanel = document.createElement('div');
// statsPanel.style = 'position: absolute; top: 10px; right: 10px; background: white; padding: 10px; border: 1px solid #ccc;';
// statsPanel.innerHTML = `
//   <strong>Regression Equation:</strong><br>
//   ${regressionResult.string}<br>
//   <strong>R²:</strong> ${regressionResult.r2.toFixed(3)}
// `;
// document.body.appendChild(statsPanel);