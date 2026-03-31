
export function calculatePortfolioPerformance(items: any[]) {

  let totalCost = 0
  let totalValue = 0

  for (const item of items) {
    totalCost += Number(item.purchasePrice ?? 0)
    totalValue += Number(item.currentValue ?? 0)
  }

  return {
    totalCost,
    totalValue,
    totalProfit: totalValue - totalCost
  }
}
