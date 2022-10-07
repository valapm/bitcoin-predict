import { bsv, buildContractClass, SigHashPreimage, PubKey, Bytes, Sig, Ripemd160 } from "scryptlib"
import { getMerkleRoot, getMerklePath as getShaMerklePath } from "./merkleTree"
import { int2Hex, toHex, fromHex, hex2IntArray, splitHexByNumber, reverseHex, hex2Int } from "./hex"
import { isHash, hash, sha256 } from "./sha"
import { oracleDetail, getOracleDetailsHex, isValidOracleDetails, getOracleStatesHex } from "./oracle"
import { getLmsrSatsFixed, SatScaling, balance, getLmsrSats } from "./lmsr"
import { AbstractContract } from "scryptlib/dist/contract"
import { FunctionCall } from "scryptlib/dist/abi"
import { currentMarketContract, marketContracts, marketVersion } from "./contracts"
import semverLt from "semver/functions/lt"
import semverGte from "semver/functions/gte"

const valaIndexContract = "2af7dfaa7e799e28c7c31fc303dc915c"

interface PM extends AbstractContract {
  updateMarket(
    preimage: SigHashPreimage,
    action: number,
    payoutAddress: Ripemd160,
    changeSats: number,
    publicKey: Bytes,
    newLiquidity: number,
    newEntryShares: Bytes,
    lastEntry: Bytes,
    lastMerklePath: Bytes,
    prevLiquidity: number,
    prevShares: Bytes,
    prevAccLiquidityFeePoolState: number,
    prevLiquidityPoints: number,
    redeemLiquidity: boolean,
    signature: Sig,
    merklePath: Bytes,
    oraclePos: number,
    oracleSig: BigInt,
    paddingCount: number,
    oracleDecision: number,
    dustLimit: number
  ): FunctionCall
}

interface Index extends AbstractContract {
  update(preimage: SigHashPreimage): FunctionCall
}

export type option = {
  name: string
  details?: string
}

export type marketDetails = {
  resolve: string
  details: string // Detailed Information about the market
  options: option[]
}

export type marketStatus = {
  decided: boolean
  decision: number
  votes: number[]
  liquidityFeePool: number
  accLiquidityFeePool: number
  liquidityPoints: number
}

export type entry = {
  balance: balance
  publicKey: bsv.PublicKey
  globalLiqidityFeePoolSave: number
  liquidityPoints: number
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
  requiredVotes: number
  liquidityFee: number
  settingsHash?: string
}

export const balanceTableByteLength = 32
export const voteCountByteLen = 2

export const marketStatusHexLength = 4

export const entryLiqudityPos = 33
export const entrySharePos = 34

export const sharesByteLength = 4
export const liquidityByteLength = 4

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

export function getMarketVersion(identifier: string): marketVersion {
  const v = marketContracts[identifier]
  if (v) return v
  throw new Error(`Market version ${identifier} not supported`)
}

// export function getToken(oracles: oracleDetail): Token {
//   const Token = buildContractClass(require("../predictionMarket.json"))
//   return new Token(getOracleDetailsHex(oracles))
// }

export function getNewMarket(
  details: marketDetails,
  oracles: oracleDetail[],
  creator: creatorInfo,
  creatorFee: number,
  liquidityFee: number,
  requiredVotes: number
): marketInfo {
  const votes = "0"
    .repeat(details.options.length)
    .split("")
    .map(n => parseInt(n))

  const status = { decided: false, decision: 0, votes, liquidityFeePool: 0, accLiquidityFeePool: 0, liquidityPoints: 0 }

  return {
    version: currentMarketContract.identifier,
    details,
    status,
    oracles,
    balance: {
      liquidity: 0,
      shares: new Array(details.options.length).fill(0) as number[]
    },
    balanceMerkleRoot: getMerkleRoot([sha256("00")]),
    creator,
    creatorFee,
    liquidityFee,
    requiredVotes,
    settingsHash: sha256("00")
  }
}

