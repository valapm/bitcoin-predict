import { RabinSignature, rabinSig, rabinPrivKey, rabinPubKey } from "rabinsig"
import { buildContractClass, SigHashPreimage, Bytes } from "scryptlib"
import { AbstractContract } from "scryptlib/dist/contract"
import { FunctionCall } from "scryptlib/dist/abi"

import { int2Hex, hex2BigInt, hex2Bool, bool2Hex, splitHexByNumber } from "./hex"
import { num2bin } from "scryptlib"
import { sha256 } from "./sha"

export type oracleDetail = { pubKey: rabinPubKey; votes: number; committed?: boolean; voted?: boolean }
// export type oracleState = {}

export const oracleContractHash = "02fbca51c5c8820b884bcc3d4481a252"

export const rabinKeyByteLength = 126
export const oracleInfoByteLength = rabinKeyByteLength + 1
export const oracleStateByteLength = 2

// Hash of oracleCommitment.txt
export const commitmentHash = "0E47D25DE560350A3717647DD69C4B5E190A46484589A20435CE79CE002E07DB"

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

export function getOraclePubKeyFromHex(hex: string): bigint {
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
  const rabin = new RabinSignature()

  const pubKey = rabin.privKeyToPubKey(privKey.p, privKey.q)
  return rabin.sign(message, privKey.p, privKey.q, pubKey)
}

interface oracleContract extends AbstractContract {
  update(
    preimage: SigHashPreimage,
    action: number,
    details: Bytes,
    oracleSig: bigint,
    paddingCount: number,
    burnSats: number
  ): FunctionCall
}

export function getOracleToken(pubKey: rabinPubKey): oracleContract {
  const Token = buildContractClass(require(`../scripts/${oracleContractHash}.json`)) // eslint-disable-line

  const token = new Token(pubKey) as oracleContract // eslint-disable-line

  token.setDataPart(sha256("00"))

  return token
}
