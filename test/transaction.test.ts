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
  getOracleVoteTx
  // getDebugParams
} from "../src/transaction"
import { privKeyToPubKey, rabinPrivKey, rabinPubKey } from "rabinsig"
import {
  entry,
  getMarketBalance,
  getBalanceMerkleRoot,
  marketInfo,
  getNewMarket,
  creatorInfo,
  marketDetails
} from "../src/pm"
import { balance } from "../src/lmsr"
import { bsv } from "scryptlib"
import { getSignature, oracleDetail } from "../src/oracle"
import { cloneDeep } from "lodash"

const rabinPrivKey1: rabinPrivKey = {
  p: 3097117482495218740761570398276008894011381249145414887346233174147008460690669803628686127894575795412733149071918669075694907431747167762627687052467n,
  q: 650047001204168007801848889418948532353073326909497585177081016045346562912146630794965372241635285465610094863279373295872825824127728241709483771067n
}

const rabinPrivKey2: rabinPrivKey = {
  p: 5282996768621071377953148561714230757875959595062017918330039194973991105026912034418577469175391947647260152227014115175065212479767996019477136300223n,
  q: 650047001204168007801848889418948532353073326909497585177081016045346562912146630794965372241635285465610094863279373295872825824127728241709483771067n
}

const rabinPubKey1: rabinPubKey = privKeyToPubKey(rabinPrivKey1.p, rabinPrivKey1.q)
const rabinPubKey2: rabinPubKey = privKeyToPubKey(rabinPrivKey2.p, rabinPrivKey2.q)

const oracleDetails: oracleDetail[] = [
  {
    pubKey: rabinPubKey1,
    votes: 40
  },
  {
    pubKey: rabinPubKey2,
    votes: 60
  }
]

const privateKey = bsv.PrivateKey.fromString("Kys3cyL5HZ4upzwWsnirv4urUeczpnweiJ2zY5EDBCkRZ5j2TTdj")
const address = privateKey.toAddress()

const entry: entry = {
  publicKey: privateKey.publicKey,
  balance: {
    liquidity: 2,
    shares: [0, 0, 0]
  }
}

const entries = [entry]

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

const marketCreator: creatorInfo = {
  pubKey: privateKey.publicKey,
  payoutAddress: bsv.Address.fromString("1KCrKrbmjiyHhx8Wp8zKCqLgAbUV5B8okY")
}

const creatorFee = 1

const marketDetails: marketDetails = {
  resolve: "test",
  details: "Here are some details about this market",
  options: {
    length: 3
  }
}

const requiredVotes = 50

const market = getNewMarket(marketDetails, entry, oracleDetails, marketCreator, creatorFee, requiredVotes)

test("build and fund pm init transaction", () => {
  const tx = buildTx(market)
  fundTx(tx, privateKey, address, utxos)
  expect(isValidMarketTx(tx, entries)).toBe(true)
})

test("build and fund pm init transaction without liquidity", () => {
  const entry = {
    publicKey: privateKey.publicKey,
    balance: {
      liquidity: 0,
      shares: [0, 0, 0]
    }
  }
  const newEntries = [entry]
  const market = getNewMarket(marketDetails, entry, oracleDetails, marketCreator, creatorFee, requiredVotes)
  const tx = buildTx(market)
  fundTx(tx, privateKey, address, utxos)

  expect(isValidMarketTx(tx, newEntries)).toBe(true)
})

test("convert between market and script consistency", () => {
  const tx = buildTx(market)
  const extractedMarket = getMarketFromScript(tx.outputs[0].script)
  const tx2 = buildTx(extractedMarket)

  expect(tx2.outputs[0].script.toASM()).toBe(tx.outputs[0].script.toASM())
})

test("add entry", () => {
  const tx = buildTx(market)
  fundTx(tx, privateKey, address, utxos)

  const newEntry: entry = {
    publicKey: privateKey.publicKey,
    balance: {
      liquidity: 0,
      shares: [1, 0, 2]
    }
  }

  const newTx = getAddEntryTx(tx, entries, newEntry, marketCreator.payoutAddress, utxos, privateKey)

  const newEntries = entries.concat([newEntry])

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
})

test("add entry with liquidity", () => {
  const tx = buildTx(market)
  fundTx(tx, privateKey, address, utxos)

  const newEntry: entry = {
    publicKey: privateKey.publicKey,
    balance: {
      liquidity: 1,
      shares: [1, 0, 2]
    }
  }

  const newTx = getAddEntryTx(tx, entries, newEntry, marketCreator.payoutAddress, utxos, privateKey)

  const newEntries = entries.concat([newEntry])

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
})

