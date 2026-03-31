import { evaluateItem } from "./aiAssistant";
import type { VaultItem } from "./vaultModel";

export function evaluateCollection(items: VaultItem[]) {
  return items.map((item) => ({
    itemId: item.id,
    ...evaluateItem(item),
  }));
}
