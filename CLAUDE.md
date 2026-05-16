# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Quder** is a web application for Qubit quantification. It fits a standard curve from plate reader data and predicts sample DNA/RNA concentrations for pooling calculations.

Two versions exist:
- **R Shiny** (`app.R`) — original, requires an R server
- **Static HTML/JS** (`index.html` + `js/`) — zero-dependency, hostable on GitHub Pages

## Running the Static App

Open `index.html` in a browser, or serve with any static file server:

```bash
python3 -m http.server 8765
# Then open http://localhost:8765
```

No build step. All dependencies loaded via CDN.

## Running the R App

```r
shiny::runApp(".", port = 8765)
```

## Key Dependencies

### Static App (CDN)
`Bootstrap 5.3` (Bootswatch Flatly), `AG Grid Community` (editable tables), `Plotly.js` (charts), `Papa Parse` (CSV parsing)

### R App
`shiny`, `bslib`, `tidyverse`, `rhandsontable`, `plotly`, `htmltools`

## Architecture

### Static App

- **`index.html`** — Full page with CDN links and Bootstrap layout
- **`js/app.js`** — Main wiring: event handlers, state management, UI updates
- **`js/math.js`** — `fitStandardCurve()`, `predictSamples()`, `summarizeSamples()`, `r2Quality()`, `checkStandardCount()`. Ports of R regression/validation logic.
- **`js/state.js`** — Simple pub/sub state store (replaces Shiny `reactiveVal`)
- **`js/tables.js`** — AG Grid table creation for standards and samples
- **`js/charts.js`** — `renderCurvePlot()`, `renderResidualPlot()` via Plotly.js
- **`js/io.js`** — `parseCSVFile()`, `exportResultsCSV()`, `loadExampleData()` via Papa Parse
- **`css/custom.css`** — Styles beyond Flatly defaults

### R App

- **`app.R`** — Entry point. Defines UI and server logic.
- **`R/regression.R`** — `fit_standard_curve()`, `predict_samples()`, `summarize_samples()`.
- **`R/validation.R`** — `r2_quality()`, `validate_numeric_input()`, `check_standard_count()`.
- **`R/parse_plate.R`** — `parse_sample_csv()` with auto separator detection.
- **`Qubit.R`** — Original standalone prototype, not used by either app.

## Data Files

- `Std.csv` — 8 standard curve concentrations (raw readings from Qubit kit)
- `Smp.csv` — Sample groups (rows × columns layout from plate reader)

## Conventions

- No testing infrastructure.
- No linting or formatting config.
- Static app uses ES modules (`import`/`export`) with `<script type="module">`.
- CDN libraries loaded as UMD globals; app code uses ES modules.
