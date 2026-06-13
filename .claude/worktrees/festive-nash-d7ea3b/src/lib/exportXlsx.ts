// src/lib/exportXlsx.ts
import * as XLSX from "xlsx";

export function exportToXlsx(filename: string, rows: any[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventory");
  XLSX.writeFile(wb, filename);
}