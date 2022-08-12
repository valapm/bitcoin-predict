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
    developerPayoutAddress: string
  }
}

// Keep track of old versions for compatibility.
export const marketContracts: { [indentifier: string]: marketVersion } = {
  "8a5960d6dfcdc139af96b9d1e281a61e": {
    identifier: "8a5960d6dfcdc139af96b9d1e281a61e",
    version: "0.6.1",
    argPos: 18,
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
      devFee: 0.2,
      developerPayoutAddress: "0053faba2fb9a28dfa94d93270079cd2aa270180f3"
    },
    md5: "fef79271cd93fd01b436d405c1717293",
    length: 83470
  },
  "73145fea9a249918adf07357674cf33d": {
    identifier: "73145fea9a249918adf07357674cf33d",
    version: "0.3.13",
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
      devFee: 0.2,
      developerPayoutAddress: "0053faba2fb9a28dfa94d93270079cd2aa270180f3"
    },
    md5: "80085a7c1ac58d67eb19e8b82064ef3c",
    length: 31404
  },
  b7be4afbfb07f03ee23b01289804c1c9: {
    identifier: "b7be4afbfb07f03ee23b01289804c1c9",
    version: "0.3.12",
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
      devFee: 0.2,
      developerPayoutAddress: "00ae2c80a6e4bd7a01a0c8e6679f888234efac02b6"
    },
    md5: "e18c4f75119389e937146b8725a40038",
    length: 31404
  },
  "60be596a82e2a2a752bafcad8ea9567b": {
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
      devFee: 0.2,
      developerPayoutAddress: "00ae2c80a6e4bd7a01a0c8e6679f888234efac02b6"
    },
    md5: "29b3535c851df8d1326e57f87b21364a",
    length: 31524
  },
  "8f65ba6f86f6ba3c14e47a46e2406152": {
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
      devFee: 0.2,
      developerPayoutAddress: "00ae2c80a6e4bd7a01a0c8e6679f888234efac02b6"
    },
    md5: "50c7bed9076efb5519f723c0d29b4483",
    length: 31508
  }
}

export const currentMarketContract = marketContracts["8a5960d6dfcdc139af96b9d1e281a61e"]

export const oracleContracts: { [indentifier: string]: version } = {
  "5d9a258cb212c53d9d3c5c71a0c4daeb": {
    identifier: "5d9a258cb212c53d9d3c5c71a0c4daeb",
    version: "0.1.3",
    argPos: 8,
    args: ["rabinPubKey"],
    options: {},
    md5: "1807af1e72025021c735567fa8fbd8a1",
    length: 1472
  },
  "02fbca51c5c8820b884bcc3d4481a252": {
    identifier: "02fbca51c5c8820b884bcc3d4481a252",
    version: "0.1.1",
    argPos: 3,
    args: ["rabinPubKey"],
    options: {},
    md5: "ced81480741af8e2b2ca1547f6138fbe",
    length: 1475
  }
}

export const currentOracleContract = oracleContracts["5d9a258cb212c53d9d3c5c71a0c4daeb"]

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
