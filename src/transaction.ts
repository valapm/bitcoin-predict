import { bsv, SigHashPreimage, Bytes, Sig, Ripemd160 } from "scryptlib"
import {
  getMarketVersion,
  getMarketStatusfromHex,
  getMarketBalance,
  entry,
  getMarketDetailsFromHex,
  isValidMarketInfo,
  validateEntries,
  marketInfo,
  getMerklePath,
  getEntryHex,
  getToken,
  getBalanceMerkleRoot as getMerkleRoot,
  getMinMarketSatBalance,
  voteCountByteLen,
  balanceTableByteLength,
  getSharesHex,
  developerPayoutAddress
} from "./pm"
import {
  getOracleDetailsFromHex,
  oracleInfoByteLength,
  oracleStateByteLength,
  commitmentHash,
  getSignature as getOracleSig
} from "./oracle"
import { getLmsrSats, SatScaling, balance } from "./lmsr"
import { getMerkleRootByPath } from "./merkleTree"
import { sha256 } from "./sha"
import { DEFAULT_FLAGS } from "scryptlib/dist/utils"
import { rabinPrivKey, privKeyToPubKey } from "rabinsig"
import { hex2IntArray, int2Hex, getIntFromOP, reverseHex } from "./hex"

const feeb = 0.5

const Signature = bsv.crypto.Signature

const opReturnDataLength = 3

// export function getLockingScript(market: marketInfo): bsv.Script {
//   const asm = getLockingScriptASM(market.oracles).join(" ")
//   const marketBalanceHex = getBalanceHex(market.balance) + String(market.balanceMerkleRoot)
//   const marketDetailsHex = getMarketDetailsHex(market.details)
//   const marketStatusHex = getMarketStatusHex(market.status)

//   const fullScript = `${asm} OP_RETURN ${identifier} ${marketDetailsHex} ${marketStatusHex + marketBalanceHex}`

//   return bsv.Script.fromASM(fullScript)
// }

// export function getLockingScript(market: marketInfo): bsv.Script {
//   const token = getToken(market.oracles)

//   const marketBalanceHex = getBalanceHex(market.balance) + String(market.balanceMerkleRoot)
//   const marketDetailsHex = getMarketDetailsHex(market.details)
//   const marketStatusHex = getMarketStatusHex(market.status)

//   token.setDataPart(`${identifier} ${marketDetailsHex} ${marketStatusHex + marketBalanceHex}`)

//   return token.lockingScript as bsv.Script
// }

// export function getOpReturnHex(market: marketInfo): string {
//   const marketBalanceHex = getBalanceHex(market.balance) + String(market.balanceMerkleRoot)
//   const marketDetailsHex = getMarketDetailsHex(market.details)
//   const marketStatusHex = getMarketStatusHex(market.status)

//   return `${identifier} ${marketDetailsHex} ${marketStatusHex + marketBalanceHex}`
// }

export function buildTx(market: marketInfo): bsv.Transaction {
  const token = getToken(market)

  const contractBalance = getLmsrSats(market.balance)

  const tx = new bsv.Transaction()
  tx.addOutput(new bsv.Transaction.Output({ script: token.lockingScript, satoshis: contractBalance }))

  tx.feePerKb(feeb * 1000)

  return tx
}

export function getUpdateMarketTx(
  prevTx: bsv.Transaction,
  market: marketInfo,
  unlockingScript: bsv.Script = bsv.Script.empty()
): bsv.Transaction {
  const tx = buildTx(market)

  tx.addInput(
    bsv.Transaction.Input.fromObject({
      prevTxId: prevTx.hash,
      outputIndex: 0,
      script: unlockingScript,
      output: prevTx.outputs[0] // prevTx of newTx here?
    })
  )

  const prevBalance = prevTx.outputs[0].satoshis
  const newBalance = tx.outputs[0].satoshis

  // Add fee outputs to dev and creator
  const redeemSats = prevBalance - newBalance
  if (redeemSats > 0) {
    const version = getMarketVersion(market.version)

    const developerSatFee = Math.floor((version.devFee * redeemSats) / 100)
    const creatorSatFee = Math.floor((market.creatorFee * redeemSats) / 100)

    tx.to(bsv.Address.fromHex(developerPayoutAddress), developerSatFee)
    tx.to(market.creator.payoutAddress, creatorSatFee)
  }

  return tx
}

