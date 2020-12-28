import {
  buildTx,
  fundTx,
  isValidMarketTx,
  getUpdateEntryTx,
  getRedeemTx,
  getAddEntryTx,
  getDecideTx,
  isValidMarketUpdateTx
} from "../src/transaction"
import { privKeyToPubKey, rabinPrivKey } from "rabinsig"
import { entry, getMarketBalance, getBalanceMerkleRoot, balance, marketInfo } from "../src/pm"
import { bsv } from "scryptlib"
import { getSignature } from "../src/oracle"
import { cloneDeep } from "lodash"

const privKey1: rabinPrivKey = {
  p: 3097117482495218740761570398276008894011381249145414887346233174147008460690669803628686127894575795412733149071918669075694907431747167762627687052467n,
  q: 650047001204168007801848889418948532353073326909497585177081016045346562912146630794965372241635285465610094863279373295872825824127728241709483771067n
}

const privKey2: rabinPrivKey = {
  p: 5282996768621071377953148561714230757875959595062017918330039194973991105026912034418577469175391947647260152227014115175065212479767996019477136300223n,
  q: 650047001204168007801848889418948532353073326909497585177081016045346562912146630794965372241635285465610094863279373295872825824127728241709483771067n
}

const pubKey1 = privKeyToPubKey(privKey1.p, privKey1.q)
const pubKey2 = privKeyToPubKey(privKey2.p, privKey2.q)

const miners = [
  {
    pubKey: pubKey1,
    votes: 40
  },
  {
    pubKey: pubKey2,
    votes: 60
  }
]

const privateKey = bsv.PrivateKey.fromString("Kys3cyL5HZ4upzwWsnirv4urUeczpnweiJ2zY5EDBCkRZ5j2TTdj")
const address = privateKey.toAddress()

const entries: entry[] = [
  {
    publicKey: privateKey.publicKey,
    balance: {
      liquidity: 1,
      sharesFor: 0,
      sharesAgainst: 0
    }
  }
]

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

const market: marketInfo = {
  details: { resolve: "test" },
  status: { decided: false, decision: 0 },
  miners,
  balance: getMarketBalance(entries),
  balanceMerkleRoot: getBalanceMerkleRoot(entries)
}

test("build and fund pm init transaction", () => {
  const tx = buildTx(market)
  fundTx(tx, privateKey, address, utxos)
  expect(isValidMarketTx(tx, entries)).toBe(true)
})

// test("convert market to and from script", () => {
//   const script = getLockingScript(market)
//   expect(getMarketFromScript(script)).toEqual(market)
// })

test("add entry", () => {
  const tx = buildTx(market)
  fundTx(tx, privateKey, address, utxos)

  const newEntry: entry = {
    publicKey: privateKey.publicKey,
    balance: {
      liquidity: 0,
      sharesFor: 1,
      sharesAgainst: 0
    }
  }

  const newTx = getAddEntryTx(tx, entries, newEntry)
  fundTx(newTx, privateKey, address, utxos)

  const newEntries = entries.concat([newEntry])

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
})

test("update entry", () => {
  const tx = buildTx(market)
  fundTx(tx, privateKey, address, utxos)

  const newBalance: balance = {
    liquidity: 1,
    sharesFor: 1,
    sharesAgainst: 0
  }

  const newTx = getUpdateEntryTx(tx, entries, newBalance, privateKey)
  fundTx(newTx, privateKey, address, utxos)

  const newEntry: entry = cloneDeep(entries[0])
  newEntry.balance.sharesFor += 1

  const newEntries = [newEntry]

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
})

test("invalid redeem balance", () => {
  const tx = buildTx(market)
  fundTx(tx, privateKey, address, utxos)

  const newTx = getRedeemTx(tx, entries, privateKey)
  fundTx(newTx, privateKey, address, utxos)

  const newEntry: entry = cloneDeep(entries[0])
  newEntry.balance.sharesFor = 0
  newEntry.balance.sharesAgainst = 0

  const newEntries = [newEntry]

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(false)
})

