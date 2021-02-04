import { bsv } from "scryptlib"

export type hash = string

export function sha256(x: string): string {
  return bsv.crypto.Hash.sha256(Buffer.from(x, "hex")).toString("hex")
}

export function isHash(s: hash): s is hash {
  return s.length === 64 && /^[A-F0-9]+$/i.test(s)
}
