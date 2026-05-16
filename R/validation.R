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
