import {
  buildNewMarketTx,
  fundTx,
  isValidMarketTx,
  getUpdateEntryTx,
  getOracleCommitTx,
  getUpdateMarketTx,
  getAddEntryTx,
  isValidMarketUpdateTx,
  getMarketFromScript,
  getOracleVoteTx,
  // getDebugParams,
  getFunctionID,
  getNewOracleTx,
  getOracleUpdateDetailsTx,
  getOracleBurnTx,
  isValidUpdateTx,
  DUST,
  getMarketCreationTx,
  isValidMarketInitOutput,
  isValidOracleInitOutput,
  getDust,
  getUpdateMarketSettingsTx
} from "../src/transaction"
import { RabinSignature, rabinPrivKey, rabinPubKey } from "rabinsig"
import {
  entry,
  getMarketBalance,
  getBalanceMerkleRoot,
  marketInfo,
  getNewMarket,
  creatorInfo,
  marketDetails,
  getNewIndexScript,
  market2JSON,
  getMarketVersion
} from "../src/pm"
import { balance, SatScaling } from "../src/lmsr"
import bsv from "bsv"
import { getSignature, oracleDetail } from "../src/oracle"
import { cloneDeep } from "lodash"
import { addLeaf } from "../src/merkleTree"
import { marketVersion, oracleContracts, currentOracleContract } from "../src/contracts"
import { toHex } from "../src/hex"
import { sha256 } from "../src/sha"

const feeb = 0.5

const rabin = new RabinSignature()

const rabinPrivKey1: rabinPrivKey = {
  p: 3097117482495218740761570398276008894011381249145414887346233174147008460690669803628686127894575795412733149071918669075694907431747167762627687052467n,
  q: 650047001204168007801848889418948532353073326909497585177081016045346562912146630794965372241635285465610094863279373295872825824127728241709483771067n
}

const rabinPrivKey2: rabinPrivKey = {
  p: 5282996768621071377953148561714230757875959595062017918330039194973991105026912034418577469175391947647260152227014115175065212479767996019477136300223n,
  q: 650047001204168007801848889418948532353073326909497585177081016045346562912146630794965372241635285465610094863279373295872825824127728241709483771067n
}

const rabinPubKey1: rabinPubKey = rabin.privKeyToPubKey(rabinPrivKey1.p, rabinPrivKey1.q)
const rabinPubKey2: rabinPubKey = rabin.privKeyToPubKey(rabinPrivKey2.p, rabinPrivKey2.q)

const creatorFee = 1
const liquidityFee = 0.2

const requiredVotes = 50

const privateKey = bsv.PrivateKey.fromString("Kys3cyL5HZ4upzwWsnirv4urUeczpnweiJ2zY5EDBCkRZ5j2TTdj")
const address = privateKey.toAddress()

const utxoData = [
  {
    address: "1KCrKrbmjiyHhx8Wp8zKCqLgAbUV5B8okY",
    txid: "4fdfb21063a59f2c524f5d690b2f3fa728ed4fb5761a3e472839eb4aed367d63",
    vout: 1,
    amount: 100,
    height: 661843,
    confirmations: 82,
    scriptPubKey: "76a914c7b003a282cae060ade434c349f497189b7a71cd88ac",
    script: "76a914c7b003a282cae060ade434c349f497189b7a71cd88ac",
    outputIndex: 1
  }
]

const utxos = utxoData.map(utxo => bsv.Transaction.UnspentOutput.fromObject(utxo))

let oracleDetails: oracleDetail[],
  entry: entry,
  entries: entry[],
  marketCreator: creatorInfo,
  marketDetails: marketDetails,
  market: marketInfo,
  populatedMarket: marketInfo,
  version: marketVersion

const valaIndexScript = getNewIndexScript()
const valaIndexTx = new bsv.Transaction()
valaIndexTx.addOutput(new bsv.Transaction.Output({ script: valaIndexScript, satoshis: DUST }))

beforeEach(() => {
  oracleDetails = [
    {
      pubKey: rabinPubKey1,
      votes: 40,
      voted: false,
      committed: false
    },
    {
      pubKey: rabinPubKey2,
      votes: 60,
      voted: false,
      committed: false
    }
  ]

  marketCreator = {
    pubKey: privateKey.publicKey,
    payoutAddress: bsv.Address.fromString("1KCrKrbmjiyHhx8Wp8zKCqLgAbUV5B8okY")
  }

  marketDetails = {
    resolve: "test",
    details: "Here are some details about this market",
    options: [{ name: "Outcome 1" }, { name: "Outcome 2" }, { name: "Outcome 3" }]
  }

  market = getNewMarket(marketDetails, oracleDetails, marketCreator, creatorFee, liquidityFee, requiredVotes)

  version = getMarketVersion(market.version)

  entry = {
    publicKey: privateKey.publicKey,
    balance: {
      liquidity: 2,
      shares: [1, 0, 0]
    },
    globalLiqidityFeePoolSave: 0,
    liquidityPoints: 0
  }

  entries = [entry]

  populatedMarket = getNewMarket(marketDetails, oracleDetails, marketCreator, creatorFee, liquidityFee, requiredVotes)
  populatedMarket.balance = entry.balance
  populatedMarket.balanceMerkleRoot = getBalanceMerkleRoot([entry], version)
})

test("Convert from and to market hex", () => {
  const complexMarket = cloneDeep(populatedMarket)
  complexMarket.balance = {
    liquidity: 1000,
    shares: [1, 0, 1000]
  }
  complexMarket.status = {
    accLiquidityFeePool: 12345678,
    liquidityFeePool: 123456,
    decided: false,
    liquidityPoints: 123456789,
    decision: 1,
    votes: [0, 1, 0]
  }

  const tx = getMarketCreationTx(complexMarket, valaIndexTx)
  const parsedMarket = getMarketFromScript(tx.outputs[1].script)

  expect(market2JSON(complexMarket)).toStrictEqual(market2JSON(parsedMarket))

  const tx2 = getMarketCreationTx(parsedMarket, valaIndexTx)

  const asm1 = tx.outputs[1].script.toASM().split(" ")
  const asm2 = tx2.outputs[1].script.toASM().split(" ")

  const opReturn1 = asm1.slice(asm1.length - 3, asm1.length)
  const opReturn2 = asm2.slice(asm2.length - 3, asm2.length)

  expect(opReturn1.join(" ")).toBe(opReturn2.join(" "))
  expect(asm1.join(" ")).toBe(asm2.join(" "))
})

test("Parse market from tx", () => {
  const tx = getMarketCreationTx(market, valaIndexTx)
  const parsedMarket = getMarketFromScript(tx.outputs[1].script)
  const tx2 = getMarketCreationTx(parsedMarket, valaIndexTx)

  const asm1 = tx.outputs[1].script.toASM().split(" ")
  const asm2 = tx2.outputs[1].script.toASM().split(" ")

  const opReturn1 = asm1.slice(asm1.length - 3, asm1.length)
  const opReturn2 = asm2.slice(asm2.length - 3, asm2.length)

  expect(opReturn1.join(" ")).toBe(opReturn2.join(" "))
  expect(asm1.join(" ")).toBe(asm2.join(" "))
})

test("build and fund pm init transaction", () => {
  const tx = getMarketCreationTx(market, valaIndexTx)
  fundTx(tx, privateKey, address, utxos)
  expect(isValidMarketTx(tx, [], 1)).toBe(true)
  expect(isValidMarketInitOutput(tx, 1)).toBe(true)
})

test("throw at invalid transaction", () => {
  const tx = getMarketCreationTx(market, valaIndexTx)
  fundTx(tx, privateKey, address, utxos)

  tx.outputs[1].script.chunks.splice(30, 1)

  expect(isValidMarketInitOutput(tx, 1)).toBe(false)
})

