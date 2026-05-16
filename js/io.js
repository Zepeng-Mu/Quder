// CSV parsing, export, and example data loading
// Ports parse_sample_csv() and file I/O from app.R

/**
 * Parse an uploaded CSV/TSV/TXT file into sample readings.
 * Returns { data: number[], warnings: string[] }
 */
export function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete(results) {
        const warnings = [];
        const data = [];

        for (let r = 0; r < results.data.length; r++) {
          const row = results.data[r];
          for (let c = 0; c < row.length; c++) {
            const val = row[c];
            if (val === null || val === '' || (typeof val === 'number' && isNaN(val))) {
              // skip empty/NaN cells
            } else if (typeof val === 'number') {
              data.push(val);
            } else {
              warnings.push(`Non-numeric value at row ${r + 1}, col ${c + 1}: "${val}"`);
            }
          }
        }

        // Report parser warnings
        for (const w of results.errors) {
          warnings.push(w.message);
        }

        resolve({ data, warnings });
      },
      error(err) {
        reject(err);
      },
    });
  });
}

/**
 * Export results as a CSV download.
 */
export function exportResultsCSV(data, filename) {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Load example data from Std.csv and Smp.csv.
 * Returns { stdReadings: number[], smpReadings: number[] }
 */
export async function loadExampleData() {
  const [stdResp, smpResp] = await Promise.all([fetch('Std.csv'), fetch('Smp.csv')]);
  const stdText = await stdResp.text();
  const smpText = await smpResp.text();

  // Std.csv is a single line of comma-separated numbers
  const stdResult = Papa.parse(stdText, { header: false, dynamicTyping: true, skipEmptyLines: true });
  const stdReadings = stdResult.data[0].filter(v => typeof v === 'number' && !isNaN(v));

  // Smp.csv is a matrix — flatten all numeric values
  const smpResult = Papa.parse(smpText, { header: false, dynamicTyping: true, skipEmptyLines: true });
  const smpReadings = [];
  for (const row of smpResult.data) {
    for (const val of row) {
      if (typeof val === 'number' && !isNaN(val)) {
        smpReadings.push(val);
      }
    }
  }

  return { stdReadings, smpReadings };
}
