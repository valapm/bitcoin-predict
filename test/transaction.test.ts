import {
  buildTx,
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
  isValidOracleInitTx,
  isValidUpdateTx,
  DUST,
  getNewMarketTx
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
  getIndexToken
} from "../src/pm"
import { balance } from "../src/lmsr"
import bsv from "bsv"
import { getSignature, oracleDetail } from "../src/oracle"
import { cloneDeep } from "lodash"

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
    amount: 0.1,
    satoshis: 10000000,
    value: 8000,
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
  populatedMarket: marketInfo

const valaIndexToken = getIndexToken()
const valaIndexTx = new bsv.Transaction()
valaIndexTx.addOutput(new bsv.Transaction.Output({ script: valaIndexToken.lockingScript, satoshis: DUST }))

beforeEach(() => {
  oracleDetails = [
    {
      pubKey: rabinPubKey1,
      votes: 40
    },
    {
      pubKey: rabinPubKey2,
      votes: 60
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

  entry = {
    publicKey: privateKey.publicKey,
    balance: {
      liquidity: 2,
      shares: [0, 0, 0]
    },
    globalLiqidityFeePoolSave: 0,
    liquidityPoints: 0
  }

  entries = [entry]

  populatedMarket = getNewMarket(marketDetails, oracleDetails, marketCreator, creatorFee, liquidityFee, requiredVotes)
  populatedMarket.balance = entry.balance
  populatedMarket.balanceMerkleRoot = getBalanceMerkleRoot([entry])
})

test("Convert from and to market hex", () => {
  const tx = getNewMarketTx(market, valaIndexTx)
  const parsedMarket = getMarketFromScript(tx.outputs[1].script)
  const tx2 = getNewMarketTx(parsedMarket, valaIndexTx)

  const asm1 = tx.outputs[1].script.toASM()
  const asm2 = tx2.outputs[1].script.toASM()

  const opReturn1 = asm1.split(" ").slice(asm1.length - 3, asm1.length)
  const opReturn2 = asm2.split(" ").slice(asm2.length - 3, asm2.length)

  expect(opReturn1.join(" ") === opReturn2.join(" "))
  expect(asm1).toBe(asm2)
})

test("build and fund pm init transaction", () => {
  const tx = getNewMarketTx(market, valaIndexTx)
  fundTx(tx, privateKey, address, utxos)
  expect(isValidMarketTx(tx, [], 1)).toBe(true)
})

test("convert between market and script consistency", () => {
  const tx = getNewMarketTx(market, valaIndexTx)
  const extractedMarket = getMarketFromScript(tx.outputs[1].script)
  const tx2 = getNewMarketTx(extractedMarket, valaIndexTx)

  expect(tx2.outputs[1].script.toASM()).toBe(tx.outputs[1].script.toASM())
})

test("add entry", () => {
  const tx = getNewMarketTx(market, valaIndexTx)
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
  const tx = getNewMarketTx(market, valaIndexTx)
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

test("update entry", () => {
  const tx = buildTx(populatedMarket)
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

  // console.log(getDebugParams(newTx))

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
})

test("update entry and sell liquidity", () => {
  const tx = buildTx(populatedMarket)
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

  const newMarket = getMarketFromScript(newTx.outputs[0].script)
  const newEntry: entry = cloneDeep(entries[0])
  newEntry.balance = newBalance
  newEntry.globalLiqidityFeePoolSave = newMarket.status.accLiquidityFeePool
  newEntry.liquidityPoints = newMarket.status.liquidityPoints

  const newEntries = [newEntry]

  // console.log(newTx.outputs.slice(1).map(output => output.script.toHex()))

  // console.log(getDebugParams(newTx))

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
})

test("update entry and sell all liqudity", () => {
  const tx = buildTx(populatedMarket)
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
})

test("update to invalid balance", () => {
  const tx = buildTx(populatedMarket)
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
  const tx = getNewMarketTx(populatedMarket, valaIndexTx)
  fundTx(tx, privateKey, address, utxos)

  const newTx = getOracleCommitTx(tx, rabinPrivKey1, address, utxos, privateKey, 1)
  const newMarket = getMarketFromScript(newTx.outputs[0].script)

  expect(newMarket.oracles[0].committed).toBe(true)
  expect(isValidMarketUpdateTx(newTx, tx, entries, 1)).toBe(true)
})

test("oracle vote succeeds", () => {
  const committedMarket: marketInfo = cloneDeep(populatedMarket)
  committedMarket.oracles[0].committed = true

  const tx = buildTx(committedMarket)
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
  const tx = buildTx(populatedMarket)
  fundTx(tx, privateKey, address, utxos)

  const vote = 1

  expect(() => getOracleVoteTx(tx, vote, rabinPrivKey1, address, utxos, privateKey)).toThrow()
})

test("oracle vote and market resolve", () => {
  const committedMarket: marketInfo = cloneDeep(populatedMarket)
  committedMarket.oracles[0].committed = true
  committedMarket.requiredVotes = 40

  const tx = buildTx(committedMarket)
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

  const tx = buildTx(committedMarket)
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
  resolvedMarket.balanceMerkleRoot = getBalanceMerkleRoot([entry])

  const tx = buildTx(resolvedMarket)
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

test("redeem invalid shares", () => {
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
  resolvedMarket.balanceMerkleRoot = getBalanceMerkleRoot([entry])

  const tx = buildTx(resolvedMarket)
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
})

test("sell liquidity after market is resolved", () => {
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
  resolvedMarket.balanceMerkleRoot = getBalanceMerkleRoot([entry])

  const tx = buildTx(resolvedMarket)
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
  resolvedMarket.balanceMerkleRoot = getBalanceMerkleRoot([entry])

  const tx = buildTx(resolvedMarket)
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
  resolvedMarket.balanceMerkleRoot = getBalanceMerkleRoot([entry])

  const tx = buildTx(resolvedMarket)
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
  resolvedMarket.balanceMerkleRoot = getBalanceMerkleRoot([entry])

  const tx = buildTx(resolvedMarket)
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

  market1.balanceMerkleRoot = getBalanceMerkleRoot([entry1])
  market1.balance = entry1.balance

  const tx1 = buildTx(market1)
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
  market1.balanceMerkleRoot = getBalanceMerkleRoot([entry1])

  market1.status.accLiquidityFeePool = 1000
  market1.status.liquidityFeePool = 1000
  market1.status.liquidityPoints = 10000

  const tx1 = buildTx(market1)
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
  expect(market2.status.liquidityFeePool).toBe(700)
  expect(market2.status.liquidityPoints).toBe(7000)
})

test("full market graph", () => {
  // Create market

  const tx = getNewMarketTx(populatedMarket, valaIndexTx)
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
  expect(isValidMarketUpdateTx(tx5, tx4, entries5)).toBe(true)

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
  expect(tx13.outputs[0].satoshis).toBe(546) // Only dust remains
})

test("get function from script", () => {
  const tx = buildTx(populatedMarket)
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

test("build and fund oracle transaction", () => {
  const tx = getNewOracleTx(rabinPubKey1, valaIndexTx)
  fundTx(tx, privateKey, address, utxos)
  expect(tx.verify() === true && !tx.getSerializationError() && isValidOracleInitTx(tx, 1)).toBe(true)
})

test("Add multiple oracles to vala index", () => {
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

  expect(tx2.outputs[0].satoshis).toBe(1000 + DUST)
  expect(tx2.getSerializationError()).toBe(undefined)
  expect(tx2.verify()).toBe(true)
  expect(isValidUpdateTx(tx2, tx, 1)).toBe(true)

  const tx3 = getOracleBurnTx(tx2, 1000)
  fundTx(tx3, privateKey, address, utxos)

  expect(tx3.outputs[0].satoshis).toBe(2000 + DUST)

  expect(isValidUpdateTx(tx3, tx2) && tx3.verify() === true && !tx3.getSerializationError()).toBe(true)
})

test("build and fund oracle details update transaction", () => {
  const tx = getNewOracleTx(rabinPubKey1, valaIndexTx)
  fundTx(tx, privateKey, address, utxos)

  const details = {
    domain: "example.com"
  }

  const tx2 = getOracleUpdateDetailsTx(tx, 1, details, rabinPrivKey1)
  expect(isValidUpdateTx(tx2, tx, 1) && tx2.verify() === true && !tx2.getSerializationError()).toBe(true)
})
