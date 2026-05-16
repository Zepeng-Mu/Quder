library(shiny)
library(bslib)
library(tidyverse)
library(rhandsontable)
library(plotly)
library(htmltools)

source("R/regression.R")
source("R/validation.R")
source("R/parse_plate.R")

# Known concentrations for the Qubit standard curve
DEFAULT_CONC <- c(10, 5, 2.5, 1.25, 0.625, 0.3125, 0.15625, 0)

# ── UI ──────────────────────────────────────────────────────────────────────

ui <- page_sidebar(
  title = "Qubit Quantification",
  theme = bs_theme(bootswatch = "flatly") |>
    bs_add_rules("
      .handsontable .wtHolder {
        overflow: visible !important;
        height: auto !important;
      }
    "),
  fillable = FALSE,

  sidebar = sidebar(
    title = "Settings",
    width = 300,

    card(
      card_header("Model Settings"),
      card_body(
        checkboxInput("exclude_highest", "Exclude highest concentration from fit", value = TRUE),
        numericInput("std_dilution", "Standard dilution factor", value = 5, min = 1, step = 1),
        numericInput("smp_dilution", "Sample dilution factor", value = 2, min = 1, step = 1),
        numericInput("target_mass", "Target pooling mass (ng)", value = 50, min = 1, step = 10)
      )
    ),

    card(
      card_header("Import"),
      card_body(
        fileInput("upload_samples", "Upload sample readings (CSV/TXT)",
                  accept = c(".csv", ".tsv", ".txt")),
        actionButton("load_example", "Load Example Data", class = "btn-outline-secondary btn-sm w-100")
      )
    ),

    card(
      card_header("Fit Quality"),
      card_body(
        uiOutput("r2_badge"),
        uiOutput("fit_params")
      )
    )
  ),

  # ── Main area ──

  card(
    card_header(
      div(style = "display: flex; align-items: center; justify-content: space-between;",
          span("Standard Curve Data"),
          actionButton("fit_model", "Fit Standard Curve", class = "btn-primary btn-sm")
      )
    ),
    card_body(
      rHandsontableOutput("std_table")
    )
  ),

  card(
    card_header("Standard Curve Plot"),
    card_body(
      plotlyOutput("curve_plot", height = "350px"),
      checkboxInput("show_residuals", "Show residual plot", value = FALSE),
      conditionalPanel(
        condition = "input.show_residuals",
        plotlyOutput("residual_plot", height = "200px")
      ),
      uiOutput("fit_warnings")
    )
  ),

  card(
    card_header(
      div(style = "display: flex; align-items: center; justify-content: space-between;",
          span("Sample Results"),
          div(
            actionButton("add_sample", "Add Sample", class = "btn-outline-primary btn-sm"),
            downloadButton("export_csv", "Export CSV", class = "btn-outline-success btn-sm")
          )
      )
    ),
    card_body(
      rHandsontableOutput("smp_table"),
      uiOutput("sample_summary")
    )
  )
)

# ── Server ──────────────────────────────────────────────────────────────────

server <- function(input, output, session) {

  # Reactive values
  model_fit <- reactiveVal(NULL)
  std_data <- reactiveVal(data.frame(
    concentration = DEFAULT_CONC,
    reading = rep(NA_real_, 8)
  ))
  smp_data <- reactiveVal(data.frame(
    sample_name = paste0("Sample_", 1:6),
    reading = rep(NA_real_, 6),
    predicted_conc = rep(NA_real_, 6),
    pool_volume = rep(NA_real_, 6),
    status = rep("N/A", 6),
    stringsAsFactors = FALSE
  ))

  # ── Standards table ──

  output$std_table <- renderRHandsontable({
    df <- std_data()
    rhandsontable(df, rowHeaders = NULL, stretchH = "all") |>
      hot_col("concentration", readOnly = TRUE, format = "0.######") |>
      hot_col("reading", format = "0") |>
      hot_context_menu(allowRowEdit = FALSE, allowColEdit = FALSE)
  })

  observeEvent(input$std_table, {
    tryCatch({
      std_data(hot_to_r(input$std_table))
    }, error = function(e) NULL)
  })

  # ── Samples table ──

  output$smp_table <- renderRHandsontable({
    df <- smp_data()
    rhandsontable(df, rowHeaders = NULL, stretchH = "all") |>
      hot_col("sample_name", type = "text") |>
      hot_col("reading", format = "0") |>
      hot_col("predicted_conc", readOnly = TRUE, format = "0.0000") |>
      hot_col("pool_volume", readOnly = TRUE, format = "0.00") |>
      hot_col("status", readOnly = TRUE) |>
      hot_context_menu(allowRowEdit = TRUE, allowColEdit = FALSE)
  })

  observeEvent(input$smp_table, {
    tryCatch({
      new_data <- hot_to_r(input$smp_table)
      mf <- model_fit()
      if (!is.null(mf) && !all(is.na(new_data$reading))) {
        preds <- predict_samples(mf$model, new_data$reading, new_data$sample_name,
                                 input$smp_dilution, input$target_mass)
        new_data$predicted_conc <- preds$predicted_conc
        new_data$pool_volume <- preds$pool_volume
        new_data$status <- preds$status
      }
      smp_data(new_data)
    }, error = function(e) NULL)
  })

  # Add sample row
  observeEvent(input$add_sample, {
    df <- isolate(smp_data())
    n <- nrow(df)
    new_row <- data.frame(
      sample_name = paste0("Sample_", n + 1),
      reading = NA_real_,
      predicted_conc = NA_real_,
      pool_volume = NA_real_,
      status = "N/A",
      stringsAsFactors = FALSE
    )
    smp_data(rbind(df, new_row))
  })

  # ── Fit model ──

  observeEvent(input$fit_model, {
    std <- std_data()
    readings <- std$reading
    conc <- std$concentration

    # Validate
    valid_idx <- !is.na(readings)
    if (sum(valid_idx) < 3) {
      showNotification("Need at least 3 standards with readings to fit a model.",
                       type = "error")
      return()
    }

    chk <- check_standard_count(sum(valid_idx))
    if (!chk$ok) {
      showNotification(chk$message, type = "warning")
    }

    # Fit
    mf <- fit_standard_curve(
      readings[valid_idx], conc[valid_idx],
      dilution_factor = input$std_dilution,
      exclude_highest = input$exclude_highest
    )

    model_fit(mf)

    # Update sample predictions
    smp <- smp_data()
    if (!all(is.na(smp$reading))) {
      preds <- predict_samples(mf$model, smp$reading, smp$sample_name,
                               input$smp_dilution, input$target_mass)
      smp$predicted_conc <- preds$predicted_conc
      smp$pool_volume <- preds$pool_volume
      smp$status <- preds$status
      smp_data(smp)
    }

    showNotification("Model fitted successfully.", type = "message")
  })

  # ── R² badge ──

  output$r2_badge <- renderUI({
    mf <- model_fit()
    if (is.null(mf)) {
      return(tags$span(style = "color: #999;", "No model fitted yet"))
    }
    q <- r2_quality(mf$r_squared)
    tags$div(
      style = sprintf("background: %s; color: white; padding: 8px 12px; border-radius: 6px; font-weight: bold;", q$color),
      q$label
    )
  })

  output$fit_params <- renderUI({
    mf <- model_fit()
    if (is.null(mf)) return(NULL)
    tags$div(
      style = "margin-top: 8px; font-size: 0.9em; color: #555;",
      sprintf("Slope: %.6f", mf$slope), tags$br(),
      sprintf("Intercept: %.4f", mf$intercept), tags$br(),
      sprintf("Equation: conc = %.6f × reading + %.4f", mf$slope, mf$intercept)
    )
  })

  # ── Standard curve plot ──

  output$curve_plot <- renderPlotly({
    mf <- model_fit()
    if (is.null(mf)) {
      return(plotly_empty())
    }

    std <- mf$std_data

    p <- plot_ly() |>
      add_markers(
        x = std$value, y = std$known_con,
        text = sprintf("Reading: %.0f<br>Conc: %.4f ng/uL", std$raw_value, std$known_con),
        hoverinfo = "text",
        marker = list(color = "#4a90d9", size = 10)
      ) |>
      add_lines(
        x = range(std$value),
        y = mf$intercept + mf$slope * range(std$value),
        line = list(color = "#e74c3c", width = 2),
        showlegend = FALSE
      ) |>
      layout(
        xaxis = list(title = "Raw Reading (dilution-corrected)"),
        yaxis = list(title = "Concentration (ng/uL)"),
        annotations = list(
          x = 0.02, y = 0.98, xref = "paper", yref = "paper",
          text = sprintf("R² = %.4f", mf$r_squared),
          showarrow = FALSE,
          font = list(size = 14, color = "#333")
        )
      )

    if (mf$excluded_point) {
      p <- p |> layout(
        annotations = list(
          x = 0.02, y = 0.90, xref = "paper", yref = "paper",
          text = "(highest conc excluded)",
          showarrow = FALSE,
          font = list(size = 11, color = "#999")
        )
      )
    }

    p
  })

  # ── Residual plot ──

  output$residual_plot <- renderPlotly({
    mf <- model_fit()
    if (is.null(mf)) return(plotly_empty())

    plot_ly() |>
      add_markers(
        x = mf$fitted_values, y = mf$residuals,
        marker = list(color = "#4a90d9", size = 8)
      ) |>
      add_lines(
        x = range(mf$fitted_values), y = c(0, 0),
        line = list(color = "#e74c3c", dash = "dash"),
        showlegend = FALSE
      ) |>
      layout(
        xaxis = list(title = "Fitted values"),
        yaxis = list(title = "Residuals")
      )
  })

  # ── Fit warnings ──

  output$fit_warnings <- renderUI({
    mf <- model_fit()
    if (is.null(mf)) return(NULL)

    q <- r2_quality(mf$r_squared)
    if (q$level %in% c("poor", "acceptable")) {
      color <- if (q$level == "poor") "danger" else "warning"
      tagList(
        tags$div(
          class = sprintf("alert alert-%s mt-2", color),
          if (q$level == "poor") {
            "R² is below 0.90. Standard curve may be unreliable. Check standard concentrations and well assignments."
          } else {
            "R² is below 0.95. Consider re-checking standard readings."
          }
        )
      )
    }
  })

  # ── Sample summary ──

  output$sample_summary <- renderUI({
    smp <- smp_data()
    mf <- model_fit()
    if (is.null(mf) || all(is.na(smp$predicted_conc))) return(NULL)

    summ <- summarize_samples(smp)
    if (nrow(summ) == 0 || all(summ$n == 1)) return(NULL)

    tags$div(
      style = "margin-top: 12px;",
      tags$h6("Sample Aggregates"),
      tags$table(
        class = "table table-sm table-bordered",
        tags$thead(
          tags$tr(
            tags$th("Sample"), tags$th("N"), tags$th("Mean Conc"),
            tags$th("CV %"), tags$th("Total Pool Vol")
          )
        ),
        tags$tbody(
          lapply(seq_len(nrow(summ)), function(i) {
            tags$tr(
              tags$td(summ$sample_name[i]),
              tags$td(summ$n[i]),
              tags$td(sprintf("%.4f", summ$mean_conc[i])),
              tags$td(ifelse(is.na(summ$cv_pct[i]), "—", sprintf("%.1f", summ$cv_pct[i]))),
              tags$td(sprintf("%.2f", summ$total_pool_volume[i]))
            )
          })
        )
      )
    )
  })

  # ── Export CSV ──

  output$export_csv <- downloadHandler(
    filename = function() {
      paste0("qubit_results_", Sys.Date(), ".csv")
    },
    content = function(file) {
      smp <- smp_data()
      mf <- model_fit()
      if (!is.null(mf) && !all(is.na(smp$reading))) {
        preds <- predict_samples(mf$model, smp$reading, smp$sample_name,
                                 input$smp_dilution, input$target_mass)
        write.csv(preds, file, row.names = FALSE)
      } else {
        write.csv(smp, file, row.names = FALSE)
      }
    }
  )

  # ── Load example data ──

  observeEvent(input$load_example, {
    # Load standard readings from Std.csv
    std_raw <- scan("Std.csv", what = numeric(), sep = ",", quiet = TRUE)
    std_data(data.frame(
      concentration = DEFAULT_CONC,
      reading = std_raw
    ))

    # Load sample readings from Smp.csv
    smp_raw <- parse_sample_csv("Smp.csv")
    if (nrow(smp_raw$data) > 0) {
      readings <- smp_raw$data$raw_value
      n <- length(readings)
      smp_data(data.frame(
        sample_name = paste0("Sample_", seq_len(n)),
        reading = readings,
        predicted_conc = rep(NA_real_, n),
        pool_volume = rep(NA_real_, n),
        status = rep("N/A", n),
        stringsAsFactors = FALSE
      ))
    }

    showNotification("Example data loaded. Click 'Fit Standard Curve' to analyze.",
                     type = "message")
  })

  # ── File upload ──

  observeEvent(input$upload_samples, {
    req(input$upload_samples)
    parsed <- parse_sample_csv(input$upload_samples$datapath)

    if (length(parsed$warnings) > 0) {
      for (w in parsed$warnings) {
        showNotification(w, type = "warning")
      }
    }

    if (nrow(parsed$data) > 0) {
      readings <- parsed$data$raw_value
      n <- length(readings)
      smp_data(data.frame(
        sample_name = paste0("Sample_", seq_len(n)),
        reading = readings,
        predicted_conc = rep(NA_real_, n),
        pool_volume = rep(NA_real_, n),
        status = rep("N/A", n),
        stringsAsFactors = FALSE
      ))
      showNotification(sprintf("Loaded %d sample readings.", n),
                       type = "message")
    }
  })
}

shinyApp(ui, server)
