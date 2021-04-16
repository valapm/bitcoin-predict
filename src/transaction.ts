import { bsv, SigHashPreimage, PubKey, Bytes, Sig, Ripemd160 } from "scryptlib"
import {
  getMarketVersion,
  getMarketStatusfromHex,
  getMarketBalance,
  marketDetails,
  entry,
  marketStatus,
  getBalanceFromHex,
  getMarketDetailsFromHex,
  isValidMarketInfo,
  validateEntries,
  marketInfo,
  marketStatusHexLength,
  getBalanceHexLength,
  getMerklePath,
  getEntryHex,
  getToken,
  getBalanceMerkleRoot as getMerkleRoot,
  getMinMarketSatBalance,
  versions,
  voteCountByteLen,
  balanceTableByteLength,
  getSharesHex
} from "./pm"
import {
  oracleDetail,
  getOracleDetailsFromHex,
  getOracleSigsString,
  oracleInfoByteLength,
  oracleStateByteLength
} from "./oracle"
import { getLmsrSats, getLmsrShas, getLmsrMerklePath, lmsrScaled, SatScaling, balance } from "./lmsr"
import { hash } from "./sha"
import { getMerkleRootByPath } from "./merkleTree"
import { sha256 } from "./sha"
import { DEFAULT_FLAGS } from "scryptlib/dist/utils"
import { rabinSig, rabinPrivKey } from "rabinsig"
import { cloneDeep } from "./utils"
import { hex2IntArray } from "./hex"

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

  const globalOptionCount = parseInt(asm[version.globalOptionCountPos], 16)

  const balanceTableRootPos = stateData.length - balanceTableByteLength
  const balanceTableRoot = stateData.slice(balanceTableRootPos)

  const globalShareStatusPos = balanceTableRootPos - globalOptionCount
  const globalShareStatus = stateData.slice(globalShareStatusPos, balanceTableRootPos)

  const globalLiquidityPos = globalShareStatusPos - 2
  const globalLiquidity = parseInt(stateData.slice(globalLiquidityPos, globalShareStatusPos), 16)

  const globalVotesLength = globalOptionCount * voteCountByteLen
  const globalVotesPos = globalLiquidityPos - globalVotesLength
  const globalVotesHex = stateData.slice(globalVotesPos, globalLiquidityPos)

  const oracleStatesLen = oracleCount * oracleStateByteLength
  const oracleStatesPos = globalVotesPos - oracleStatesLen
  const globalOracleStates = stateData.slice(oracleStatesPos, globalVotesPos)

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
      payoutAddress: bsv.Address.fromHex(asm[version.creatorPayoutAddressPos])
    },
    creatorFee: parseInt(asm[version.creatorFeePos], 16)
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
  const newBalance = getMarketBalance(newEntries, optionCount)

  const newMarket: marketInfo = {
    ...prevMarket,
    balance: newBalance,
    balanceMerkleRoot: getMerkleRoot(newEntries)
  }

  const newTx = getUpdateMarketTx(prevTx, newMarket)

  fundTx(newTx, spendingPrivKey, payoutAddress, utxos)

  const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID
  const preimage = getPreimage(prevTx, newTx, sighashType).toString("hex")

  const changeOutput = newTx.getChangeOutput()
  const changeSats = changeOutput ? changeOutput.satoshis : 0

  const token = getToken(prevMarket)

  token.txContext = { tx: newTx, inputIndex: 0, inputSatoshis: prevTx.outputs[0].satoshis }

  const unlockingScript = token
    .updateMarket(
      new SigHashPreimage(preimage),
      1, // action = Add entry
      new Ripemd160(payoutAddress.toHex()),
      changeSats,
      new Bytes(getEntryHex(entry)),
      new Bytes(lastEntry),
      new Bytes(lastMerklePath),
      0,
      new Bytes(""),
      new Bytes(""),
      new Bytes(""),
      0,
      0,
      0,
      0
    )
    .toScript() as bsv.Script

  newTx.inputs[0].setScript(unlockingScript)
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

  const merklePath = getMerklePath(prevEntries, entryIndex)
  const newMerklePath = getMerklePath(newEntries, entryIndex)

  const newMarket: marketInfo = {
    ...prevMarket,
    balance: getMarketBalance(newEntries, optionCount),
    balanceMerkleRoot: getMerkleRootByPath(sha256(getEntryHex(newEntry)), newMerklePath)
  }

  const newTx = getUpdateMarketTx(prevTx, newMarket)

  if (prevMarket.status.decided) {
    const decision = prevMarket.status.decision
    const winningShares = oldEntry.balance.shares[decision]
    const redeemed = winningShares - newEntry.balance.shares[decision]

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
      new Ripemd160(payoutAddress.toHex()),
      changeSats,
      new Bytes(getEntryHex(newEntry)),
      new Bytes(""),
      new Bytes(""),
      oldEntry.balance.liquidity,
      new Bytes(getSharesHex(oldEntry.balance.shares)),
      new Sig(signature.toString("hex")),
      new Bytes(merklePath),
      0,
      0,
      0,
      0
    )
    .toScript() as bsv.Script

  newTx.inputs[0].setScript(unlockingScript)
  return newTx
}

