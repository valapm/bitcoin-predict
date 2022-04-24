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
    identifier: "60be596a82e2a2a752bafcad8ea9567b",
    version: "0.3.11",
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
    md5: "29b3535c851df8d1326e57f87b21364a",
    length: 31524
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
    length: 1475
  }
]

export function getArgPos(version: version, argument: string): number {
  const index = version.args.findIndex(arg => arg === argument)
  if (index === -1) throw new Error("Argument not found")
  return version.argPos + index
}

export function getMd5(script: bsv.Script, length: number, argPos: number, argLength: number): string {
  const asm1 = script.toASM().split(" ")
  asm1.splice(argPos, argLength) // Cut out variable arguments

  const testScript = bsv.Script.fromASM(asm1.join(" "))

  let hex = testScript.toHex()
  hex = hex.slice(0, length * 2) // Cut off OP_RETURN

  return md5(hex)
}

export function getInfo(scryptJSON: any, argPos: number, argLength: number) {
  const asm = scryptJSON.asm.split(" ")
  asm.splice(argPos, argLength) // Cut out variable arguments

  const testScript = bsv.Script.fromASM(asm.join(" "))
  const hex = testScript.toHex()
  return {
    md5: md5(hex),
    length: hex.length / 2,
    identifier: scryptJSON.md5
  }
}