test("convert between market and script consistency", () => {
  const tx = getMarketCreationTx(market, valaIndexTx)
  const extractedMarket = getMarketFromScript(tx.outputs[1].script)
  const tx2 = getMarketCreationTx(extractedMarket, valaIndexTx)

  expect(tx2.outputs[1].script.toASM()).toBe(tx.outputs[1].script.toASM())
})

test("add entry", () => {
  const tx = getMarketCreationTx(market, valaIndexTx)
  fundTx(tx, privateKey, address, utxos)

  const publicKey = privateKey.publicKey
  const balance = {
    liquidity: 0,
    shares: [1, 0, 2]
  }

  const newTx = getAddEntryTx(tx, [], publicKey, balance, marketCreator.payoutAddress, utxos, privateKey, 1)

  const newEntries = [
    {
      balance,
      publicKey,
      globalLiqidityFeePoolSave: 0,
      liquidityPoints: 0
    }
  ]

  // console.log(market2JSON(getMarketFromScript(newTx.outputs[0].script)))

  expect(isValidMarketUpdateTx(newTx, tx, newEntries, 1)).toBe(true)
})

test("add entry in old market version", () => {
  // jest.mock('../src/service', () => require('./__mocks__/request'));

  const tx = getMarketCreationTx({ ...market, version: "b7be4afbfb07f03ee23b01289804c1c9" }, valaIndexTx)

  expect(isValidMarketInitOutput(tx, 1)).toBe(true)

  // Replace market version identifier
  // @ts-ignore
  // const opReturnIndex = tx.outputs[1].script.chunks.findIndex(chunk => chunk.opcodenum === bsv.Opcode.OP_RETURN)
  // const helperScript = bsv.Script.fromASM("60be596a82e2a2a752bafcad8ea9567b")
  // tx.outputs[1].script.chunks[opReturnIndex + 1] = helperScript.chunks[0]

  fundTx(tx, privateKey, address, utxos)

  const publicKey = privateKey.publicKey
  const balance = {
    liquidity: 0,
    shares: [1, 0, 2]
  }

  const newTx = getAddEntryTx(tx, [], publicKey, balance, marketCreator.payoutAddress, utxos, privateKey, 1)

  const newEntries = [
    {
      balance,
      publicKey,
      globalLiqidityFeePoolSave: 0,
      liquidityPoints: 0
    }
  ]

  expect(isValidMarketUpdateTx(newTx, tx, newEntries, 1)).toBe(true)
})

test("add entry with liquidity", () => {
  const tx = getMarketCreationTx(market, valaIndexTx)
  fundTx(tx, privateKey, address, utxos)

  const publicKey = privateKey.publicKey
  const balance = {
    liquidity: 1,
    shares: [1, 0, 2]
  }

  const newTx = getAddEntryTx(tx, [], publicKey, balance, marketCreator.payoutAddress, utxos, privateKey, 1)

  const newEntries = [
    {
      balance,
      publicKey,
      globalLiqidityFeePoolSave: 0,
      liquidityPoints: 0
    }
  ]

  expect(isValidMarketUpdateTx(newTx, tx, newEntries, 1)).toBe(true)
})

test("add many entries", () => {
  // Create market

  const tx = getMarketCreationTx(populatedMarket, valaIndexTx)
  fundTx(tx, privateKey, address, utxos)
  expect(isValidMarketTx(tx, entries, 1)).toBe(true)

  // Add entry

  const privateKey2 = bsv.PrivateKey.fromString("L4wrW1PZktcohFrbuACjJVPnEZWnfm9tRbh6qoiVfy1dDPfkVVpC")
  const publicKey2 = privateKey2.publicKey

  const entry2: entry = {
    publicKey: publicKey2,
    balance: {
      liquidity: 0,
      shares: [0, 0, 2]
    },
    globalLiqidityFeePoolSave: 0,
    liquidityPoints: 0
  }

  const tx2 = getAddEntryTx(
    tx,
    entries,
    entry2.publicKey,
    entry2.balance,
    marketCreator.payoutAddress,
    utxos,
    privateKey,
    1
  )

  const entries2 = entries.concat([entry2])

  expect(isValidMarketUpdateTx(tx2, tx, entries2, 1)).toBe(true)
  const market2 = getMarketFromScript(tx2.outputs[0].script)

  // const asm = tx2.outputs[0].script.toASM().split(" ")
  //   console.log(asm.splice(asm.length -4, asm.length))

  const privateKey3 = bsv.PrivateKey.fromString("L15k8C9bTzgG2xXDbxGyQbVL7asiPkeMAdrEwYCw7CHCNaEK1RGi")
  const publicKey3 = privateKey3.publicKey

  const entry3: entry = {
    publicKey: publicKey3,
    balance: {
      liquidity: 0,
      shares: [0, 1, 0]
    },
    globalLiqidityFeePoolSave: market2.status.accLiquidityFeePool,
    liquidityPoints: 0
  }

  const tx3 = getAddEntryTx(
    tx2,
    entries2,
    entry3.publicKey,
    entry3.balance,
    marketCreator.payoutAddress,
    utxos,
    privateKey,
    0
  )

  const entries3 = entries2.concat([entry3])

  expect(isValidMarketUpdateTx(tx3, tx2, entries3, 0)).toBe(true)

  const market3 = getMarketFromScript(tx3.outputs[0].script)

  // const asm = tx2.outputs[0].script.toASM().split(" ")
  //   console.log(asm.splice(asm.length -4, asm.length))

  const privateKey4 = bsv.PrivateKey.fromString("KxKqXsGr7MqXfreojbr1gnJMm7TwkSbmvbN1YR3A8AXnWPigBgWT")
  const publicKey4 = privateKey4.publicKey

  const entry4: entry = {
    publicKey: publicKey4,
    balance: {
      liquidity: 0,
      shares: [0, 1, 0]
    },
    globalLiqidityFeePoolSave: market3.status.accLiquidityFeePool,
    liquidityPoints: 0
  }

  const tx4 = getAddEntryTx(
    tx3,
    entries3,
    entry4.publicKey,
    entry4.balance,
    marketCreator.payoutAddress,
    utxos,
    privateKey,
    0
  )

  const entries4 = entries3.concat([entry4])

  expect(isValidMarketUpdateTx(tx4, tx3, entries4, 0)).toBe(true)

  const market4 = getMarketFromScript(tx4.outputs[0].script)

  // const asm = tx2.outputs[0].script.toASM().split(" ")
  //   console.log(asm.splice(asm.length -4, asm.length))

  const privateKey5 = bsv.PrivateKey.fromString("L3xc2QB9qqsYpwQQqfitSNTXbwRnJSBgrSd2dveJFMWWJZTJwobT")
  const publicKey5 = privateKey5.publicKey

  const entry5: entry = {
    publicKey: publicKey5,
    balance: {
      liquidity: 0,
      shares: [1, 0, 0]
    },
    globalLiqidityFeePoolSave: market4.status.accLiquidityFeePool,
    liquidityPoints: 0
  }

  const tx5 = getAddEntryTx(
    tx4,
    entries4,
    entry5.publicKey,
    entry5.balance,
    marketCreator.payoutAddress,
    utxos,
    privateKey,
    0
  )

  const entries5 = entries4.concat([entry5])

  // const asm5 = tx5.outputs[0].script.toASM().split(" ")
  // console.log(asm5.slice(asm5.length-4, asm5.length))
  // console.log(tx5.outputs)

  expect(isValidMarketUpdateTx(tx5, tx4, entries5, 0)).toBe(true)
})