export function getPreimage(prevTx: bsv.Transaction, newTx: bsv.Transaction, signSighash: number): Buffer {
  // TODO: Maybe prevTx could be replaced by a market
  // script could get generated using market.oracles
  const preimageBuf = bsv.Transaction.sighash.sighashPreimage(
    newTx,
    signSighash,
    0,
    prevTx.outputs[0].script,
    prevTx.outputs[0].satoshisBN,
    DEFAULT_FLAGS
  )
  return preimageBuf
}

export function getMarketFromScript(script: bsv.Script): marketInfo {
  const asm = script.toASM().split(" ")
  const opReturnData = asm.slice(asm.length - opReturnDataLength, asm.length)
  const stateData = opReturnData[2]
  const version = getMarketVersion(opReturnData[0])

  const oracleKeysHex = asm[version.oracleKeyPos]
  const oracleCount = oracleKeysHex.length / (oracleInfoByteLength * 2)

  const globalOptionCount = getIntFromOP(asm[version.globalOptionCountPos])

  const balanceTableRootPos = stateData.length - balanceTableByteLength * 2
  const balanceTableRoot = stateData.slice(balanceTableRootPos)

  const globalShareStatusPos = balanceTableRootPos - globalOptionCount * 2
  const globalShareStatus = stateData.slice(globalShareStatusPos, balanceTableRootPos)

  const globalLiquidityPos = globalShareStatusPos - 2
  const globalLiquidity = parseInt(stateData.slice(globalLiquidityPos, globalShareStatusPos), 16)

  const globalVotesLength = globalOptionCount * voteCountByteLen * 2
  const globalVotesPos = globalLiquidityPos - globalVotesLength
  const globalVotesHex = stateData.slice(globalVotesPos, globalLiquidityPos)

  const oracleStatesLen = oracleCount * oracleStateByteLength * 2
  const oracleStatesPos = globalVotesPos - oracleStatesLen
  const globalOracleStates = stateData.slice(oracleStatesPos, globalVotesPos)

  // console.log(balanceTableRoot)
  // console.log()
  // console.log(globalShareStatus)
  // console.log(globalLiquidity)
  // console.log(globalVotesHex)
  // console.log(globalOracleStates)

  const gobalDecisionPos = oracleStatesPos - 4
  const globalDecisionState = stateData.slice(gobalDecisionPos, oracleStatesPos)

  return {
    version: opReturnData[0],
    details: getMarketDetailsFromHex(opReturnData[1]),
    status: getMarketStatusfromHex(globalDecisionState, globalVotesHex),
    oracles: getOracleDetailsFromHex(oracleKeysHex, globalOracleStates),
    balance: {
      liquidity: globalLiquidity,
      shares: hex2IntArray(globalShareStatus)
    },
    balanceMerkleRoot: balanceTableRoot,
    creator: {
      pubKey: bsv.PublicKey.fromHex(asm[version.creatorPubKeyPos]),
      payoutAddress: bsv.Address.fromHex("00" + asm[version.creatorPayoutAddressPos])
    },
    creatorFee: getIntFromOP(asm[version.creatorFeePos]),
    requiredVotes: getIntFromOP(asm[version.requiredVotesPos])
  }
}

export function isValidMarketUpdateTx(tx: bsv.Transaction, prevTx: bsv.Transaction, entries: entry[]): boolean {
  const lockingScript = prevTx.outputs[0].script
  const unlockingScript = tx.inputs[0].script
  const interpreter = bsv.Script.Interpreter()
  return (
    interpreter.verify(unlockingScript, lockingScript, tx, 0, DEFAULT_FLAGS, prevTx.outputs[0].satoshisBN) &&
    isValidMarketTx(tx, entries)
  )
}

export function isValidMarketTx(tx: bsv.Transaction, entries: entry[]): boolean {
  const script = tx.outputs[0].script
  const balance = tx.outputs[0].satoshis
  const market = getMarketFromScript(script)

  const hasValidSatBalance = getMinMarketSatBalance(market, entries) <= balance
  const hasValidMarketBalance = market.status.decided ? true : validateEntries(market, entries)

  return (
    tx.verify() === true &&
    !tx.getSerializationError() &&
    isValidMarketInfo(market) &&
    hasValidMarketBalance &&
    hasValidSatBalance
  )
}

