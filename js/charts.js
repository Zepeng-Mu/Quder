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
      marker: { color: '#DD614C', size: 10 },
      showlegend: false,
    },
    {
      x: [xMin, xMax],
      y: [modelFit.intercept + modelFit.slope * xMin, modelFit.intercept + modelFit.slope * xMax],
      mode: 'lines',
      type: 'scatter',
      line: { color: '#111827', width: 2 },
      showlegend: false,
      hoverinfo: 'skip',
    },
  ];

  const annotations = [
    {
      x: 0.02, y: 0.98, xref: 'paper', yref: 'paper',
      text: `R² = ${modelFit.rSquared.toFixed(4)}`,
      showarrow: false,
      font: { size: 14, color: '#111827', family: "'Darker Grotesque', sans-serif" },
    },
  ];

  if (modelFit.excludedPoint) {
    annotations.push({
      x: 0.02, y: 0.90, xref: 'paper', yref: 'paper',
      text: '(highest conc excluded)',
      showarrow: false,
      font: { size: 11, color: '#6B7280', family: "'Darker Grotesque', sans-serif" },
    });
  }

  const layout = {
    font: { family: "'Darker Grotesque', sans-serif", size: 13, color: '#111827' },
    xaxis: { title: 'Raw Reading (dilution-corrected)', gridcolor: '#E5E7EB' },
    yaxis: { title: 'Concentration (ng/uL)', gridcolor: '#E5E7EB' },
    plot_bgcolor: '#FFFFFF',
    paper_bgcolor: '#FFFFFF',
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
      marker: { color: '#DD614C', size: 8 },
      showlegend: false,
      hoverinfo: 'skip',
    },
    {
      x: [Math.min(...modelFit.fittedValues), Math.max(...modelFit.fittedValues)],
      y: [0, 0],
      mode: 'lines',
      type: 'scatter',
      line: { color: '#9CA3AF', width: 1.5 },
      showlegend: false,
      hoverinfo: 'skip',
    },
  ];

  const layout = {
    font: { family: "'Darker Grotesque', sans-serif", size: 13, color: '#111827' },
    xaxis: { title: 'Fitted values', gridcolor: '#E5E7EB' },
    yaxis: { title: 'Residuals', gridcolor: '#E5E7EB' },
    plot_bgcolor: '#FFFFFF',
    paper_bgcolor: '#FFFFFF',
    margin: { t: 20, r: 30 },
  };

  Plotly.newPlot(containerId, data, layout, { responsive: true });
}
