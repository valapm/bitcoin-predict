import {
  addLeaf,
  verifyLeaf,
  getMerkleRoot,
  getMerklePath
} from "../src/merkleTree"
import { sha256 } from "../src/sha"

test("Add leafs", () => {
  const hashes = [sha256("01"), sha256("02"), sha256("03"), sha256("04")]

  const root = getMerkleRoot(hashes)
  const lastPath = getMerklePath(3, hashes)

  expect(verifyLeaf(sha256("04"), lastPath, root)).toBe(true)

  const root2 = addLeaf(sha256("04"), lastPath, root, sha256("05"))

  const hashes2 = hashes.concat([sha256("05")])
  const lastPath2 = getMerklePath(4, hashes2)

  expect(verifyLeaf(sha256("05"), lastPath2, root2)).toBe(true)

  const rootTest = getMerkleRoot([
    sha256("01"),
    sha256("02"),
    sha256("03"),
    sha256("04"),
    sha256("05")
  ])

  expect(rootTest).toBe(root2)

  const root3 = addLeaf(sha256("05"), lastPath2, root2, sha256("06"))

  const hashes3 = hashes2.concat([sha256("06")])
  const lastPath3 = getMerklePath(5, hashes3)

  expect(verifyLeaf(sha256("06"), lastPath3, root3)).toBe(true)

  const rootTest2 = getMerkleRoot([
    sha256("01"),
    sha256("02"),
    sha256("03"),
    sha256("04"),
    sha256("05"),
    sha256("06")
  ])

  expect(rootTest2).toBe(root3)

  const root4 = addLeaf(sha256("06"), lastPath3, root3, sha256("07"))

  const hashes4 = hashes3.concat([sha256("07")])
  const lastPath4 = getMerklePath(6, hashes4)

  expect(verifyLeaf(sha256("07"), lastPath4, root4)).toBe(true)

  const rootTest3 = getMerkleRoot([
    sha256("01"),
    sha256("02"),
    sha256("03"),
    sha256("04"),
    sha256("05"),
    sha256("06"),
    sha256("07")
  ])

  expect(rootTest3).toBe(root4)
})