export function getOpReturnData(market: marketInfo): string {
  const version = getMarketVersion(market.version)

  const marketDetailsHex = getMarketDetailsHex(market.details)
  const oracleStatesHex = getOracleStatesHex(market.oracles)
  const marketStatusHex = getMarketStatusHex(market.status)
  const marketBalanceHex = getBalanceHex(market.balance, version)
  const marketBalanceMerkleRoot = String(market.balanceMerkleRoot)
  const marketVotesHex = getVotesHex(market.status.votes)
  const liquidityFeePoolHex = int2Hex(market.status.liquidityFeePool, 5)
  const accLiquidityFeePoolHex = int2Hex(market.status.accLiquidityFeePool, 5)
  const liquidityPointsHex = int2Hex(market.status.liquidityPoints, 8)

  // console.log({
  //   marketStatusHex,
  //   oracleStatesHex,
  //   marketVotesHex,
  //   liquidityFeePoolHex,
  //   accLiquidityFeePoolHex,
  //   liquidityPointsHex,
  //   marketBalanceHex,
  //   marketBalanceMerkleRoot
  // })

  const marketDataHex =
    marketStatusHex +
    oracleStatesHex +
    marketVotesHex +
    liquidityFeePoolHex +
    accLiquidityFeePoolHex +
    liquidityPointsHex +
    marketBalanceHex +
    marketBalanceMerkleRoot

  if (semverLt(version.version, "0.4.0")) {
    return `${market.version} ${marketDetailsHex} ${marketDataHex}`
  }

  return `${market.version} ${marketDetailsHex} ${market.settingsHash} ${marketDataHex}`
}

export function getScryptTokenParams(market: marketInfo) {
  return [
    new Bytes(getOracleDetailsHex(market.oracles)).toLiteral(), // oracleKeys
    market.details.options.length, // globalOptionCount
    market.requiredVotes, // requiredVotes,
    new PubKey(market.creator.pubKey.toHex()).toLiteral(),
    new Ripemd160(market.creator.payoutAddress.hashBuffer.toString("hex")).toLiteral(),
    market.creatorFee * 100,
    market.liquidityFee * 100
  ]
}

export function getToken(market: marketInfo): PM {
  const Token = buildContractClass(require(`../scripts/${market.version}.json`)) // eslint-disable-line

  const token = new Token( // eslint-disable-line
    new Bytes(getOracleDetailsHex(market.oracles)), // oracleKeys
    market.details.options.length, // globalOptionCount
    market.requiredVotes, // requiredVotes,
    new PubKey(market.creator.pubKey.toHex()),
    new Ripemd160(market.creator.payoutAddress.hashBuffer.toString("hex")),
    market.creatorFee * 100,
    market.liquidityFee * 100
  ) as PM

  token.setDataPartInASM(getOpReturnData(market))

  // console.log(`${market.version} ${marketDetailsHex} ${marketDataHex}`)

  return token
}

export function getNewIndexScript(): bsv.Script {
  const contract = require(`../scripts/${valaIndexContract}.json`)
  return bsv.Script.fromASM(contract.asm)
}

export function getVotesHex(votes: number[]): string {
  return votes.map(vote => int2Hex(vote, 2)).join("")
}

export function getEntryHex(entry: entry, version: marketVersion): string {
  return (
    entry.publicKey.toString() +
    getBalanceHex(entry.balance, version) +
    int2Hex(entry.globalLiqidityFeePoolSave, 5) +
    int2Hex(entry.liquidityPoints, 8)
  )
}

export function getEntryFromHex(bytes: string, version: marketVersion): entry {
  const feePoolSavePos = bytes.length - 10 - 16
  const liquidityPointsPos = bytes.length - 16

  const publicKey = bsv.PublicKey.fromString(bytes.slice(0, 66))
  const balanceHex = bytes.slice(66, feePoolSavePos)
  const feePoolHex = bytes.slice(feePoolSavePos, liquidityPointsPos)
  const liquidityPointsHex = bytes.slice(liquidityPointsPos)

  return {
    publicKey,
    balance: getBalanceFromHex(balanceHex, version),
    globalLiqidityFeePoolSave: hex2Int(feePoolHex),
    liquidityPoints: hex2Int(liquidityPointsHex)
  }
}

export function getBalanceHex(balance: balance, version: marketVersion): string {
  let bytes = liquidityByteLength
  if (semverLt(version.version, "0.3.15")) {
    bytes = 1
  }
  return int2Hex(balance.liquidity, bytes) + getSharesHex(balance.shares, version)
}