test("update entry", () => {
  const tx = buildTx(market)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 2,
    shares: [1, 0, 2]
  }

  const newTx = getUpdateEntryTx(tx, entries, newBalance, privateKey, marketCreator.payoutAddress, utxos, privateKey)

  const newEntry: entry = cloneDeep(entries[0])
  newEntry.balance = newBalance

  const newEntries = [newEntry]

  // console.log(getDebugParams(newTx))

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
})

test("update entry and sell liquidity", () => {
  const tx = buildTx(market)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 1,
    shares: [0, 0, 0]
  }

  const newTx = getUpdateEntryTx(tx, entries, newBalance, privateKey, marketCreator.payoutAddress, utxos, privateKey)

  const newEntry: entry = cloneDeep(entries[0])
  newEntry.balance = newBalance

  const newEntries = [newEntry]

  // console.log(newTx.outputs.slice(1).map(output => output.script.toHex()))

  // console.log(getDebugParams(newTx))

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
})

test("update entry and sell all liqudity", () => {
  const tx = buildTx(market)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 0,
    shares: [1, 0, 2]
  }

  const newTx = getUpdateEntryTx(tx, entries, newBalance, privateKey, marketCreator.payoutAddress, utxos, privateKey)

  // console.log(newTx.outputs[0].satoshis)
  // console.log(getMarketFromScript(newTx.outputs[0].script))

  const newEntry: entry = cloneDeep(entries[0])
  newEntry.balance = newBalance

  const newEntries = [newEntry]

  // console.log(getDebugParams(newTx))

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
})

test("update to invalid balance", () => {
  const tx = buildTx(market)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 2,
    shares: [1, 0, -1]
  }

  expect(() =>
    getUpdateEntryTx(tx, entries, newBalance, privateKey, marketCreator.payoutAddress, utxos, privateKey)
  ).toThrow()
})

test("oracle commmitment", () => {
  const tx = buildTx(market)
  fundTx(tx, privateKey, address, utxos)

  const newTx = getOracleCommitTx(tx, rabinPrivKey1, address, utxos, privateKey)
  const newMarket = getMarketFromScript(newTx.outputs[0].script)

  expect(newMarket.oracles[0].committed).toBe(true)
  expect(isValidMarketUpdateTx(newTx, tx, entries)).toBe(true)
})

test("oracle vote succeeds", () => {
  const committedMarket: marketInfo = cloneDeep(market)
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
  const tx = buildTx(market)
  fundTx(tx, privateKey, address, utxos)

  const vote = 1

  expect(() => getOracleVoteTx(tx, vote, rabinPrivKey1, address, utxos, privateKey)).toThrow()
})

test("oracle vote and market resolve", () => {
  const committedMarket: marketInfo = cloneDeep(market)
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
  const committedMarket: marketInfo = cloneDeep(market)
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
    }
  }

  const localMarketCreator = cloneDeep(marketCreator)
  localMarketCreator.pubKey = bsv.PrivateKey.fromRandom().publicKey

  const resolvedMarket = getNewMarket(marketDetails, entry, oracleDetails, marketCreator, creatorFee, requiredVotes)
  resolvedMarket.status.decided = true
  resolvedMarket.status.decision = 2

  const tx = buildTx(resolvedMarket)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 2,
    shares: [1, 0, 0]
  }

  const newTx = getUpdateEntryTx(tx, [entry], newBalance, privateKey, marketCreator.payoutAddress, utxos, privateKey)

  const newEntry: entry = cloneDeep(entry)
  newEntry.balance = newBalance

  const newEntries = [newEntry]

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
})

test("redeem invalid shares", () => {
  const entry = {
    publicKey: privateKey.publicKey,
    balance: {
      liquidity: 2,
      shares: [1, 0, 2]
    }
  }

  const resolvedMarket = getNewMarket(marketDetails, entry, oracleDetails, marketCreator, creatorFee, requiredVotes)
  resolvedMarket.status.decided = true
  resolvedMarket.status.decision = 2

  const tx = buildTx(resolvedMarket)
  fundTx(tx, privateKey, address, utxos)

  const newTx = getUpdateEntryTx(tx, [entry], entry.balance, privateKey, marketCreator.payoutAddress, utxos, privateKey)

  const newEntries = [entry]

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
})

// test("sell liquidity after market is resolved", () => {})

// test("redeem invalid after market is resolved", () => {})

// test("invalid redeem balance", () => {
//   const tx = buildTx(market)
//   fundTx(tx, privateKey, address, utxos)

//   const newTx = getRedeemTx(tx, entries, privateKey)
//   fundTx(newTx, privateKey, address, utxos)

