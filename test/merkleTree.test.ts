import { update } from "lodash"
import { addLeaf, verifyLeaf, getMerkleRoot, getMerklePath, getMerkleRootByPath, updateLeaf } from "../src/merkleTree"
import { sha256d } from "../src/sha"
import { marketContracts } from "../src/contracts"
import { getMerklePath as getMerklePathEntries, getEntryHex, entry } from "../src/pm"
import bsv from "bsv"

test("Add leafs", () => {
  const hashes = [sha256d("01"), sha256d("02"), sha256d("03"), sha256d("04")]

  const root = getMerkleRoot(hashes)
  const lastPath = getMerklePath(3, hashes)

  expect(verifyLeaf(sha256d("04"), lastPath, root)).toBe(true)

  const root2 = addLeaf("04", lastPath, root, "05")

  const hashes2 = hashes.concat([sha256d("05")])
  const lastPath2 = getMerklePath(4, hashes2)

  expect(verifyLeaf(sha256d("05"), lastPath2, root2)).toBe(true)

  const rootTest = getMerkleRoot([sha256d("01"), sha256d("02"), sha256d("03"), sha256d("04"), sha256d("05")])

  expect(rootTest).toBe(root2)

  const root3 = addLeaf("05", lastPath2, root2, "06")

  const hashes3 = hashes2.concat([sha256d("06")])
  const lastPath3 = getMerklePath(5, hashes3)

  expect(verifyLeaf(sha256d("06"), lastPath3, root3)).toBe(true)

  const rootTest2 = getMerkleRoot([
    sha256d("01"),
    sha256d("02"),
    sha256d("03"),
    sha256d("04"),
    sha256d("05"),
    sha256d("06")
  ])

  expect(rootTest2).toBe(root3)

  const root4 = addLeaf("06", lastPath3, root3, "07")

  const hashes4 = hashes3.concat([sha256d("07")])
  const lastPath4 = getMerklePath(6, hashes4)

  expect(verifyLeaf(sha256d("07"), lastPath4, root4)).toBe(true)

  const rootTest3 = getMerkleRoot([
    sha256d("01"),
    sha256d("02"),
    sha256d("03"),
    sha256d("04"),
    sha256d("05"),
    sha256d("06"),
    sha256d("07")
  ])

  expect(rootTest3).toBe(root4)
})

test("calculate valid paths", () => {
  const hashes = [
    sha256d("01"),
    sha256d("02"),
    sha256d("03"),
    sha256d("04"),
    sha256d("05"),
    sha256d("06"),
    sha256d("07"),
    sha256d("09"),
    sha256d("10"),
    sha256d("11"),
    sha256d("12"),
    sha256d("13"),
    sha256d("14"),
    sha256d("15"),
    sha256d("16"),
    sha256d("17"),
    sha256d("18"),
    sha256d("19"),
    sha256d("20")
  ]

  const root = getMerkleRoot(hashes)

  const path = getMerklePath(3, hashes)
  expect(verifyLeaf(sha256d("04"), path, root)).toBe(true)

  const path2 = getMerklePath(4, hashes)
  expect(verifyLeaf(sha256d("05"), path2, root)).toBe(true)

  const path3 = getMerklePath(5, hashes)
  expect(verifyLeaf(sha256d("06"), path3, root)).toBe(true)
})

test("update leafs", () => {
  const hashes = [
    sha256d("01"),
    sha256d("02"),
    sha256d("03"),
    sha256d("04"),
    sha256d("05"),
    sha256d("06"),
    sha256d("07")
  ]

  const root = getMerkleRoot(hashes)

  const root2 = updateLeaf("03", "08", getMerklePath(2, hashes), root)
  const hashes2 = [
    sha256d("01"),
    sha256d("02"),
    sha256d("08"),
    sha256d("04"),
    sha256d("05"),
    sha256d("06"),
    sha256d("07")
  ]

  expect(getMerkleRoot(hashes2)).toBe(root2)
})

