import { addItem, updateItem, deleteItem } from "./vaultModel";
import { emitVaultUpdate } from "./vaultEvents";

export function addItemAndNotify(item: any) {
  const res = addItem(item);
  emitVaultUpdate();
  return res;
}

export function updateItemAndNotify(item: any) {
  const res = updateItem(item);
  emitVaultUpdate();
  return res;
}

export function deleteItemAndNotify(id: string) {
  const res = deleteItem(id);
  emitVaultUpdate();
  return res;
}
