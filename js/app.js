// Main application wiring
// Connects all modules: math, state, tables, charts, io

import { State } from './state.js';
import { DEFAULT_CONC, fitStandardCurve, predictSamples, summarizeSamples, r2Quality, checkStandardCount } from './math.js';
import { createStdTable, createSmpTable, addSampleRow, updateSmpTableData, getGridData, nextSmpRowId } from './tables.js';
import { renderCurvePlot, renderResidualPlot } from './charts.js';
import { parseCSVFile, exportResultsCSV, loadExampleData } from './io.js';

// ── Notifications ──────────────────────────────────────────────────────────

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast-notification ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('show'));
  // Auto-dismiss after 4s
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ── State ──────────────────────────────────────────────────────────────────

const state = new State({
  stdData: DEFAULT_CONC.map(c => ({ concentration: c, reading: null })),
  smpData: Array.from({ length: 6 }, (_, i) => ({
    _id: nextSmpRowId(),
    sampleName: `Sample_${i + 1}`,
    reading: null,
    predictedConc: null,
    poolVolume: null,
    status: 'N/A',
  })),
  modelFit: null,
});

// ── Helpers ────────────────────────────────────────────────────────────────

function getSettings() {
  return {
    excludeHighest: document.getElementById('exclude_highest').checked,
    stdDilution: parseFloat(document.getElementById('std_dilution').value) || 5,
    smpDilution: parseFloat(document.getElementById('smp_dilution').value) || 2,
    targetMass: parseFloat(document.getElementById('target_mass').value) || 50,
  };
}

function updateR2Badge(modelFit) {
  const el = document.getElementById('r2_badge');
  if (!modelFit) {
    el.innerHTML = '<span class="text-muted-custom">No model fitted yet</span>';
    return;
  }
  const q = r2Quality(modelFit.rSquared);
  el.innerHTML = `<div class="r2-badge r2-${q.level}">${q.label}</div>`;
}

function updateFitParams(modelFit) {
  const el = document.getElementById('fit_params');
  if (!modelFit) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = [
    `Slope: ${modelFit.slope.toFixed(6)}`,
    `Intercept: ${modelFit.intercept.toFixed(4)}`,
    `Equation: conc = ${modelFit.slope.toFixed(6)} × reading + ${modelFit.intercept.toFixed(4)}`,
  ].join('<br>');
}

function updateFitWarnings(modelFit) {
  const el = document.getElementById('fit_warnings');
  if (!modelFit) {
    el.innerHTML = '';
    return;
  }
  const q = r2Quality(modelFit.rSquared);
  if (q.level === 'poor') {
    el.innerHTML = '<div class="alert alert-danger mt-2">R² is below 0.90. Standard curve may be unreliable. Check standard concentrations and well assignments.</div>';
  } else if (q.level === 'acceptable') {
    el.innerHTML = '<div class="alert alert-warning mt-2">R² is below 0.95. Consider re-checking standard readings.</div>';
  } else {
    el.innerHTML = '';
  }
}

