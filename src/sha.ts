import * as crypto from "crypto"

export function sha256(x: string): string {
  return crypto.createHash("sha256").update(Buffer.from(x, "hex")).digest("hex")
}
