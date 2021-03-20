import { getMinerDetailsHex, getMinerDetailsFromHex, minerDetail, getSignature } from "../src/oracle"
import { generatePrivKey, privKeyToPubKey } from "rabinsig"
import { int2Hex } from "../src/hex"

const { verify } = require("rabinsig") // Why doesn't import work for verify ???

const privKey1 = generatePrivKey()
const privKey2 = generatePrivKey()

const pubKey1 = privKeyToPubKey(privKey1.p, privKey1.q)
const pubKey2 = privKeyToPubKey(privKey2.p, privKey2.q)

const minerDetails: minerDetail[] = [
  { pubKey: pubKey1, votes: 40 },
  {
    pubKey: pubKey2,
    votes: 60
  }
]

test("should accurately convert to and from minerDetails", () => {
  const hex = getMinerDetailsHex(minerDetails)
  const test = getMinerDetailsFromHex(hex)

  expect(test).toEqual(minerDetails)
  expect(getMinerDetailsFromHex(hex)).toEqual(minerDetails)
})

test("should produce valid signature", () => {
  const decision = 1
  const signature = getSignature(decision, privKey1)

  const messageHex = int2Hex(decision)

  expect(verify(messageHex, signature.paddingByteCount, signature.signature, pubKey1)).toBe(true)
})
