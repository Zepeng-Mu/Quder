// Core math functions — ports of R/regression.R and R/validation.R

const DEFAULT_CONC = [10, 5, 2.5, 1.25, 0.625, 0.3125, 0.15625, 0];

/**
 * Fit a linear regression to standard curve data.
 * Port of fit_standard_curve() from R/regression.R
 */
export function fitStandardCurve(readings, knownConc, dilutionFactor = 5, excludeHighest = true) {
  // Build paired data, filter out null/NaN readings
  let data = [];
  for (let i = 0; i < readings.length; i++) {
    const raw = readings[i];
    const conc = knownConc[i];
    if (raw != null && !isNaN(raw) && conc != null && !isNaN(conc)) {
      data.push({ rawValue: raw, knownCon: conc, value: raw / dilutionFactor });
    }
  }

  if (data.length === 0) {
    return null;
  }

  // Exclude highest concentration if requested
  let excluded = false;
  let fitData = data;
  if (excludeHighest && data.length > 1) {
    const maxCon = Math.max(...data.map(d => d.knownCon));
    fitData = data.filter(d => d.knownCon !== maxCon);
    excluded = true;
  }

  if (fitData.length < 2) {
    return null;
  }

  // Linear regression: knownCon ~ value
  const n = fitData.length;
  const xVals = fitData.map(d => d.value);
  const yVals = fitData.map(d => d.knownCon);

  const sumX = xVals.reduce((a, b) => a + b, 0);
  const sumY = yVals.reduce((a, b) => a + b, 0);
  const sumXY = xVals.reduce((acc, x, i) => acc + x * yVals[i], 0);
  const sumX2 = xVals.reduce((acc, x) => acc + x * x, 0);

  const denom = n * sumX2 - sumX * sumX;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R-squared
  const meanY = sumY / n;
  const ssTot = yVals.reduce((acc, y) => acc + (y - meanY) ** 2, 0);
  const ssRes = fitData.reduce((acc, d) => {
    const pred = slope * d.value + intercept;
    return acc + (d.knownCon - pred) ** 2;
  }, 0);
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  // Fitted values and residuals
  const fittedValues = fitData.map(d => slope * d.value + intercept);
  const residuals = fitData.map((d, i) => d.knownCon - fittedValues[i]);

  return {
    slope,
    intercept,
    rSquared,
    fittedValues,
    residuals,
    stdData: fitData,
    excludedPoint: excluded,
  };
}

/**
 * Predict sample concentrations from fitted model.
 * Port of predict_samples() from R/regression.R
 */
export function predictSamples(model, readings, sampleNames, sampleDilution = 2, targetMass = 50) {
  const n = readings.length;
  const results = [];

  for (let i = 0; i < n; i++) {
    const raw = readings[i];
    const name = sampleNames?.[i] ?? `Sample_${i + 1}`;
    const corrected = raw != null ? raw / sampleDilution : null;
    const pred = corrected != null ? model.slope * corrected + model.intercept : null;
    const poolVolume = pred != null && pred > 0 ? targetMass / pred : null;

    let status;
    if (raw == null || isNaN(raw)) {
      status = 'N/A';
    } else if (pred < 0) {
      status = 'Negative';
    } else if (pred === 0) {
      status = 'Cannot pool';
    } else if (poolVolume > 200) {
      status = 'Too dilute';
    } else {
      status = 'OK';
    }

    results.push({
      sampleName: name,
      rawValue: raw,
      dilutionCorrected: corrected != null ? +corrected.toFixed(4) : null,
      predictedConc: pred != null ? +pred.toFixed(4) : null,
      poolVolume: poolVolume != null ? +poolVolume.toFixed(2) : null,
      status,
    });
  }

  return results;
}

/**
 * Summarize results by sample group.
 * Port of summarize_samples() from R/regression.R
 */
export function summarizeSamples(results) {
  const valid = results.filter(r => r.status === 'OK');
  if (valid.length === 0) return [];

  // Group by sampleName
  const groups = new Map();
  for (const r of valid) {
    if (!groups.has(r.sampleName)) groups.set(r.sampleName, []);
    groups.get(r.sampleName).push(r);
  }

  const summary = [];
  for (const [name, rows] of groups) {
    const n = rows.length;
    const concs = rows.map(r => r.predictedConc).filter(v => v != null);
    const pools = rows.map(r => r.poolVolume).filter(v => v != null);
    const meanConc = concs.reduce((a, b) => a + b, 0) / concs.length;
    const sdConc = n > 1
      ? Math.sqrt(concs.reduce((acc, v) => acc + (v - meanConc) ** 2, 0) / (concs.length - 1))
      : null;
    const cvPct = n > 1 && meanConc > 0 ? +((sdConc / meanConc) * 100).toFixed(1) : null;
    const totalPoolVolume = pools.reduce((a, b) => a + b, 0);

    summary.push({
      sampleName: name,
      n,
      meanConc: +meanConc.toFixed(4),
      cvPct,
      totalPoolVolume: +totalPoolVolume.toFixed(2),
    });
  }

  return summary;
}

/**
 * Map R-squared to quality label, color, and level.
 * Port of r2_quality() from R/validation.R
 */
export function r2Quality(rSquared) {
  if (rSquared == null || isNaN(rSquared)) {
    return { label: 'N/A', color: '#999999', level: 'none' };
  }
  if (rSquared >= 0.99) {
    return { label: `R² = ${rSquared.toFixed(4)} (Excellent)`, color: '#28a745', level: 'excellent' };
  }
  if (rSquared >= 0.95) {
    return { label: `R² = ${rSquared.toFixed(4)} (Good)`, color: '#007bff', level: 'good' };
  }
  if (rSquared >= 0.90) {
    return { label: `R² = ${rSquared.toFixed(4)} (Acceptable)`, color: '#ffc107', level: 'acceptable' };
  }
  return { label: `R² = ${rSquared.toFixed(4)} (Poor)`, color: '#dc3545', level: 'poor' };
}

/**
 * Check if enough standards were used.
 * Port of check_standard_count() from R/validation.R
 */
export function checkStandardCount(nStandards, minRequired = 5) {
  if (nStandards < minRequired) {
    return {
      ok: false,
      message: `Only ${nStandards} standard(s) used. Need at least ${minRequired} for a reliable fit.`,
    };
  }
  return { ok: true, message: null };
}

export { DEFAULT_CONC };
