import * as turf from '@turf/turf';

export function interpolateIDWHex(wellData, cellSize = 2, k = 2) {
  const bbox = turf.bbox(wellData); // [minX, minY, maxX, maxY]
  const hexGrid = turf.hexGrid(bbox, cellSize, { units: 'kilometers' });

  hexGrid.features.forEach(hex => {
    const centroid = turf.centroid(hex);
    let numerator = 0;
    let denominator = 0;

    wellData.features.forEach(well => {
      const d = turf.distance(centroid, well, { units: 'kilometers' });
      const nitrate = well.properties.nitr_ran;

      if (d === 0) {
        // If the centroid falls right on a well, use that value directly
        hex.properties.nitrate = nitrate;
        return;
      }

      const weight = 1 / Math.pow(d, k);
      numerator += weight * nitrate;
      denominator += weight;
    });

    hex.properties.nitrate = numerator / denominator;
  });

  return hexGrid;
}