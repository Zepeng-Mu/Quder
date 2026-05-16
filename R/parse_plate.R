# CSV parsing helper for file upload path

#' Parse a sample CSV file into a tibble
#'
#' Handles raw number dumps from plate readers (no headers expected).
#' Supports comma, tab, and semicolon separators.
#'
#' @param file_path Path to the uploaded file
#'
#' @return A list with: data (tibble with columns row_idx, col_idx, raw_value),
#'   n_rows, n_cols, warnings (character vector)
parse_sample_csv <- function(file_path) {
  warnings <- character()

  # Read raw lines
  lines <- readLines(file_path, warn = FALSE)
  lines <- trimws(lines)
  lines <- lines[lines != ""]

  if (length(lines) == 0) {
    return(list(data = tibble(), n_rows = 0, n_cols = 0,
                warnings = "File is empty."))
  }

  # Auto-detect separator
  sep <- detect_separator(lines)

  # Parse each line
  rows <- strsplit(lines, sep, fixed = TRUE)
  n_cols <- max(lengths(rows))
  n_rows <- length(rows)

  # Check for ragged rows
  for (i in seq_along(rows)) {
    if (length(rows[[i]]) < n_cols) {
      warnings <- c(warnings,
        sprintf("Row %d has %d values, expected %d. Padding with NA.",
                i, length(rows[[i]]), n_cols))
      rows[[i]] <- c(rows[[i]], rep(NA, n_cols - length(rows[[i]])))
    }
  }

  # Build matrix and convert to tibble
  mat <- matrix(unlist(rows), nrow = n_rows, ncol = n_cols, byrow = TRUE)

  # Validate numeric values
  vals <- suppressWarnings(as.numeric(mat))
  bad <- is.na(vals) & !is.na(mat) & mat != ""
  if (any(bad)) {
    bad_pos <- which(bad, arr.ind = TRUE)
    for (j in seq_len(nrow(bad_pos))) {
      warnings <- c(warnings,
        sprintf("Non-numeric value at row %d, col %d: \"%s\"",
                bad_pos[j, 1], bad_pos[j, 2], mat[bad_pos[j, 1], bad_pos[j, 2]]))
    }
  }

  # Build tidy tibble
  data <- expand.grid(row_idx = seq_len(n_rows), col_idx = seq_len(n_cols))
  data$raw_value <- vals

  list(
    data = as_tibble(data),
    n_rows = n_rows,
    n_cols = n_cols,
    warnings = warnings
  )
}

#' Count occurrences of a pattern in a string
#'
#' @param x Character string
#' @param pattern Character pattern to count
#'
#' @return Integer count of occurrences
count_matches <- function(x, pattern) {
  m <- gregexpr(pattern, x, fixed = TRUE)[[1]]
  if (m[1] == -1) return(0L)
  length(m)
}

#' Detect the most likely separator in a set of lines
#'
#' @param lines Character vector of lines
#'
#' @return The separator string ("," or "\t" or ";")
detect_separator <- function(lines) {
  test_lines <- head(lines, min(5, length(lines)))

  counts <- c(
    comma = sum(vapply(test_lines, function(l) count_matches(l, ","), integer(1))),
    tab = sum(vapply(test_lines, function(l) count_matches(l, "\t"), integer(1))),
    semi = sum(vapply(test_lines, function(l) count_matches(l, ";"), integer(1)))
  )

  # Pick the most common separator
  if (counts[["tab"]] > 0) return("\t")
  if (counts[["semi"]] > 0) return(";")
  ","
}
