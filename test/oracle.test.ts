import {
  getOracleDetailsHex,
  getOracleDetailsFromHex,
  oracleDetail,
  getSignature,
  getOracleStatesHex
} from "../src/oracle"
import { generatePrivKey, privKeyToPubKey } from "rabinsig"

const { verify } = require("rabinsig") // Why doesn't import work for verify ???

const privKey1 = generatePrivKey()
const privKey2 = generatePrivKey()

const pubKey1 = privKeyToPubKey(privKey1.p, privKey1.q)
const pubKey2 = privKeyToPubKey(privKey2.p, privKey2.q)

const oracleDetails: oracleDetail[] = [
  { pubKey: pubKey1, votes: 40, committed: false, voted: false },
  {
    pubKey: pubKey2,
    votes: 60,
    committed: true,
    voted: true
  }
]

test("should accurately convert to and from oracleDetails", () => {
  const deatilsHex = getOracleDetailsHex(oracleDetails)
  const stateHex = getOracleStatesHex(oracleDetails)
  const test = getOracleDetailsFromHex(deatilsHex, stateHex)

  expect(test).toEqual(oracleDetails)
})

test("should produce valid signature", () => {
  const sigContent = "Some Signature Content"
  const contentHex = Buffer.from(sigContent, "utf-8").toString("hex")

  const signature = getSignature(contentHex, privKey1)

  expect(verify(contentHex, signature.paddingByteCount, signature.signature, pubKey1)).toBe(true)
})
