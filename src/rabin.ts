import { privKeyToPubKey, sign, rabinSig, rabinPrivKey, rabinPubKey } from "rabinsig"

import { num2bin as bigNum2bin } from "./hex"
import { num2bin } from "scryptlib"

export type minerDetail = { pubKey: rabinPubKey; votes: number }

export const rabinKeyLength = 125

export function getMinerSigString(signature: rabinSig, keyPos: number): string {
  return [
    num2bin(keyPos, 1),
    bigNum2bin(signature.signature, rabinKeyLength),
    num2bin(signature.paddingByteCount, 1)
  ].join("")
}

export function getMinerVoteString(miner: minerDetail): string {
  return bigNum2bin(miner.pubKey, rabinKeyLength) + num2bin(miner.votes, 1)
}

export function getMinerPubString(minerDetails: minerDetail[]): string {
  return minerDetails.map(getMinerVoteString).join("")
}

// Get miner sigs

// export function getMinerSigs(minerPrivKeys: rabinPrivKey[], vote: number): string {
//   const minerSigs = minerPrivKeys.map((privKey, index) => {
//     const pubKey = privKeyToPubKey(privKey.p, privKey.q)
//     const signature = sign(num2bin(vote, 1), privKey.p, privKey.q, pubKey)
//     return getMinerSigString(signature, index)
//   })

//   return minerSigs.join("")
// }

// or

export function getSignature(message: number, privKey: rabinPrivKey): rabinSig {
  const pubKey = privKeyToPubKey(privKey.p, privKey.q)
  return sign(num2bin(message, 1), privKey.p, privKey.q, pubKey)
}

// export function getMinerSigsAlt(minerPrivKeys: rabinPrivKey[], vote: number): rabinSig[] {
//   return minerPrivKeys.map(privKey => {
//     return getSignature(vote, privKey)
//   })
// }

// export function getMinerSigsString(minerSigs: rabinSig[]): string {
//   return minerSigs.map(getMinerSigString).join("")
// }
