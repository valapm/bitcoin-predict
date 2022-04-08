import { bsv, buildContractClass, SigHashPreimage, PubKey, Bytes, Sig, Ripemd160 } from "scryptlib"
import { getMerkleRoot, getMerklePath as getShaMerklePath } from "./merkleTree"
import { int2Hex, toHex, fromHex, hex2IntArray, splitHexByNumber, reverseHex, hex2Int } from "./hex"
import { isHash, hash, sha256 } from "./sha"
import { oracleDetail, getOracleDetailsHex, isValidOracleDetails, getOracleStatesHex } from "./oracle"
import { getLmsrSatsFixed, SatScaling, balance } from "./lmsr"
import { AbstractContract } from "scryptlib/dist/contract"
import { FunctionCall } from "scryptlib/dist/abi"
import { marketContracts, marketVersion } from "./contracts"

const valaIndexContract = "935ec6b78a842b25fb12b353f8a204c7"

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
}

export const balanceTableByteLength = 32
export const voteCountByteLen = 2

export const marketStatusHexLength = 4

export const entryLiqudityPos = 33
export const entrySharePos = 34

export const developerPayoutAddress = "00ae2c80a6e4bd7a01a0c8e6679f888234efac02b6"

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
  const version = marketContracts.find(version => version.identifier === identifier)
  if (!version) throw new Error(`Market version ${identifier} not supported`)
  return version
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
    version: marketContracts[0].identifier,
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
    requiredVotes
  }
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

  // console.log([
  //   new Bytes(getOracleDetailsHex(market.oracles)).toLiteral(), // oracleKeys
  //   market.details.options.length, // globalOptionCount
  //   market.requiredVotes, // requiredVotes,
  //   new PubKey(market.creator.pubKey.toHex()).toLiteral(),
  //   new Ripemd160(market.creator.payoutAddress.hashBuffer.toString("hex")).toLiteral(),
  //   market.creatorFee * 100,
  //   market.liquidityFee * 100
  // ])

  const marketDetailsHex = getMarketDetailsHex(market.details)
  const oracleStatesHex = getOracleStatesHex(market.oracles)
  const marketStatusHex = getMarketStatusHex(market.status)
  const marketBalanceHex = getBalanceHex(market.balance)
  const marketBalanceMerkleRoot = String(market.balanceMerkleRoot)
  const marketVotesHex = getVotesHex(market.status.votes)
  const liquidityFeePoolHex = int2Hex(market.status.liquidityFeePool, 5)
  const accLiquidityFeePoolHex = int2Hex(market.status.accLiquidityFeePool, 5)
  const liquidityPointsHex = int2Hex(market.status.liquidityPoints, 8)

  // console.log([
  //   marketStatusHex,
  //   oracleStatesHex,
  //   marketVotesHex,
  //   liquidityFeePoolHex,
  //   accLiquidityFeePoolHex,
  //   liquidityPointsHex,
  //   marketBalanceHex,
  //   marketBalanceMerkleRoot
  // ])

  const marketDataHex =
    marketStatusHex +
    oracleStatesHex +
    marketVotesHex +
    liquidityFeePoolHex +
    accLiquidityFeePoolHex +
    liquidityPointsHex +
    marketBalanceHex +
    marketBalanceMerkleRoot

  token.setDataPart(`${market.version} ${marketDetailsHex} ${marketDataHex}`)

  // console.log(`${market.version} ${marketDetailsHex} ${marketDataHex}`)

  return token
}

export function getIndexToken(): Index {
  const ValaIndexToken = buildContractClass(require(`../scripts/${valaIndexContract}.json`)) // eslint-disable-line
  return new ValaIndexToken() as Index // eslint-disable-line
}

export function getVotesHex(votes: number[]): string {
  return votes.map(vote => int2Hex(vote, 2)).join("")
}

export function getEntryHex(entry: entry): string {
  // console.log(
  //   entry.publicKey.toString() +
  //     getBalanceHex(entry.balance) +
  //     int2Hex(entry.globalLiqidityFeePoolSave, 5) +
  //     int2Hex(entry.liquidityPoints, 8)
  // )

  return (
    entry.publicKey.toString() +
    getBalanceHex(entry.balance) +
    int2Hex(entry.globalLiqidityFeePoolSave, 5) +
    int2Hex(entry.liquidityPoints, 8)
  )
}

export function getEntryFromHex(bytes: string): entry {
  const feePoolSavePos = bytes.length - 10 - 16
  const liquidityPointsPos = bytes.length - 16

  const publicKey = bsv.PublicKey.fromString(bytes.slice(0, 66))
  const balanceHex = bytes.slice(66, feePoolSavePos)
  const feePoolHex = bytes.slice(feePoolSavePos, liquidityPointsPos)
  const liquidityPointsHex = bytes.slice(liquidityPointsPos)

  return {
    publicKey,
    balance: getBalanceFromHex(balanceHex),
    globalLiqidityFeePoolSave: hex2Int(feePoolHex),
    liquidityPoints: hex2Int(liquidityPointsHex)
  }
}

export function getBalanceHex(balance: balance): string {
  return int2Hex(balance.liquidity, 1) + getSharesHex(balance.shares)
}

export function getBalanceFromHex(bytes: string): balance {
  return {
    liquidity: parseInt(bytes.slice(0, 2), 16),
    shares: getSharesFromHex(bytes.slice(2))
  }
}

export function getSharesHex(shares: number[]): string {
  return shares.reduce((bytes: string, n) => bytes + int2Hex(n, 1), "")
}

export function getSharesFromHex(bytes: string): number[] {
  return hex2IntArray(bytes)
}

export function getBalanceHexLength(version: marketVersion, script: bsv.Script): number {
  const optionCountPos = version.args.findIndex(arg => arg === "globalOptionCount") + version.argPos
  return parseInt(script.toASM()[optionCountPos], 16) * 2
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
  return getMerkleRoot([sha256("00"), ...entries.map(entry => sha256(getEntryHex(entry)))])
}

export function getMerklePath(entries: entry[], position: number): string {
  return getShaMerklePath(position + 1, [sha256("00"), ...entries.map(entry => sha256(getEntryHex(entry)))])
}

export function getMarketBalanceHex(entries: entry[], optionCount: number): string {
  const marketBalance = getBalanceHex(getMarketBalance(entries, optionCount))
  const balanceTableRoot = getBalanceMerkleRoot(entries)
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
    decided: Boolean(parseInt(decisionHex.slice(0, 2), 16)),
    decision: parseInt(decisionHex.slice(2, 4), 16),
    votes: splitHexByNumber(votesHex, voteCountByteLen * 2).map(n => parseInt(reverseHex(n), 16)),
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
  const optionCount = market.details.options.length
  const calculatedBalance = getMarketBalance(entries, optionCount)

  const hasCorrectLiquidity = market.balance.liquidity === calculatedBalance.liquidity
  const hasCorrectShares = market.status.decided
    ? true
    : market.balance.shares.every((n, i) => n === calculatedBalance.shares[i])
  const hasCorrectBalanceMerkleRoot = market.balanceMerkleRoot === getBalanceMerkleRoot(entries)

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
    return getLmsrSatsFixed(balance) + market.status.liquidityFeePool
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
