import {
  getOracleDetailsHex,
  getOracleDetailsFromHex,
  oracleDetail,
  getSignature,
  getOracleStatesHex
} from "../src/oracle"
import { RabinSignature } from "rabinsig"

const rabin = new RabinSignature()

const privKey1 = rabin.generatePrivKey()
const privKey2 = rabin.generatePrivKey()

const pubKey1 = rabin.privKeyToPubKey(privKey1.p, privKey1.q)
const pubKey2 = rabin.privKeyToPubKey(privKey2.p, privKey2.q)

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

  expect(rabin.verify(contentHex, signature.paddingByteCount, signature.signature, pubKey1)).toBe(true)
})
