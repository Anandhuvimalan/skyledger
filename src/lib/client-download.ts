"use client";

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  triggerBlobDownload(filename, blob);
}

export function triggerBlobDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, payload: unknown) {
  triggerDownload(
    filename,
    JSON.stringify(payload, null, 2),
    "application/json;charset=utf-8"
  );
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>
) {
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n");

  triggerDownload(filename, csv, "text/csv;charset=utf-8");
}