test("update entry (buy)", () => {
  const tx = buildNewMarketTx(populatedMarket)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 2,
    shares: [1, 0, 2]
  }

  const newTx = getUpdateEntryTx(
    tx,
    entries,
    newBalance,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  const newEntry: entry = cloneDeep(entries[0])
  newEntry.balance = newBalance

  const newEntries = [newEntry]

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
})

test("update entry (sell)", () => {
  const tx = buildNewMarketTx(populatedMarket)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 2,
    shares: [0, 0, 0]
  }

  const newTx = getUpdateEntryTx(
    tx,
    entries,
    newBalance,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  const newEntry: entry = cloneDeep(entries[0])
  newEntry.balance = newBalance
  newEntry.liquidityPoints = 1642
  newEntry.globalLiqidityFeePoolSave = 821

  const newEntries = [newEntry]

  // console.log(getDebugParams(newTx))

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
})

test("update entry (sell) with no liquidity fee", () => {
  const populatedMarket = getNewMarket(marketDetails, oracleDetails, marketCreator, creatorFee, 0, requiredVotes)
  populatedMarket.balance = entry.balance
  populatedMarket.balanceMerkleRoot = getBalanceMerkleRoot([entry], version)

  const tx = buildNewMarketTx(populatedMarket)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 2,
    shares: [0, 0, 0]
  }

  const newTx = getUpdateEntryTx(
    tx,
    entries,
    newBalance,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  const newEntry: entry = cloneDeep(entries[0])
  newEntry.balance = newBalance

  const newEntries = [newEntry]

  // console.log(getDebugParams(newTx))

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
})

test("update entry (sell) with no market fee", () => {
  const populatedMarket = getNewMarket(marketDetails, oracleDetails, marketCreator, 0, liquidityFee, requiredVotes)
  populatedMarket.balance = entry.balance
  populatedMarket.balanceMerkleRoot = getBalanceMerkleRoot([entry], version)

  const tx = buildNewMarketTx(populatedMarket)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 2,
    shares: [0, 0, 0]
  }

  const newTx = getUpdateEntryTx(
    tx,
    entries,
    newBalance,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  const newEntry: entry = cloneDeep(entries[0])
  newEntry.balance = newBalance
  newEntry.liquidityPoints = 1642
  newEntry.globalLiqidityFeePoolSave = 821

  const newEntries = [newEntry]

  // console.log(getDebugParams(newTx))

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
})

test("add a lots of liquidty", () => {
  const tx = buildNewMarketTx(populatedMarket)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 2000,
    shares: [1, 0, 2]
  }

  const newTx = getUpdateEntryTx(
    tx,
    entries,
    newBalance,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  const newEntry: entry = cloneDeep(entries[0])
  newEntry.balance = newBalance

  const newEntries = [newEntry]

  // console.log(getDebugParams(newTx))

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
})

test("Set accurate fee per byte on adding", () => {
  const tx = getMarketCreationTx(market, valaIndexTx)
  fundTx(tx, privateKey, address, utxos)

  const publicKey = privateKey.publicKey
  const balance = {
    liquidity: 0,
    shares: [1, 0, 2]
  }

  const newTx = getAddEntryTx(tx, [], publicKey, balance, marketCreator.payoutAddress, utxos, privateKey, 1, 0.1)

  const size = newTx.uncheckedSerialize().length / 2
  const fee = newTx.inputAmount - newTx.outputAmount

  expect(fee).toBeGreaterThan(size * 0.1)
  expect(fee).toBeLessThan(size * 0.15)
})

test("Set accurate fee per byte on update", () => {
  const tx = buildNewMarketTx(populatedMarket)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 2,
    shares: [1, 0, 2]
  }

  const newTx = getUpdateEntryTx(
    tx,
    entries,
    newBalance,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey,
    0.1
  )

  const size = newTx.uncheckedSerialize().length / 2
  const fee = newTx.inputAmount - newTx.outputAmount

  expect(fee).toBeGreaterThan(size * 0.1)
  expect(fee).toBeLessThan(size * 0.15)
})

test("update entry and sell liquidity", () => {
  const tx = buildNewMarketTx(populatedMarket)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 1,
    shares: [1, 0, 0]
  }

  const newTx = getUpdateEntryTx(
    tx,
    entries,
    newBalance,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  const newMarket = getMarketFromScript(newTx.outputs[0].script)
  const newEntry: entry = cloneDeep(entries[0])
  newEntry.balance = newBalance
  newEntry.globalLiqidityFeePoolSave = newMarket.status.accLiquidityFeePool
  newEntry.liquidityPoints = newMarket.status.liquidityPoints

  const newEntries = [newEntry]

  // console.log(newTx.outputs.slice(1).map(output => output.script.toHex()))

  // console.log(getDebugParams(newTx))

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
  expect(newMarket.status.accLiquidityFeePool).toBe(0) // No fees collected
  expect(newMarket.status.liquidityPoints).toBe(0)
})

test("update entry and sell all liqudity", () => {
  const tx = buildNewMarketTx(populatedMarket)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 0,
    shares: [1, 0, 0]
  }

  const newTx = getUpdateEntryTx(
    tx,
    entries,
    newBalance,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  // console.log(newTx.outputs[0].satoshis)
  // console.log(getMarketFromScript(newTx.outputs[0].script))

  const newMarket = getMarketFromScript(newTx.outputs[0].script)
  const newEntry: entry = cloneDeep(entries[0])
  newEntry.balance = newBalance
  newEntry.globalLiqidityFeePoolSave = newMarket.status.accLiquidityFeePool
  newEntry.liquidityPoints = newMarket.status.liquidityPoints

  const newEntries = [newEntry]

  // console.log(getDebugParams(newTx))

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
  expect(newMarket.status.accLiquidityFeePool).toBe(0) // Fees collected, because shares changed as well
  expect(newMarket.status.liquidityPoints).toBe(0)
})

test("update entry and sell all liqudity and buy shares", () => {
  const tx = buildNewMarketTx(populatedMarket)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 0,
    shares: [1, 0, 2]
  }

  const newTx = getUpdateEntryTx(
    tx,
    entries,
    newBalance,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  // console.log(newTx.outputs[0].satoshis)
  // console.log(getMarketFromScript(newTx.outputs[0].script))

  const newMarket = getMarketFromScript(newTx.outputs[0].script)
  const newEntry: entry = cloneDeep(entries[0])
  newEntry.balance = newBalance
  newEntry.globalLiqidityFeePoolSave = newMarket.status.accLiquidityFeePool
  newEntry.liquidityPoints = newMarket.status.liquidityPoints

  const newEntries = [newEntry]

  // console.log(getDebugParams(newTx))

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
  expect(newMarket.status.accLiquidityFeePool).toBeGreaterThan(0) // Fees collected, because shares changed as well
  expect(newMarket.status.liquidityPoints).toBeGreaterThan(0)
})
test("update entry and sell all liqudity but some liquidity remains", () => {
  const entry2 = {
    publicKey: bsv.PrivateKey.fromString("L3KWX37j9v89ZUyguBGTU2WVa3xSB7f9n2ATg1jybcUpZWujRNKm").publicKey,
    balance: {
      liquidity: 1,
      shares: [0, 0, 0]
    },
    globalLiqidityFeePoolSave: 0,
    liquidityPoints: 0
  }

  const entries = [entry, entry2]

  const market = getNewMarket(marketDetails, oracleDetails, marketCreator, creatorFee, liquidityFee, requiredVotes)
  market.balance = getMarketBalance(entries, 3)
  market.balanceMerkleRoot = getBalanceMerkleRoot(entries, version)

  const tx = buildNewMarketTx(market)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 0,
    shares: [1, 0, 0]
  }

  const newTx = getUpdateEntryTx(
    tx,
    entries,
    newBalance,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  // console.log(newTx.outputs[0].satoshis)
  // console.log(getMarketFromScript(newTx.outputs[0].script))

  const newMarket = getMarketFromScript(newTx.outputs[0].script)
  const newEntry: entry = cloneDeep(entries[0])
  newEntry.balance = newBalance

  const newEntries = [newEntry, entry2]

  // console.log(getDebugParams(newTx))

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
  expect(newMarket.status.accLiquidityFeePool).toBe(0) // Fees collected, because shares changed as well
  expect(newMarket.status.liquidityPoints).toBe(0)
})

