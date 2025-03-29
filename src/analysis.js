import * as turf from '@turf/turf';
import regression from 'regression';

// IDW Interpolation using hex bins
export function interpolateIDWHex(wellData, cellSize = 10, k = 2) {
  const bbox = turf.bbox(wellData);
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

// Run linear regression
export function runRegression(cancerTracts) {
  const data = cancerTracts.features
    .map(f => [f.properties.avg_nitrate, f.properties.canrate])
    .filter(([x, y]) => !isNaN(x) && !isNaN(y));

  const result = regression.linear(data);
  return {
    points: data,
    equation: result.equation,
    string: result.string,
    r2: result.r2
  };
}

// Add residuals to each tract
export function computeResiduals(cancerTracts, regressionResult) {
  const [slope, intercept] = regressionResult.equation;
  cancerTracts.features.forEach(f => {
    const x = f.properties.avg_nitrate;
    const y = f.properties.canrate;
    if (!isNaN(x) && !isNaN(y)) {
      const predicted = slope * x + intercept;
      f.properties.residual = y - predicted;
    } else {
      f.properties.residual = null;
    }
  });
  return cancerTracts;
}

// Calculate standard deviation of residuals per hex bin
export function hexbinResidualStdDev(cancerTracts, cellSize = 10) {
  const centroids = cancerTracts.features.map(f => {
    const center = turf.centroid(f);
    center.properties = {
      residual: f.properties.residual
    };
    return center;
  });

  const collection = turf.featureCollection(centroids);
  const bbox = turf.bbox(collection);
  const hexGrid = turf.hexGrid(bbox, cellSize, { units: 'kilometers' });

  hexGrid.features.forEach(hex => {
    const points = centroids.filter(pt => turf.booleanPointInPolygon(pt, hex));
    const values = points.map(p => p.properties.residual).filter(v => !isNaN(v));

    if (values.length > 1) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (values.length - 1);
      hex.properties.std_dev = Math.sqrt(variance);
    } else {
      hex.properties.std_dev = null;
    }
  });

  return hexGrid;
}