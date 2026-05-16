# Validation helpers for input, model, and prediction quality

#' Get R-squared quality label and color
#'
#' @param r_squared Numeric, R-squared value from the model
#'
#' @return A list with: label (character), color (hex string), level (character)
r2_quality <- function(r_squared) {
  if (is.na(r_squared)) {
    list(label = "N/A", color = "#999999", level = "none")
  } else if (r_squared >= 0.99) {
    list(label = sprintf("R² = %.4f (Excellent)", r_squared),
         color = "#28a745", level = "excellent")
  } else if (r_squared >= 0.95) {
    list(label = sprintf("R² = %.4f (Good)", r_squared),
         color = "#007bff", level = "good")
  } else if (r_squared >= 0.90) {
    list(label = sprintf("R² = %.4f (Acceptable)", r_squared),
         color = "#ffc107", level = "acceptable")
  } else {
    list(label = sprintf("R² = %.4f (Poor)", r_squared),
         color = "#dc3545", level = "poor")
  }
}

#' Validate numeric input vector
#'
#' @param values Character vector of user input
#'
#' @return A list with: valid (numeric vector with NAs for bad values),
#'   warnings (character vector of warning messages)
validate_numeric_input <- function(values) {
  warnings <- character()
  valid <- suppressWarnings(as.numeric(values))

  bad_idx <- which(is.na(valid) & !is.na(values) & values != "")
  if (length(bad_idx) > 0) {
    warnings <- c(warnings,
      sprintf("Non-numeric value at position %s: \"%s\"",
              bad_idx, values[bad_idx]))
  }

  list(valid = valid, warnings = warnings)
}

#' Check if a model fit has enough standards
#'
#' @param n_standards Integer, number of standards used in fit
#' @param min_required Integer, minimum recommended (default 5)
#'
#' @return A list with: ok (logical), message (character or NULL)
check_standard_count <- function(n_standards, min_required = 5) {
  if (n_standards < min_required) {
    list(ok = FALSE,
         message = sprintf("Only %d standard(s) used. Need at least %d for a reliable fit.",
                           n_standards, min_required))
  } else {
    list(ok = TRUE, message = NULL)
  }
}
