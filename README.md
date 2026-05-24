# Quder — Qubit with Plate Reader

A web app for DNA/RNA quantification using Qubit fluorometry data from a plate reader. Fits a standard curve and predicts sample concentrations for pooling calculations.

## Access on GitHub Pages

https://zepeng-mu.github.io/Quder/

## Run the Live App locally

Open `index.html` directly in a browser — no build step required. Or serve locally:

```bash
python3 -m http.server 8765
# http://localhost:8765
```

The static version has zero dependencies beyond CDN libraries and can be hosted on GitHub Pages.

## Features

- Upload standard and sample CSV files from a plate reader
- Fit a linear/quadratic standard curve with R² quality indicator
- Predict sample concentrations with interactive editable tables
- Residual plot for curve diagnostics
- Export results to CSV

## Acknowledgements
The original protocol for Qubit measurement with a plate reader was developed by Cristin McCabe at the Broad Institute (https://www.broadinstitute.org/) and inspired this project.
