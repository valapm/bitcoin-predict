import { compile, bsv, buildContractClass, SigHashPreimage, PubKey, Bytes, Sig } from "scryptlib"
import { getMerkleRoot, getMerklePath as getShaMerklePath } from "./merkleTree"
import { int2Hex, toHex, fromHex } from "./hex"
import { isHash, hash, sha256 } from "./sha"
import { minerDetail, getMinerDetailsHex, isValidMinerDetails } from "./oracle"
import { MaxLiquidity, MaxShares, getLmsrSats, SatScaling, balance } from "./lmsr"
import { ContractDescription, AbstractContract } from "scryptlib/dist/contract"
import { FunctionCall } from "scryptlib/dist/abi"

export type version = {
  identifier: string
  minerKeyPos: number
}

export const versions: version[] = [
  { identifier: "8405e83ea9586904ac569d02d32bc9bb", minerKeyPos: 8 },
  { identifier: "6b8c5b603c5e3ac8e4fbd52647fa920fc4d91661", minerKeyPos: 8 }
]

interface PM extends AbstractContract {
  addEntry(
    preimage: SigHashPreimage,
    liquidity: number,
    sharesFor: number,
    sharesAgainst: number,
    publicKey: PubKey,
    newLmsrBalance: number,
    newLmsrMerklePath: Bytes,
    lastEntry: Bytes,
    lastMerklePath: Bytes
  ): FunctionCall

  updateEntry(
    preimage: SigHashPreimage,
    liquidity: number,
    sharesFor: number,
    sharesAgainst: number,
    prevLiquidity: number,
    prevSharesFor: number,
    prevSharesAgainst: number,
    publicKey: PubKey,
    signature: Sig,
    newLmsrBalance: number,
    newLmsrMerklePath: Bytes,
    merklePath: Bytes
  ): FunctionCall

  redeem(
    txPreimage: SigHashPreimage,
    prevLiquidity: number,
    prevSharesFor: number,
    prevSharesAgainst: number,
    publicKey: PubKey,
    signature: Sig,
    merklePath: Bytes
  ): FunctionCall

  decide(txPreimage: Sig, result: number, minerSigs: Bytes): FunctionCall
}

export type marketDetails = {
  resolve: string
  maxLiquidity?: number
  maxShares?: number
}

export type marketStatus = {
  decided: boolean
  decision: number
}

// export function getCompiledPM(): void {
//   const contractPath = require.resolve("scrypt_boilerplate/contracts/predictionMarket.scrypt")
//   compile({ path: contractPath }, { desc: true })
// }

// export function getContractDescription(): ContractDescription {
//   return require("../predictionMarket.json") as ContractDescription
// }

// export function getLockingScriptASMTemplate(): string[] {
//   const currentVersion = versions[0]
//   const compiled = require(`../scripts/${currentVersion.identifier}`) as ContractDescription
//   return compiled.asm.split(" ")
// }

// export function getLockingScriptASM(minerDetails: minerDetail[]): string[] {
//   const asmTemplate = getLockingScriptASMTemplate()
//   const minerKeyPos = asmTemplate.findIndex(op => op === "$minerKeys")
//   asmTemplate[minerKeyPos] = getMinerDetailsHex(minerDetails)
//   return asmTemplate
// }

export function getMarketVersion(identifier: string): version {
  const version = versions.find(version => version.identifier === identifier)
  if (!version) throw new Error("Market version not supported")
  return version
}

// export function getToken(miners: minerDetail): Token {
//   const Token = buildContractClass(require("../predictionMarket.json"))
//   return new Token(getMinerDetailsHex(miners))
// }

export function getNewMarket(details: marketDetails, entries: entry[], miners: minerDetail[]): marketInfo {
  return {
    version: versions[0].identifier,
    details,
    status: { decided: false, decision: 0 },
    miners,
    balance: getMarketBalance(entries),
    balanceMerkleRoot: getBalanceMerkleRoot(entries)
  }
}

export function getToken(market: marketInfo): PM {
  const Token = buildContractClass(require(`../scripts/${market.version}.json`))
  const token = new Token(new Bytes(getMinerDetailsHex(market.miners))) as PM

  const marketBalanceHex = getBalanceHex(market.balance) + String(market.balanceMerkleRoot)
  const marketDetailsHex = getMarketDetailsHex(market.details)
  const marketStatusHex = getMarketStatusHex(market.status)

  token.setDataPart(`${market.version} ${marketDetailsHex} ${marketStatusHex + marketBalanceHex}`)

  return token
}

export type entry = {
  balance: balance
  publicKey: bsv.PublicKey
}

export type marketInfo = {
  version: string
  status: marketStatus
  details: marketDetails
  balance: balance
  balanceMerkleRoot: hash
  miners: minerDetail[]
}

