import { sha256, hash } from "./sha"
import { int2Hex } from "./hex"
import { balance } from "./pm"
import { getMerklePath } from "./merkleTree"

export const MaxShares = 2 ** 7
export const MaxLiquidity = 2 ** 2
export const ScalingFactor = 2 ** 35
export const SatScaling = 2 ** 20

export function lmsr(balance: balance): number {
  return (
    balance.liquidity *
    Math.log(Math.exp(balance.sharesFor / balance.liquidity) + Math.exp(balance.sharesAgainst / balance.liquidity))
  )
}

export function getProbability(balance: balance): number {
  return (
    Math.exp(balance.sharesFor / balance.liquidity) /
    (Math.exp(balance.sharesFor / balance.liquidity) + Math.exp(balance.sharesAgainst / balance.liquidity))
  )
}

export function lmsrScaled(balance: balance): number {
  return Math.round(lmsr(balance) * ScalingFactor)
}

export function getLmsrShas(maxL = MaxLiquidity, maxS = MaxShares): hash[] {
  const array = []
  let i = 0
  for (let l = 1; l <= maxL; l++) {
    for (let n = 0; n <= maxS; n++) {
      for (let m = 0; m <= maxS; m++) {
        const balance: balance = {
          liquidity: l,
          sharesFor: n,
          sharesAgainst: m
        }
        array[i] = sha256(getLmsrHex(balance))
        i++
      }
    }
  }
  return array
}

export function getLmsrHex(balance: balance): string {
  return (
    int2Hex(balance.liquidity, 1) +
    int2Hex(balance.sharesFor, 1) +
    int2Hex(balance.sharesAgainst, 1) +
    int2Hex(lmsrScaled(balance), 6)
  )
}

export function getPos(balance: balance, maxShares = MaxShares): number {
  return (balance.liquidity - 1) * (maxShares + 1) ** 2 + balance.sharesFor * (maxShares + 1) + balance.sharesAgainst
}

export function getLmsrSats(balance: balance): number {
  return Math.floor(lmsr(balance) * SatScaling)
}

export function getLmsrMerklePath(balance: balance, shas: hash[]): string {
  return getMerklePath(getPos(balance), shas)
}
