import { privKeyToPubKey, sign, rabinSig, rabinPrivKey, rabinPubKey } from "rabinsig"

import { num2bin as bigNum2bin } from "./hex"
import { num2bin } from "scryptlib"

export type minerDetail = { pubKey: rabinPubKey; votes: number }

export const rabinKeyLength = 125

export function getTotalVotes(minerDetails: minerDetail[]): number {
  return minerDetails.reduce((votes: number, miner: minerDetail) => votes + miner.votes, 0)
}

export function isValidMinerDetails(minerDetails: minerDetail[]): boolean {
  return getTotalVotes(minerDetails) === 100
}

export function getMinerSigHex(signature: rabinSig, keyPos: number): string {
  return [
    num2bin(keyPos, 1),
    bigNum2bin(signature.signature, rabinKeyLength),
    num2bin(signature.paddingByteCount, 1)
  ].join("")
}

export function getMinerDetailHex(minerDetail: minerDetail): string {
  return bigNum2bin(minerDetail.pubKey, rabinKeyLength) + num2bin(minerDetail.votes, 1)
}

export function getMinerDetailsHex(minerDetails: minerDetail[]): string {
  return minerDetails.map(getMinerDetailHex).join("")
}

export function getMinerSigsString(minerSigs: rabinSig[]): string {
  return minerSigs.map(getMinerSigHex).join("")
}

/**
 * Generates a valid decision signature. Intended for miner and testing usage.
 *
 * @param message Should be 0 or 1
 * @param privKey
 */
export function getSignature(message: number, privKey: rabinPrivKey): rabinSig {
  const pubKey = privKeyToPubKey(privKey.p, privKey.q)
  return sign(num2bin(message, 1), privKey.p, privKey.q, pubKey)
}
