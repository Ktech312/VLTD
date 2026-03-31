import { Suspense } from "react";
import SpreadsheetImportClient from "./SpreadsheetImportClient";

export default function VaultImportPage() {
  return (
    <Suspense fallback={null}>
      <SpreadsheetImportClient />
    </Suspense>
  );
}