test("update entry (buy) with other entry existing", () => {
  const entry2 = {
    publicKey: bsv.PrivateKey.fromString("L3KWX37j9v89ZUyguBGTU2WVa3xSB7f9n2ATg1jybcUpZWujRNKm").publicKey,
    balance: {
      liquidity: 1,
      shares: [0, 0, 0]
    },
    globalLiqidityFeePoolSave: 0,
    liquidityPoints: 0
  }

  const entries = [entry, entry2]

  const market = getNewMarket(marketDetails, oracleDetails, marketCreator, creatorFee, liquidityFee, requiredVotes)
  market.balance = getMarketBalance(entries, 3)
  market.balanceMerkleRoot = getBalanceMerkleRoot(entries, version)

  const tx = buildNewMarketTx(market)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 2,
    shares: [1, 0, 2]
  }

  const newTx = getUpdateEntryTx(
    tx,
    entries,
    newBalance,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  // console.log(newTx.outputs[0].satoshis)
  // console.log(getMarketFromScript(newTx.outputs[0].script))

  const newMarket = getMarketFromScript(newTx.outputs[0].script)
  const newEntry: entry = cloneDeep(entries[0])
  newEntry.balance = newBalance
  newEntry.globalLiqidityFeePoolSave = newMarket.status.accLiquidityFeePool
  newEntry.liquidityPoints = newMarket.status.liquidityPoints

  const newEntries = [newEntry, entry2]

  // console.log(getDebugParams(newTx))

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
  expect(newMarket.status.accLiquidityFeePool).toBe(0)
  expect(newMarket.status.liquidityPoints).toBe(0)
})

test("update entry (sell) with other entry existing", () => {
  const entry2 = {
    publicKey: bsv.PrivateKey.fromString("L3KWX37j9v89ZUyguBGTU2WVa3xSB7f9n2ATg1jybcUpZWujRNKm").publicKey,
    balance: {
      liquidity: 1,
      shares: [0, 0, 0]
    },
    globalLiqidityFeePoolSave: 0,
    liquidityPoints: 0
  }

  const entries = [entry, entry2]

  const market = getNewMarket(marketDetails, oracleDetails, marketCreator, creatorFee, liquidityFee, requiredVotes)
  market.balance = getMarketBalance(entries, 3)
  market.balanceMerkleRoot = getBalanceMerkleRoot(entries, version)

  const tx = buildNewMarketTx(market)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 1,
    shares: [0, 0, 0]
  }

  const newTx = getUpdateEntryTx(
    tx,
    entries,
    newBalance,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  // console.log(newTx.outputs[0].satoshis)
  // console.log(getMarketFromScript(newTx.outputs[0].script))

  const newMarket = getMarketFromScript(newTx.outputs[0].script)
  const newEntry: entry = cloneDeep(entry)
  newEntry.balance = newBalance
  newEntry.globalLiqidityFeePoolSave = newMarket.status.accLiquidityFeePool
  newEntry.liquidityPoints = 6166

  const newEntries = [newEntry, entry2]

  // console.log(getDebugParams(newTx))

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
  expect(newMarket.status.accLiquidityFeePool).toBeGreaterThan(0) // Fees collected, because shares changed as well
  expect(newMarket.status.liquidityPoints).toBeGreaterThan(0)
})

test("update to invalid balance", () => {
  const tx = buildNewMarketTx(populatedMarket)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 2,
    shares: [1, 0, -1]
  }

  expect(() =>
    getUpdateEntryTx(tx, entries, newBalance, false, privateKey, marketCreator.payoutAddress, utxos, privateKey)
  ).toThrow()
})

test("oracle commitment", () => {
  const tx = getMarketCreationTx(populatedMarket, valaIndexTx)
  fundTx(tx, privateKey, address, utxos)

  const newTx = getOracleCommitTx(tx, rabinPrivKey1, address, utxos, privateKey, 1)
  const newMarket = getMarketFromScript(newTx.outputs[0].script)

  expect(newMarket.oracles[0].committed).toBe(true)
  expect(isValidMarketUpdateTx(newTx, tx, entries, 1)).toBe(true)
})

test("oracle vote succeeds", () => {
  const committedMarket: marketInfo = cloneDeep(populatedMarket)
  committedMarket.oracles[0].committed = true

  const tx = buildNewMarketTx(committedMarket)
  fundTx(tx, privateKey, address, utxos)

  const vote = 1

  const newTx = getOracleVoteTx(tx, vote, rabinPrivKey1, address, utxos, privateKey)
  const newMarket = getMarketFromScript(newTx.outputs[0].script)
  const newVotes = committedMarket.status.votes[vote] + committedMarket.oracles[0].votes

  expect(newMarket.status.decided).toBe(false)
  expect(newMarket.oracles[0].voted).toBe(true)
  expect(newMarket.status.votes[vote]).toBe(newVotes)
  expect(isValidMarketUpdateTx(newTx, tx, entries)).toBe(true)
})

test("oracle vote not possible without commitment", () => {
  const tx = buildNewMarketTx(populatedMarket)
  fundTx(tx, privateKey, address, utxos)

  const vote = 1

  expect(() => getOracleVoteTx(tx, vote, rabinPrivKey1, address, utxos, privateKey)).toThrow()
})

test("oracle vote and market resolve", () => {
  const committedMarket: marketInfo = cloneDeep(populatedMarket)
  committedMarket.oracles[0].committed = true
  committedMarket.requiredVotes = 40

  const tx = buildNewMarketTx(committedMarket)
  fundTx(tx, privateKey, address, utxos)

  const vote = 1

  const newTx = getOracleVoteTx(tx, vote, rabinPrivKey1, address, utxos, privateKey)
  const newMarket = getMarketFromScript(newTx.outputs[0].script)
  const newVotes = committedMarket.status.votes[vote] + committedMarket.oracles[0].votes

  expect(newMarket.status.decided).toBe(true)
  expect(newMarket.oracles[0].voted).toBe(true)
  expect(newMarket.status.votes[vote]).toBe(newVotes)
  expect(isValidMarketUpdateTx(newTx, tx, entries)).toBe(true)
})

test("Two oracles vote and market resolve", () => {
  const committedMarket: marketInfo = cloneDeep(populatedMarket)
  committedMarket.oracles[0].committed = true
  committedMarket.oracles[1].committed = true

  const tx = buildNewMarketTx(committedMarket)
  fundTx(tx, privateKey, address, utxos)

  const vote = 2

  const newTx = getOracleVoteTx(tx, vote, rabinPrivKey1, address, utxos, privateKey)
  const newMarket = getMarketFromScript(newTx.outputs[0].script)

  expect(newMarket.status.decided).toBe(false)

  const newTx2 = getOracleVoteTx(newTx, vote, rabinPrivKey2, address, utxos, privateKey)
  const newMarket2 = getMarketFromScript(newTx2.outputs[0].script)

  expect(newMarket2.status.decided).toBe(true)
  expect(isValidMarketUpdateTx(newTx2, newTx, entries)).toBe(true)
})

