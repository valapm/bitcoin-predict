declare module "rabinsig" {
  export type rabinPubKey = bigint

  export type rabinPrivKey = {
    q: bigint
    p: bigint
  }

  export type rabinSig = {
    signature: bigint
    paddingByteCount: number
  }

  export function generatePrivKey(): rabinPrivKey
  export function privKeyToPubKey(p: bigint, q: bigint): rabinPubKey
  export function sign(value: string, p: bigint, q: bigint, pubKey: rabinPubKey): rabinSig
}