test("update leafs", () => {
  const hashes = [
    sha256d("01"),
    sha256d("02"),
    sha256d("03"),
    sha256d("04"),
    sha256d("05"),
    sha256d("06"),
    sha256d("07"),
    sha256d("08"),
    sha256d("09"),
    sha256d("10"),
    sha256d("11"),
    sha256d("12"),
    sha256d("13"),
    sha256d("14"),
    sha256d("15"),
    sha256d("16"),
    sha256d("17"),
    sha256d("18"),
    sha256d("19"),
    sha256d("20")
  ]

  const root = getMerkleRoot(hashes)

  const root2 = updateLeaf("03", "08", getMerklePath(2, hashes), root)
  const hashes2 = [
    sha256d("01"),
    sha256d("02"),
    sha256d("08"),
    sha256d("04"),
    sha256d("05"),
    sha256d("06"),
    sha256d("07"),
    sha256d("08"),
    sha256d("09"),
    sha256d("10"),
    sha256d("11"),
    sha256d("12"),
    sha256d("13"),
    sha256d("14"),
    sha256d("15"),
    sha256d("16"),
    sha256d("17"),
    sha256d("18"),
    sha256d("19"),
    sha256d("20")
  ]

  expect(getMerkleRoot(hashes2)).toBe(root2)
})

test("merkelize array", () => {
  const array = [
    sha256d("01"),
    sha256d("02"),
    sha256d("08"),
    sha256d("04"),
    sha256d("05"),
    sha256d("06"),
    sha256d("07"),
    sha256d("08"),
    sha256d("09"),
    sha256d("10"),
    sha256d("11"),
    sha256d("12"),
    sha256d("13"),
    sha256d("14"),
    sha256d("15"),
    sha256d("16"),
    sha256d("17"),
    sha256d("18"),
    sha256d("19"),
    sha256d("20")
  ]

  const newArray = [
    sha256d("01"),
    sha256d("02"),
    sha256d("123"),
    sha256d("04"),
    sha256d("05"),
    sha256d("06"),
    sha256d("07"),
    sha256d("08"),
    sha256d("09"),
    sha256d("10"),
    sha256d("11"),
    sha256d("12"),
    sha256d("13"),
    sha256d("14"),
    sha256d("15"),
    sha256d("16"),
    sha256d("17"),
    sha256d("18"),
    sha256d("19"),
    sha256d("20")
  ]

  const merklePath = getMerklePath(2, array)
  const newMerklePath = getMerklePath(2, newArray)

  const oldMerkleRoot = getMerkleRootByPath(sha256d("03"), merklePath)
  const newMerkleRoot = getMerkleRootByPath(sha256d("123"), newMerklePath)

  const newMerkleRoot2 = updateLeaf("03", "123", merklePath, oldMerkleRoot)

  expect(newMerkleRoot).toBe(newMerkleRoot2)
})

