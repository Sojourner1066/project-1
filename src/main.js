import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { interpolateIDWHex } from './analysis.js';

const base = import.meta.env.BASE_URL;

// import markerIcon from 'leaflet/dist/images/marker-icon.png';
// import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// delete L.Icon.Default.prototype._getIconUrl;

// L.Icon.Default.mergeOptions({
//   iconUrl: markerIcon,
//   shadowUrl: markerShadow,
// });

const map = L.map('map').setView([43.0, -89.4], 8); // center on WI

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);



fetch(`${base}data/well_nitrate.geojson`)
  .then(res => res.json())
  .then(wellData => {
    const hexGrid = interpolateIDWHex(wellData, 2, 2); // cellSize = 2km, k = 2

    L.geoJSON(hexGrid, {
      style: feature => ({
        fillColor: getColor(feature.properties.nitrate),
        color: '#555',
        weight: 1,
        fillOpacity: 0.6
      }),
      onEachFeature: (feature, layer) => {
        const value = feature.properties.nitrate?.toFixed(2);
        layer.bindPopup(`Nitrate: ${value}`);ß
      }
    }).addTo(map);
  });

function getColor(val) {
  return val > 10 ? '#800026' :
         val > 8  ? '#BD0026' :
         val > 6  ? '#E31A1C' :
         val > 4  ? '#FC4E2A' :
         val > 2  ? '#FD8D3C' :
         val > 0  ? '#FEB24C' :
                    '#FFEDA0';
}

// fetch(`${base}/data/cancer_tracts.geojson`)
//   .then(res => res.json())
//   .then(data => {
//     L.geoJSON(data, {
//       style: {
//         color: 'red',
//         weight: 1,
//         fillOpacity: 0.2
//       }
//     }).addTo(map);
//   });