test("redeem winning shares", () => {
  const entry = {
    publicKey: privateKey.publicKey,
    balance: {
      liquidity: 2,
      shares: [1, 0, 2]
    },
    globalLiqidityFeePoolSave: 0,
    liquidityPoints: 0
  }

  const localMarketCreator = cloneDeep(marketCreator)
  localMarketCreator.pubKey = bsv.PrivateKey.fromString(
    "L3KWX37j9v89ZUyguBGTU2WVa3xSB7f9n2ATg1jybcUpZWujRNKm"
  ).publicKey

  const resolvedMarket = getNewMarket(
    marketDetails,
    oracleDetails,
    localMarketCreator,
    creatorFee,
    liquidityFee,
    requiredVotes
  )
  resolvedMarket.status.decided = true
  resolvedMarket.status.decision = 2
  resolvedMarket.balance = entry.balance
  resolvedMarket.balanceMerkleRoot = getBalanceMerkleRoot([entry], version)

  const tx = buildNewMarketTx(resolvedMarket)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 2,
    shares: [0, 0, 0]
  }

  const newTx = getUpdateEntryTx(
    tx,
    [entry],
    newBalance,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  const newMarket = getMarketFromScript(newTx.outputs[0].script)
  const newEntry: entry = cloneDeep(entries[0])
  newEntry.balance = newBalance
  newEntry.globalLiqidityFeePoolSave = newMarket.status.accLiquidityFeePool
  newEntry.liquidityPoints = newMarket.status.liquidityPoints

  const newEntries = [newEntry]

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
})

test("redeem invalid shares (deprecated)", () => {
  // This is deprecated. Just check that nothing changes.

  const entry = {
    publicKey: privateKey.publicKey,
    balance: {
      liquidity: 2,
      shares: [1, 0, 2]
    },
    globalLiqidityFeePoolSave: 0,
    liquidityPoints: 0
  }

  const resolvedMarket = getNewMarket(
    marketDetails,
    oracleDetails,
    marketCreator,
    creatorFee,
    liquidityFee,
    requiredVotes
  )
  resolvedMarket.status.decided = true
  resolvedMarket.status.decision = 2
  resolvedMarket.balance = entry.balance
  resolvedMarket.balanceMerkleRoot = getBalanceMerkleRoot([entry], version)

  const tx = buildNewMarketTx(resolvedMarket)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 2,
    shares: [0, 0, 2]
  }

  const newTx = getUpdateEntryTx(
    tx,
    [entry],
    newBalance,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  const newMarket = getMarketFromScript(newTx.outputs[0].script)
  const newEntry: entry = cloneDeep(entries[0])
  newEntry.balance = newBalance
  newEntry.globalLiqidityFeePoolSave = newMarket.status.accLiquidityFeePool
  newEntry.liquidityPoints = newMarket.status.liquidityPoints

  const newEntries = [newEntry]

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
  expect(newTx.outputs[0].satoshis).toBe(tx.outputs[0].satoshis)
})

test("sell all liquidity after market is resolved", () => {
  const entry = {
    publicKey: privateKey.publicKey,
    balance: {
      liquidity: 2,
      shares: [1, 0, 2]
    },
    globalLiqidityFeePoolSave: 0,
    liquidityPoints: 0
  }

  const localMarketCreator = cloneDeep(marketCreator)
  localMarketCreator.pubKey = bsv.PrivateKey.fromString(
    "L3KWX37j9v89ZUyguBGTU2WVa3xSB7f9n2ATg1jybcUpZWujRNKm"
  ).publicKey

  const resolvedMarket = getNewMarket(
    marketDetails,
    oracleDetails,
    localMarketCreator,
    creatorFee,
    liquidityFee,
    requiredVotes
  )
  resolvedMarket.status.decided = true
  resolvedMarket.status.decision = 2
  resolvedMarket.balance = entry.balance
  resolvedMarket.balanceMerkleRoot = getBalanceMerkleRoot([entry], version)

  const tx = buildNewMarketTx(resolvedMarket)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 0,
    shares: [0, 0, 2]
  }

  const newTx = getUpdateEntryTx(
    tx,
    [entry],
    newBalance,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  const newMarket = getMarketFromScript(newTx.outputs[0].script)
  const newEntry: entry = cloneDeep(entries[0])
  newEntry.balance = newBalance
  newEntry.globalLiqidityFeePoolSave = newMarket.status.accLiquidityFeePool
  newEntry.liquidityPoints = newMarket.status.liquidityPoints

  const newEntries = [newEntry]

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
  expect(newTx.outputs[0].satoshis).toBe(2 * SatScaling + newMarket.status.liquidityFeePool)
})

test("sell partial liquidity after market is resolved", () => {
  const entry = {
    publicKey: privateKey.publicKey,
    balance: {
      liquidity: 2,
      shares: [1, 0, 2]
    },
    globalLiqidityFeePoolSave: 0,
    liquidityPoints: 0
  }

  const localMarketCreator = cloneDeep(marketCreator)
  localMarketCreator.pubKey = bsv.PrivateKey.fromString(
    "L3KWX37j9v89ZUyguBGTU2WVa3xSB7f9n2ATg1jybcUpZWujRNKm"
  ).publicKey

  const resolvedMarket = getNewMarket(
    marketDetails,
    oracleDetails,
    localMarketCreator,
    creatorFee,
    liquidityFee,
    requiredVotes
  )
  resolvedMarket.status.decided = true
  resolvedMarket.status.decision = 2
  resolvedMarket.balance = entry.balance
  resolvedMarket.balanceMerkleRoot = getBalanceMerkleRoot([entry], version)

  const tx = buildNewMarketTx(resolvedMarket)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 1,
    shares: [0, 0, 2]
  }

  const newTx = getUpdateEntryTx(
    tx,
    [entry],
    newBalance,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  const newMarket = getMarketFromScript(newTx.outputs[0].script)
  const newEntry: entry = cloneDeep(entries[0])
  newEntry.balance = newBalance
  newEntry.globalLiqidityFeePoolSave = newMarket.status.accLiquidityFeePool
  newEntry.liquidityPoints = newMarket.status.liquidityPoints

  const newEntries = [newEntry]

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
  const prevMarketSatBalance = 2 * SatScaling + newMarket.status.liquidityFeePool
  const satDiff = tx.outputs[0].satoshis - prevMarketSatBalance
  expect(newTx.outputs[0].satoshis).toBe(2 * SatScaling + newMarket.status.liquidityFeePool + satDiff / 2)
})

test("Market creator can sell liquidity after market is resolved", () => {
  const entry = {
    publicKey: privateKey.publicKey,
    balance: {
      liquidity: 2,
      shares: [1, 0, 2]
    },
    globalLiqidityFeePoolSave: 0,
    liquidityPoints: 0
  }

  const resolvedMarket = getNewMarket(
    marketDetails,
    oracleDetails,
    marketCreator,
    creatorFee,
    liquidityFee,
    requiredVotes
  )
  resolvedMarket.status.decided = true
  resolvedMarket.status.decision = 2
  resolvedMarket.balance = entry.balance
  resolvedMarket.balanceMerkleRoot = getBalanceMerkleRoot([entry], version)

  const tx = buildNewMarketTx(resolvedMarket)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 0,
    shares: [0, 0, 2]
  }

  const newTx = getUpdateEntryTx(
    tx,
    [entry],
    newBalance,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  const newMarket = getMarketFromScript(newTx.outputs[0].script)
  const newEntry: entry = cloneDeep(entries[0])
  newEntry.balance = newBalance
  newEntry.globalLiqidityFeePoolSave = newMarket.status.accLiquidityFeePool
  newEntry.liquidityPoints = newMarket.status.liquidityPoints

  const newEntries = [newEntry]

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
})