export function getAddEntryTx(
  prevTx: bsv.Transaction,
  prevEntries: entry[],
  entry: entry,
  payoutAddress: bsv.Address,
  utxos: bsv.Transaction.UnspentOutput[],
  spendingPrivKey: bsv.PrivateKey
): bsv.Transaction {
  const prevMarket = getMarketFromScript(prevTx.outputs[0].script)
  const optionCount = prevMarket.details.options.length

  const lastEntry = getEntryHex(prevEntries[prevEntries.length - 1])
  const lastMerklePath = getMerklePath(prevEntries, prevEntries.length - 1)

  const newEntries = prevEntries.concat([entry])
  const newGlobalBalance = getMarketBalance(newEntries, optionCount)

  const newMarket: marketInfo = {
    ...prevMarket,
    balance: newGlobalBalance,
    balanceMerkleRoot: getMerkleRoot(newEntries)
  }

  const newTx = getUpdateMarketTx(prevTx, newMarket)

  fundTx(newTx, spendingPrivKey, payoutAddress, utxos)

  const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID

  const preimage = getPreimage(prevTx, newTx, sighashType)

  const changeOutput = newTx.getChangeOutput()
  const changeSats = changeOutput ? changeOutput.satoshis : 0

  const token = getToken(prevMarket)

  token.txContext = { tx: newTx, inputIndex: 0, inputSatoshis: prevTx.outputs[0].satoshis }

  const unlockingScript = token
    .updateMarket(
      new SigHashPreimage(preimage.toString("hex")),
      1, // action = Add entry
      new Ripemd160(payoutAddress.hashBuffer.toString("hex")),
      changeSats,
      new Bytes(getEntryHex(entry)),
      new Bytes(lastEntry),
      new Bytes(lastMerklePath),
      0,
      new Bytes(""),
      new Sig("00"),
      new Bytes(""),
      0,
      0n,
      0,
      0
    )
    .toScript() as bsv.Script

  // console.log([
  //   new SigHashPreimage(preimage.toString("hex")).toLiteral(),
  //   1, // action = Add entry
  //   new Ripemd160(payoutAddress.hashBuffer.toString("hex")).toLiteral(),
  //   changeSats,
  //   new Bytes(getEntryHex(entry)).toLiteral(),
  //   new Bytes(lastEntry).toLiteral(),
  //   new Bytes(lastMerklePath).toLiteral(),
  //   0,
  //   new Bytes("").toLiteral(),
  //   new Sig("00").toLiteral(),
  //   new Bytes("").toLiteral(),
  //   0,
  //   0n,
  //   0,
  //   0
  // ])

  newTx.inputs[0].setScript(unlockingScript)

  // console.log(newTx.toString())
  // console.log(prevTx.outputs[0].satoshis)

  // const asm = prevTx.outputs[0].script.toASM().split(" ")
  // console.log(asm.slice(asm.length - opReturnDataLength, asm.length).join(" "))

  return newTx
}

