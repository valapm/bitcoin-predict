import { getEntryFromHex, getEntryHex, entry } from "../src/pm"
import { bsv } from "scryptlib"

test("Convert entry to and from hex", () => {
  const privateKey = bsv.PrivateKey.fromString("Kys3cyL5HZ4upzwWsnirv4urUeczpnweiJ2zY5EDBCkRZ5j2TTdj")
  const entry: entry = {
    publicKey: privateKey.publicKey,
    balance: {
      liquidity: 2,
      shares: [1, 2, 3, 4, 6]
    }
  }

  const entryHex = getEntryHex(entry)
  const parsedEntry = getEntryFromHex(entryHex)
  const entryHex2 = getEntryHex(parsedEntry)

  expect(entryHex).toBe(entryHex2)
})
