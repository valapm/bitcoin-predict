import { getLmsrShas, getPos, getLmsrHex, balance } from "../src/lmsr"
import { getMerklePath, verifyLeaf, getMerkleRoot } from "../src/merkleTree"
import { sha256 } from "../src/sha"

test("generate and verify lmsr hashes", () => {
  const prevBalance: balance = {
    liquidity: 1,
    sharesFor: 1,
    sharesAgainst: 1
  }

  const newBalance: balance = {
    liquidity: 1,
    sharesFor: 2,
    sharesAgainst: 1
  }

  const shas = getLmsrShas()
  const prevPos = getPos(prevBalance)
  const newPos = getPos(newBalance)
  const prevMerklePath = getMerklePath(prevPos, shas)
  const newMerklePath = getMerklePath(newPos, shas)
  const merkleRoot = getMerkleRoot(shas)

  const prevValue = getLmsrHex(prevBalance)
  const newValue = getLmsrHex(newBalance)

  // console.log(prevMerklePath)
  // console.log(newMerklePath)
  // console.log(merkleRoot)

  // console.log(verifyLeaf(sha256(prevValue), prevMerklePath, merkleRoot))
  // console.log(verifyLeaf(sha256(newValue), newMerklePath, merkleRoot))

  expect(verifyLeaf(sha256(prevValue), prevMerklePath, merkleRoot)).toBe(true)
  expect(verifyLeaf(sha256(newValue), newMerklePath, merkleRoot)).toBe(true)
})