export function getUpdateEntryTx(
  prevTx: bsv.Transaction,
  prevEntries: entry[],
  newBalance: balance,
  privateKey: bsv.PrivateKey,
  payoutAddress: bsv.Address,
  utxos: bsv.Transaction.UnspentOutput[],
  spendingPrivKey: bsv.PrivateKey
): bsv.Transaction {
  const prevMarket = getMarketFromScript(prevTx.outputs[0].script)
  const optionCount = prevMarket.details.options.length

  const publicKey = privateKey.publicKey
  const entryIndex = prevEntries.findIndex(entry => entry.publicKey.toString() === publicKey.toString())

  if (entryIndex === -1) throw new Error("No entry with this publicKey found.")

  const oldEntry = prevEntries[entryIndex]
  const newEntry: entry = {
    balance: newBalance,
    publicKey
  }

  const newEntries = [...prevEntries]
  newEntries[entryIndex] = newEntry
  const newGlobalBalance = getMarketBalance(newEntries, optionCount)

  const merklePath = getMerklePath(prevEntries, entryIndex)
  const newMerklePath = getMerklePath(newEntries, entryIndex)

  const newMarket: marketInfo = {
    ...prevMarket,
    balance: newGlobalBalance,
    balanceMerkleRoot: getMerkleRootByPath(sha256(getEntryHex(newEntry)), newMerklePath)
  }

  const newTx = getUpdateMarketTx(prevTx, newMarket)

  if (prevMarket.status.decided) {
    const decision = prevMarket.status.decision
    const winningShares = oldEntry.balance.shares[decision]
    const redeemed = winningShares - newEntry.balance.shares[decision]

    // FIXME: market creator can redeem invalid tokens as well if resolved

    if (redeemed) {
      const redeemSats = redeemed * SatScaling
      newTx.outputs[0].satoshis = prevTx.outputs[0].satoshis - redeemSats
    }
  }

  fundTx(newTx, spendingPrivKey, payoutAddress, utxos)

  const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID

  const preimage = getPreimage(prevTx, newTx, sighashType)

  const signature = getSignature(preimage, privateKey, sighashType)

  const changeOutput = newTx.getChangeOutput()
  const changeSats = changeOutput ? changeOutput.satoshis : 0

  const token = getToken(prevMarket)

  token.txContext = { tx: newTx, inputIndex: 0, inputSatoshis: prevTx.outputs[0].satoshis }

  const unlockingScript = token
    .updateMarket(
      new SigHashPreimage(preimage.toString("hex")),
      2, // action = Update entry
      new Ripemd160(payoutAddress.hashBuffer.toString("hex")),
      changeSats,
      new Bytes(getEntryHex(newEntry)),
      new Bytes(""),
      new Bytes(""),
      oldEntry.balance.liquidity,
      new Bytes(getSharesHex(oldEntry.balance.shares)),
      new Sig(signature.toString("hex")),
      new Bytes(merklePath),
      0,
      0n,
      0,
      0
    )
    .toScript() as bsv.Script

  // console.log([
  //   new SigHashPreimage(preimage.toString("hex")).toLiteral(),
  //   2, // action = Update entry
  //   new Ripemd160(payoutAddress.hashBuffer.toString("hex")).toLiteral(),
  //   changeSats,
  //   new Bytes(getEntryHex(newEntry)).toLiteral(),
  //   new Bytes("").toLiteral(),
  //   new Bytes("").toLiteral(),
  //   oldEntry.balance.liquidity,
  //   new Bytes(getSharesHex(oldEntry.balance.shares)).toLiteral(),
  //   new Sig(signature.toString("hex")).toLiteral(),
  //   new Bytes(merklePath).toLiteral(),
  //   0,
  //   0n,
  //   0,
  //   0
  // ])

  newTx.inputs[0].setScript(unlockingScript)

  // console.log(newTx.toString())
  // console.log(prevTx.outputs[0].satoshis)

  // const asm = prevTx.outputs[0].script.toASM().split(" ")
  // console.log(asm.slice(asm.length - opReturnDataLength, asm.length).join(" "))

  return newTx
}

export function getOracleCommitTx(
  prevTx: bsv.Transaction,
  rabinPrivKey: rabinPrivKey,
  payoutAddress: bsv.Address,
  utxos: bsv.Transaction.UnspentOutput[],
  spendingPrivKey: bsv.PrivateKey
): bsv.Transaction {
  // TODO: Offer option to fund transaction separately?

  const prevMarket = getMarketFromScript(prevTx.outputs[0].script)
  const token = getToken(prevMarket)

  const rabinPubKey = privKeyToPubKey(rabinPrivKey.p, rabinPrivKey.q)

  const oracleIndex = prevMarket.oracles.findIndex(oracle => oracle.pubKey === rabinPubKey)
  const oracle = prevMarket.oracles[oracleIndex]

  if (!oracle) throw new Error("Oracle not found.")

  const newOracles = prevMarket.oracles
  newOracles[oracleIndex] = {
    ...oracle,
    committed: true
  }

  const newMarket = {
    ...prevMarket,
    oracles: newOracles
  }

  const newTx = getUpdateMarketTx(prevTx, newMarket)

  const sigContent = commitmentHash + reverseHex(prevTx.hash)
  const signature = getOracleSig(sigContent, rabinPrivKey)
  const signatureBytes = int2Hex(signature.signature)

  const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_SINGLE | Signature.SIGHASH_FORKID
  const preimage = getPreimage(prevTx, newTx, sighashType)

  token.txContext = { tx: newTx, inputIndex: 0, inputSatoshis: prevTx.outputs[0].satoshis }

  const unlockingScript = token
    .updateMarket(
      new SigHashPreimage(preimage.toString("hex")),
      3, // action = Update entry
      new Ripemd160("00"),
      0,
      new Bytes(""),
      new Bytes(""),
      new Bytes(""),
      0,
      new Bytes(""),
      new Sig("00"),
      new Bytes(""),
      oracleIndex,
      signature.signature,
      signature.paddingByteCount,
      0
    )
    .toScript() as bsv.Script

  // console.log([
  //   new SigHashPreimage(preimage.toString("hex")).toLiteral(),
  //   3, // action = Update entry
  //   new Ripemd160("00").toLiteral(),
  //   0,
  //   new Bytes("").toLiteral(),
  //   new Bytes("").toLiteral(),
  //   new Bytes("").toLiteral(),
  //   0,
  //   new Bytes("").toLiteral(),
  //   new Sig("00").toLiteral(),
  //   new Bytes("").toLiteral(),
  //   oracleIndex,
  //   signature.signature.toString(),
  //   signature.paddingByteCount,
  //   0
  // ])

  newTx.inputs[0].setScript(unlockingScript)

  fundTx(newTx, spendingPrivKey, payoutAddress, utxos)

  // console.log(newTx.toString())
  // console.log(prevTx.outputs[0].satoshis)

  // const asm = prevTx.outputs[0].script.toASM().split(" ")
  // console.log(asm.slice(asm.length - opReturnDataLength, asm.length).join(" "))

  return newTx
}

