import { privKeyToPubKey, sign, rabinSig, rabinPrivKey, rabinPubKey } from "rabinsig"

import { int2Hex, hex2BigInt, hex2Bool, bool2Hex, splitHexByNumber } from "./hex"
import { num2bin } from "scryptlib"

export type oracleDetail = { pubKey: rabinPubKey; votes: number; committed?: boolean; voted?: boolean }
// export type oracleState = {}

export const rabinKeyByteLength = 126
export const oracleInfoByteLength = rabinKeyByteLength + 1
export const oracleStateByteLength = 2

export function getTotalVotes(oracleDetails: oracleDetail[]): number {
  return oracleDetails.reduce((votes: number, oracle: oracleDetail) => votes + oracle.votes, 0)
}

export function isValidOracleDetails(oracleDetails: oracleDetail[]): oracleDetails is oracleDetail[] {
  return getTotalVotes(oracleDetails) === 100
}

export function getOracleDetailHex(oracleDetail: oracleDetail): string {
  return int2Hex(oracleDetail.pubKey, rabinKeyByteLength) + num2bin(oracleDetail.votes, 1)
}

export function getOracleDetailsHex(oracleDetails: oracleDetail[]): string {
  return oracleDetails.map(getOracleDetailHex).join("")
}

export function getOracleStateHex(oracleDetail: oracleDetail): string {
  return bool2Hex(oracleDetail.committed || false) + bool2Hex(oracleDetail.voted || false)
}

export function getOracleStatesHex(oracleDetails: oracleDetail[]): string {
  return oracleDetails.map(getOracleStateHex).join("")
}

function getOraclePubKeyFromHex(hex: string): bigint {
  const pubKeyHex = hex.slice(0, hex.length - 2)
  return hex2BigInt(pubKeyHex)
}

function getOracleVotesFromHex(hex: string): number {
  const votesHex = hex.slice(hex.length - 2, hex.length)
  return parseInt(votesHex, 16)
}

export function getOracleDetailsFromHex(oracleKeysHex: string, oracleStatesHex: string): oracleDetail[] {
  const oracleHexLength = rabinKeyByteLength * 2 + 2
  const oracles = splitHexByNumber(oracleKeysHex, oracleHexLength)

  const oracleStateLength = oracleStateByteLength * 2
  const oracleStates = splitHexByNumber(oracleStatesHex, oracleStateLength)

  const oracleDetails = oracles.map((oracleHex, i) => {
    const stateHex = oracleStates[i]

    return {
      pubKey: getOraclePubKeyFromHex(oracleHex),
      votes: getOracleVotesFromHex(oracleHex),
      committed: hex2Bool(stateHex.slice(0, 2)),
      voted: hex2Bool(stateHex.slice(2, 4))
    }
  })

  return oracleDetails
}

export function getOracleSigHex(signature: rabinSig, keyPos: number): string {
  return [
    num2bin(keyPos, 1),
    int2Hex(signature.signature, rabinKeyByteLength),
    num2bin(signature.paddingByteCount, 1)
  ].join("")
}

export function getOracleSigsString(oracleSigs: rabinSig[]): string {
  return oracleSigs.map(getOracleSigHex).join("")
}

/**
 * Generates a valid decision signature. Intended for oracle and testing usage.
 *
 * @param message Should be 0 or 1
 * @param privKey
 */
export function getSignature(message: string, privKey: rabinPrivKey): rabinSig {
  const pubKey = privKeyToPubKey(privKey.p, privKey.q)
  return sign(message, privKey.p, privKey.q, pubKey)
}
