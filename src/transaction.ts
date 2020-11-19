import { bsv, SigHashPreimage, PubKey, Bytes, toHex } from "scryptlib"
import { getASM, getInitMarketStatus } from "./pm"
import { getMinerPubString, minerDetail } from "./rabin"
import { getLmsrSats } from "./lmsr"
import { getMerkleRoot } from "./merkleTree"

const feeb = 0.5
const identifier = "25c78e732e3af9aa593d1f71912775bcb2ada1bf" // TODO:

const Signature = bsv.crypto.Signature
const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_SINGLE | Signature.SIGHASH_FORKID

export type marketDetails = {
  resolve: string
}

// export async function fetchMinerDetails(): Promise<minerDetail[]> {
//   // TODO: Implement
// }

function getTotalVotes(minerDetails: minerDetail[]): number {
  return minerDetails.reduce((votes: number, miner: minerDetail) => votes + miner.votes, 0)
}

export function isValidMinerDetails(minerDetails: minerDetail[]): boolean {
  return getTotalVotes(minerDetails) === 100
}

export function getInitLockingScript(
  minerKeys: string,
  marketDetails: marketDetails,
  marketStatus: string
): bsv.Script {
  const asm = getASM(minerKeys)

  const fullScript = `${asm} OP_RETURN ${identifier} ${JSON.stringify(marketDetails)} ${marketStatus}`

  return bsv.Script.fromASM(fullScript)
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
  liquidity: number,
  publicKey: bsv.PublicKey,
  minerDetails: minerDetail[]
  // utxos: bsv.Transaction.UnspentOutput[]
): bsv.Transaction {
  const tx = new bsv.Transaction()

  const pubKey = publicKey.toString()
  const marketStatus = getInitMarketStatus(pubKey, liquidity)
  const minerVoteString = getMinerPubString(minerDetails)

  const script = getInitLockingScript(minerVoteString, marketDetails, marketStatus)

  const contractBalance = getLmsrSats(liquidity, 0, 0)
  tx.addOutput(new bsv.Transaction.Output({ script, satoshis: contractBalance }))

  tx.feePerKb(feeb * 1000)

  // tx.from(utxos)

  // signTx(tx, privateKey, script.toASM(), contractBalance, 0, sighashType)
  return tx
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
    new Bytes(lastMerklePath)
    // "OP_1"
  ].join(" ")
  return bsv.Script.fromASM(asm)
}

export function buildAddEntryTx(
  prevTx: bsv.Transaction,
  balances: string[],
  liquidity: number,
  sharesFor: number,
  sharesAgainst: number,
  pubKey: string
) {
  const oldMerkleRoot = getMerkleRoot(balances)
  const prevASM = prevTx.outputs[0].script.toASM().split(" ")
  const prevOpReturnIndex = prevASM.findIndex(op => op === "OP_RETURN")
  const prevOpReturn = prevASM.slice()
}

export function fundTx(
  tx: bsv.Transaction,
  privateKey: bsv.PrivateKey,
  utxos: bsv.Transaction.UnspentOutput[]
): bsv.Transaction {
  const address = privateKey.toAddress().toString()

  tx.change(address)

  tx.from(utxos)

  tx.sign(privateKey)
  // signTx(tx, privateKey, tx.outputs[0].script.toASM(), contractBalance, 1, sighashType)

  return tx
}

export const b = bsv
