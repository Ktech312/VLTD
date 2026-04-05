import { loadItems, saveItem, saveItems, type VaultItem } from "./vaultModel";
import { emitVaultUpdate } from "./vaultEvents";

export function addItemAndNotify(item: VaultItem) {
  saveItem(item);
  emitVaultUpdate();
  return item;
}

export function updateItemAndNotify(item: VaultItem) {
  saveItem(item);
  emitVaultUpdate();
  return item;
}

export function deleteItemAndNotify(id: string) {
  const items = loadItems({ includeAllProfiles: true });
  const next = items.filter((item) => String(item.id) !== String(id));
  saveItems(next);
  emitVaultUpdate();
  return id;
}
