import md5 from "md5"
import { bsv } from "scryptlib"

export type version = {
  identifier: string
  version: string
  args: string[]
  argPos: number
  md5: string
  options: any
  length: number
}

export type marketVersion = version & {
  options: {
    devFee: number
    maxOptionCount: number
    maxOracleCount: number
  }
}

// Keep track of old versions for compatibility.
export const marketContracts: marketVersion[] = [
  {
    identifier: "8f65ba6f86f6ba3c14e47a46e2406152",
    version: "0.3.10",
    argPos: 14,
    args: [
      "oracleKey",
      "globalOptionCount",
      "requiredVotes",
      "creatorPubKey",
      "creatorPayoutAddress",
      "creatorFee",
      "liquidityFeeRate"
    ],
    options: {
      maxOptionCount: 6,
      maxOracleCount: 3,
      devFee: 0.2
    },
    md5: "50c7bed9076efb5519f723c0d29b4483",
    length: 29302
  }
]

export const oracleContracts: version[] = [
  {
    identifier: "02fbca51c5c8820b884bcc3d4481a252",
    version: "0.1.1",
    argPos: 3,
    args: ["rabinPubKey"],
    options: {},
    md5: "ced81480741af8e2b2ca1547f6138fbe",
    length: 1236
  }
]

export function getArgPos(version: version, argument: string): number {
  const index = version.args.findIndex(arg => arg === argument)
  if (index === -1) throw new Error("Argument not found")
  return version.argPos + index
}

export function getMd5(script: bsv.Script, length: number, argPos: number, argLength: number): string {
  const testScript = new bsv.Script(script)

  testScript.chunks.splice(length) // Cut off OP_RETURN
  testScript.chunks.splice(argPos, argLength) // Cut out variable arguments
  return md5(testScript.toHex())
}