export function getBalanceFromHex(bytes: string, version: marketVersion): balance {
  let byteLen = liquidityByteLength
  if (semverLt(version.version, "0.3.15")) {
    byteLen = 1
  }
  const sharesBytePos = byteLen * 2
  return {
    liquidity: hex2Int(bytes.slice(0, sharesBytePos)),
    shares: getSharesFromHex(bytes.slice(sharesBytePos), version)
  }
}

export function getSharesHex(shares: number[], version: marketVersion): string {
  let byteLen = sharesByteLength
  if (semverLt(version.version, "0.3.15")) {
    byteLen = 1
  }

  return shares.reduce((bytes: string, n) => bytes + int2Hex(n, byteLen), "")
}

export function getSharesFromHex(bytes: string, version: marketVersion): number[] {
  let byteLen = sharesByteLength
  if (semverLt(version.version, "0.3.15")) {
    byteLen = 1
  }
  return hex2IntArray(bytes, byteLen)
}

export function getBalanceHexLength(version: marketVersion, script: bsv.Script): number {
  const optionCountPos = version.args.findIndex(arg => arg === "globalOptionCount") + version.argPos
  return hex2Int(script.toASM()[optionCountPos]) * 2
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

export function getBalanceMerkleRoot(entries: entry[], version: marketVersion): hash {
  return getMerkleRoot([sha256("00"), ...entries.map(entry => sha256(getEntryHex(entry, version)))])
}

export function getMerklePath(entries: entry[], position: number, version: marketVersion): string {
  return getShaMerklePath(position + 1, [sha256("00"), ...entries.map(entry => sha256(getEntryHex(entry, version)))])
}

export function getMarketBalanceHex(entries: entry[], optionCount: number, version: marketVersion): string {
  const marketBalance = getBalanceHex(getMarketBalance(entries, optionCount), version)
  const balanceTableRoot = getBalanceMerkleRoot(entries, version)

  return marketBalance + String(balanceTableRoot)
}

export function getMarketStatusHex(status: marketStatus): string {
  const isDecidedHex = status.decided ? "01" : "00"
  const resultHex = int2Hex(status.decision, 1)

  return isDecidedHex + resultHex
}

export function getMarketStatusfromHex(
  decisionHex: string,
  votesHex: string,
  liquidityFeePoolHex: string,
  accLiquidityFeePoolHex: string,
  liquidityPointsHex: string
): marketStatus {
  // console.log(
  //   votesHex,
  //   "->",
  //   splitHexByNumber(votesHex, voteCountByteLen * 2),
  //   "->",
  //   splitHexByNumber(votesHex, voteCountByteLen * 2).map(n => parseInt(reverseHex(n), 16))
  // )

  return {
    decided: Boolean(hex2Int(decisionHex.slice(0, 2))),
    decision: hex2Int(decisionHex.slice(2, 4)),
    votes: splitHexByNumber(votesHex, voteCountByteLen * 2).map(n => hex2Int(n)),
    liquidityFeePool: hex2Int(liquidityFeePoolHex),
    accLiquidityFeePool: hex2Int(accLiquidityFeePoolHex),
    liquidityPoints: hex2Int(liquidityPointsHex)
  }
}

export function getMarketDetailsHex(marketDetails: marketDetails): string {
  return toHex(JSON.stringify(marketDetails))
}

export function getMarketDetailsFromHex(hex: string): marketDetails {
  return JSON.parse(fromHex(hex)) as marketDetails
}

export function isValidMarketStatus(status: marketStatus, optionCount: number): status is marketStatus {
  // console.log([
  //   status.decided === false || status.decided === true,
  //   status.decision >= 0 || status.decision < optionCount,
  //   status.liquidityFeePool >= 0,
  //   status.accLiquidityFeePool >= status.liquidityFeePool,
  //   status.liquidityPoints >= status.liquidityFeePool
  // ])

  return (
    (status.decided === false || status.decided === true) &&
    (status.decision >= 0 || status.decision < optionCount) &&
    status.liquidityFeePool >= 0 &&
    status.accLiquidityFeePool >= status.liquidityFeePool &&
    status.liquidityFeePool >= 0 &&
    status.liquidityPoints >= 0
  )
}

export function isValidMarketDetails(details: marketDetails): details is marketDetails {
  return Boolean(details.resolve)
}

export function isValidMarketBalance(balance: balance): balance is balance {
  return balance.liquidity >= 0 && balance.shares.every(share => share >= 0)
}

export function isValidMarketInfo(market: marketInfo): boolean {
  // console.log([
  //   isValidMarketStatus(market.status, market.details.options.length),
  //   isValidMarketDetails(market.details),
  //   isValidMarketBalance(market.balance),
  //   isValidOracleDetails(market.oracles),
  //   isHash(market.balanceMerkleRoot),
  //   market.status.votes.length === market.details.options.length
  // ])

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
  const version = getMarketVersion(market.version)

  const optionCount = market.details.options.length
  const calculatedBalance = getMarketBalance(entries, optionCount)

  const hasCorrectLiquidity = market.balance.liquidity === calculatedBalance.liquidity
  const hasCorrectShares = market.status.decided
    ? true
    : market.balance.shares.every((n, i) => n === calculatedBalance.shares[i])

  // console.log({ entries: JSON.stringify(entries.map(e => e.balance)) })
  const hasCorrectBalanceMerkleRoot = market.balanceMerkleRoot === getBalanceMerkleRoot(entries, version)

  // console.log({
  //   hasCorrectLiquidity,
  //   hasCorrectShares,
  //   hasCorrectBalanceMerkleRoot
  // })

  return hasCorrectLiquidity && hasCorrectShares && hasCorrectBalanceMerkleRoot
}

export function getMinMarketSatBalance(market: marketInfo, entries: entry[]): number {
  // Calculates minimal market sat balance from entries

  const isDecided = market.status.decided
  const optionCount = market.details.options.length
  const balance = getMarketBalance(entries, optionCount)

  if (isDecided) {
    const shares = balance.shares[market.status.decision]
    return shares * SatScaling + market.status.liquidityFeePool
  } else {
    const version = getMarketVersion(market.version)
    return getLmsrSatsFixed(balance, version) + market.status.liquidityFeePool
  }
}

export function isValidMarketInit(market: marketInfo): boolean {
  return (
    !market.status.decided &&
    market.status.votes.reduce((a, b) => a + b, 0) === 0 &&
    market.oracles.every(oracle => !oracle.committed && !oracle.voted) &&
    market.balance.liquidity === 0 &&
    market.balance.shares.reduce((a, b) => a + b, 0) === 0 &&
    market.balanceMerkleRoot === getMerkleRoot([sha256("00")])
  )
}

export function isValidMarketInitEntry(entry: entry): boolean {
  return entry.globalLiqidityFeePoolSave === 0 && entry.liquidityPoints === 0
}

export function market2JSON(market: marketInfo): string {
  return JSON.parse(
    JSON.stringify(
      market,
      (key, value) => (typeof value === "bigint" ? value.toString() : value) // return everything else unchanged
    )
  )
}

export function getSettingsFromScript(inputScript: bsv.Script): any {
  const settingsHex = inputScript.toASM().split(" ")[21]

  let settings
  try {
    settings = JSON.parse(fromHex(settingsHex))
  } catch (e) {
    throw new Error("Failed to parse new settings hex")
  }

  return settings
}

/**
 * Returns number of satoshis that can be extracted when redeeming liquidity
 */
export function getLiquiditySatBalance(
  marketBalance: balance,
  marketStatus: marketStatus,
  contractSats: number,
  liquidity: number,
  marketVersion: marketVersion
) {
  if (marketStatus.decided && semverGte(marketVersion.version, "0.6.0")) {
    if (marketBalance.liquidity === 0) return 0

    const winningShares = marketBalance.shares[marketStatus.decision]
    const marketSatBalance = winningShares * SatScaling + marketStatus.liquidityFeePool
    const liquiditySatBalance = contractSats - marketSatBalance
    const liquidityShare = liquidity / marketBalance.liquidity // contract uses 32bit unint
    return liquidityShare * liquiditySatBalance
  } else {
    return (
      getLmsrSats(marketBalance) -
      getLmsrSats({
        shares: marketBalance.shares,
        liquidity: marketBalance.liquidity - liquidity
      })
    )
  }
}