test("can't sell liquidity and redeem shares after market is resolved", () => {
  const entry = {
    publicKey: privateKey.publicKey,
    balance: {
      liquidity: 2,
      shares: [1, 0, 2]
    },
    globalLiqidityFeePoolSave: 0,
    liquidityPoints: 0
  }

  const localMarketCreator = cloneDeep(marketCreator)
  localMarketCreator.pubKey = bsv.PrivateKey.fromString(
    "L3KWX37j9v89ZUyguBGTU2WVa3xSB7f9n2ATg1jybcUpZWujRNKm"
  ).publicKey

  const resolvedMarket = getNewMarket(
    marketDetails,
    oracleDetails,
    localMarketCreator,
    creatorFee,
    liquidityFee,
    requiredVotes
  )
  resolvedMarket.status.decided = true
  resolvedMarket.status.decision = 2
  resolvedMarket.balance = entry.balance
  resolvedMarket.balanceMerkleRoot = getBalanceMerkleRoot([entry], version)

  const tx = buildNewMarketTx(resolvedMarket)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 0,
    shares: [1, 0, 0]
  }

  const getNewTx = () =>
    getUpdateEntryTx(tx, [entry], newBalance, false, privateKey, marketCreator.payoutAddress, utxos, privateKey)

  expect(getNewTx).toThrow()

  // const newEntry: entry = cloneDeep(entry)
  // newEntry.balance = newBalance

  // const newEntries = [newEntry]

  // expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(false)
})

test("Redeem winning shares after loosing shares", () => {
  const entry = {
    publicKey: privateKey.publicKey,
    balance: {
      liquidity: 0,
      shares: [1, 1, 1]
    },
    globalLiqidityFeePoolSave: 0,
    liquidityPoints: 0
  }

  // const localMarketCreator = cloneDeep(marketCreator)
  // localMarketCreator.pubKey = bsv.PrivateKey.fromString(
  //   "L3KWX37j9v89ZUyguBGTU2WVa3xSB7f9n2ATg1jybcUpZWujRNKm"
  // ).publicKey

  const resolvedMarket = getNewMarket(
    marketDetails,
    oracleDetails,
    marketCreator,
    // localMarketCreator,
    creatorFee,
    liquidityFee,
    requiredVotes
  )
  resolvedMarket.status.decided = true
  resolvedMarket.status.decision = 0
  resolvedMarket.balance = {
    liquidity: 0,
    shares: [1, 0, 0]
  }
  resolvedMarket.balanceMerkleRoot = getBalanceMerkleRoot([entry], version)

  const tx = buildNewMarketTx(resolvedMarket)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 0,
    shares: [0, 0, 0]
  }

  const newTx = getUpdateEntryTx(
    tx,
    [entry],
    newBalance,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  const newMarket = getMarketFromScript(newTx.outputs[0].script)
  const newEntry: entry = cloneDeep(entries[0])
  newEntry.balance = newBalance
  newEntry.globalLiqidityFeePoolSave = newMarket.status.accLiquidityFeePool
  newEntry.liquidityPoints = newMarket.status.liquidityPoints

  const newEntries = [newEntry]

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
})

test("Redeem liquidity before redeeming winning shares", () => {
  const entry = {
    publicKey: privateKey.publicKey,
    balance: {
      liquidity: 2,
      shares: [0, 1, 0]
    },
    globalLiqidityFeePoolSave: 0,
    liquidityPoints: 0
  }

  const resolvedMarket = getNewMarket(
    marketDetails,
    oracleDetails,
    marketCreator,
    creatorFee,
    liquidityFee,
    requiredVotes
  )
  resolvedMarket.status.decided = true
  resolvedMarket.status.decision = 1
  resolvedMarket.balance = entry.balance
  resolvedMarket.balanceMerkleRoot = getBalanceMerkleRoot([entry], version)

  const tx = buildNewMarketTx(resolvedMarket)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 0,
    shares: [0, 1, 0]
  }

  const newTx = getUpdateEntryTx(
    tx,
    [entry],
    newBalance,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  const newMarket = getMarketFromScript(newTx.outputs[0].script)
  const newEntry: entry = cloneDeep(entries[0])
  newEntry.balance = newBalance
  newEntry.globalLiqidityFeePoolSave = newMarket.status.accLiquidityFeePool
  newEntry.liquidityPoints = newMarket.status.liquidityPoints

  const newEntries = [newEntry]

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
})

test("Redeem liquidity while global winning shares are not 0", () => {
  const entry = {
    publicKey: privateKey.publicKey,
    balance: {
      liquidity: 2,
      shares: [0, 0, 0]
    },
    globalLiqidityFeePoolSave: 0,
    liquidityPoints: 0
  }

  const resolvedMarket = getNewMarket(
    marketDetails,
    oracleDetails,
    marketCreator,
    creatorFee,
    liquidityFee,
    requiredVotes
  )
  resolvedMarket.status.decided = true
  resolvedMarket.status.decision = 1
  resolvedMarket.balance = {
    liquidity: 2,
    shares: [0, 1, 0]
  }
  resolvedMarket.balanceMerkleRoot = getBalanceMerkleRoot([entry], version)

  const tx = buildNewMarketTx(resolvedMarket)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 0,
    shares: [0, 0, 0]
  }

  const newTx = getUpdateEntryTx(
    tx,
    [entry],
    newBalance,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  const newMarket = getMarketFromScript(newTx.outputs[0].script)
  const newEntry: entry = cloneDeep(entries[0])
  newEntry.balance = newBalance
  newEntry.globalLiqidityFeePoolSave = newMarket.status.accLiquidityFeePool
  newEntry.liquidityPoints = newMarket.status.liquidityPoints

  const newEntries = [newEntry]

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
})

