import { WineMaster } from "../types";

export function calculateProfit(cost: number, sellingPrice: number) {
  if (sellingPrice === 0) return { profit: 0, margin: 0, costRatio: 0 };
  const profit = sellingPrice - cost;
  const margin = (profit / sellingPrice) * 100;
  const costRatio = (cost / sellingPrice) * 100;
  return { profit, margin, costRatio };
}

export function calculateGlassProfit(bottleCost: number, glassPrice: number, glassesCount: number = 6) {
  if (glassPrice === 0 || glassesCount === 0) return { profit: 0, costRatio: 0 };
  const costPerGlass = bottleCost / glassesCount;
  const profit = glassPrice - costPerGlass;
  const costRatio = (costPerGlass / glassPrice) * 100;
  return { profit, costRatio };
}

export function simulateProfitScenario(wine: WineMaster, bottlesPerMonth: number, price: number) {
  const { profit, margin } = calculateProfit(wine.cost, price);
  return {
    monthlyRevenue: bottlesPerMonth * price,
    monthlyProfit: bottlesPerMonth * profit,
    margin
  };
}
