import { getLmsrShas, getPos, getLmsrHex } from "../src/lmsr"
import { getMerklePath, verifyLeaf, getMerkleRoot } from "../src/merkleTree"
import { sha256 } from "../src/sha"

test("generate and verify lmsr hashes", () => {
  const shas = getLmsrShas()
  const prevPos = getPos(1, 1, 1)
  const newPos = getPos(1, 2, 1)
  const prevMerklePath = getMerklePath(prevPos, shas)
  const newMerklePath = getMerklePath(newPos, shas)
  const merkleRoot = getMerkleRoot(shas)

  const prevValue = getLmsrHex(1, 1, 1)
  const newValue = getLmsrHex(1, 2, 1)

  // console.log(prevMerklePath)
  // console.log(newMerklePath)
  // console.log(merkleRoot)

  // console.log(verifyLeaf(sha256(prevValue), prevMerklePath, merkleRoot))
  // console.log(verifyLeaf(sha256(newValue), newMerklePath, merkleRoot))

  expect(verifyLeaf(sha256(prevValue), prevMerklePath, merkleRoot)).toBe(true)
  expect(verifyLeaf(sha256(newValue), newMerklePath, merkleRoot)).toBe(true)
})
