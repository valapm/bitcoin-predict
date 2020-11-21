import { getMinerDetailsHex, getMinerDetailsFromHex, minerDetail } from "../src/oracle"
import { generatePrivKey, privKeyToPubKey } from "rabinsig"

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
  expect(getMinerDetailsFromHex(hex)).toEqual(minerDetails)
})
