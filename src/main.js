import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const map = L.map('map').setView([43.0, -89.4], 8); // center on WI

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

export default map;

fetch('/data/well_nitrate.geojson')
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data).addTo(map);
  });

fetch('/data/cancer_tracts.geojson')
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data, {
      style: {
        color: 'red',
        weight: 1,
        fillOpacity: 0.2
      }
    }).addTo(map);
  });