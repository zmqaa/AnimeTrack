export type ExportFileFormat = 'json' | 'csv';

function padTimestampPart(value: number): string {
  return String(value).padStart(2, '0');
}

export function buildExportFilename(format: ExportFileFormat, date = new Date()): string {
  const day = [
    date.getFullYear(),
    padTimestampPart(date.getMonth() + 1),
    padTimestampPart(date.getDate()),
  ].join('');
  const time = [
    padTimestampPart(date.getHours()),
    padTimestampPart(date.getMinutes()),
    padTimestampPart(date.getSeconds()),
  ].join('');

  return `anime-track-export-${day}-${time}.${format}`;
}
