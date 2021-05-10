import { compile, bsv, buildContractClass, SigHashPreimage, PubKey, Bytes, Sig, Ripemd160 } from "scryptlib"
import { getMerkleRoot, getMerklePath as getShaMerklePath } from "./merkleTree"
import { int2Hex, toHex, fromHex, hex2IntArray, splitHexByNumber } from "./hex"
import { isHash, hash, sha256 } from "./sha"
import { oracleDetail, getOracleDetailsHex, isValidOracleDetails, getOracleStatesHex } from "./oracle"
import { getLmsrSats, SatScaling, balance } from "./lmsr"
import { ContractDescription, AbstractContract } from "scryptlib/dist/contract"
import { FunctionCall } from "scryptlib/dist/abi"

export type version = {
  identifier: string
  oracleKeyPos: number
  globalOptionCountPos: number
  requiredVotesPos: number
  creatorPubKeyPos: number
  creatorPayoutAddressPos: number
  creatorFeePos: number
  maxOptionCount: number
  maxOracleCount: number
}

// Keep track of old versions for compatibility.
export const versions: version[] = [
  {
    identifier: "f1b59d4a10014958b5123b1d795e2514",
    oracleKeyPos: 26,
    globalOptionCountPos: 27,
    requiredVotesPos: 28,
    creatorPubKeyPos: 29,
    creatorPayoutAddressPos: 30,
    creatorFeePos: 31,
    maxOptionCount: 6,
    maxOracleCount: 3
  }
]

interface PM extends AbstractContract {
  updateMarket(
    preimage: SigHashPreimage,
    action: number,
    payoutAddress: Ripemd160,
    changeSats: number,
    entry: Bytes,
    lastEntry: Bytes,
    lastMerklePath: Bytes,
    prevLiquidity: number,
    prevShares: Bytes,
    signature: Sig,
    merklePath: Bytes,
    oraclePos: number,
    oracleSig: BigInt,
    paddingCount: number,
    oracleDecision: number
  ): FunctionCall

  decide(txPreimage: Sig, result: number, oracleSigs: Bytes): FunctionCall
}

export type marketDetails = {
  resolve: string
  details: string // Detailed Information about the market
  options: {
    length: number // globalOptionCount
  }
}

export type marketStatus = {
  decided: boolean
  decision: number
  votes: number[]
}

export type entry = {
  balance: balance
  publicKey: bsv.PublicKey
}

export type creatorInfo = {
  pubKey: bsv.PublicKey
  payoutAddress: bsv.Address
}

export type marketInfo = {
  version: string
  status: marketStatus
  details: marketDetails
  balance: balance
  balanceMerkleRoot: hash
  oracles: oracleDetail[]
  creator: creatorInfo
  creatorFee: number
}

export const balanceTableByteLength = 32
export const voteCountByteLen = 2

export const marketStatusHexLength = 4

export const entryLiqudityPos = 33
export const entrySharePos = 34

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

// export function getLockingScriptASM(oracleDetails: oracleDetail[]): string[] {
//   const asmTemplate = getLockingScriptASMTemplate()
//   const oracleKeyPos = asmTemplate.findIndex(op => op === "$oracleKeys")
//   asmTemplate[oracleKeyPos] = getOracleDetailsHex(oracleDetails)
//   return asmTemplate
// }

export function getMarketVersion(identifier: string): version {
  const version = versions.find(version => version.identifier === identifier)
  if (!version) throw new Error("Market version not supported")
  return version
}

// export function getToken(oracles: oracleDetail): Token {
//   const Token = buildContractClass(require("../predictionMarket.json"))
//   return new Token(getOracleDetailsHex(oracles))
// }

export function getNewMarket(
  details: marketDetails,
  entry: entry,
  oracles: oracleDetail[],
  creator: creatorInfo,
  creatorFee: number
): marketInfo {
  const votes = "0"
    .repeat(details.options.length)
    .split("")
    .map(n => parseInt(n))

  return {
    version: versions[0].identifier,
    details,
    status: { decided: false, decision: 0, votes },
    oracles,
    balance: getMarketBalance([entry], details.options.length),
    balanceMerkleRoot: getBalanceMerkleRoot([entry]),
    creator,
    creatorFee
  }
}

