const LS_KEY = "vltd_vault_items_v1";
const SALES_KEY = "vltd_sales_history";

export function sellItem(itemId: string, salePrice: number) {
  if (typeof window === "undefined") return;

  try {
    // Load current vault
    const raw = localStorage.getItem(LS_KEY);
    const items = raw ? JSON.parse(raw) : [];

    // Find item
    const item = items.find((i: any) => i.id === itemId);
    if (!item) return;

    // Remove from vault
    const nextItems = items.filter((i: any) => i.id !== itemId);
    localStorage.setItem(LS_KEY, JSON.stringify(nextItems));

    // Save to sales history
    const salesRaw = localStorage.getItem(SALES_KEY);
    const sales = salesRaw ? JSON.parse(salesRaw) : [];

    const saleRecord = {
      ...item,
      salePrice,
      soldAt: Date.now(),
    };

    sales.push(saleRecord);
    localStorage.setItem(SALES_KEY, JSON.stringify(sales));
  } catch (err) {
    console.error("sellItem failed", err);
  }
}