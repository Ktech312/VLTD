"use client";

export default function RestoreVaultButton() {
  function handleRestore() {
    const backup = localStorage.getItem("vltd_vault_backup");

    if (!backup) {
      alert("No backup found.");
      return;
    }

    const confirmRestore = confirm("Restore vault from backup? This will overwrite current data.");

    if (!confirmRestore) return;

    localStorage.setItem("vltd_vault_items_v1", backup);

    alert("Vault restored.");
    location.reload();
  }

  return (
    <button
      type="button"
      onClick={handleRestore}
      className="vltd-selectable inline-flex min-h-[42px] items-center justify-center rounded-full bg-[color:var(--pill)] px-5 py-2 text-sm font-medium text-[color:var(--fg)] ring-1 ring-[color:var(--border)] transition"
    >
      Restore Vault
    </button>
  );
}