test("test", () => {
  const entryObjects = [
    {
      publicKey: {
        x: "43720e9471e064b623355629abb42da1587189e2b62e5fff141e603d5936ed06",
        y: "a952abe8f78be7865218b8a806bd9e43d7a58d1ee59680539b9a76c79024e0d6",
        compressed: true
      },
      balance: {
        liquidity: 0,
        shares: [10, 0, 0]
      },
      globalLiqidityFeePoolSave: 0,
      liquidityPoints: 0
    },
    {
      publicKey: {
        x: "556bb83a6fdd67efa7b08b64312c33f1540a482d57c168534bae31a8510115b7",
        y: "7bca238e3306002ad2e0b65a16821a4c377041602c9fa4e072036a9f134d9b04",
        compressed: true
      },
      balance: {
        liquidity: 0,
        shares: [0, 0, 1]
      },
      globalLiqidityFeePoolSave: 0,
      liquidityPoints: 0
    },
    {
      publicKey: {
        x: "a151cc277ab9dcc0c824f04e2bb8797e1f4ae3827360d1687838583f574355fb",
        y: "0777b222c1c9bd2c930c2d596968dd8d4002783a909ff95c4b94a51f8400bccc",
        compressed: true
      },
      balance: {
        liquidity: 0,
        shares: [30, 0, 0]
      },
      globalLiqidityFeePoolSave: 0,
      liquidityPoints: 0
    },
    {
      publicKey: {
        x: "9343bdbb4dbcce4cd383635d3585792b1889f86de364616d2620ad63d95dffc8",
        y: "9e590bebb513f4458cf8ea490cd6dc4af42fcfcc5f700ce8730e1914aaa35733",
        compressed: true
      },
      balance: {
        liquidity: 0,
        shares: [2, 0, 0]
      },
      globalLiqidityFeePoolSave: 0,
      liquidityPoints: 0
    },
    {
      publicKey: {
        x: "af828d3318abba473c29923b376069a6aea8a361178cc4d2927e7a87e9abb463",
        y: "03ed4a463a209321ae94056ec676506e3cc4e753c30808a695b44a060a69c99b",
        compressed: true
      },
      balance: {
        liquidity: 0,
        shares: [0, 10, 0]
      },
      globalLiqidityFeePoolSave: 8696,
      liquidityPoints: 0
    },
    {
      publicKey: {
        x: "4b4fa85fbbd58c5fea4ee8e9cb52fb759c8fd5ae2c516e512a8010a045438294",
        y: "54cbe8a1bdefc2c35bf555277925112957d6d5c4756e9fc410890b685949e05d",
        compressed: true
      },
      balance: {
        liquidity: 0,
        shares: [12, 0, 0]
      },
      globalLiqidityFeePoolSave: 8696,
      liquidityPoints: 0
    },
    {
      publicKey: {
        x: "67b89ec7a5c441431ddbd962623ab3b2c2f72df683bd82caeb837c64eae6e7b2",
        y: "6d3bdb8adfab2a72cc4fa8b0c38cc2f912b7897e92235713a83e4592291005e7",
        compressed: true
      },
      balance: {
        liquidity: 0,
        shares: [2, 0, 0]
      },
      globalLiqidityFeePoolSave: 8696,
      liquidityPoints: 0
    },
    {
      publicKey: {
        x: "ca1517849a9c5f906c98c87c9befd73d51a688c14f81a3ea30d0aff43e4d98ac",
        y: "e9934ffe6f8d7c189902a34b4ac45de242e8458ecabacd60f44bb71a10d19694",
        compressed: true
      },
      balance: {
        liquidity: 0,
        shares: [5, 0, 0]
      },
      globalLiqidityFeePoolSave: 8696,
      liquidityPoints: 0
    },
    {
      publicKey: {
        x: "f57b408045a1d244c39b085f6d7e4f0ddafe943c17fc3023c99f6a1a03efc306",
        y: "2c222fbac3165c7e0c2b635db0c1277bb1f0df2ed079a57ffa107143c42e61c6",
        compressed: true
      },
      balance: {
        liquidity: 0,
        shares: [0, 10, 0]
      },
      globalLiqidityFeePoolSave: 8696,
      liquidityPoints: 0
    },
    {
      publicKey: {
        x: "db19c899dbbff6a8831b4c60f5180243870f3a6467bad612311f0c14f59d712d",
        y: "8f9f95a9babf3e9ba263023779402724ad272d31ab5e7022db77e5f8bc42d5e8",
        compressed: true
      },
      balance: {
        liquidity: 0,
        shares: [1, 0, 0]
      },
      globalLiqidityFeePoolSave: 8696,
      liquidityPoints: 0
    },
    {
      publicKey: {
        x: "21e1fffce635ca8393ca88f5ce9616cedfb37ef41b5d8823a9a97fcf91dd41f3",
        y: "a3a11d5a298a7e6f23f978e61b256d3c73da9fd7cd9fbfae06f3939c9295910c",
        compressed: true
      },
      balance: {
        liquidity: 0,
        shares: [0, 10, 0]
      },
      globalLiqidityFeePoolSave: 8696,
      liquidityPoints: 0
    },
    {
      balance: {
        shares: [0, 1, 1],
        liquidity: 10
      },
      publicKey: {
        x: "691ddfd727ddcc991ed5facd49806db88a47541d1cb51fe5819d34e1c9610d69",
        y: "4a88a62aff54bb6549a40f83b00675bd6f198d184cb56e313f0fea433ba2c4cf",
        compressed: true
      },
      globalLiqidityFeePoolSave: 8696,
      liquidityPoints: 86960
    },
    {
      publicKey: {
        x: "1b1e0d0a75c1ecf3c4ca4321c927bcbecc310f2123689ccfd59ea28e8393478d",
        y: "24d1f812d2eca12643f8bc64f2123a9a61f6a06d5845a7d6e4742fb5bc3885b4",
        compressed: true
      },
      balance: {
        liquidity: 0,
        shares: [0, 1, 1]
      },
      globalLiqidityFeePoolSave: 8696,
      liquidityPoints: 0
    },
    {
      publicKey: {
        x: "ecbb03fa1491dbda0bfaf0c3dcac3f69afd3613b369689e585a81007642ad12e",
        y: "fbaa05303a4bf83fd959cd8228b5511fb7d9b25a65585b9075c50e6051e911a0",
        compressed: true
      },
      balance: {
        liquidity: 0,
        shares: [4, 0, 0]
      },
      globalLiqidityFeePoolSave: 0,
      liquidityPoints: 0
    },
    {
      publicKey: {
        x: "ec897519c1b15c0078ffe03badf1db9784462cea1b900a3aaeb0db2b2bbd1d7e",
        y: "554f3fad76486aa5bd790ec3344e509dd2ff38cbbfa9db447f06374c5d2a92a0",
        compressed: true
      },
      balance: {
        liquidity: 0,
        shares: [1, 0, 0]
      },
      globalLiqidityFeePoolSave: 0,
      liquidityPoints: 0
    },
    {
      publicKey: {
        x: "2edaf20afb619cc0d115b75a22df6df6a54495293f7f63fad21f61082ef2c4ae",
        y: "f74d0e04a53210522aeecf5f063f4419610c2b6891a9287b8fef74d7fc4e1a5f",
        compressed: true
      },
      balance: {
        liquidity: 2,
        shares: [6, 0, 0]
      },
      globalLiqidityFeePoolSave: 0,
      liquidityPoints: 0
    },
    {
      publicKey: {
        x: "7b16deb3a64a4cdc8b41003f503e0d3fa7a9c9ce8a8b666aa0b6d9e7f2b798fa",
        y: "d2f1794e1ac57991fddf67d025a913aaabbc3436161b5c2ffb6fca5c2ab99f7f",
        compressed: true
      },
      balance: {
        liquidity: 0,
        shares: [0, 2, 0]
      },
      globalLiqidityFeePoolSave: 0,
      liquidityPoints: 0
    },
    {
      publicKey: {
        x: "a0b62905f142597e49fcd1352690ff3f0fef24891ac297fd20dd2d02e34e346e",
        y: "d3f0c49f42a6d9926829f1eead81bf497b47f1613ff05e806215cbb86e96daa5",
        compressed: true
      },
      balance: {
        liquidity: 0,
        shares: [12, 0, 0]
      },
      globalLiqidityFeePoolSave: 0,
      liquidityPoints: 0
    },
    {
      publicKey: {
        x: "21d18d27971239432b006aeb4be7211709312bc6d0ae611c59fac4e70164207b",
        y: "7d58b716c46a1d316115164e3a1a727e400947a80ed5dc26657ede60f9b0cf04",
        compressed: true
      },
      balance: {
        liquidity: 0,
        shares: [0, 43, 0]
      },
      globalLiqidityFeePoolSave: 0,
      liquidityPoints: 0
    }
  ]

  const prevEntries = entryObjects.map(entry => {
    return {
      ...entry,
      // @ts-ignore
      publicKey: new bsv.PublicKey(entry.publicKey)
    }
  })

  const entryIndex = 11

  const newEntry = {
    ...prevEntries[entryIndex],
    balance: {
      ...prevEntries[entryIndex].balance,
      liquidity: 18
    }
  }

  const newEntries = [...prevEntries]
  newEntries[11] = newEntry

  const version = marketContracts["49a07371b72a9261b25bd8c16c54d246"]

  // console.log(version)

  const merklePath = getMerklePathEntries(prevEntries, entryIndex, version)
  const newMerklePath = getMerklePathEntries(newEntries, entryIndex, version)

  const oldEntryHex = getEntryHex(prevEntries[entryIndex], version)
  const newEntryHex = getEntryHex(newEntry, version)

  // console.log(getEntryHex(prevEntries[entryIndex], version))
  // console.log(getEntryHex(newEntry, version))

  const oldMerkleRoot = getMerkleRootByPath(sha256d(getEntryHex(prevEntries[entryIndex], version)), merklePath)
  const newMerkleRoot = getMerkleRootByPath(sha256d(getEntryHex(newEntry, version)), newMerklePath)

  const oldMerkleRoot2 = getMerkleRoot([
    sha256d("00"),
    ...prevEntries.map(entry => sha256d(getEntryHex(entry, version)))
  ])

  // console.log(oldLeaf, "7aceb8f2096fc689ac2dae6cf99a2ff59f6956bc19546af68e335a0c82735d48")
  // console.log(newLeaf, "664631d4ab4411a0758f6378a6c8a7060ee9e99211a85fb9dee78fe645d3dc78")
  // console.log(
  //   merklePath,
  //   "bf2ecefebf001a0557579a450f82e6078aac201820340b1a2c10c82aa857cc5601c49bf3219e5d1ba114f265f0c93bc02d5a1b422715b3c5052b6cad12a12c71c301c3c0786069b96a9e95c86f0d583726c5d8e54abab3e8f88b5540493df526b74c00e6aee30ff6889de62eab122163122305787cc58534a7d0225a02b8d43fce7a5f003a98eb9d3b9a8535c780d70516f0a1a72380bd7f8b8243357eec07ac98de2abe01"
  // )
  // console.log(oldMerkleRoot, "fa92ce804e850e38e1d8ec941d19fca50f5aa1def9cdaef55f79ade5fa10a905")
  // console.log(oldMerkleRoot2)

  // expect(oldLeaf).toBe("7aceb8f2096fc689ac2dae6cf99a2ff59f6956bc19546af68e335a0c82735d48")
  // expect(newLeaf).toBe("664631d4ab4411a0758f6378a6c8a7060ee9e99211a85fb9dee78fe645d3dc78")
  // expect(merklePath).toBe(
  //   "bf2ecefebf001a0557579a450f82e6078aac201820340b1a2c10c82aa857cc5601c49bf3219e5d1ba114f265f0c93bc02d5a1b422715b3c5052b6cad12a12c71c301c3c0786069b96a9e95c86f0d583726c5d8e54abab3e8f88b5540493df526b74c00e6aee30ff6889de62eab122163122305787cc58534a7d0225a02b8d43fce7a5f003a98eb9d3b9a8535c780d70516f0a1a72380bd7f8b8243357eec07ac98de2abe01"
  // )
  // expect(oldMerkleRoot).toBe("fa92ce804e850e38e1d8ec941d19fca50f5aa1def9cdaef55f79ade5fa10a905")

  // updateLeaf(
  //   "7aceb8f2096fc689ac2dae6cf99a2ff59f6956bc19546af68e335a0c82735d48",
  //   "c8d3df724c1f1fddb66ae430163129c55346433414495deddcf655ff180760ec",
  //   "bf2ecefebf001a0557579a450f82e6078aac201820340b1a2c10c82aa857cc5601c49bf3219e5d1ba114f265f0c93bc02d5a1b422715b3c5052b6cad12a12c71c301c3c0786069b96a9e95c86f0d583726c5d8e54abab3e8f88b5540493df526b74c00e6aee30ff6889de62eab122163122305787cc58534a7d0225a02b8d43fce7a5f003a98eb9d3b9a8535c780d70516f0a1a72380bd7f8b8243357eec07ac98de2abe01",
  //   "ff2490b876963fd1d4eed1e0e08c038811c6e53dfde6894c43af4b08ad36ba7a"
  // )

  updateLeaf(oldEntryHex, newEntryHex, merklePath, oldMerkleRoot)
})