test("liquidity points generation", () => {
  const entry1: entry = {
    publicKey: privateKey.publicKey,
    balance: {
      liquidity: 2,
      shares: [1, 0, 2]
    },
    globalLiqidityFeePoolSave: 0,
    liquidityPoints: 0
  }

  const market1 = getNewMarket(
    marketDetails,
    oracleDetails,
    marketCreator,
    // localMarketCreator,
    creatorFee,
    liquidityFee,
    requiredVotes
  )

  market1.balanceMerkleRoot = getBalanceMerkleRoot([entry1], version)
  market1.balance = entry1.balance

  const tx1 = buildNewMarketTx(market1)
  fundTx(tx1, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 2,
    shares: [1, 0, 0]
  }

  const tx2 = getUpdateEntryTx(
    tx1,
    [entry1],
    newBalance,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  const newMarket = getMarketFromScript(tx2.outputs[0].script)
  const newEntry: entry = cloneDeep(entry1)
  newEntry.balance = newBalance
  newEntry.globalLiqidityFeePoolSave = newMarket.status.accLiquidityFeePool
  newEntry.liquidityPoints = newMarket.status.liquidityPoints

  const newEntries = [newEntry]
  const market2 = getMarketFromScript(tx2.outputs[0].script)

  expect(market2.status.accLiquidityFeePool > 0).toBe(true)
  expect(market2.status.liquidityFeePool > 0).toBe(true)
  expect(market2.status.liquidityPoints > 0).toBe(true)
  expect(isValidMarketUpdateTx(tx2, tx1, newEntries)).toBe(true)
})

test("liquidity points redeeming", () => {
  const entry1: entry = {
    publicKey: privateKey.publicKey,
    balance: {
      liquidity: 2,
      shares: [1, 0, 2]
    },
    globalLiqidityFeePoolSave: 0,
    liquidityPoints: 1000
  }

  const market1 = getNewMarket(
    marketDetails,
    oracleDetails,
    marketCreator,
    // localMarketCreator,
    creatorFee,
    liquidityFee,
    requiredVotes
  )

  market1.balance = entry1.balance
  market1.balanceMerkleRoot = getBalanceMerkleRoot([entry1], version)

  market1.status.accLiquidityFeePool = 1000
  market1.status.liquidityFeePool = 1000
  market1.status.liquidityPoints = 10000

  const tx1 = buildNewMarketTx(market1)
  fundTx(tx1, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 2,
    shares: [1, 0, 2]
  }

  const tx2 = getUpdateEntryTx(
    tx1,
    [entry1],
    newBalance,
    true,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  const newEntry: entry = cloneDeep(entry1)
  newEntry.balance = newBalance
  newEntry.globalLiqidityFeePoolSave = 1000
  newEntry.liquidityPoints = 0

  const newEntries = [newEntry]
  const market2 = getMarketFromScript(tx2.outputs[0].script)

  expect(isValidMarketUpdateTx(tx2, tx1, newEntries)).toBe(true)
  expect(market2.status.accLiquidityFeePool).toBe(1000)
  expect(market2.status.liquidityFeePool).toBe(701) // script calculations result in 1 less sat
  expect(market2.status.liquidityPoints).toBe(7000)
})

test("full market graph", () => {
  // Create market

  const tx = getMarketCreationTx(populatedMarket, valaIndexTx)
  fundTx(tx, privateKey, address, utxos)
  expect(isValidMarketTx(tx, entries, 1)).toBe(true)

  // Add entry

  const privateKey2 = bsv.PrivateKey.fromString("L4wrW1PZktcohFrbuACjJVPnEZWnfm9tRbh6qoiVfy1dDPfkVVpC")
  const publicKey2 = privateKey2.publicKey

  const entry2: entry = {
    publicKey: publicKey2,
    balance: {
      liquidity: 0,
      shares: [0, 0, 2]
    },
    globalLiqidityFeePoolSave: 0,
    liquidityPoints: 0
  }

  const tx2 = getAddEntryTx(
    tx,
    entries,
    entry2.publicKey,
    entry2.balance,
    marketCreator.payoutAddress,
    utxos,
    privateKey,
    1
  )

  const entries2 = entries.concat([entry2])

  expect(isValidMarketUpdateTx(tx2, tx, entries2, 1)).toBe(true)

  // Update entry - buy

  const balance3: balance = {
    liquidity: 2,
    shares: [1, 2, 2]
  }

  const tx3 = getUpdateEntryTx(
    tx2,
    entries2,
    balance3,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  const entry3: entry = {
    publicKey: privateKey.publicKey,
    balance: balance3,
    globalLiqidityFeePoolSave: 0,
    liquidityPoints: 0
  }

  const entries3 = [entry3, entry2]

  expect(isValidMarketUpdateTx(tx3, tx2, entries3)).toBe(true)

  // Change liquidity

  const balance4: balance = {
    liquidity: 3,
    shares: [1, 2, 2]
  }

  const tx4 = getUpdateEntryTx(
    tx3,
    entries3,
    balance4,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  const entry4: entry = {
    publicKey: privateKey.publicKey,
    balance: balance4,
    globalLiqidityFeePoolSave: 0,
    liquidityPoints: 0
  }

  const entries4 = [entry4, entry2]

  expect(isValidMarketUpdateTx(tx4, tx3, entries4)).toBe(true)

  // Update entry - sell

  const balance5: balance = {
    liquidity: 3,
    shares: [1, 0, 2]
  }

  const tx5 = getUpdateEntryTx(
    tx4,
    entries4,
    balance5,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  const entry5: entry = {
    publicKey: privateKey.publicKey,
    balance: balance5,
    globalLiqidityFeePoolSave: 896,
    liquidityPoints: 2688
  }

  const entries5 = [entry5, entry2]
  const market5 = getMarketFromScript(tx5.outputs[0].script)

  expect(entry5.liquidityPoints).toBe(market5.status.liquidityPoints)
  // expect(isValidMarketUpdateTx(tx5, tx4, entries5)).toBe(true)

  // Oracle 1 commit

  const tx6 = getOracleCommitTx(tx5, rabinPrivKey1, address, utxos, privateKey)

  expect(isValidMarketUpdateTx(tx6, tx5, entries5)).toBe(true)

  // Oracle 2 commit

  const tx7 = getOracleCommitTx(tx6, rabinPrivKey2, address, utxos, privateKey)

  expect(isValidMarketUpdateTx(tx7, tx6, entries5)).toBe(true)

  // Oracle 1 vote

  const vote = 2

  const tx8 = getOracleVoteTx(tx7, vote, rabinPrivKey1, address, utxos, privateKey)

  expect(isValidMarketUpdateTx(tx8, tx7, entries5)).toBe(true)

  // Oracle 2 vote

  const tx9 = getOracleVoteTx(tx8, vote, rabinPrivKey2, address, utxos, privateKey)

  expect(isValidMarketUpdateTx(tx9, tx8, entries5)).toBe(true)

  const market9 = getMarketFromScript(tx9.outputs[0].script)
  expect(market9.status.decided).toBe(true)

  // User 2 redeems winning shares

  const balance10: balance = {
    liquidity: 0,
    shares: [0, 0, 0]
  }

  const tx10 = getUpdateEntryTx(
    tx9,
    entries5,
    balance10,
    false,
    privateKey2,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  const market10 = getMarketFromScript(tx10.outputs[0].script)
  const entry10: entry = {
    publicKey: publicKey2,
    balance: balance10,
    globalLiqidityFeePoolSave: market10.status.accLiquidityFeePool,
    liquidityPoints: 0
  }
  const entries10 = [entry5, entry10]

  expect(isValidMarketUpdateTx(tx10, tx9, entries10)).toBe(true)

  // Market creator redeems winning shares

  const balance11: balance = {
    liquidity: 3,
    shares: [0, 0, 0]
  }

  const tx11 = getUpdateEntryTx(
    tx10,
    entries10,
    balance11,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  const market11 = getMarketFromScript(tx11.outputs[0].script)
  const entry11: entry = {
    publicKey: privateKey.publicKey,
    balance: balance11,
    globalLiqidityFeePoolSave: market11.status.accLiquidityFeePool,
    liquidityPoints:
      entry5.liquidityPoints +
      balance5.liquidity * (market11.status.accLiquidityFeePool - entry5.globalLiqidityFeePoolSave)
  }

  const entries11 = [entry11, entry10]

  expect(isValidMarketUpdateTx(tx11, tx10, entries11)).toBe(true)

  // Market creator redeems loosing shares and sells liquidity

  const balance12: balance = {
    liquidity: 0,
    shares: [0, 0, 0]
  }

  const tx12 = getUpdateEntryTx(
    tx11,
    entries11,
    balance12,
    false,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  const market12 = getMarketFromScript(tx12.outputs[0].script)
  const entry12: entry = {
    publicKey: privateKey.publicKey,
    balance: balance12,
    globalLiqidityFeePoolSave: market12.status.accLiquidityFeePool,
    liquidityPoints:
      entry11.liquidityPoints +
      entry11.balance.liquidity * (market12.status.liquidityFeePool - entry11.globalLiqidityFeePoolSave)
  }

  const entries12 = [entry12, entry10]

  expect(isValidMarketUpdateTx(tx12, tx11, entries12)).toBe(true)

  // User redeeming liquidity points

  const tx13 = getUpdateEntryTx(
    tx12,
    entries12,
    balance12,
    true,
    privateKey,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  const market13 = getMarketFromScript(tx13.outputs[0].script)
  const entry13: entry = {
    publicKey: privateKey.publicKey,
    balance: balance12,
    globalLiqidityFeePoolSave: market13.status.accLiquidityFeePool,
    liquidityPoints: 0
  }

  const entries13 = [entry13, entry10]

  expect(isValidMarketUpdateTx(tx13, tx12, entries13)).toBe(true)
  expect(tx13.outputs[0].satoshis).toBe(getDust(tx13.outputs[0].getSize())) // Only dust remains
})

test("get function from script", () => {
  const tx = buildNewMarketTx(populatedMarket)
  fundTx(tx, privateKey, address, utxos)

  const newEntry: entry = {
    publicKey: privateKey.publicKey,
    balance: {
      liquidity: 0,
      shares: [1, 0, 2]
    },
    globalLiqidityFeePoolSave: 0,
    liquidityPoints: 0
  }

  const newTx = getAddEntryTx(
    tx,
    entries,
    newEntry.publicKey,
    newEntry.balance,
    marketCreator.payoutAddress,
    utxos,
    privateKey
  )

  expect(getFunctionID(newTx.inputs[0].script)).toBe(1)
})

test("Add multiple markets to the vala index", () => {
  const tx = getMarketCreationTx(market, valaIndexTx)
  fundTx(tx, privateKey, address, utxos)
  const tx2 = getMarketCreationTx(market, tx)
  fundTx(tx2, privateKey, address, utxos)
  // console.log(tx2.toString())
  expect(isValidUpdateTx(tx2, tx) && tx2.verify() === true && !tx2.getSerializationError()).toBe(true)
})

test("build and fund oracle transaction", () => {
  const tx = getNewOracleTx(rabinPubKey1, valaIndexTx)
  fundTx(tx, privateKey, address, utxos)
  expect(tx.verify()).toBe(true)
  expect(!tx.getSerializationError()).toBe(true)
  expect(isValidOracleInitOutput(tx, 1)).toBe(true)
})

test("Add multiple oracles to the vala index", () => {
  const tx = getNewOracleTx(rabinPubKey1, valaIndexTx)
  fundTx(tx, privateKey, address, utxos)
  const tx2 = getNewOracleTx(rabinPubKey1, tx)
  fundTx(tx2, privateKey, address, utxos)
  // console.log(tx2.toString())
  expect(isValidUpdateTx(tx2, tx) && tx2.verify() === true && !tx2.getSerializationError()).toBe(true)
})

test("build and fund oracle burn update transaction", () => {
  const tx = getNewOracleTx(rabinPubKey1, valaIndexTx)

  fundTx(tx, privateKey, address, utxos)

  const tx2 = getOracleBurnTx(tx, 1000, 1)
  fundTx(tx2, privateKey, address, utxos)

  // console.log(tx2.outputs)

  // const asm = tx2.outputs[1].script.toASM().split(" ")
  // console.log(tx2.outputs[0].script.toASM())
  // console.log(asm.slice(asm.length - 3, asm.length))
  // console.log(tx2.inputs)
  // console.log(tx.outputs)
  // console.log(tx2.toString())
  // console.log(rabinPubKey1)
  // const asm = tx.outputs[0].script.toASM().split(" ")
  // console.log(asm.slice(asm.length - 3, asm.length))
  // const asm2 = tx2.outputs[0].script.toASM().split(" ")
  // console.log(asm2.slice(asm2.length - 3, asm2.length))

  expect(tx2.outputs[0].satoshis).toBe(1000 + tx.outputs[1].satoshis)
  expect(tx2.getSerializationError()).toBe(undefined)
  expect(tx2.verify()).toBe(true)
  expect(isValidUpdateTx(tx2, tx, 1)).toBe(true)

  const tx3 = getOracleBurnTx(tx2, 1000)
  fundTx(tx3, privateKey, address, utxos)

  expect(tx3.outputs[0].satoshis).toBe(1000 + tx2.outputs[0].satoshis)

  expect(isValidUpdateTx(tx3, tx2) && tx3.verify() === true && !tx3.getSerializationError()).toBe(true)
})

test("build and fund oracle details update transaction", () => {
  const tx = getNewOracleTx(rabinPubKey1, valaIndexTx)
  fundTx(tx, privateKey, address, utxos)

  expect(isValidOracleInitOutput(tx, 1)).toBe(true)

  const details = {
    domain: "example.com"
  }

  const tx2 = getOracleUpdateDetailsTx(tx, 1, details, rabinPrivKey1)
  expect(isValidUpdateTx(tx2, tx, 1) && tx2.verify() === true && !tx2.getSerializationError()).toBe(true)
})

test("build and fund oracle details update transaction with old contract version", () => {
  const oracleVersion = oracleContracts["02fbca51c5c8820b884bcc3d4481a252"]
  const tx = getNewOracleTx(rabinPubKey1, valaIndexTx, 0, feeb, oracleVersion)
  fundTx(tx, privateKey, address, utxos)

  expect(isValidOracleInitOutput(tx, 1)).toBe(true)

  const details = {
    domain: "example.com"
  }

  const tx2 = getOracleUpdateDetailsTx(tx, 1, details, rabinPrivKey1)
  expect(isValidUpdateTx(tx2, tx, 1) && tx2.verify() === true && !tx2.getSerializationError()).toBe(true)
})

test("Update market settings", () => {
  // const tx = buildNewMarketTx(populatedMarket)
  const tx = getMarketCreationTx(populatedMarket, valaIndexTx)
  fundTx(tx, privateKey, address, utxos)

  const newSettings = {
    hidden: true
  }

  // const asm = tx.outputs[1].script.toASM().split(" ")
  // console.log(asm[asm.length - 1], asm[asm.length - 1].length)

  const newTx = getUpdateMarketSettingsTx(tx, newSettings, privateKey, feeb, 1)

  expect(isValidMarketUpdateTx(newTx, tx, entries, 1)).toBe(true)

  const newMarket = getMarketFromScript(newTx.outputs[0].script)
  expect(newMarket.settingsHash).toBe(sha256(toHex(JSON.stringify(newSettings))))
})

test("Update market settings with short state hex string", () => {
  // const tx = buildNewMarketTx(populatedMarket)

  const longMarket = getNewMarket(
    {
      ...marketDetails,
      options: [{ name: "1" }, { name: "2" }]
    },
    [
      {
        ...oracleDetails[0],
        votes: 100
      }
    ],
    marketCreator,
    creatorFee,
    liquidityFee,
    requiredVotes
  )

  const tx = getMarketCreationTx(longMarket, valaIndexTx)
  fundTx(tx, privateKey, address, utxos)

  const newSettings = {
    hidden: true
  }

  // const asm = tx.outputs[1].script.toASM().split(" ")
  // console.log(asm[asm.length - 1], asm[asm.length - 1].length)

  const newTx = getUpdateMarketSettingsTx(tx, newSettings, privateKey, feeb, 1)

  expect(isValidMarketUpdateTx(newTx, tx, [], 1)).toBe(true)

  const newMarket = getMarketFromScript(newTx.outputs[0].script)
  expect(newMarket.settingsHash).toBe(sha256(toHex(JSON.stringify(newSettings))))
})

test("Only market creator can update market settings", () => {
  const tx = buildNewMarketTx(populatedMarket)
  fundTx(tx, privateKey, address, utxos)

  const newSettings = {
    hidden: true
  }

  const privateKey2 = bsv.PrivateKey.fromString("L4wrW1PZktcohFrbuACjJVPnEZWnfm9tRbh6qoiVfy1dDPfkVVpC")

  expect(() => getUpdateMarketSettingsTx(tx, newSettings, privateKey2)).toThrow()
})