function updateSampleSummary(smpData) {
  const el = document.getElementById('sample_summary');
  const modelFit = state.get('modelFit');
  if (!modelFit || smpData.every(r => r.predictedConc == null)) {
    el.innerHTML = '';
    return;
  }

  const summary = summarizeSamples(smpData);
  if (summary.length === 0 || summary.every(s => s.n === 1)) {
    el.innerHTML = '';
    return;
  }

  const rows = summary.map(s => `
    <tr>
      <td>${s.sampleName}</td>
      <td>${s.n}</td>
      <td>${s.meanConc.toFixed(4)}</td>
      <td>${s.cvPct != null ? s.cvPct.toFixed(1) : '—'}</td>
      <td>${s.totalPoolVolume.toFixed(2)}</td>
    </tr>`).join('');

  el.innerHTML = `
    <h6>Sample Aggregates</h6>
    <table class="table table-sm table-bordered">
      <thead><tr>
        <th>Sample</th><th>N</th><th>Mean Conc</th><th>CV %</th><th>Total Pool Vol</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function updateCharts(modelFit) {
  renderCurvePlot('curve_plot', modelFit);
  if (document.getElementById('show_residuals').checked) {
    renderResidualPlot('residual_plot', modelFit);
  }
}

function predictAndUpdateSamples(stdGridApi, smpGridApi) {
  const modelFit = state.get('modelFit');
  if (!modelFit) return;

  const smpRows = getGridData(smpGridApi);
  const settings = getSettings();
  const readings = smpRows.map(r => r.reading);
  const names = smpRows.map(r => r.sampleName);

  if (readings.every(r => r == null)) return;

  const predictions = predictSamples(modelFit, readings, names, settings.smpDilution, settings.targetMass);

  const updated = smpRows.map((row, i) => ({
    ...row,
    predictedConc: predictions[i].predictedConc,
    poolVolume: predictions[i].poolVolume,
    status: predictions[i].status,
  }));

  state.set('smpData', updated);
  updateSmpTableData(smpGridApi, updated);
  updateSampleSummary(updated);
}

// ── Initialize Tables ──────────────────────────────────────────────────────

const stdGridApi = createStdTable('std_table', (event) => {
  // Cell changed in standards table — update state
  const rows = getGridData(stdGridApi);
  state.set('stdData', rows);
});

const smpGridApi = createSmpTable('smp_table', (event) => {
  // Cell changed in samples table — re-predict
  const rows = getGridData(smpGridApi);
  state.set('smpData', rows);
  predictAndUpdateSamples(stdGridApi, smpGridApi);
});

// Load initial data into tables
stdGridApi.setGridOption('rowData', state.get('stdData'));
smpGridApi.setGridOption('rowData', state.get('smpData'));

// ── Button: Fit Standard Curve ─────────────────────────────────────────────

document.getElementById('fit_model').addEventListener('click', () => {
  const stdRows = getGridData(stdGridApi);
  const settings = getSettings();

  const validRows = stdRows.filter(r => r.reading != null && !isNaN(r.reading));
  if (validRows.length < 3) {
    showToast('Need at least 3 standards with readings to fit a model.', 'danger');
    return;
  }

  const chk = checkStandardCount(validRows.length);
  if (!chk.ok) {
    showToast(chk.message, 'warning');
  }

  const readings = validRows.map(r => r.reading);
  const concs = validRows.map(r => r.concentration);

  const mf = fitStandardCurve(readings, concs, settings.stdDilution, settings.excludeHighest);
  if (!mf) {
    showToast('Failed to fit model. Check your data.', 'danger');
    return;
  }

  state.set('modelFit', mf);
  updateR2Badge(mf);
  updateFitParams(mf);
  updateFitWarnings(mf);
  updateCharts(mf);
  predictAndUpdateSamples(stdGridApi, smpGridApi);
  showToast('Model fitted successfully.', 'success');
});

// ── Button: Add Sample ─────────────────────────────────────────────────────

document.getElementById('add_sample').addEventListener('click', () => {
  addSampleRow(smpGridApi);
  const rows = getGridData(smpGridApi);
  state.set('smpData', rows);
});

// ── Button: Export CSV ─────────────────────────────────────────────────────

document.getElementById('export_csv').addEventListener('click', () => {
  const modelFit = state.get('modelFit');
  const smpRows = getGridData(smpGridApi);
  const settings = getSettings();
  const today = new Date().toISOString().slice(0, 10);

  if (modelFit && smpRows.some(r => r.reading != null)) {
    const readings = smpRows.map(r => r.reading);
    const names = smpRows.map(r => r.sampleName);
    const predictions = predictSamples(modelFit, readings, names, settings.smpDilution, settings.targetMass);
    exportResultsCSV(predictions, `qubit_results_${today}.csv`);
  } else {
    exportResultsCSV(smpRows, `qubit_results_${today}.csv`);
  }
});

// ── Button: Load Example Data ──────────────────────────────────────────────

document.getElementById('load_example').addEventListener('click', async () => {
  try {
    const { stdReadings, smpReadings } = await loadExampleData();

    const stdData = DEFAULT_CONC.map((c, i) => ({
      concentration: c,
      reading: stdReadings[i] ?? null,
    }));
    state.set('stdData', stdData);
    stdGridApi.setGridOption('rowData', stdData);

    const smpData = smpReadings.map((r, i) => ({
      _id: nextSmpRowId(),
      sampleName: `Sample_${i + 1}`,
      reading: r,
      predictedConc: null,
      poolVolume: null,
      status: 'N/A',
    }));
    state.set('smpData', smpData);
    smpGridApi.setGridOption('rowData', smpData);

    showToast('Example data loaded. Click "Fit Standard Curve" to analyze.', 'info');
  } catch (e) {
    showToast('Failed to load example data.', 'danger');
  }
});

// ── File Upload ────────────────────────────────────────────────────────────

document.getElementById('upload_samples').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const { data, warnings } = await parseCSVFile(file);
    for (const w of warnings) showToast(w, 'warning');

    if (data.length > 0) {
      const smpData = data.map((r, i) => ({
        _id: nextSmpRowId(),
        sampleName: `Sample_${i + 1}`,
        reading: r,
        predictedConc: null,
        poolVolume: null,
        status: 'N/A',
      }));
      state.set('smpData', smpData);
      smpGridApi.setGridOption('rowData', smpData);
      showToast(`Loaded ${data.length} sample readings.`, 'success');
    }
  } catch (err) {
    showToast('Failed to parse file.', 'danger');
  }

  // Reset file input so same file can be re-uploaded
  e.target.value = '';
});

// ── Residual Plot Toggle ───────────────────────────────────────────────────

document.getElementById('show_residuals').addEventListener('change', (e) => {
  const container = document.getElementById('residual_plot_container');
  if (e.target.checked) {
    container.style.display = 'block';
    renderResidualPlot('residual_plot', state.get('modelFit'));
  } else {
    container.style.display = 'none';
  }
});

// ── Tab Changes (Resize components) ────────────────────────────────────────

const calculatorTab = document.getElementById('calculator-tab');
if (calculatorTab) {
  calculatorTab.addEventListener('shown.bs.tab', () => {
    stdGridApi.sizeColumnsToFit();
    smpGridApi.sizeColumnsToFit();
    if (state.get('modelFit')) {
      const curvePlot = document.getElementById('curve_plot');
      if (curvePlot && curvePlot.data) Plotly.Plots.resize(curvePlot);
      const residualPlot = document.getElementById('residual_plot');
      if (residualPlot && residualPlot.data) Plotly.Plots.resize(residualPlot);
    }
  });
}

// ── Sidebar Settings Changes ───────────────────────────────────────────────

// When dilution factors or target mass change, re-predict if model exists
for (const id of ['smp_dilution', 'target_mass']) {
  document.getElementById(id).addEventListener('change', () => {
    predictAndUpdateSamples(stdGridApi, smpGridApi);
  });
}

// When exclude_highest or std_dilution change, user needs to re-fit manually
// (matching R app behavior — model is not auto-refitted)

// ── Debug ──────────────────────────────────────────────────────────────────
window.quderState = state;
