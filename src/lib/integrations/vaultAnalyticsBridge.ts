
export function computeVaultAnalytics(items:any[]){

  let totalValue = 0
  let totalCost = 0

  for(const item of items){
    totalValue += Number(item.currentValue ?? 0)
    totalCost += Number(item.purchasePrice ?? 0)
  }

  return {
    totalValue,
    totalCost,
    roi: totalCost ? ((totalValue-totalCost)/totalCost*100).toFixed(2) : 0
  }
}
