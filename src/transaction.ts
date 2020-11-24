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
  balanceHexLength,
  getBalanceHex
} from "./pm"
import { minerDetail, getMinerDetailsFromHex } from "./oracle"
import { getLmsrSats } from "./lmsr"
import { getMerkleRoot } from "./merkleTree"
import { hash } from "./sha"

const feeb = 0.5
const identifier = "25c78e732e3af9aa593d1f71912775bcb2ada1bf"

const Signature = bsv.crypto.Signature
const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_SINGLE | Signature.SIGHASH_FORKID

const opReturnDataLength = 3

export function getLockingScript(market: market): bsv.Script {
  const asm = getLockingScriptASM(market.miners).join(" ")
  const marketBalanceHex = getBalanceHex(market.balance) + String(market.balanceMerkleRoot)
  const marketDetailsHex = getMarketDetailsHex(market.details)
  const marketStatusHex = getMarketStatusHex(market.status)

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

export function getBalanceMerkleRoot(opReturnData: string[]): hash {
  const position = marketStatusHexLength + balanceHexLength
  return opReturnData[2].slice(position, position + 64)
}

// export function buildInitTx(
//   marketDetails: marketDetails,
//   minerDetails: minerDetail[],
//   entries: entry[]
// ): bsv.Transaction {
//   const status = { decided: false, decision: 0 }
//   return buildTx(...)
// }

export function buildTx(market: market): bsv.Transaction {
  const script = getLockingScript(market)
  const contractBalance = getLmsrSats(market.balance)

  const tx = new bsv.Transaction()
  tx.addOutput(new bsv.Transaction.Output({ script, satoshis: contractBalance }))

  tx.feePerKb(feeb * 1000)

  // tx.from(utxos)

  // signTx(tx, privateKey, script.toASM(), contractBalance, 0, sighashType)
  return tx
}

export function getPreimage(prevTx: bsv.Transaction, market: market): SigHashPreimage {
  const tx = buildTx(market)
  tx.addInput(
    bsv.Transaction.Input.fromObject({
      prevTxId: prevTx.hash,
      outputIndex: 0,
      script: prevTx.outputs[0].script
    })
  )

  const preimageBuf = bsv.Transaction.sighash.sighashPreimage(
    tx,
    sighashType,
    0,
    prevTx.outputs[0].script,
    prevTx.outputs[0].satoshisBN
  )
  return new SigHashPreimage(preimageBuf.toString("hex"))
}

// export function buildUpdateTx(prevOut: bsv.Transaction.Output) {
//   // TODO:
// }

export function getMarketFromScript(script: bsv.Script): market {
  const data = getOpReturnData(script)
  return {
    details: getMarketDetails(data),
    status: getMarketStatus(data),
    miners: getMinerDetails(script),
    balance: getBalance(data),
    balanceMerkleRoot: getBalanceMerkleRoot(data)
  }
}

export function isValidMarketTx(tx: bsv.Transaction, entries: entry[]): boolean {
  const script = tx.outputs[0].script
  const balance = tx.outputs[0].satoshis
  const market = getMarketFromScript(script)

  const hasValidBalance = balance === getLmsrSats(market.balance)

  return tx.verify() === true && isValidMarket(market) && validateEntries(market.balance, entries) && hasValidBalance
}

export function getAddEntryUnlockingScript(
  preimage: string,
  liquidity: number,
  sharesFor: number,
  sharesAgainst: number,
  pubKey: string,
  newLmsrBalance: number,
  newLmsrMerklePath: string,
  lastEntry: string,
  lastMerklePath: string
): bsv.Script {
  const asm = [
    new SigHashPreimage(toHex(preimage)),
    liquidity,
    sharesFor,
    sharesAgainst,
    new PubKey(pubKey),
    newLmsrBalance,
    new Bytes(newLmsrMerklePath),
    new Bytes(lastEntry),
    new Bytes(lastMerklePath),
    "OP_1" // Selects scrypt functino to call
  ].join(" ")
  return bsv.Script.fromASM(asm)
}

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
