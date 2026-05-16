# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Quder** is an R Shiny web application for Qubit quantification. It fits a standard curve from plate reader data and predicts sample DNA/RNA concentrations for pooling calculations.

## Running the App

```r
# From project root
shiny::runApp(".", port = 8765)

# Or via Rscript
Rscript app.R
```

No formal build system, dependency lockfile, or CI exists. Dependencies are declared inline via `library()` calls.

## Key Dependencies

`shiny`, `bslib` (flatly theme), `tidyverse`, `rhandsontable`, `plotly`, `htmltools`

## Architecture

Standard Shiny two-file pattern with extracted helpers:

- **`app.R`** — Entry point. Defines UI (`bslib::page_sidebar` with three cards: standard curve table, plot, sample results) and all server logic (model fitting, reactive predictions, file upload, CSV export, sample aggregation).
- **`R/regression.R`** — `fit_standard_curve()`, `predict_samples()`, `summarize_samples()`. Core math: linear model `lm(known_con ~ value)` with optional highest-concentration exclusion and dilution correction.
- **`R/validation.R`** — `r2_quality()`, `validate_numeric_input()`, `check_standard_count()`. Input validation and R-squared quality mapping.
- **`R/parse_plate.R`** — `parse_sample_csv()` with auto separator detection (comma/tab/semicolon). Handles raw plate reader CSV/TXT import into tidy tibbles.
- **`Qubit.R`** — Original standalone prototype, not used by the app.

## Data Files

- `Std.csv` — 8 standard curve concentrations (raw readings from Qubit kit)
- `Smp.csv` — Sample groups (rows × columns layout from plate reader)

## Conventions

- No testing infrastructure (no `testthat`, no CI).
- No linting or formatting config.
- UI uses `rhandsontable` for editable in-app spreadsheets and `plotly` for interactive plots.
- Helper modules in `R/` are sourced via `source()` in `app.R`.
