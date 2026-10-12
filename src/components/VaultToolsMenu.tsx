"use client";

import { useState } from "react";

import InsurancePdfButton from "@/components/InsurancePdfButton";
import { ToolsMenu } from "@/components/ui/ToolsMenu";
import { downloadPhotosZip } from "@/components/VaultExportButton";
import { showToast } from "@/lib/toast";
import { exportVaultCsv, exportVaultJson } from "@/lib/vaultExport";
import { loadItems } from "@/lib/vaultModel";

/** Vault Tools: Import and the ordinary record exports. Backup and recovery live in Settings. */
export default function VaultToolsMenu() {
  const [insuranceOpen, setInsuranceOpen] = useState(false);

  async function handlePhotoZip() {
    try {
      await downloadPhotosZip(loadItems(), (message) => showToast(message));
    } catch {
      showToast("The photo download could not finish.");
    }
  }

  return (
    <>
      <ToolsMenu
        items={[
          { key: "import", label: "Import", description: "Bring in items from a spreadsheet", href: "/vault/import" },
          { key: "csv", label: "Export CSV", description: "Your records as a spreadsheet", onClick: exportVaultCsv },
          { key: "json", label: "Export JSON", description: "Your records as a data file", onClick: exportVaultJson },
          { key: "insurance", label: "Insurance PDF", description: "A printable list for insurance", onClick: () => setInsuranceOpen(true) },
          { key: "report", label: "Collection report", description: "A printable view of your vault", onClick: () => window.open("/vault/print", "_blank") },
          { key: "zip", label: "Download photos (ZIP)", description: "All item photos in one file", onClick: () => void handlePhotoZip() },
        ]}
      />
      <InsurancePdfButton items={insuranceOpen ? loadItems() : []} open={insuranceOpen} onOpenChange={setInsuranceOpen} hideTrigger />
    </>
  );
}