export function getToken(market: marketInfo): PM {
  const Token = buildContractClass(require(`../scripts/${market.version}.json`)) // eslint-disable-line

  const token = new Token( // eslint-disable-line
    new Bytes(getOracleDetailsHex(market.oracles)), // oracleKeys
    market.details.options.length, // globalOptionCount
    1, // requiredVotes,
    new PubKey(market.creator.pubKey.toHex()),
    new Ripemd160(market.creator.payoutAddress.toHex()),
    market.creatorFee
  ) as PM

  // console.log([
  //   new Bytes(getOracleDetailsHex(market.oracles)).toLiteral(), // oracleKeys
  //   market.details.options.length, // globalOptionCount
  //   1, // requiredVotes,
  //   new PubKey(market.creator.pubKey.toHex()).toLiteral(),
  //   new Ripemd160(market.creator.payoutAddress.toHex()).toLiteral(),
  //   market.creatorFee
  // ])

  const marketDetailsHex = getMarketDetailsHex(market.details)
  const oracleStatesHex = getOracleStatesHex(market.oracles)
  const marketStatusHex = getMarketStatusHex(market.status)
  const marketBalanceHex = getBalanceHex(market.balance)
  const marketBalanceMerkleRoot = String(market.balanceMerkleRoot)
  const marketVotesHex = getVotesHex(market.status.votes)

  const marketDataHex = marketStatusHex + oracleStatesHex + marketVotesHex + marketBalanceHex + marketBalanceMerkleRoot

  token.setDataPart(`${market.version} ${marketDetailsHex} ${marketDataHex}`)

  // console.log(`${market.version} ${marketDetailsHex} ${marketDataHex}`)

  return token
}

export function getVotesHex(votes: number[]): string {
  return votes.map(vote => int2Hex(vote, 2)).join("")
}

export function getEntryHex(entry: entry): string {
  return entry.publicKey.toString() + getBalanceHex(entry.balance)
}

export function getBalanceHex(balance: balance): string {
  return int2Hex(balance.liquidity, 1) + getSharesHex(balance.shares)
}

export function getSharesHex(shares: number[]): string {
  return shares.reduce((bytes: string, n) => bytes + int2Hex(n, 1), "")
}

export function getBalanceHexLength(version: version, script: bsv.Script): number {
  return parseInt(script.toASM()[version.globalOptionCountPos], 16) * 2
}

export function getMarketBalance(entries: entry[], optionCount: number): balance {
  return entries.reduce(
    (balance: balance, entry: entry) => {
      return {
        liquidity: balance.liquidity + entry.balance.liquidity,
        shares: balance.shares.map((n, i) => n + entry.balance.shares[i])
      }
    },
    { liquidity: 0, shares: Array.from({ length: optionCount }, () => 0) }
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

export function getMarketBalanceHex(entries: entry[], optionCount: number): string {
  const marketBalance = getBalanceHex(getMarketBalance(entries, optionCount))
  const balanceTableRoot = getBalanceMerkleRoot(entries)
  return marketBalance + String(balanceTableRoot)
}

export function getMarketStatusHex(status: marketStatus): string {
  const isDecidedHex = status.decided ? "01" : "00"
  const resultHex = int2Hex(status.decision, 1)
  const votes = status.votes.map(int2Hex).join("")
  return isDecidedHex + resultHex + votes
}

export function getMarketStatusfromHex(decisionHex: string, votesHex: string): marketStatus {
  return {
    decided: Boolean(parseInt(decisionHex.slice(0, 2), 16)),
    decision: parseInt(decisionHex.slice(2, 4), 16),
    votes: splitHexByNumber(votesHex, voteCountByteLen * 2).map(n => parseInt(n))
  }
}

export function getMarketDetailsHex(marketDetails: marketDetails): string {
  return toHex(JSON.stringify(marketDetails))
}

export function getMarketDetailsFromHex(hex: string): marketDetails {
  return JSON.parse(fromHex(hex)) as marketDetails
}

export function isValidMarketStatus(status: marketStatus, optionCount: number): status is marketStatus {
  return (
    (status.decided === false || status.decided === true) && (status.decision >= 0 || status.decision < optionCount)
  )
}

export function isValidMarketDetails(details: marketDetails): details is marketDetails {
  return Boolean(details.resolve)
}

export function isValidMarketBalance(balance: balance): balance is balance {
  return balance.liquidity >= 0 && balance.shares.every(share => share >= 0)
}

export function isValidMarketInfo(market: marketInfo): boolean {
  return (
    isValidMarketStatus(market.status, market.details.options.length) &&
    isValidMarketDetails(market.details) &&
    isValidMarketBalance(market.balance) &&
    isValidOracleDetails(market.oracles) &&
    isHash(market.balanceMerkleRoot) &&
    market.status.votes.length === market.details.options.length
  )
}

export function validateEntries(market: marketInfo, entries: entry[]): boolean {
  const optionCount = market.details.options.length
  const calculatedBalance = getMarketBalance(entries, optionCount)
  return (
    market.balance.liquidity === calculatedBalance.liquidity &&
    market.balance.shares.every((n, i) => n === calculatedBalance.shares[i])
  )
}

export function getMinMarketSatBalance(market: marketInfo, entries: entry[]): number {
  // Calculates minimal market sat balance from entries

  const isDecided = market.status.decided
  const optionCount = market.details.options.length
  const balance = getMarketBalance(entries, optionCount)

  if (isDecided) {
    const shares = balance.shares[market.status.decision]
    return shares * SatScaling
  } else {
    return getLmsrSats(balance)
  }
}
