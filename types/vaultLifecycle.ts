export type VaultItemStatus =
  | "COLLECTION"
  | "SOLD"
  | "WISHLIST";

export type SaleRecord = {
  id: string;
  itemId: string;

  title: string;
  universe?: string;
  category?: string;

  grade?: string;
  certNumber?: string;

  purchasePrice?: number;
  salePrice?: number;

  soldAt: number;

  platform?: string;
  notes?: string;
};