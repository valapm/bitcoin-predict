import { log, exp, bigIntScale } from "./fixMath"
import { exp as expOld, log as logOld, scale as scaleOld } from "./fixMathOld"
import { marketVersion } from "./contracts"
import semverLte from "semver/functions/lte"

export const SatScaling = 2 ** 20
const SatScalingAdjust = 44 // 64 - 20

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

export function lmsrFixed(balance: balance): bigint {
  if (balance.liquidity === 0) return BigInt(Math.max(...balance.shares)) * bigIntScale

  const expSum = balance.shares
    .map(share => (BigInt(share) * bigIntScale) / BigInt(balance.liquidity))
    .map(exp)
    .reduce((a, b) => a + b)

  return BigInt(balance.liquidity) * log(expSum)
}

export function lmsrFixedOld(balance: balance): number {
  if (balance.liquidity === 0) return Math.max(...balance.shares)

  const expSum = balance.shares
    .map(share => (share * scaleOld) / balance.liquidity)
    .map(Math.floor)
    .map(expOld)
    .reduce((a, b) => a + b)

  return (balance.liquidity * logOld(expSum)) / scaleOld
}

export function getProbability(balance: balance, shares: number): number {
  if (balance.liquidity === 0) {
    return shares / balance.shares.reduce((a, b) => a + b)
  }

  const expSum = balance.shares
    .map(share => share / balance.liquidity)
    .map(Math.exp)
    .reduce((a, b) => a + b)

  return Math.exp(shares / balance.liquidity) / expSum
}

export function getLmsrSats(balance: balance): number {
  return Math.floor(lmsr(balance) * SatScaling)
}

export function getLmsrSatsFixed(balance: balance, version: marketVersion): number {
  if (semverLte(version.version, "0.3.13")) {
    return Math.floor(lmsrFixedOld(balance) * SatScaling)
  }

  return Number(lmsrFixed(balance) >> BigInt(SatScalingAdjust))
}
