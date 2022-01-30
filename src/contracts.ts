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
    identifier: "97281a1a2fd6499a1ddb749c9e701932",
    version: "0.3.7",
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
    md5: "d4c9441ab8958c6657ee8cd033c5dffa",
    length: 29299
  }
]

export const oracleContracts: version[] = [
  {
    identifier: "02fbca51c5c8820b884bcc3d4481a252",
    version: "0.1.0",
    argPos: 3,
    args: ["rabinPubKey"],
    options: {},
    md5: "e86c5cc2961ed2d8eec2d1c7d931a4a1",
    length: 1236
  }
]

export function getArgPos(version: version, argument: string): number {
  const index = version.args.findIndex(arg => arg === argument)
  if (index === -1) throw new Error("Argument not found")
  return version.argPos + index
}
