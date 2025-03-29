import * as turf from '@turf/turf';
import regression from 'regression';

// IDW Interpolation using hex bins
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

// Aggregate IDW nitrate values into census tracts
export function attachNitrateToTracts(cancerTracts, idwHexes) {
  cancerTracts.features.forEach(tract => {
    const hexesInTract = idwHexes.features.filter(hex => {
      const centroid = turf.centroid(hex);
      return turf.booleanPointInPolygon(centroid, tract);
    });

    const values = hexesInTract.map(hex => hex.properties.nitrate).filter(v => !isNaN(v));
    const avgNitrate = values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null;

    tract.properties.avg_nitrate = avgNitrate;
  });

  return cancerTracts;
}

// Run linear regression on avg_nitrate vs. canrate
export function runRegression(cancerTracts) {
  const data = cancerTracts.features
    .map(f => [f.properties.avg_nitrate, f.properties.canrate])
    .filter(([x, y]) => !isNaN(x) && !isNaN(y));

  const result = regression.linear(data);

  return {
    points: data,
    equation: result.equation,    // [slope, intercept]
    string: result.string,        // e.g. "y = 1.23x + 4.56"
    r2: result.r2                 // Coefficient of determination
  };
}