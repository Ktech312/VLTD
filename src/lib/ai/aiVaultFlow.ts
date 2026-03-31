
export function buildVaultItemFromAI(result:any){

  return {
    id: String(Date.now()),
    title: result.title,
    categoryLabel: result.category,
    purchasePrice: result.estimatedValue,
    currentValue: result.estimatedValue,
    createdAt: Date.now()
  }
}