export function getOracleVoteTx(
  prevTx: bsv.Transaction,
  vote: number,
  rabinPrivKey: rabinPrivKey,
  payoutAddress: bsv.Address,
  utxos: bsv.Transaction.UnspentOutput[],
  spendingPrivKey: bsv.PrivateKey
): bsv.Transaction {
  // TODO: Offer option to fund transaction separately?

  const prevMarket = getMarketFromScript(prevTx.outputs[0].script)
  const token = getToken(prevMarket)

  const rabinPubKey = privKeyToPubKey(rabinPrivKey.p, rabinPrivKey.q)

  const oracleIndex = prevMarket.oracles.findIndex(oracle => oracle.pubKey === rabinPubKey)
  const oracle = prevMarket.oracles[oracleIndex]

  if (!oracle) throw new Error("Oracle not found.")
  if (!oracle.committed) throw new Error("Oracle not committed to this market yet.")
  if (oracle.voted) throw new Error("Oracle already voted.")

  const newOracles = prevMarket.oracles
  newOracles[oracleIndex] = {
    ...oracle,
    voted: true
  }

  const newVotes = prevMarket.status.votes
  newVotes[oracleIndex] = newVotes[oracleIndex] + oracle.votes

  const newMarket = {
    ...prevMarket,
    oracles: newOracles
  }
  newMarket.status.votes = newVotes

  const newTx = getUpdateMarketTx(prevTx, newMarket)

  const sigContent = int2Hex(vote, 1) + reverseHex(prevTx.hash)
  const signature = getOracleSig(sigContent, rabinPrivKey)

  console.log(sigContent)

  const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_SINGLE | Signature.SIGHASH_FORKID
  const preimage = getPreimage(prevTx, newTx, sighashType)

  token.txContext = { tx: newTx, inputIndex: 0, inputSatoshis: prevTx.outputs[0].satoshis }

  const unlockingScript = token
    .updateMarket(
      new SigHashPreimage(preimage.toString("hex")),
      4, // action = Update entry
      new Ripemd160("00"),
      0,
      new Bytes(""),
      new Bytes(""),
      new Bytes(""),
      0,
      new Bytes(""),
      new Sig("00"),
      new Bytes(""),
      oracleIndex,
      signature.signature,
      signature.paddingByteCount,
      vote
    )
    .toScript() as bsv.Script

  // console.log([
  //   new SigHashPreimage(preimage.toString("hex")).toLiteral(),
  //   4, // action = Update entry
  //   new Ripemd160("00").toLiteral(),
  //   0,
  //   new Bytes("").toLiteral(),
  //   new Bytes("").toLiteral(),
  //   new Bytes("").toLiteral(),
  //   0,
  //   new Bytes("").toLiteral(),
  //   new Sig("00").toLiteral(),
  //   new Bytes("").toLiteral(),
  //   oracleIndex,
  //   signature.signature.toString(),
  //   signature.paddingByteCount,
  //   vote
  // ])

  newTx.inputs[0].setScript(unlockingScript)

  fundTx(newTx, spendingPrivKey, payoutAddress, utxos)

  // console.log(newTx.toString())
  // console.log(prevTx.outputs[0].satoshis)

  // const asm = prevTx.outputs[0].script.toASM().split(" ")
  // console.log(asm.slice(asm.length - opReturnDataLength, asm.length).join(" "))

  return newTx
}

