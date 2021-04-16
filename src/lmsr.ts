import { log, exp, scale } from "./fixMath"

export const SatScaling = 2 ** 20

export type balance = {
  liquidity: number
  shares: number[]
}

export function lmsr(balance: balance): number {
  if (balance.liquidity === 0) return Math.max(...balance.shares)

  const expSum = balance.shares
    .map(share => share / balance.liquidity)
    .map(Math.exp)
    .reduce((a, b) => a + b)

  return balance.liquidity * Math.log(expSum)
}

export function lmsrFixed(balance: balance): number {
  if (balance.liquidity === 0) return Math.max(...balance.shares)

  const expSum = balance.shares
    .map(share => (share * scale) / balance.liquidity)
    .map(Math.floor)
    .map(exp)
    .reduce((a, b) => a + b)

  return (balance.liquidity * log(expSum)) / scale
}

export function getProbability(balance: balance, shares: number): number {
  const expSum = balance.shares
    .map(share => share / balance.liquidity)
    .map(Math.exp)
    .reduce((a, b) => a + b)

  return Math.exp(shares / balance.liquidity) / expSum
}

export function getLmsrSats(balance: balance): number {
  return Math.floor(lmsrFixed(balance) * SatScaling)
}
