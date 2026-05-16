// AG Grid table creation and management
// Ports rhandsontable behavior from app.R

/**
 * Create the standards table (8 fixed rows).
 * Columns: concentration (readOnly, 6 decimal), reading (editable, integer)
 */
export function createStdTable(containerId, onCellChange) {
  const gridOptions = {
    columnDefs: [
      {
        field: 'concentration',
        headerName: 'Concentration (ng/uL)',
        editable: false,
        valueFormatter: p => p.value != null ? p.value.toFixed(6) : '',
        flex: 1,
      },
      {
        field: 'reading',
        headerName: 'Reading',
        editable: true,
        valueFormatter: p => p.value != null ? Math.round(p.value) : '',
        flex: 1,
      },
    ],
    defaultColDef: {
      resizable: false,
      sortable: false,
      filter: false,
    },
    rowData: [],
    suppressRowHoverHighlight: true,
    rowSelection: 'single',
    onCellValueChanged: onCellChange,
  };

  const container = document.getElementById(containerId);
  const gridApi = agGrid.createGrid(container, gridOptions);
  return gridApi;
}

/**
 * Create the samples table (dynamic rows).
 * Columns: sample_name, reading (editable), predicted_conc, pool_volume, status (readOnly)
 */
export function createSmpTable(containerId, onCellChange) {
  const gridOptions = {
    columnDefs: [
      {
        field: 'sampleName',
        headerName: 'Sample Name',
        editable: true,
        flex: 1,
      },
      {
        field: 'reading',
        headerName: 'Reading',
        editable: true,
        valueFormatter: p => p.value != null ? Math.round(p.value) : '',
        flex: 1,
      },
      {
        field: 'predictedConc',
        headerName: 'Predicted Conc',
        editable: false,
        valueFormatter: p => p.value != null ? p.value.toFixed(4) : '',
        flex: 1,
      },
      {
        field: 'poolVolume',
        headerName: 'Pool Volume',
        editable: false,
        valueFormatter: p => p.value != null ? p.value.toFixed(2) : '',
        flex: 1,
      },
      {
        field: 'status',
        headerName: 'Status',
        editable: false,
        flex: 1,
        cellClass: p => {
          switch (p.value) {
            case 'OK': return 'status-ok';
            case 'Negative': return 'status-negative';
            case 'Cannot pool': return 'status-cannot-pool';
            case 'Too dilute': return 'status-too-dilute';
            default: return 'status-na';
          }
        },
      },
    ],
    defaultColDef: {
      resizable: false,
      sortable: false,
      filter: false,
    },
    rowData: [],
    suppressRowHoverHighlight: true,
    rowSelection: 'single',
    onCellValueChanged: onCellChange,
  };

  const container = document.getElementById(containerId);
  const gridApi = agGrid.createGrid(container, gridOptions);
  return gridApi;
}

/**
 * Add a new sample row to the samples grid.
 */
export function addSampleRow(gridApi) {
  const rowCount = gridApi.getDisplayedRowCount();
  const newRow = {
    sampleName: `Sample_${rowCount + 1}`,
    reading: null,
    predictedConc: null,
    poolVolume: null,
    status: 'N/A',
  };
  gridApi.applyTransaction({ add: [newRow] });
}

/**
 * Bulk update sample table data (after prediction).
 */
export function updateSmpTableData(gridApi, data) {
  gridApi.setGridOption('rowData', data);
}

/**
 * Get all row data from a grid.
 */
export function getGridData(gridApi) {
  const rows = [];
  gridApi.forEachNode(node => rows.push({ ...node.data }));
  return rows;
}