//   const newEntry: entry = cloneDeep(entries[0])
//   newEntry.balance.sharesFor = 0
//   newEntry.balance.sharesAgainst = 0

//   const newEntries = [newEntry]

//   expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(false)
// })

// test("verify signatures", () => {
//   const decision = 1
//   const sig1 = getSignature(decision, rabinPrivKey1)
//   const sig2 = getSignature(decision, rabinPrivKey2)

//   const tx = buildTx(market)
//   fundTx(tx, privateKey, address, utxos)

//   const newTx = getDecideTx(tx, decision, [sig1, sig2])
//   fundTx(newTx, privateKey, address, utxos)

//   expect(isValidMarketUpdateTx(newTx, tx, entries)).toBe(true)
// })

// test("redeem balance", () => {
//   const entriesWithBalance: entry[] = [
//     {
//       publicKey: privateKey.publicKey,
//       balance: {
//         liquidity: 1,
//         sharesFor: 1,
//         sharesAgainst: 0
//       }
//     }
//   ]

//   const resolvedMarket = cloneDeep(market)
//   resolvedMarket.status = {
//     decided: true,
//     decision: 1
//   }
//   resolvedMarket.balanceMerkleRoot = getBalanceMerkleRoot(entriesWithBalance)
//   resolvedMarket.balance = getMarketBalance(entriesWithBalance)

//   const tx = buildTx(resolvedMarket)
//   fundTx(tx, privateKey, address, utxos)

//   const newTx = getRedeemTx(tx, entriesWithBalance, privateKey)
//   fundTx(newTx, privateKey, address, utxos)

//   const newEntries = cloneDeep(entriesWithBalance)
//   newEntries[0].balance.sharesFor = 0

//   expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
// })
// // function getOracleSigs(oraclePrivKeys: rabinPrivKey[], vote: number): rabinSig[] {
// //   return oraclePrivKeys.map(privKey => {
// //     return getSignature(vote, privKey)
// //   })
// // }

// test("full market graph", () => {
//   const entries: entry[] = [
//     {
//       publicKey: privateKey.publicKey,
//       balance: {
//         liquidity: 1,
//         sharesFor: 0,
//         sharesAgainst: 0
//       }
//     }
//   ]

//   const market = getNewMarket({ resolve: "test" }, entries, oracleDetails)

//   // Build init tx
//   const tx1 = buildTx(market)
//   fundTx(tx1, privateKey, address, utxos)

//   expect(isValidMarketTx(tx1, entries)).toBe(true)

//   // Add new entry
//   const newEntry: entry = {
//     publicKey: privateKey.publicKey,
//     balance: {
//       liquidity: 0,
//       sharesFor: 2,
//       sharesAgainst: 0
//     }
//   }

//   const tx2 = getAddEntryTx(tx1, entries, newEntry)
//   fundTx(tx2, privateKey, address, utxos)

//   entries.push(newEntry)

//   expect(isValidMarketUpdateTx(tx2, tx1, entries)).toBe(true)

//   // Buy more shares
//   const newBalance: balance = {
//     liquidity: 1,
//     sharesFor: 0,
//     sharesAgainst: 1
//   }

//   const tx3 = getUpdateEntryTx(tx2, entries, newBalance, privateKey)
//   fundTx(tx3, privateKey, address, utxos)

//   entries[0].balance.sharesAgainst = 1

//   expect(isValidMarketUpdateTx(tx3, tx2, entries)).toBe(true)

//   // Sell shares
//   const newBalance2: balance = {
//     liquidity: 1,
//     sharesFor: 0,
//     sharesAgainst: 0
//   }

//   const tx4 = getUpdateEntryTx(tx3, entries, newBalance2, privateKey)
//   tx4.change(address)

//   entries[0].balance.sharesAgainst = 0

//   expect(isValidMarketUpdateTx(tx4, tx3, entries)).toBe(true)

//   // Decide market
//   const decision = 1
//   const sig1 = getSignature(decision, rabinPrivKey1)
//   const sig2 = getSignature(decision, rabinPrivKey2)

//   const tx5 = getDecideTx(tx4, decision, [sig1, sig2])
//   fundTx(tx5, privateKey, address, utxos)

//   expect(isValidMarketUpdateTx(tx5, tx4, entries)).toBe(true)

//   // Redeem balance
//   const tx6 = getRedeemTx(tx5, entries, privateKey)
//   tx6.change(address)

//   entries[0].balance.sharesFor = 0
//   entries[0].balance.sharesAgainst = 0

//   expect(isValidMarketUpdateTx(tx6, tx5, entries)).toBe(true)
// })
