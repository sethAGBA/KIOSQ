/**
 * Utility to export data to CSV format
 */
export const exportToCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows: string[] = [];

  // Header row (semicolon separator for Excel compatibility in French locales)
  csvRows.push(headers.join(';'));

  // Data rows
  for (const row of data) {
    const values = headers.map(header => {
      let val = row[header];

      if (val === null || val === undefined) {
        val = '';
      } else if (val instanceof Date) {
        val = val.toLocaleString();
      } else if (typeof val === 'object') {
        val = JSON.stringify(val);
      }

      const escaped = ('' + val).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(';'));
  }

  const csvString = csvRows.join('\n');
  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
