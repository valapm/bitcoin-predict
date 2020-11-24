import { sha256 } from "./sha"
import { int2Hex } from "./hex"
import { balance } from "./pm"

export const maxShares = 2 ** 7
export const maxLiquidity = 2 ** 2
export const scalingFactor = 2 ** 35
export const satScaling = 2 ** 20

export function lmsr(liquidity: number, sharesPro: number, sharesContra: number): number {
  return liquidity * Math.log(Math.exp(sharesPro / liquidity) + Math.exp(sharesContra / liquidity))
}

export function lmsrScaled(liquidity: number, sharesPro: number, sharesContra: number): number {
  return Math.round(lmsr(liquidity, sharesPro, sharesContra) * scalingFactor)
}

export function getLmsrShas(maxL: number = maxLiquidity, maxS: number = maxShares): string[] {
  const array = []
  let i = 0
  for (let l = 1; l <= maxL; l++) {
    for (let n = 0; n <= maxS; n++) {
      for (let m = 0; m <= maxS; m++) {
        array[i] = sha256(getLmsrHex(l, n, m))
        i++
      }
    }
  }
  return array
}

export function getLmsrHex(l: number, n: number, m: number): string {
  return int2Hex(l, 1) + int2Hex(n, 1) + int2Hex(m, 1) + int2Hex(lmsrScaled(l, n, m), 6)
}

export function getPos(l: number, n: number, m: number): number {
  return (l - 1) * (maxShares + 1) ** 2 + n * (maxShares + 1) + m
}

export function getLmsrSats(balance: balance): number {
  return Math.floor(lmsr(balance.liquidity, balance.sharesFor, balance.sharesAgainst) * satScaling)
}
