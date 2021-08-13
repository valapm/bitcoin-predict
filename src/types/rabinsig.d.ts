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

  export class RabinSignature {
    generatePrivKey(): rabinPrivKey
    privKeyToPubKey(p: bigint, q: bigint): rabinPubKey
    sign(value: string, p: bigint, q: bigint, pubKey: rabinPubKey): rabinSig
    verify(dataHex: string, paddingByteCount: number, signature: bigint, nRabin: bigint): boolean
  }
}
