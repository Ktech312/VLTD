import { showToast } from "@/lib/toast";

export function backupVault() {
  try {
    const raw = localStorage.getItem("vltd_vault_items_v1");
    if (!raw) return;

    localStorage.setItem("vltd_vault_backup", raw);
  } catch {}
}

export function restoreVaultBackup() {
  try {
    const backup = localStorage.getItem("vltd_vault_backup");
    if (!backup) {
      showToast("No backup found");
      return;
    }

    localStorage.setItem("vltd_vault_items_v1", backup);
    showToast("Vault restored from backup");
    location.reload();
  } catch {}
}
