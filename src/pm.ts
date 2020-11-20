import { compile, bsv } from "scryptlib"
import { getMerkleRoot } from "./merkleTree"
import { num2bin } from "./hex"
import { minerDetail, getMinerPubString } from "./oracle"

export type marketDetails = {
  resolve: string
}

export type marketStatus = {
  decided: boolean
  decision: number
}

type contract = {
  asm: string
}

export function getCompiledPM(): void {
  const contractPath = require.resolve("scrypt_boilerplate/contracts/predictionMarket.scrypt")
  compile({ path: contractPath }, { desc: true })
}

export function getLockingScriptASMTemplate(): string[] {
  const compiled = require("../predictionMarket.json") as contract
  return compiled.asm.split(" ")
}

export function getLockingScriptASM(minerDetails: minerDetail[]): string[] {
  const asmTemplate = getLockingScriptASMTemplate()
  asmTemplate[7] = getMinerPubString(minerDetails)
  return asmTemplate
}

export type balance = {
  liquidity: number
  sharesFor: number
  sharesAgainst: number
}

export type entry = {
  balance: balance
  publicKey: bsv.PublicKey
}

export function getEntryHex(entry: entry): string {
  return (
    entry.publicKey.toString() +
    num2bin(entry.balance.liquidity, 1) +
    num2bin(entry.balance.sharesFor, 1) +
    num2bin(entry.balance.sharesAgainst, 1)
  )
}

export function getBalanceHex(balance: balance): string {
  return num2bin(balance.liquidity, 1) + num2bin(balance.sharesFor, 1) + num2bin(balance.sharesAgainst, 1)
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

export function getMarketBalanceHex(entries: entry[]): string {
  const marketBalance = getBalanceHex(getMarketBalance(entries))
  const balanceTableRoot = getMerkleRoot(entries.map(getEntryHex))
  return marketBalance + balanceTableRoot
}

export function getMarketDecisionHex(status: marketStatus): string {
  const isDecidedHex = status.decided ? "01" : "00"
  const resultHex = num2bin(status.decision, 1)
  return isDecidedHex + resultHex
}
