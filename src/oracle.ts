import { privKeyToPubKey, sign, rabinSig, rabinPrivKey, rabinPubKey } from "rabinsig"

import { int2Hex, hex2BigInt } from "./hex"
import { num2bin } from "scryptlib"

export type minerDetail = { pubKey: rabinPubKey; votes: number }

export const rabinKeyLength = 125

export function getTotalVotes(minerDetails: minerDetail[]): number {
  return minerDetails.reduce((votes: number, miner: minerDetail) => votes + miner.votes, 0)
}

export function isValidMinerDetails(minerDetails: minerDetail[]): minerDetails is minerDetail[] {
  return getTotalVotes(minerDetails) === 100
}

export function getMinerDetailHex(minerDetail: minerDetail): string {
  return int2Hex(minerDetail.pubKey, rabinKeyLength) + num2bin(minerDetail.votes, 1)
}

export function getMinerDetailsHex(minerDetails: minerDetail[]): string {
  return minerDetails.map(getMinerDetailHex).join("")
}

export function getMinerDetailFromHex(hex: string): minerDetail {
  const pubKeyHex = hex.slice(0, hex.length - 2)
  const votesHex = hex.slice(hex.length - 2, hex.length)
  return {
    pubKey: hex2BigInt(pubKeyHex),
    votes: parseInt(votesHex, 16)
  }
}

export function getMinerDetailsFromHex(hex: string): minerDetail[] {
  const minerDetails = hex.match(new RegExp(".{1," + (rabinKeyLength * 2 + 2).toString() + "}", "g"))
  return minerDetails ? minerDetails.map(getMinerDetailFromHex) : []
}

export function getMinerSigHex(signature: rabinSig, keyPos: number): string {
  return [
    num2bin(keyPos, 1),
    int2Hex(signature.signature, rabinKeyLength),
    num2bin(signature.paddingByteCount, 1)
  ].join("")
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
