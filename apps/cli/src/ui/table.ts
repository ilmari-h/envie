export interface TableColumn {
  header: string;
  key: string;
}

export interface TableRow {
  [key: string]: string | number | null | undefined;
}

export function printTable(columns: TableColumn[], rows: TableRow[]): void {

  // Calculate column widths
  const columnWidths: Record<string, number> = {};
  
  columns.forEach(col => {
    // Start with header width
    columnWidths[col.key] = col.header.length;
    
    // Check all row values for this column
    rows.forEach(row => {
      const value = row[col.key];
      const stringValue = value?.toString() ?? '';
      columnWidths[col.key] = Math.max(columnWidths[col.key], stringValue.length);
    });
  });

  // Print header row (all caps)
  const headerRow = columns
    .map(col => col.header.toUpperCase().padEnd(columnWidths[col.key]))
    .join('  ');
  console.log(headerRow);

  // Print separator row (dashes)
  const separatorRow = columns
    .map(col => '-'.repeat(columnWidths[col.key]))
    .join('  ');
  console.log(separatorRow);

  // Print data rows
  rows.forEach(row => {
    const dataRow = columns
      .map(col => {
        const value = row[col.key];
        const stringValue = value?.toString() ?? '';
        return stringValue.padEnd(columnWidths[col.key]);
      })
      .join('  ');
    console.log(dataRow);
  });
}