export function getEntryHex(entry: entry): string {
  return (
    entry.publicKey.toString() +
    int2Hex(entry.balance.liquidity, 1) +
    int2Hex(entry.balance.sharesFor, 1) +
    int2Hex(entry.balance.sharesAgainst, 1)
  )
}

export const balanceHexLength = 6
export function getBalanceHex(balance: balance): string {
  return int2Hex(balance.liquidity, 1) + int2Hex(balance.sharesFor, 1) + int2Hex(balance.sharesAgainst, 1)
}

export function getBalanceFromHex(hex: string): balance {
  return {
    liquidity: parseInt(hex.slice(0, 2), 16),
    sharesFor: parseInt(hex.slice(2, 4), 16),
    sharesAgainst: parseInt(hex.slice(4, 6), 16)
  }
}

export function getMarketBalance(entries: entry[]): balance {
  return entries.reduce(
    (balance, entry) => {
      return {
        liquidity: balance.liquidity + entry.balance.liquidity,
        sharesFor: balance.sharesFor + entry.balance.sharesFor,
        sharesAgainst: balance.sharesAgainst + entry.balance.sharesAgainst
      }
    },
    { liquidity: 0, sharesFor: 0, sharesAgainst: 0 }
  )
}

export function getBalanceMerkleRoot(entries: entry[]): hash {
  return getMerkleRoot(entries.map(entry => sha256(getEntryHex(entry))))
}

export function getMerklePath(entries: entry[], position: number): string {
  return getShaMerklePath(
    position,
    entries.map(entry => sha256(getEntryHex(entry)))
  )
}

export const marketBalanceHexLength = balanceHexLength + 64
export function getMarketBalanceHex(entries: entry[]): string {
  const marketBalance = getBalanceHex(getMarketBalance(entries))
  const balanceTableRoot = getBalanceMerkleRoot(entries)
  return marketBalance + String(balanceTableRoot)
}

export const marketStatusHexLength = 4
export function getMarketStatusHex(status: marketStatus): string {
  const isDecidedHex = status.decided ? "01" : "00"
  const resultHex = int2Hex(status.decision, 1)
  return isDecidedHex + resultHex
}

export function getMarketStatusfromHex(hex: string): marketStatus {
  return {
    decided: Boolean(parseInt(hex.slice(0, 2), 16)),
    decision: parseInt(hex.slice(2, 4), 16)
  }
}

export function getMarketDetailsHex(marketDetails: marketDetails): string {
  return toHex(JSON.stringify(marketDetails))
}

export function getMarketDetailsFromHex(hex: string): marketDetails {
  return JSON.parse(fromHex(hex)) as marketDetails
}

export function isValidMarketStatus(status: marketStatus): status is marketStatus {
  return (status.decided === false || status.decided === true) && (status.decision === 1 || status.decision === 0)
}

export function isValidMarketDetails(details: marketDetails): details is marketDetails {
  return Boolean(details.resolve)
}

export function isValidMarketBalance(balance: balance): balance is balance {
  return balance.liquidity >= 0 && balance.sharesFor >= 0 && balance.sharesAgainst >= 0
}

// export function isValid(marketInfo: marketInfo): number {
//   return marketInfo.details.maxLiquidity || MaxLiquidity
// }

export function hasBalanceWithinLimits(marketInfo: marketInfo): boolean {
  const maxLiquidity = marketInfo.details.maxLiquidity || MaxLiquidity
  const maxShares = marketInfo.details.maxShares || MaxShares
  return (
    marketInfo.balance.liquidity <= maxLiquidity &&
    marketInfo.balance.sharesFor <= maxShares &&
    marketInfo.balance.sharesAgainst <= maxShares
  )
}

export function isValidMarketInfo(market: marketInfo): boolean {
  return (
    isValidMarketStatus(market.status) &&
    isValidMarketDetails(market.details) &&
    isValidMarketBalance(market.balance) &&
    hasBalanceWithinLimits(market) &&
    isValidMinerDetails(market.miners) &&
    isHash(market.balanceMerkleRoot)
  )
}

export function validateEntries(balance: balance, entries: entry[]): boolean {
  const calculatedBalance = getMarketBalance(entries)
  return (
    balance.liquidity === calculatedBalance.liquidity &&
    balance.sharesFor === calculatedBalance.sharesFor &&
    balance.sharesAgainst === calculatedBalance.sharesAgainst
  )
}

export function isSameEntry(entry1: entry, entry2: entry): boolean {
  return entry1.publicKey.toString() === entry2.publicKey.toString()
}

export function getMarketSatBalance(status: marketStatus, entries: entry[]): number {
  const isDecided = status.decided
  const balance = getMarketBalance(entries)
  if (isDecided) {
    const shares = status.decision ? balance.sharesFor : balance.sharesAgainst
    return shares * SatScaling
  } else {
    return getLmsrSats(balance)
  }
}
