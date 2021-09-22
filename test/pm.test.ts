import { balance } from "../src/lmsr"
import {
  getEntryFromHex,
  getEntryHex,
  entry,
  getBalanceFromHex,
  getBalanceHex,
  getMarketStatusHex,
  getMarketStatusfromHex,
  marketStatus,
  getVotesHex
} from "../src/pm"
import { bsv } from "scryptlib"
import { int2Hex } from "../src/hex"

test("Convert entry to and from hex", () => {
  const privateKey = bsv.PrivateKey.fromString("Kys3cyL5HZ4upzwWsnirv4urUeczpnweiJ2zY5EDBCkRZ5j2TTdj")
  const entry: entry = {
    publicKey: privateKey.publicKey,
    balance: {
      liquidity: 2,
      shares: [1, 2, 3, 4, 6]
    },
    globalLiqidityFeePoolSave: 123,
    liquidityPoints: 10
  }

  const entryHex = getEntryHex(entry)
  const parsedEntry = getEntryFromHex(entryHex)
  const entryHex2 = getEntryHex(parsedEntry)

  expect(entryHex).toBe(entryHex2)
})

test("Convert balance from and to hex", () => {
  const balance: balance = {
    liquidity: 5,
    shares: [1, 2, 3, 4, 6]
  }

  const balanceHex = getBalanceHex(balance)
  const parsedBalance = getBalanceFromHex(balanceHex)
  const balanceHex2 = getBalanceHex(parsedBalance)

  expect(balanceHex).toBe(balanceHex2)
})
