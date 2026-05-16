// Plotly chart rendering
// Ports app.R curve_plot and residual_plot outputs

/**
 * Render the standard curve scatter + regression line.
 */
export function renderCurvePlot(containerId, modelFit) {
  if (!modelFit) {
    Plotly.newPlot(containerId, [], {
      xaxis: { title: 'Raw Reading (dilution-corrected)' },
      yaxis: { title: 'Concentration (ng/uL)' },
    });
    return;
  }

  const std = modelFit.stdData;
  const xVals = std.map(d => d.value);
  const yVals = std.map(d => d.knownCon);
  const hoverText = std.map(d => `Reading: ${Math.round(d.rawValue)}<br>Conc: ${d.knownCon.toFixed(4)} ng/uL`);

  // Regression line
  const xMin = Math.min(...xVals);
  const xMax = Math.max(...xVals);

  const data = [
    {
      x: xVals,
      y: yVals,
      text: hoverText,
      hoverinfo: 'text',
      mode: 'markers',
      type: 'scatter',
      marker: { color: '#4a90d9', size: 10 },
      showlegend: false,
    },
    {
      x: [xMin, xMax],
      y: [modelFit.intercept + modelFit.slope * xMin, modelFit.intercept + modelFit.slope * xMax],
      mode: 'lines',
      type: 'scatter',
      line: { color: '#e74c3c', width: 2 },
      showlegend: false,
      hoverinfo: 'skip',
    },
  ];

  const annotations = [
    {
      x: 0.02, y: 0.98, xref: 'paper', yref: 'paper',
      text: `R² = ${modelFit.rSquared.toFixed(4)}`,
      showarrow: false,
      font: { size: 14, color: '#333' },
    },
  ];

  if (modelFit.excludedPoint) {
    annotations.push({
      x: 0.02, y: 0.90, xref: 'paper', yref: 'paper',
      text: '(highest conc excluded)',
      showarrow: false,
      font: { size: 11, color: '#999' },
    });
  }

  const layout = {
    xaxis: { title: 'Raw Reading (dilution-corrected)' },
    yaxis: { title: 'Concentration (ng/uL)' },
    annotations,
    margin: { t: 30, r: 30 },
  };

  Plotly.newPlot(containerId, data, layout, { responsive: true });
}

/**
 * Render the residual plot.
 */
export function renderResidualPlot(containerId, modelFit) {
  if (!modelFit) {
    Plotly.newPlot(containerId, [], {
      xaxis: { title: 'Fitted values' },
      yaxis: { title: 'Residuals' },
    });
    return;
  }

  const data = [
    {
      x: modelFit.fittedValues,
      y: modelFit.residuals,
      mode: 'markers',
      type: 'scatter',
      marker: { color: '#4a90d9', size: 8 },
      showlegend: false,
      hoverinfo: 'skip',
    },
    {
      x: [Math.min(...modelFit.fittedValues), Math.max(...modelFit.fittedValues)],
      y: [0, 0],
      mode: 'lines',
      type: 'scatter',
      line: { color: '#e74c3c', dash: 'dash' },
      showlegend: false,
      hoverinfo: 'skip',
    },
  ];

  const layout = {
    xaxis: { title: 'Fitted values' },
    yaxis: { title: 'Residuals' },
    margin: { t: 20, r: 30 },
  };

  Plotly.newPlot(containerId, data, layout, { responsive: true });
}
