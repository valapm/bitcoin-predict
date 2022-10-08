import { sha256 } from "./sha"
import semverLt from "semver/functions/lt"
import { currentMarketContract } from "./contracts"

export function getMerkleRoot(hashes: string[]): string {
  let array = hashes
  do {
    array = merkelizeArray(array)
  } while (array.length > 1)

  return array[0]
}

export function merkelizeArray(array: string[]): string[] {
  const reduced = []
  for (let i = 0; i <= array.length - 2; i++) {
    if (i % 2 === 0) {
      const hashString = array.slice(i, i + 2).join("")
      const newHash = sha256(hashString)
      reduced.push(newHash)
    }
  }
  if (array.length % 2 == 1) reduced.push(sha256(array[array.length - 1].repeat(2)))
  return reduced
}

export function getMerklePath(pos: number, hashes: string[]): string {
  const left = pos % 2 === 0 ? true : false
  let sibling = left ? hashes[pos + 1] : hashes[pos - 1]
  sibling = sibling || hashes[pos]
  const path = left ? sibling + "01" : sibling + "00"
  // console.log(hashes.length, pos, left, left ? `(${hashes[pos]}) + ${sibling}` : `${sibling} + (${hashes[pos]})`)
  if (hashes.length <= 2) return path
  return path + getMerklePath(Math.floor(pos / 2), merkelizeArray(hashes))
}

export function getMerkleRootByPath(leaf: string, path: string): string {
  const merklePathLength = path.length / 66
  let i = 0
  let merkleValue = leaf
  while (i < merklePathLength) {
    const left = Boolean(parseInt(path.substring(i * 66 + 64, i * 66 + 66)))
    const sibling = path.substring(i * 66, i * 66 + 64)
    const merged = left ? merkleValue + sibling : sibling + merkleValue
    // console.log(merged.substring(0, 64) + " + " + merged.substring(64, 128))
    merkleValue = sha256(merged)
    // console.log("= " + merkleValue)
    i++
  }
  return merkleValue
}

export function verifyLeaf(leaf: string, merklePath: string, merkleRoot: string): boolean {
  const firstNeighbor = merklePath.substring(0, 64)
  if (firstNeighbor === leaf) {
    // Make sure that leaf is not just a mirror
    const firstLeft = Boolean(parseInt(merklePath.substring(64, 66)))
    if (!firstLeft) return false
  }

  return getMerkleRootByPath(leaf, merklePath) === merkleRoot
}

/**
  *  Makes sure that
  *  - the new leaf is added at the same depth as the other leafs.
  +  - the new leaf is hashed twice before adding.
  */
export function addLeaf(
  lastEntry: string,
  lastMerklePath: string,
  oldMerkleRoot: string,
  newEntry: string,
  version = currentMarketContract
): string {
  const lastLeaf = semverLt(version.version, "0.6.5") ? sha256(lastEntry) : sha256(sha256(lastEntry))
  const newLeaf = semverLt(version.version, "0.6.5") ? sha256(newEntry) : sha256(sha256(newEntry))

  if (!verifyLeaf(lastLeaf, lastMerklePath, oldMerkleRoot)) throw new Error("Invalid merkle root or path")

  const depth = lastMerklePath.length / 66

  let i = 0
  let merkleValue = newLeaf
  let lastLeafValue = lastLeaf
  let joined = false

  while (i < depth) {
    const sibling = lastMerklePath.slice(i * 66, i * 66 + 64)
    const left = Boolean(parseInt(lastMerklePath.substring(i * 66 + 64, i * 66 + 66)))

    if (left) {
      if (!joined) {
        if (sibling !== lastLeafValue) throw new Error("Invalid merkle path for last leaf")
        merkleValue = sha256(lastLeafValue + merkleValue)
      } else {
        // if (sibling !== merkleValue) throw new Error("Invalid merkle path for last leaf")
        merkleValue = sha256(merkleValue.repeat(2))
      }

      joined = true
    } else {
      if (!joined) {
        merkleValue = sha256(merkleValue.repeat(2))
        lastLeafValue = sha256(sibling + lastLeafValue)
      } else {
        merkleValue = sha256(sibling + merkleValue)
      }
    }
    i++
  }

  if (!joined) {
    merkleValue = sha256(oldMerkleRoot + merkleValue)
  }

  return merkleValue
}

export function updateLeaf(
  oldEntry: string,
  newEntry: string,
  merklePath: string,
  oldMerkleRoot: string,
  version = currentMarketContract
): string {
  // Make sure that entries are hashed twice

  const oldLeaf = semverLt(version.version, "0.6.5") ? sha256(oldEntry) : sha256(sha256(oldEntry))
  const newLeaf = semverLt(version.version, "0.6.5") ? sha256(newEntry) : sha256(sha256(newEntry))

  let i = 0
  const merklePathLength = merklePath.length / 66
  let oldMerkleValue = oldLeaf
  let newMerkleValue = newLeaf

  while (i < merklePathLength) {
    const left = parseInt(merklePath.slice(i * 66 + 64, i * 66 + 66))
    const oldNeighbor = merklePath.slice(i * 66, i * 66 + 64)
    const newNeighbor = oldNeighbor === oldMerkleValue ? newMerkleValue : oldNeighbor
    // console.log(oldMerkleValue)
    if (left) {
      oldMerkleValue = sha256(oldMerkleValue + oldNeighbor)
      newMerkleValue = sha256(newMerkleValue + newNeighbor)
    } else {
      oldMerkleValue = sha256(oldNeighbor + oldMerkleValue)
      newMerkleValue = sha256(newNeighbor + newMerkleValue)
    }
    // console.log(oldNeighbor, "=>", oldMerkleValue, Boolean(left))
    i = i + 1
  }

  if (oldMerkleValue !== oldMerkleRoot) throw new Error()

  return newMerkleValue
}