test("verify signatures", () => {
  const decision = 1
  const sig1 = getSignature(decision, privKey1)
  const sig2 = getSignature(decision, privKey2)

  const tx = buildTx(market)
  fundTx(tx, privateKey, address, utxos)

  const newTx = getDecideTx(tx, decision, [sig1, sig2])
  fundTx(newTx, privateKey, address, utxos)

  expect(isValidMarketUpdateTx(newTx, tx, entries)).toBe(true)
})

test("redeem balance", () => {
  const entriesWithBalance: entry[] = [
    {
      publicKey: privateKey.publicKey,
      balance: {
        liquidity: 1,
        sharesFor: 1,
        sharesAgainst: 0
      }
    }
  ]

  const resolvedMarket = cloneDeep(market)
  resolvedMarket.status = {
    decided: true,
    decision: 1
  }
  resolvedMarket.balanceMerkleRoot = getBalanceMerkleRoot(entriesWithBalance)
  resolvedMarket.balance = getMarketBalance(entriesWithBalance)

  const tx = buildTx(resolvedMarket)
  fundTx(tx, privateKey, address, utxos)

  const newTx = getRedeemTx(tx, entriesWithBalance, privateKey)
  fundTx(newTx, privateKey, address, utxos)

  const newEntries = cloneDeep(entriesWithBalance)
  newEntries[0].balance.sharesFor = 0

  expect(isValidMarketUpdateTx(newTx, tx, newEntries)).toBe(true)
})
// function getMinerSigs(minerPrivKeys: rabinPrivKey[], vote: number): rabinSig[] {
//   return minerPrivKeys.map(privKey => {
//     return getSignature(vote, privKey)
//   })
// }

test("full market graph", () => {
  const entries: entry[] = [
    {
      publicKey: privateKey.publicKey,
      balance: {
        liquidity: 1,
        sharesFor: 0,
        sharesAgainst: 0
      }
    }
  ]

  const market: marketInfo = {
    details: { resolve: "test" },
    status: { decided: false, decision: 0 },
    miners,
    balance: getMarketBalance(entries),
    balanceMerkleRoot: getBalanceMerkleRoot(entries)
  }

  // Build init tx
  const tx1 = buildTx(market)
  fundTx(tx1, privateKey, address, utxos)

  expect(isValidMarketTx(tx1, entries)).toBe(true)

  // Add new entry
  const newEntry: entry = {
    publicKey: privateKey.publicKey,
    balance: {
      liquidity: 0,
      sharesFor: 2,
      sharesAgainst: 0
    }
  }

  const tx2 = getAddEntryTx(tx1, entries, newEntry)
  fundTx(tx2, privateKey, address, utxos)

  entries.push(newEntry)

  expect(isValidMarketUpdateTx(tx2, tx1, entries)).toBe(true)

  // Buy more shares
  const newBalance: balance = {
    liquidity: 1,
    sharesFor: 0,
    sharesAgainst: 1
  }

  const tx3 = getUpdateEntryTx(tx2, entries, newBalance, privateKey)
  fundTx(tx3, privateKey, address, utxos)

  entries[0].balance.sharesAgainst = 1

  expect(isValidMarketUpdateTx(tx3, tx2, entries)).toBe(true)

  // Sell shares
  const newBalance2: balance = {
    liquidity: 1,
    sharesFor: 0,
    sharesAgainst: 0
  }

  const tx4 = getUpdateEntryTx(tx3, entries, newBalance2, privateKey)
  tx4.change(address)

  entries[0].balance.sharesAgainst = 0

  expect(isValidMarketUpdateTx(tx4, tx3, entries)).toBe(true)

  // Decide market
  const decision = 1
  const sig1 = getSignature(decision, privKey1)
  const sig2 = getSignature(decision, privKey2)

  const tx5 = getDecideTx(tx4, decision, [sig1, sig2])
  fundTx(tx5, privateKey, address, utxos)

  expect(isValidMarketUpdateTx(tx5, tx4, entries)).toBe(true)

  // Redeem balance
  const tx6 = getRedeemTx(tx5, entries, privateKey)
  tx6.change(address)

  entries[0].balance.sharesFor = 0
  entries[0].balance.sharesAgainst = 0

  expect(isValidMarketUpdateTx(tx6, tx5, entries)).toBe(true)
})
