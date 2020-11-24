import { bsv, SigHashPreimage, PubKey, Bytes, toHex } from "scryptlib"
import {
  getLockingScriptASM,
  getMarketStatusHex,
  getMarketStatusfromHex,
  getMarketBalance,
  getMarketBalanceHex,
  balance,
  marketDetails,
  entry,
  marketStatus,
  getBalanceFromHex,
  getMarketDetailsHex,
  getMarketDetailsFromHex,
  isValidMarket,
  validateEntries,
  market,
  marketStatusHexLength,
  balanceHexLength
} from "./pm"
import { minerDetail, getMinerDetailsFromHex } from "./oracle"
import { getLmsrSats } from "./lmsr"
import { getMerkleRoot } from "./merkleTree"

const feeb = 0.5
const identifier = "25c78e732e3af9aa593d1f71912775bcb2ada1bf"

const Signature = bsv.crypto.Signature
const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_SINGLE | Signature.SIGHASH_FORKID

const opReturnDataLength = 3

export function getLockingScript(
  minerDetails: minerDetail[],
  marketDetails: marketDetails,
  marketStatus: marketStatus,
  entries: entry[]
): bsv.Script {
  const asm = getLockingScriptASM(minerDetails).join(" ")
  const marketBalanceHex = getMarketBalanceHex(entries)
  const marketDetailsHex = getMarketDetailsHex(marketDetails)
  const marketStatusHex = getMarketStatusHex(marketStatus)

  const fullScript = `${asm} OP_RETURN ${identifier} ${marketDetailsHex} ${marketStatusHex + marketBalanceHex}`

  return bsv.Script.fromASM(fullScript)
}

export function getOpReturnData(script: bsv.Script): string[] {
  const asm = script.toASM().split(" ")
  return asm.slice(asm.length - opReturnDataLength, asm.length)
}

export function getMinerDetails(script: bsv.Script): minerDetail[] {
  const minerHex = script.toASM().split(" ")[7]
  return getMinerDetailsFromHex(minerHex)
}

export function getMarketDetails(opReturnData: string[]): marketDetails {
  return getMarketDetailsFromHex(opReturnData[1])
}

export function getMarketStatus(opReturnData: string[]): marketStatus {
  const decisionHex = opReturnData[2].slice(0, marketStatusHexLength)
  return getMarketStatusfromHex(decisionHex)
}

export function getBalance(opReturnData: string[]): balance {
  const balanceHex = opReturnData[2].slice(marketStatusHexLength, marketStatusHexLength + balanceHexLength)
  return getBalanceFromHex(balanceHex)
}

export function getUpdateLockingScript(prevOut: bsv.Transaction.Output, marketStatus: string): bsv.Script {
  const asmList = prevOut.script.toASM().split(" ")
  const newASM = asmList
    .slice(0, asmList.length - 1)
    .concat([marketStatus])
    .join(" ")
  return bsv.Script.fromASM(newASM)
}

export function buildInitTx(
  marketDetails: marketDetails,
  minerDetails: minerDetail[],
  entries: entry[]
): bsv.Transaction {
  const marketStatus = { decided: false, decision: 0 }

  const script = getLockingScript(minerDetails, marketDetails, marketStatus, entries)
  const marketBalance = getMarketBalance(entries)

  const contractBalance = getLmsrSats(marketBalance.liquidity, marketBalance.sharesFor, marketBalance.sharesAgainst)

  const tx = new bsv.Transaction()

  tx.addOutput(new bsv.Transaction.Output({ script, satoshis: contractBalance }))

  tx.feePerKb(feeb * 1000)

  // tx.from(utxos)

  // signTx(tx, privateKey, script.toASM(), contractBalance, 0, sighashType)
  return tx
}

export function isValidMarketTx(tx: bsv.Transaction, entries: entry[]): boolean {
  const script = tx.outputs[0].script
  const balance = tx.outputs[0].satoshis
  const data = getOpReturnData(script)
  const market: market = {
    details: getMarketDetails(data),
    status: getMarketStatus(data),
    miners: getMinerDetails(script),
    balance: getBalance(data)
  }
  const hasValidBalance =
    balance === getLmsrSats(market.balance.liquidity, market.balance.sharesFor, market.balance.sharesAgainst)

  return tx.verify() === true && isValidMarket(market) && validateEntries(market.balance, entries) && hasValidBalance
}

// export function getAddEntryUnlockingScript(
//   preimage: string,
//   liquidity: number,
//   sharesFor: number,
//   sharesAgainst: number,
//   pubKey: string,
//   newLmsrBalance: number,
//   newLmsrMerklePath: string,
//   lastEntry: string,
//   lastMerklePath: string
// ): bsv.Script {
//   const asm = [
//     new SigHashPreimage(toHex(preimage)),
//     liquidity,
//     sharesFor,
//     sharesAgainst,
//     new PubKey(pubKey),
//     newLmsrBalance,
//     new Bytes(newLmsrMerklePath),
//     new Bytes(lastEntry),
//     new Bytes(lastMerklePath)
//     // "OP_1"
//   ].join(" ")
//   return bsv.Script.fromASM(asm)
// }

// export function buildAddEntryTx(
//   prevTx: bsv.Transaction,
//   balances: string[],
//   liquidity: number,
//   sharesFor: number,
//   sharesAgainst: number,
//   pubKey: string
// ) {
//   const oldMerkleRoot = getMerkleRoot(balances)
//   const prevASM = prevTx.outputs[0].script.toASM().split(" ")
//   const prevOpReturnIndex = prevASM.findIndex(op => op === "OP_RETURN")
//   const prevOpReturn = prevASM.slice()
// }

export function fundTx(
  tx: bsv.Transaction,
  privateKey: bsv.PrivateKey,
  changeAddress: bsv.Address,
  utxos: bsv.Transaction.UnspentOutput[]
): bsv.Transaction {
  tx.change(changeAddress)
  tx.from(utxos)
  tx.sign(privateKey)
  // signTx(tx, privateKey, tx.outputs[0].script.toASM(), contractBalance, 1, sighashType)

  return tx
}
