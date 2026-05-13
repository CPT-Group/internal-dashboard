/**
 * Minimal CSV helpers for client-side downloads (e.g. Cursor analytics tab exports).
 */

function csvEscapeField(value: string | number | boolean): string {
  const s = typeof value === 'string' ? value : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(headers: string[], rows: (string | number | boolean)[][]): string {
  const headerLine = headers.map(csvEscapeField).join(',');
  const bodyLines = rows.map((row) => row.map(csvEscapeField).join(','));
  return [headerLine, ...bodyLines].join('\r\n');
}

/** UTF-8 BOM so Excel recognizes UTF-8 when opening the file. */
export function downloadCsv(filename: string, csvBody: string): void {
  const text = `\uFEFF${csvBody}`;
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.click();
  URL.revokeObjectURL(url);
}
