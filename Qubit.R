# Load packages
library(tidyverse)
library(data.table)
library(tidyplots)

# Read standard curve
std <- fread("Desktop/Std.csv", header = T) |>
  pivot_longer(`8`:`1`) |>
  mutate(logValue = log(value), grp = "Std") |>
  mutate(con = c(10, 5, 2.5, 1.25, 0.625, 0.3125, 0.15625, 0)) |>
  filter(con != 10) |>
  mutate(value = value / 5)

# Plot standard curve
std |>
  tidyplot(x = value, y = con) |>
  add_data_points() |>
  add_curve_fit(method = "lm")

# Fit a standard curve
modelFit <- lm(con ~ value, std)

# Load sample data
smp <- fread("Desktop/Smp.csv", header = T) |>
  pivot_longer(P1:P12) |>
  mutate(logValue = log(value)) |>
  rename(grp = V1) |>
  mutate(value = value / 2)

# Calculate sample concentration from fitted model
smp$con <- predict(modelFit, smp)

# Volume to pool equimolar for each sample
smp$pool <- 50 / smp$con

# Total volume pooled
smp |> 
  summarise(total = sum(pool), .by = grp)

# Plot sample data with standard curve
cmb <- bind_rows(smp, std)

cmb |>
  tidyplot(x = value, y = con, color = grp) |>
  add_data_points() |>
  add_line()