export function getOracleCommitTx(prevTx: bsv.Transaction, rabinPrivKey: rabinPrivKey): bsv.Transaction {
  const prevMarket = getMarketFromScript(prevTx.outputs[0].script)
  const token = getToken(prevMarket)

  const newTx = getUpdateMarketTx(prevTx, newMarket)

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
      new Bytes(""),
      new Bytes(""),
      oraclePos,
      signature,
      paddingCount,
      0
    )
    .toScript() as bsv.Script

  newTx.inputs[0].setScript(unlockingScript)
  return newTx
}

export function getDecideTx(prevTx: bsv.Transaction, result: 1 | 0, signatures: rabinSig[]): bsv.Transaction {
  const sigHex = getOracleSigsString(signatures)

  const prevMarket = getMarketFromScript(prevTx.outputs[0].script)
  const newMarket = {
    ...prevMarket,
    status: {
      decided: true,
      decision: result
    }
  }

  const newTx = getUpdateTx(prevTx, newMarket)
  const preimage = getPreimage(prevTx, newTx)

  const token = getToken(prevMarket)

  token.txContext = { tx: newTx, inputIndex: 0, inputSatoshis: prevTx.outputs[0].satoshis }

  const unlockingScript = token
    .decide(new SigHashPreimage(preimage.toString("hex")), result, new Bytes(sigHex))
    .toScript() as bsv.Script

  newTx.inputs[0].setScript(unlockingScript)
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
  const inputAmount = tx.inputs.length

  tx.change(changeAddress)

  tx.from(utxos)

  const fundingInputs = tx.inputs.slice(inputAmount, tx.inputs.length)

  // Check amount
  if (tx.inputAmount < tx.outputAmount) throw new Error(`Input amount needs to be at least ${tx.outputAmount}`)

  fundingInputs.forEach((input: bsv.Transaction.Input, index: number) => {
    const [signature] = input.getSignatures(tx, privateKey, index + inputAmount)
    if (!signature) throw new Error("Invalid privateKey")
    input.addSignature(tx, signature)
  })

  return tx
}

export function getIntFromOP(op: string): number {
  const numString = op.startsWith("OP") ? op.slice(3) : op
  return parseInt(numString)
}

export function getFunctionName(script: bsv.Script): string {
  const asm = script.toASM().split(" ")

  const functionOp = getIntFromOP(asm[asm.length - 1])

  if (functionOp === 0) {
    return "addEntry"
  } else if (functionOp === 1) {
    return "updateEntry"
  } else if (functionOp === 2) {
    return "redeem"
  } else if (functionOp === 3) {
    return "decide"
  } else {
    throw new Error("No known function")
  }
}

export function getNewEntries(prevEntries: entry[], script: bsv.Script): entry[] {
  const asm = script.toASM().split(" ")

  const functionOp = getIntFromOP(asm[asm.length - 1])
  // const functionPos = parseInt(functionOp.slice(3))
  // const functionName = functionNames[functionPos]

  if (functionOp === 0) {
    // addEntry

    const entry: entry = {
      balance: {
        liquidity: getIntFromOP(asm[1]),
        sharesFor: getIntFromOP(asm[2]),
        sharesAgainst: getIntFromOP(asm[3])
      },
      publicKey: bsv.PublicKey.fromHex(asm[4])
    }

    const newEntries = cloneDeep(prevEntries) as entry[]
    newEntries.push(entry)
    return newEntries
  } else if (functionOp === 1) {
    // updateEntry

    const publicKey = bsv.PublicKey.fromHex(asm[7])

    const entry: entry = {
      balance: {
        liquidity: getIntFromOP(asm[1]),
        sharesFor: getIntFromOP(asm[2]),
        sharesAgainst: getIntFromOP(asm[3])
      },
      publicKey
    }

    const entryIndex = prevEntries.findIndex(entry => entry.publicKey.toString() === publicKey.toString())

    const newEntries = cloneDeep(prevEntries) as entry[]
    newEntries[entryIndex] = entry
    return newEntries
  } else if (functionOp === 2) {
    // redeem

    const publicKey = bsv.PublicKey.fromHex(asm[4])
    const entryIndex = prevEntries.findIndex(entry => entry.publicKey.toString() === publicKey.toString())

    const entry = cloneDeep(prevEntries[entryIndex]) as entry
    entry.balance.sharesFor = 0
    entry.balance.sharesAgainst = 0

    const newEntries = cloneDeep(prevEntries) as entry[]
    newEntries[entryIndex] = entry
    return newEntries
  } else {
    return prevEntries
  }
}
