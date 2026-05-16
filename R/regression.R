# Standard curve fitting and sample prediction
# Extracted from Qubit.R with added flexibility

#' Fit a linear regression to standard curve data
#'
#' @param readings Numeric vector of raw plate reader values for standards
#' @param known_conc Numeric vector of known concentrations (ng/uL), same length as readings
#' @param dilution_factor Numeric, dilution factor for standards (default 5)
#' @param exclude_highest Logical, whether to exclude the highest concentration point (default TRUE)
#'
#' @return A list with: model, r_squared, slope, intercept, fitted_values, residuals,
#'   std_data (tibble used for fitting), excluded_point (TRUE/FALSE)
fit_standard_curve <- function(readings, known_conc, dilution_factor = 5,
                               exclude_highest = TRUE) {
  # Build tibble
  std <- tibble(
    raw_value = as.numeric(readings),
    known_con = as.numeric(known_conc)
  )

  # Remove rows with missing values
  std <- std[complete.cases(std), ]

  # Apply dilution correction
  std$value <- std$raw_value / dilution_factor

  # Exclude highest concentration if requested
  excluded <- FALSE
  if (exclude_highest && nrow(std) > 1) {
    max_con <- max(std$known_con)
    std_fit <- std[std$known_con != max_con, ]
    excluded <- TRUE
  } else {
    std_fit <- std
  }

  # Fit linear model: concentration ~ reading
  model <- lm(known_con ~ value, data = std_fit)

  r_sq <- summary(model)$r.squared
  slope <- coef(model)[["value"]]
  intercept <- coef(model)[["(Intercept)"]]

  list(
    model = model,
    r_squared = r_sq,
    slope = slope,
    intercept = intercept,
    fitted_values = fitted(model),
    residuals = residuals(model),
    std_data = std_fit,
    excluded_point = excluded
  )
}

#' Predict sample concentrations from fitted model
#'
#' @param model A fitted lm object from fit_standard_curve()
#' @param readings Numeric vector of raw plate reader values for samples
#' @param sample_names Character vector of sample names, same length as readings
#' @param sample_dilution Numeric, dilution factor for samples (default 2)
#' @param target_mass Numeric, target mass for pooling in ng (default 50)
#'
#' @return A tibble with columns: sample_name, raw_value, dilution_corrected,
#'   predicted_conc, pool_volume, status
predict_samples <- function(model, readings, sample_names = NULL,
                            sample_dilution = 2, target_mass = 50) {
  n <- length(readings)

  if (is.null(sample_names)) {
    sample_names <- paste0("Sample_", seq_len(n))
  }

  raw <- as.numeric(readings)
  corrected <- raw / sample_dilution

  # Predict concentrations
  pred <- predict(model, newdata = data.frame(value = corrected))

  # Compute pooling volumes
  pool <- ifelse(pred > 0, target_mass / pred, NA_real_)

  # Determine status
  status <- ifelse(is.na(raw), "N/A",
    ifelse(pred < 0, "Negative",
      ifelse(pred == 0, "Cannot pool",
        ifelse(pool > 200, "Too dilute",
          "OK"))))

  tibble(
    sample_name = sample_names,
    raw_value = raw,
    dilution_corrected = corrected,
    predicted_conc = round(pred, 4),
    pool_volume = round(pool, 2),
    status = status
  )
}

#' Summarize results by sample group
#'
#' @param results A tibble from predict_samples()
#'
#' @return A tibble with columns: sample_name, n, mean_conc, cv_pct, total_pool_volume
summarize_samples <- function(results) {
  valid <- results[results$status == "OK", ]

  if (nrow(valid) == 0) {
    return(tibble(sample_name = character(), n = integer(),
                  mean_conc = numeric(), cv_pct = numeric(),
                  total_pool_volume = numeric()))
  }

  valid |>
    summarise(
      n = n(),
      mean_conc = mean(predicted_conc, na.rm = TRUE),
      sd_conc = sd(predicted_conc, na.rm = TRUE),
      total_pool_volume = sum(pool_volume, na.rm = TRUE),
      .by = sample_name
    ) |>
    mutate(cv_pct = ifelse(n > 1, round(sd_conc / mean_conc * 100, 1), NA_real_)) |>
    select(sample_name, n, mean_conc, cv_pct, total_pool_volume)
}