test("entries", () => {
  const oldEntryObjects = [
    {
      investorPubKey: "03691ddfd727ddcc991ed5facd49806db88a47541d1cb51fe5819d34e1c9610d69",
      shares: [0, 1, 1],
      liquidity: 10,
      prevLiquidityPoolState: 8696,
      liquidityPoints: 86960
    },
    {
      investorPubKey: "021b1e0d0a75c1ecf3c4ca4321c927bcbecc310f2123689ccfd59ea28e8393478d",
      shares: [0, 1, 1],
      liquidity: 0,
      prevLiquidityPoolState: 8696,
      liquidityPoints: 0
    },
    {
      investorPubKey: "02ecbb03fa1491dbda0bfaf0c3dcac3f69afd3613b369689e585a81007642ad12e",
      shares: [4, 0, 0],
      liquidity: 0,
      prevLiquidityPoolState: 0,
      liquidityPoints: 0
    },
    {
      investorPubKey: "02ec897519c1b15c0078ffe03badf1db9784462cea1b900a3aaeb0db2b2bbd1d7e",
      shares: [1, 0, 0],
      liquidity: 0,
      prevLiquidityPoolState: 0,
      liquidityPoints: 0
    },
    {
      investorPubKey: "032edaf20afb619cc0d115b75a22df6df6a54495293f7f63fad21f61082ef2c4ae",
      shares: [6, 0, 0],
      liquidity: 2,
      prevLiquidityPoolState: 0,
      liquidityPoints: 0
    },
    {
      investorPubKey: "037b16deb3a64a4cdc8b41003f503e0d3fa7a9c9ce8a8b666aa0b6d9e7f2b798fa",
      shares: [0, 2, 0],
      liquidity: 0,
      prevLiquidityPoolState: 0,
      liquidityPoints: 0
    },
    {
      investorPubKey: "03a0b62905f142597e49fcd1352690ff3f0fef24891ac297fd20dd2d02e34e346e",
      shares: [12, 0, 0],
      liquidity: 0,
      prevLiquidityPoolState: 0,
      liquidityPoints: 0
    },
    {
      investorPubKey: "0221d18d27971239432b006aeb4be7211709312bc6d0ae611c59fac4e70164207b",
      shares: [0, 43, 0],
      liquidity: 0,
      prevLiquidityPoolState: 0,
      liquidityPoints: 0
    },
    {
      investorPubKey: "0243720e9471e064b623355629abb42da1587189e2b62e5fff141e603d5936ed06",
      shares: [10, 0, 0],
      liquidity: 0,
      prevLiquidityPoolState: 0,
      liquidityPoints: 0
    },
    {
      investorPubKey: "02556bb83a6fdd67efa7b08b64312c33f1540a482d57c168534bae31a8510115b7",
      shares: [0, 0, 1],
      liquidity: 0,
      prevLiquidityPoolState: 0,
      liquidityPoints: 0
    },
    {
      investorPubKey: "02a151cc277ab9dcc0c824f04e2bb8797e1f4ae3827360d1687838583f574355fb",
      shares: [30, 0, 0],
      liquidity: 0,
      prevLiquidityPoolState: 0,
      liquidityPoints: 0
    },
    {
      investorPubKey: "039343bdbb4dbcce4cd383635d3585792b1889f86de364616d2620ad63d95dffc8",
      shares: [2, 0, 0],
      liquidity: 0,
      prevLiquidityPoolState: 0,
      liquidityPoints: 0
    },
    {
      investorPubKey: "03af828d3318abba473c29923b376069a6aea8a361178cc4d2927e7a87e9abb463",
      shares: [0, 10, 0],
      liquidity: 0,
      prevLiquidityPoolState: 8696,
      liquidityPoints: 0
    },
    {
      investorPubKey: "034b4fa85fbbd58c5fea4ee8e9cb52fb759c8fd5ae2c516e512a8010a045438294",
      shares: [12, 0, 0],
      liquidity: 0,
      prevLiquidityPoolState: 8696,
      liquidityPoints: 0
    },
    {
      investorPubKey: "0367b89ec7a5c441431ddbd962623ab3b2c2f72df683bd82caeb837c64eae6e7b2",
      shares: [2, 0, 0],
      liquidity: 0,
      prevLiquidityPoolState: 8696,
      liquidityPoints: 0
    },
    {
      investorPubKey: "02ca1517849a9c5f906c98c87c9befd73d51a688c14f81a3ea30d0aff43e4d98ac",
      shares: [5, 0, 0],
      liquidity: 0,
      prevLiquidityPoolState: 8696,
      liquidityPoints: 0
    },
    {
      investorPubKey: "02f57b408045a1d244c39b085f6d7e4f0ddafe943c17fc3023c99f6a1a03efc306",
      shares: [0, 10, 0],
      liquidity: 0,
      prevLiquidityPoolState: 8696,
      liquidityPoints: 0
    },
    {
      investorPubKey: "02db19c899dbbff6a8831b4c60f5180243870f3a6467bad612311f0c14f59d712d",
      shares: [1, 0, 0],
      liquidity: 0,
      prevLiquidityPoolState: 8696,
      liquidityPoints: 0
    }
  ]

  const newEntryObjects = [
    {
      investorPubKey: "0243720e9471e064b623355629abb42da1587189e2b62e5fff141e603d5936ed06",
      shares: [10, 0, 0],
      liquidity: 0,
      prevLiquidityPoolState: 0,
      liquidityPoints: 0
    },
    {
      investorPubKey: "02556bb83a6fdd67efa7b08b64312c33f1540a482d57c168534bae31a8510115b7",
      shares: [0, 0, 1],
      liquidity: 0,
      prevLiquidityPoolState: 0,
      liquidityPoints: 0
    },
    {
      investorPubKey: "02a151cc277ab9dcc0c824f04e2bb8797e1f4ae3827360d1687838583f574355fb",
      shares: [30, 0, 0],
      liquidity: 0,
      prevLiquidityPoolState: 0,
      liquidityPoints: 0
    },
    {
      investorPubKey: "039343bdbb4dbcce4cd383635d3585792b1889f86de364616d2620ad63d95dffc8",
      shares: [2, 0, 0],
      liquidity: 0,
      prevLiquidityPoolState: 0,
      liquidityPoints: 0
    },
    {
      investorPubKey: "03af828d3318abba473c29923b376069a6aea8a361178cc4d2927e7a87e9abb463",
      shares: [0, 10, 0],
      liquidity: 0,
      prevLiquidityPoolState: 8696,
      liquidityPoints: 0
    },
    {
      investorPubKey: "034b4fa85fbbd58c5fea4ee8e9cb52fb759c8fd5ae2c516e512a8010a045438294",
      shares: [12, 0, 0],
      liquidity: 0,
      prevLiquidityPoolState: 8696,
      liquidityPoints: 0
    },
    {
      investorPubKey: "0367b89ec7a5c441431ddbd962623ab3b2c2f72df683bd82caeb837c64eae6e7b2",
      shares: [2, 0, 0],
      liquidity: 0,
      prevLiquidityPoolState: 8696,
      liquidityPoints: 0
    },
    {
      investorPubKey: "02ca1517849a9c5f906c98c87c9befd73d51a688c14f81a3ea30d0aff43e4d98ac",
      shares: [5, 0, 0],
      liquidity: 0,
      prevLiquidityPoolState: 8696,
      liquidityPoints: 0
    },
    {
      investorPubKey: "02f57b408045a1d244c39b085f6d7e4f0ddafe943c17fc3023c99f6a1a03efc306",
      shares: [0, 10, 0],
      liquidity: 0,
      prevLiquidityPoolState: 8696,
      liquidityPoints: 0
    },
    {
      investorPubKey: "02db19c899dbbff6a8831b4c60f5180243870f3a6467bad612311f0c14f59d712d",
      shares: [1, 0, 0],
      liquidity: 0,
      prevLiquidityPoolState: 8696,
      liquidityPoints: 0
    },
    {
      investorPubKey: "0221e1fffce635ca8393ca88f5ce9616cedfb37ef41b5d8823a9a97fcf91dd41f3",
      shares: [0, 10, 0],
      liquidity: 0,
      prevLiquidityPoolState: 8696,
      liquidityPoints: 0
    },
    {
      investorPubKey: "03691ddfd727ddcc991ed5facd49806db88a47541d1cb51fe5819d34e1c9610d69",
      shares: [0, 1, 1],
      liquidity: 10,
      prevLiquidityPoolState: 8696,
      liquidityPoints: 86960
    },
    {
      investorPubKey: "021b1e0d0a75c1ecf3c4ca4321c927bcbecc310f2123689ccfd59ea28e8393478d",
      shares: [0, 1, 1],
      liquidity: 0,
      prevLiquidityPoolState: 8696,
      liquidityPoints: 0
    },
    {
      investorPubKey: "02ecbb03fa1491dbda0bfaf0c3dcac3f69afd3613b369689e585a81007642ad12e",
      shares: [4, 0, 0],
      liquidity: 0,
      prevLiquidityPoolState: 0,
      liquidityPoints: 0
    },
    {
      investorPubKey: "02ec897519c1b15c0078ffe03badf1db9784462cea1b900a3aaeb0db2b2bbd1d7e",
      shares: [1, 0, 0],
      liquidity: 0,
      prevLiquidityPoolState: 0,
      liquidityPoints: 0
    },
    {
      investorPubKey: "032edaf20afb619cc0d115b75a22df6df6a54495293f7f63fad21f61082ef2c4ae",
      shares: [6, 0, 0],
      liquidity: 2,
      prevLiquidityPoolState: 0,
      liquidityPoints: 0
    },
    {
      investorPubKey: "037b16deb3a64a4cdc8b41003f503e0d3fa7a9c9ce8a8b666aa0b6d9e7f2b798fa",
      shares: [0, 2, 0],
      liquidity: 0,
      prevLiquidityPoolState: 0,
      liquidityPoints: 0
    },
    {
      investorPubKey: "03a0b62905f142597e49fcd1352690ff3f0fef24891ac297fd20dd2d02e34e346e",
      shares: [12, 0, 0],
      liquidity: 0,
      prevLiquidityPoolState: 0,
      liquidityPoints: 0
    },
    {
      investorPubKey: "0221d18d27971239432b006aeb4be7211709312bc6d0ae611c59fac4e70164207b",
      shares: [0, 43, 0],
      liquidity: 0,
      prevLiquidityPoolState: 0,
      liquidityPoints: 0
    }
  ]

  const oldEntries: entry[] = oldEntryObjects.map(entry => {
    return {
      publicKey: bsv.PublicKey.fromHex(entry.investorPubKey),
      balance: {
        shares: entry.shares,
        liquidity: entry.liquidity
      },
      globalLiqidityFeePoolSave: entry.prevLiquidityPoolState,
      liquidityPoints: entry.liquidityPoints
    }
  })

  const newEntries: entry[] = newEntryObjects.map(entry => {
    return {
      publicKey: bsv.PublicKey.fromHex(entry.investorPubKey),
      balance: {
        shares: entry.shares,
        liquidity: entry.liquidity
      },
      globalLiqidityFeePoolSave: entry.prevLiquidityPoolState,
      liquidityPoints: entry.liquidityPoints
    }
  })

  const version = marketContracts["49a07371b72a9261b25bd8c16c54d246"]

  const oldMerkleRoot = getMerkleRoot([sha256d("00"), ...oldEntries.map(entry => sha256d(getEntryHex(entry, version)))])
  const newMerkleRoot = getMerkleRoot([sha256d("00"), ...newEntries.map(entry => sha256d(getEntryHex(entry, version)))])

  // console.log(oldMerkleRoot, "c1fe054e64a1f9b52d6a939b27f8d5346b3ec37530a03628fcd5badb8647a1bc")
  // console.log(newMerkleRoot, "fa92ce804e850e38e1d8ec941d19fca50f5aa1def9cdaef55f79ade5fa10a905")
})
