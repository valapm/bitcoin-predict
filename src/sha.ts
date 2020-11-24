import * as crypto from "crypto"

export type hash = string

export function sha256(x: string): string {
  return crypto.createHash("sha256").update(Buffer.from(x, "hex")).digest("hex")
}

export function isHash(s: hash): s is hash {
  return s.length === 64 && /^[A-F0-9]+$/i.test(s)
}