export function getDecideTx(
  prevTx: bsv.Transaction,
  result: 1 | 0,
  rabinPrivKey: rabinPrivKey,
  payoutAddress: bsv.Address,
  utxos: bsv.Transaction.UnspentOutput[],
  spendingPrivKey: bsv.PrivateKey
): bsv.Transaction {
  // TODO: Offer option to fund transaction separately?
  const prevMarket = getMarketFromScript(prevTx.outputs[0].script)
  const token = getToken(prevMarket)

  const rabinPubKey = privKeyToPubKey(rabinPrivKey.p, rabinPrivKey.q)

  const oracleIndex = prevMarket.oracles.findIndex(oracle => oracle.pubKey === rabinPubKey)
  const oracle = prevMarket.oracles[oracleIndex]

  if (!oracle) throw new Error("Oracle not found.")

  const newOracles = prevMarket.oracles
  newOracles[oracleIndex] = {
    ...oracle,
    committed: true
  }

  const newMarket = {
    ...prevMarket,
    oracles: newOracles
  }

  const newTx = getUpdateMarketTx(prevTx, newMarket)

  const sigContent = commitmentHash + prevTx.hash
  const signature = getOracleSig(sigContent, rabinPrivKey)
  const signatureBytes = int2Hex(signature.signature)

  const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_SINGLE | Signature.SIGHASH_FORKID
  const preimage = getPreimage(prevTx, newTx, sighashType)

  token.txContext = { tx: newTx, inputIndex: 0, inputSatoshis: prevTx.outputs[0].satoshis }

  const unlockingScript = token
    .updateMarket(
      new SigHashPreimage(preimage.toString("hex")),
      3, // action = Update entry
      new Bytes(""),
      0,
      new Bytes(""),
      new Bytes(""),
      new Bytes(""),
      0,
      new Bytes(""),
      new Sig("00"),
      new Bytes(""),
      oracleIndex,
      signature.signature,
      signature.paddingByteCount,
      0
    )
    .toScript() as bsv.Script

  newTx.inputs[0].setScript(unlockingScript)

  fundTx(newTx, spendingPrivKey, payoutAddress, utxos)

  return newTx
}

export function getSignature(preimage: Buffer, privateKey: bsv.PrivateKey, sighashType: number): Buffer {
  const preimageHash = bsv.crypto.Hash.sha256sha256(preimage)
  const buffer = new bsv.encoding.BufferReader(preimageHash).readReverse()

  return bsv.crypto.ECDSA.sign(buffer, privateKey, "little")
    .set({
      nhashtype: sighashType
    })
    .toTxFormat()
}

export function fundTx(
  tx: bsv.Transaction,
  privateKey: bsv.PrivateKey,
  changeAddress: bsv.Address,
  utxos: bsv.Transaction.UnspentOutput[]
): bsv.Transaction {
  const inputCount = tx.inputs.length

  // Handle dust limit TODO: Is at 135 now, 0 @ end 2021
  const dustLimit = bsv.Transaction.DUST_AMOUNT
  const marketOutput = tx.outputs[0]
  if (marketOutput.satoshis < dustLimit) {
    marketOutput.satoshis = dustLimit
  }

  tx.change(changeAddress)

  tx.from(utxos)

  // Check amount
  if (tx.inputAmount < tx.outputAmount) throw new Error(`Input amount needs to be at least ${tx.outputAmount}`)

  const fundingInputs = tx.inputs.slice(inputCount, tx.inputs.length)

  fundingInputs.forEach((input: bsv.Transaction.Input, index: number) => {
    const [signature] = input.getSignatures(tx, privateKey, index + inputCount)
    if (!signature) throw new Error("Invalid privateKey")
    input.addSignature(tx, signature)
  })

  return tx
}

// export function getDebugParams(tx: bsv.Transaction): string {
//   function getBytes(asm: string): string {
//     const bytes = asm === "0" ? "" : asm
//     return new Bytes(bytes).toLiteral()
//   }

//   const unlockingScript = tx.inputs[0].script.toASM().split(" ")
//   const tokenParams = [
//     // new SigHashPreimage(unlockingScript[0]).toLiteral(),
//     getIntFromOP(unlockingScript[1]), // action = Add entry
//     new Ripemd160(unlockingScript[2]).toLiteral(),
//     getIntFromOP(unlockingScript[3]),
//     getBytes(unlockingScript[4]),
//     getBytes(unlockingScript[5]),
//     getBytes(unlockingScript[6]),
//     getIntFromOP(unlockingScript[7]),
//     getBytes(unlockingScript[8]),
//     new Sig(unlockingScript[9]).toLiteral(),
//     getBytes(unlockingScript[10]),
//     getIntFromOP(unlockingScript[11]),
//     hex2BigInt(unlockingScript[12]).toString(),
//     getIntFromOP(unlockingScript[13]),
//     getIntFromOP(unlockingScript[14])
//   ]
//   return JSON.stringify(tokenParams)
// }
