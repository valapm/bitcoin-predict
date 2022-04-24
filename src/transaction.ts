import { bsv, SigHashPreimage, Bytes, Sig, Ripemd160, buildContractClass } from "scryptlib"
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
  developerPayoutAddress,
  getIndexToken,
  isValidMarketInit
} from "./pm"
import {
  getOracleDetailsFromHex,
  oracleInfoByteLength,
  oracleStateByteLength,
  commitmentHash,
  getSignature as getOracleSig,
  getOracleToken
} from "./oracle"
import { getLmsrSatsFixed, SatScaling, balance } from "./lmsr"
import { getMerkleRootByPath } from "./merkleTree"
import { sha256 } from "./sha"
import { DEFAULT_FLAGS } from "scryptlib/dist/utils"
import { rabinPrivKey, RabinSignature, rabinPubKey } from "rabinsig"
import { hex2IntArray, int2Hex, getIntFromOP, reverseHex, hex2BigInt, hex2Int, toHex } from "./hex"
import { version, marketContracts, oracleContracts, getArgPos, getMd5 } from "./contracts"
import md5 from "md5"

const feeb = 0.5

// TODO: Is at 135 now, 0 @ end 2021
export const DUST = 546

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

export function buildTx(market: marketInfo, relayFee = feeb): bsv.Transaction {
  const token = getToken(market)

  const contractBalance = getLmsrSatsFixed(market.balance) + market.status.liquidityFeePool

  const tx = new bsv.Transaction()
  let output = new bsv.Transaction.Output({ script: token.lockingScript, satoshis: contractBalance })
  const dust = getDust(output.getSize(), relayFee)

  if (dust > contractBalance) {
    output = new bsv.Transaction.Output({ script: token.lockingScript, satoshis: dust })
  }

  tx.addOutput(output)
  tx.feePerKb(relayFee * 1000)

  return tx
}

export function getNewMarketTx(
  market: marketInfo,
  prevValaIndexTx: bsv.Transaction,
  prevValaIndexOutputIndex = 0,
  feePerByte = feeb
): bsv.Transaction {
  const tx = buildTx(market, feePerByte)
  addValaIndex(tx, prevValaIndexTx, prevValaIndexOutputIndex)
  return tx
}

export function getUpdateMarketTx(
  prevTx: bsv.Transaction,
  market: marketInfo,
  outputIndex = 0,
  feePerByte = feeb,
  unlockingScript: bsv.Script = bsv.Script.empty()
): bsv.Transaction {
  const tx = buildTx(market, feePerByte)

  const input = bsv.Transaction.Input.fromObject({
    prevTxId: prevTx.hash,
    outputIndex,
    script: unlockingScript,
    output: prevTx.outputs[outputIndex] // prevTx of newTx here?
  })

  input.clearSignatures = () => {}
  input.isFullySigned = () => true

  tx.addInput(input)

  return tx
}

export function getPreimage(
  prevTx: bsv.Transaction,
  newTx: bsv.Transaction,
  signSighash: number,
  outputIndex = 0,
  inputIndex = 0
): Buffer {
  // TODO: Maybe prevTx could be replaced by a market
  // script could get generated using market.oracles
  const preimageBuf = bsv.Transaction.sighash.sighashPreimage(
    newTx,
    signSighash,
    inputIndex,
    prevTx.outputs[outputIndex].script,
    prevTx.outputs[outputIndex].satoshisBN,
    DEFAULT_FLAGS
  )

  // console.log(preimageBuf.toString("hex"))

  // const asm = prevTx.outputs[outputIndex].script.toASM().split(" ")
  // console.log(asm[asm.length - 1])

  return preimageBuf
}

export function getMarketFromScript(script: bsv.Script): marketInfo {
  const asm = script.toASM().split(" ")
  const opReturnData = asm.slice(asm.length - opReturnDataLength, asm.length)
  const stateData = opReturnData[2]
  const version = getMarketVersion(opReturnData[0])

  const oracleKeyPos = getArgPos(version, "oracleKey")
  const oracleKeysHex = asm[oracleKeyPos]
  const oracleCount = oracleKeysHex.length / (oracleInfoByteLength * 2)

  const globalOptionCountPos = getArgPos(version, "globalOptionCount")
  const globalOptionCount = getIntFromOP(asm[globalOptionCountPos])

  const balanceTableRootPos = stateData.length - balanceTableByteLength * 2
  const balanceTableRoot = stateData.slice(balanceTableRootPos)

  const globalShareStatusPos = balanceTableRootPos - globalOptionCount * 2
  const globalShareStatus = stateData.slice(globalShareStatusPos, balanceTableRootPos)

  const globalLiquidityPos = globalShareStatusPos - 2
  const globalLiquidity = parseInt(stateData.slice(globalLiquidityPos, globalShareStatusPos), 16)

  const globalLiquidityPointsPos = globalLiquidityPos - 16
  const globalLiquidityPointsHex = stateData.slice(globalLiquidityPointsPos, globalLiquidityPos)

  const globalAccLiquidityFeePoolPos = globalLiquidityPointsPos - 10
  const globalAccLiquidityFeePoolHex = stateData.slice(globalAccLiquidityFeePoolPos, globalLiquidityPointsPos)

  const globalLiquidityFeePoolPos = globalAccLiquidityFeePoolPos - 10
  const globalLiquidityFeePoolHex = stateData.slice(globalLiquidityFeePoolPos, globalAccLiquidityFeePoolPos)

  const globalVotesLength = globalOptionCount * voteCountByteLen * 2
  const globalVotesPos = globalLiquidityFeePoolPos - globalVotesLength
  const globalVotesHex = stateData.slice(globalVotesPos, globalLiquidityFeePoolPos)

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
    status: getMarketStatusfromHex(
      globalDecisionState,
      globalVotesHex,
      globalLiquidityFeePoolHex,
      globalAccLiquidityFeePoolHex,
      globalLiquidityPointsHex
    ),
    oracles: getOracleDetailsFromHex(oracleKeysHex, globalOracleStates),
    balance: {
      liquidity: globalLiquidity,
      shares: hex2IntArray(globalShareStatus)
    },
    balanceMerkleRoot: balanceTableRoot,
    creator: {
      pubKey: bsv.PublicKey.fromHex(asm[getArgPos(version, "creatorPubKey")]),
      payoutAddress: bsv.Address.fromHex("00" + asm[getArgPos(version, "creatorPayoutAddress")])
    },
    creatorFee: getIntFromOP(asm[getArgPos(version, "creatorFee")]) / 100,
    requiredVotes: getIntFromOP(asm[getArgPos(version, "requiredVotes")]),
    liquidityFee: getIntFromOP(asm[getArgPos(version, "liquidityFeeRate")]) / 100
  }
}

export function isValidUpdateTx(
  tx: bsv.Transaction,
  prevTx: bsv.Transaction,
  outputIndex = 0,
  inputIndex = 0
): boolean {
  const lockingScript = prevTx.outputs[outputIndex].script
  const unlockingScript = tx.inputs[inputIndex].script
  const interpreter = bsv.Script.Interpreter()

  // console.log(prevTx.outputs)
  // console.log(tx.inputs)
  // console.log(DEFAULT_FLAGS)

  const isValidScript = interpreter.verify(
    unlockingScript,
    lockingScript,
    tx,
    inputIndex,
    DEFAULT_FLAGS,
    prevTx.outputs[outputIndex].satoshisBN
  )

  if (!isValidScript) {
    console.error(interpreter.errstr)
  }

  return isValidScript
}

export function isValidMarketUpdateTx(
  tx: bsv.Transaction,
  prevTx: bsv.Transaction,
  entries: entry[],
  outputIndex = 0,
  inputIndex = 0
): boolean {
  return isValidUpdateTx(tx, prevTx, outputIndex, inputIndex) && isValidMarketTx(tx, entries, 0)
}

export function isValidMarketTx(tx: bsv.Transaction, entries: entry[], outputIndex = 0): boolean {
  const script = tx.outputs[outputIndex].script
  const balance = tx.outputs[outputIndex].satoshis
  const market = getMarketFromScript(script)

  // FIXME: This is probably be removed. Script verifies it all.
  const hasValidSatBalance = getMinMarketSatBalance(market, entries) <= balance

  // console.log([getMinMarketSatBalance(market, entries), balance])
  // console.log(market.status)

  // console.log([
  //   tx.verify() === true,
  //   !tx.getSerializationError(),
  //   isValidMarketInfo(market),
  //   validateEntries(market, entries),
  //   hasValidSatBalance
  // ])

  return (
    tx.verify() === true &&
    !tx.getSerializationError() &&
    isValidMarketInfo(market) &&
    validateEntries(market, entries) &&
    hasValidSatBalance
  )
}

export function getAddEntryTx(
  prevTx: bsv.Transaction,
  prevEntries: entry[],
  publicKey: bsv.PublicKey,
  balance: balance,
  payoutAddress: bsv.Address,
  utxos: bsv.Transaction.UnspentOutput[],
  spendingPrivKey: bsv.PrivateKey,
  outputIndex = 0,
  feePerByte: number = feeb
): bsv.Transaction {
  const prevMarket = getMarketFromScript(prevTx.outputs[outputIndex].script)
  const optionCount = prevMarket.details.options.length

  const lastEntry = prevEntries.length ? getEntryHex(prevEntries[prevEntries.length - 1]) : "00"
  const lastMerklePath = getMerklePath(prevEntries, prevEntries.length - 1)

  const entry: entry = {
    balance,
    publicKey,
    globalLiqidityFeePoolSave: prevMarket.status.accLiquidityFeePool,
    liquidityPoints: 0
  }

  const newEntries = prevEntries.concat([entry])
  const newGlobalBalance = getMarketBalance(newEntries, optionCount)

  const newMarket: marketInfo = {
    ...prevMarket,
    balance: newGlobalBalance,
    balanceMerkleRoot: getMerkleRoot(newEntries)
  }

  const newTx = getUpdateMarketTx(prevTx, newMarket, outputIndex, feePerByte)

  fundTx(newTx, spendingPrivKey, payoutAddress, utxos, feePerByte)

  const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID

  const preimage = getPreimage(prevTx, newTx, sighashType, outputIndex)

  const changeOutput = newTx.getChangeOutput()
  const changeSats = changeOutput ? changeOutput.satoshis : 0

  const token = getToken(prevMarket)

  token.txContext = { tx: newTx, inputIndex: 0, inputSatoshis: prevTx.outputs[outputIndex].satoshis }

  const unlockingScript = token
    .updateMarket(
      new SigHashPreimage(preimage.toString("hex")),
      1, // action = Add entry
      new Ripemd160(payoutAddress.hashBuffer.toString("hex")),
      changeSats,
      new Bytes(entry.publicKey.toString()),
      entry.balance.liquidity,
      new Bytes(getSharesHex(entry.balance.shares)),
      new Bytes(lastEntry),
      new Bytes(lastMerklePath),
      0,
      new Bytes(""),
      0,
      0,
      false,
      new Sig("00"),
      new Bytes(""),
      0,
      0n,
      0,
      0,
      newTx.outputs[0].satoshis
    )
    .toScript()

  // console.log(new SigHashPreimage(preimage.toString("hex")).toLiteral())

  // console.log([
  //   // new SigHashPreimage(preimage.toString("hex")).toLiteral(),
  //   1, // action = Add entry
  //   new Ripemd160(payoutAddress.hashBuffer.toString("hex")).toLiteral(),
  //   changeSats,
  //   new Bytes(entry.publicKey.toString()).toLiteral(),
  //   entry.balance.liquidity,
  //   new Bytes(getSharesHex(entry.balance.shares)).toLiteral(),
  //   new Bytes(lastEntry).toLiteral(),
  //   new Bytes(lastMerklePath).toLiteral(),
  //   0,
  //   new Bytes("").toLiteral(),
  //   0,
  //   0,
  //   false,
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
  redeemLiquidityPoints: boolean,
  privateKey: bsv.PrivateKey,
  payoutAddress: bsv.Address,
  utxos: bsv.Transaction.UnspentOutput[],
  spendingPrivKey: bsv.PrivateKey,
  feePerByte: number = feeb
): bsv.Transaction {
  const prevMarket = getMarketFromScript(prevTx.outputs[0].script)
  const optionCount = prevMarket.details.options.length

  const publicKey = privateKey.publicKey
  const entryIndex = prevEntries.findIndex(entry => entry.publicKey.toString() === publicKey.toString())

  if (entryIndex === -1) throw new Error("No entry with this publicKey found.")

  const oldEntry = prevEntries[entryIndex]

  let newGlobalBalance: balance
  const updatedBalanceEntries = [...prevEntries]
  updatedBalanceEntries[entryIndex] = {
    ...oldEntry,
    balance: newBalance
  }
  if (prevMarket.status.decided) {
    const decision = prevMarket.status.decision
    const winningShares = oldEntry.balance.shares[decision]
    const redeemed = winningShares - newBalance.shares[decision]

    if (redeemed !== 0) {
      // Redeem winning shares

      if (!newBalance.shares.every((newShares, index) => index === decision || newShares === 0))
        throw new Error("Loosing shares must be set to 0")

      newGlobalBalance = {
        liquidity: prevMarket.balance.liquidity,
        shares: prevMarket.balance.shares.map((shares, index) => (index === decision ? shares - redeemed : shares))
      }
    } else if (publicKey.toString() === prevMarket.creator.pubKey.toString()) {
      // Redeem invalid shares

      newGlobalBalance = getMarketBalance(updatedBalanceEntries, optionCount)
      const onlyValidShares = newGlobalBalance.shares.map((shares, i) =>
        i === prevMarket.status.decision ? shares : 0
      )
      newGlobalBalance.shares = onlyValidShares
    } else {
      newGlobalBalance = getMarketBalance(updatedBalanceEntries, optionCount)
      newGlobalBalance.shares = prevMarket.balance.shares
    }
  } else {
    newGlobalBalance = getMarketBalance(updatedBalanceEntries, optionCount)
  }

  const prevGlobalSatBalance = prevTx.outputs[0].satoshis
  const prevMarketSatBalance = prevGlobalSatBalance - prevMarket.status.liquidityFeePool

  // Determine payout
  let redeemSats = 0

  // Determine redeemed winning shares
  let redeemShares = 0
  if (prevMarket.status.decided) {
    const decision = prevMarket.status.decision
    const winningShares = oldEntry.balance.shares[decision]
    redeemShares = winningShares - newBalance.shares[decision]
  }

  // Determine if redeeming invalid shares
  // const redeemInvalid =
  //   prevMarket.status.decided && publicKey.toString() === prevMarket.creator.pubKey.toString() && !redeemShares

  let newMarketSatBalance = 0

  if (redeemShares) {
    // User is redeeming shares
    redeemSats = redeemShares * SatScaling
    newMarketSatBalance = prevMarketSatBalance - redeemSats
  } else {
    // User is buying, selling, changing liquidity or market creator is redeeming invalid shares after market is resolved
    newMarketSatBalance = getLmsrSatsFixed(newGlobalBalance)

    const noShareChange = newGlobalBalance.shares.every((v, i) => v === prevMarket.balance.shares[i])
    if (noShareChange) {
      // Do not calculate any fees if only liquidity is extracted
      redeemSats = 0
    } else {
      redeemSats = prevMarketSatBalance - newMarketSatBalance
    }
  }

  const liquidityFee = redeemSats > 0 ? Math.floor((redeemSats * prevMarket.liquidityFee) / 100) : 0

  const feesSinceLastChange = prevMarket.status.accLiquidityFeePool - oldEntry.globalLiqidityFeePoolSave + liquidityFee
  const newEntryLiquidityPoints = oldEntry.liquidityPoints + feesSinceLastChange * oldEntry.balance.liquidity

  const newAccLiquidityFeePool = prevMarket.status.accLiquidityFeePool + liquidityFee

  const newEntry: entry = {
    balance: newBalance,
    publicKey,
    globalLiqidityFeePoolSave: newAccLiquidityFeePool,
    liquidityPoints: redeemLiquidityPoints ? 0 : newEntryLiquidityPoints
  }

  const newEntries = [...prevEntries]
  newEntries[entryIndex] = newEntry

  const merklePath = getMerklePath(prevEntries, entryIndex)
  const newMerklePath = getMerklePath(newEntries, entryIndex)

  const redeemedLiquidityPoolSats = redeemLiquidityPoints
    ? (newEntryLiquidityPoints / prevMarket.status.liquidityPoints) * prevMarket.status.liquidityFeePool
    : 0
  const newLiquidityFeePool = prevMarket.status.liquidityFeePool + liquidityFee - redeemedLiquidityPoolSats

  const newLiquidityPoints = redeemLiquidityPoints
    ? prevMarket.status.liquidityPoints + liquidityFee * prevMarket.balance.liquidity - newEntryLiquidityPoints
    : prevMarket.status.liquidityPoints + liquidityFee * prevMarket.balance.liquidity

  // console.log({
  //   prevEntryBalance: oldEntry.balance,
  //   prevEntryLiquidityPoints: oldEntry.liquidityPoints,
  //   prevEntryGlobalLiquidityPoolSave: oldEntry.globalLiqidityFeePoolSave,
  //   prevMarketBalance: prevMarket.balance,
  //   newGlobalBalance,
  //   feesSinceLastChange,
  //   newEntryBalance: newEntry.balance,
  //   newEntryLiquidityPoints,
  //   prevLiquidityFeePool: prevMarket.status.liquidityFeePool,
  //   prevMarketLiquidityPoints: prevMarket.status.liquidityPoints,
  //   liquidityFee,
  //   redeemedLiquidityPoolSats,
  //   newLiquidityFeePool,
  //   newLiquidityPoints,
  //   newAccLiquidityFeePool,
  //   newMarketSatBalance
  // })

  const newMarket: marketInfo = {
    ...prevMarket,
    balance: newGlobalBalance,
    balanceMerkleRoot: getMerkleRootByPath(sha256(getEntryHex(newEntry)), newMerklePath),
    status: {
      ...prevMarket.status,
      liquidityPoints: newLiquidityPoints,
      liquidityFeePool: newLiquidityFeePool,
      accLiquidityFeePool: newAccLiquidityFeePool
    }
  }

  const newTx = getUpdateMarketTx(prevTx, newMarket, 0, feePerByte)
  newTx.outputs[0].satoshis = newMarketSatBalance + newLiquidityFeePool

  const dust = getDust(newTx.outputs[0].getSize(), feePerByte)

  if (dust > newTx.outputs[0].satoshis) {
    newTx.outputs[0].satoshis = dust
  }

  // Add fee outputs to dev and creator
  if (redeemSats > 0) {
    const version = getMarketVersion(prevMarket.version)

    let developerSatFee = Math.floor((version.options.devFee * redeemSats) / 100)
    let creatorSatFee = Math.floor((prevMarket.creatorFee * redeemSats) / 100)

    developerSatFee = developerSatFee > DUST ? developerSatFee : DUST
    creatorSatFee = creatorSatFee > DUST ? creatorSatFee : DUST

    newTx.to(bsv.Address.fromHex(developerPayoutAddress), developerSatFee)
    newTx.to(prevMarket.creator.payoutAddress, creatorSatFee)
  }

  fundTx(newTx, spendingPrivKey, payoutAddress, utxos, feePerByte)

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
      new Bytes(publicKey.toString()),
      newBalance.liquidity,
      new Bytes(getSharesHex(newBalance.shares)),
      new Bytes(""),
      new Bytes(""),
      oldEntry.balance.liquidity,
      new Bytes(getSharesHex(oldEntry.balance.shares)),
      oldEntry.globalLiqidityFeePoolSave,
      oldEntry.liquidityPoints,
      redeemLiquidityPoints,
      new Sig(signature.toString("hex")),
      new Bytes(merklePath),
      0,
      0n,
      0,
      0,
      newTx.outputs[0].satoshis
    )
    .toScript()

  // console.log(new SigHashPreimage(preimage.toString("hex")).toLiteral())

  // console.log([
  //   // new SigHashPreimage(preimage.toString("hex")).toLiteral(),
  //   2, // action = Update entry
  //   new Ripemd160(payoutAddress.hashBuffer.toString("hex")).toLiteral(),
  //   changeSats,
  //   new Bytes(publicKey.toString()).toLiteral(),
  //   newBalance.liquidity,
  //   new Bytes(getSharesHex(newBalance.shares)).toLiteral(),
  //   new Bytes("").toLiteral(),
  //   new Bytes("").toLiteral(),
  //   oldEntry.balance.liquidity,
  //   new Bytes(getSharesHex(oldEntry.balance.shares)).toLiteral(),
  //   oldEntry.globalLiqidityFeePoolSave,
  //   oldEntry.liquidityPoints,
  //   redeemLiquidityPoints,
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

  // const asm = newTx.outputs[0].script.toASM().split(" ")
  // console.log(asm.slice(asm.length - opReturnDataLength, asm.length).join(" "))

  // console.log(newTx.outputs)

  return newTx
}

export function getOracleCommitTx(
  prevTx: bsv.Transaction,
  rabinPrivKey: rabinPrivKey,
  payoutAddress: bsv.Address,
  utxos: bsv.Transaction.UnspentOutput[],
  spendingPrivKey: bsv.PrivateKey,
  outputIndex = 0,
  feePerByte: number = feeb
): bsv.Transaction {
  // TODO: Offer option to fund transaction separately?

  const prevMarket = getMarketFromScript(prevTx.outputs[outputIndex].script)
  const token = getToken(prevMarket)

  const rabin = new RabinSignature()
  const rabinPubKey = rabin.privKeyToPubKey(rabinPrivKey.p, rabinPrivKey.q)

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

  const newTx = getUpdateMarketTx(prevTx, newMarket, outputIndex, feePerByte)

  const sigContent = commitmentHash + reverseHex(prevTx.hash)
  const signature = getOracleSig(sigContent, rabinPrivKey)
  const signatureBytes = int2Hex(signature.signature)

  const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_SINGLE | Signature.SIGHASH_FORKID
  const preimage = getPreimage(prevTx, newTx, sighashType, outputIndex)

  token.txContext = { tx: newTx, inputIndex: 0, inputSatoshis: prevTx.outputs[outputIndex].satoshis }

  const unlockingScript = token
    .updateMarket(
      new SigHashPreimage(preimage.toString("hex")),
      3, // action = Update entry
      new Ripemd160("00"),
      0,
      new Bytes(""),
      0,
      new Bytes(""),
      new Bytes(""),
      new Bytes(""),
      0,
      new Bytes(""),
      0,
      0,
      false,
      new Sig("00"),
      new Bytes(""),
      oracleIndex,
      signature.signature,
      signature.paddingByteCount,
      0,
      newTx.outputs[0].satoshis
    )
    .toScript()

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

  fundTx(newTx, spendingPrivKey, payoutAddress, utxos, feePerByte)

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
  spendingPrivKey: bsv.PrivateKey,
  feePerByte: number = feeb
): bsv.Transaction {
  // TODO: Offer option to fund transaction separately?

  const prevMarket = getMarketFromScript(prevTx.outputs[0].script)
  const token = getToken(prevMarket)

  const rabin = new RabinSignature()
  const rabinPubKey = rabin.privKeyToPubKey(rabinPrivKey.p, rabinPrivKey.q)

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
  newVotes[vote] = newVotes[vote] + oracle.votes

  const newMarketStatus = {
    ...prevMarket.status,
    votes: newVotes
  }

  if (newVotes[vote] >= prevMarket.requiredVotes) {
    newMarketStatus.decided = true
    newMarketStatus.decision = vote
  }

  const newMarket = {
    ...prevMarket,
    oracles: newOracles,
    status: newMarketStatus
  }

  const newTx = getUpdateMarketTx(prevTx, newMarket, 0, feePerByte)

  const sigContent = int2Hex(vote, 1) + reverseHex(prevTx.hash)
  const signature = getOracleSig(sigContent, rabinPrivKey)

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
      0,
      new Bytes(""),
      new Bytes(""),
      new Bytes(""),
      0,
      new Bytes(""),
      0,
      0,
      false,
      new Sig("00"),
      new Bytes(""),
      oracleIndex,
      signature.signature,
      signature.paddingByteCount,
      vote,
      newTx.outputs[0].satoshis
    )
    .toScript()

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

  fundTx(newTx, spendingPrivKey, payoutAddress, utxos, feePerByte)

  // console.log(newTx.toString())
  // console.log(prevTx.outputs[0].satoshis)

  // const asm = prevTx.outputs[0].script.toASM().split(" ")
  // console.log(asm.slice(asm.length - opReturnDataLength, asm.length).join(" "))

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
  utxos: bsv.Transaction.UnspentOutput[],
  satPerByte: number = feeb
): bsv.Transaction {
  const inputCount = tx.inputs.length

  // for (const output of tx.outputs) {
  //   const dust = getDust(output.getSize(), satPerByte)

  //   if (output.satoshis < dust) {
  //     output.satoshis = dust
  //   }
  // }

  // const marketOutput = tx.outputs[0]
  // if (marketOutput.satoshis < DUST) {
  //   marketOutput.satoshis = DUST
  // }

  tx.feePerKb(satPerByte * 1000)

  tx.change(changeAddress)

  tx.from(utxos)

  // Remove outputs smaller then dust limit
  // TODO: Should be implemented in contract
  // tx.outputs = tx.outputs.filter(output => output.satoshis >= DUST)

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

export function getFunctionID(script: bsv.Script): number {
  const asm = script.toASM().split(" ")
  return getIntFromOP(asm[1])
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

/**
 * Adds Vala Index input and output to the transaction
 */
export function addValaIndex(
  tx: bsv.Transaction,
  prevValaIndexTx: bsv.Transaction,
  prevValaIndexOutputIndex = 0
): bsv.Transaction {
  // console.log("index script length", prevValaIndexTx.outputs[prevValaIndexOutputIndex].script.toASM().length)
  // console.log("index script index", prevValaIndexOutputIndex)
  const indexToken = getIndexToken()

  const input = bsv.Transaction.Input.fromObject({
    prevTxId: prevValaIndexTx.hash,
    outputIndex: prevValaIndexOutputIndex,
    script: bsv.Script.empty(),
    output: prevValaIndexTx.outputs[prevValaIndexOutputIndex]
  })

  input.clearSignatures = () => {} // eslint-disable-line
  input.isFullySigned = () => true

  tx.addInput(input)

  const inputIndex = tx.inputs.length - 1

  const satoshis = prevValaIndexTx.outputs[prevValaIndexOutputIndex].satoshis
  const output = new bsv.Transaction.Output({ script: indexToken.lockingScript, satoshis })

  if (inputIndex < tx.outputs.length) {
    // With SIGHASH_SINGLE, output needs to be same index as input
    tx.outputs.splice(inputIndex, 0, output)
    tx._outputAmount = undefined
    tx._updateChangeOutput()
  } else {
    tx.addOutput(output)
  }

  const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_SINGLE | Signature.SIGHASH_FORKID

  // console.log(prevValaIndexOutputIndex)
  // console.log(inputIndex)

  const preimage = getPreimage(prevValaIndexTx, tx, sighashType, prevValaIndexOutputIndex, inputIndex)

  // console.log("Preimage length:", preimage.toString("hex").length)
  // console.log(preimage.toString("hex"))

  const unlockingScript = indexToken.update(new SigHashPreimage(preimage.toString("hex"))).toScript()

  tx.inputs[inputIndex].setScript(unlockingScript)

  return tx
}

export function getNewOracleTx(
  pubKey: rabinPubKey,
  prevValaIndexTx: bsv.Transaction,
  prevValaIndexOutputIndex = 0,
  relayFee = feeb
): bsv.Transaction {
  const token = getOracleToken(pubKey)
  token.setDataPart(sha256("00"))

  // const asm = token.lockingScript.toASM().split(" ")
  // console.log(asm[asm.length - 1])

  const tx = new bsv.Transaction()
  let output = new bsv.Transaction.Output({ script: token.lockingScript, satoshis: 123456789 })
  const dust = getDust(output.getSize(), relayFee)

  output = new bsv.Transaction.Output({ script: token.lockingScript, satoshis: dust })

  tx.addOutput(output)

  tx.feePerKb(relayFee * 1000)

  addValaIndex(tx, prevValaIndexTx, prevValaIndexOutputIndex)

  // console.log(tx.inputs)
  // console.log(tx.outputs)
  // console.log(tx.toString())

  return tx
}

export function getOracleUpdateTx(
  prevTx: bsv.Transaction,
  outputIndex = 0,
  burnSats = 0,
  details?: {
    description?: string
    domain: string
  },
  rabinPrivKey?: rabinPrivKey,
  relayFee = feeb
): bsv.Transaction {
  const pubKeyHex = prevTx.outputs[outputIndex].script.toASM().split(" ")[3]
  const pubKey = hex2BigInt(pubKeyHex)

  const satoshis = prevTx.outputs[outputIndex].satoshis + burnSats

  const detailsHex = details ? toHex(JSON.stringify(details)) : "00"
  const detailsHash = sha256(detailsHex)

  const token = getOracleToken(pubKey)

  token.setDataPart(detailsHash)

  const newTx = new bsv.Transaction()
  newTx.addOutput(new bsv.Transaction.Output({ script: token.lockingScript, satoshis }))

  newTx.feePerKb(relayFee * 1000)

  // console.log(prevTx.outputs)
  // console.log(outputIndex)

  const input = bsv.Transaction.Input.fromObject({
    prevTxId: prevTx.hash,
    outputIndex: outputIndex,
    script: bsv.Script.empty(),
    output: prevTx.outputs[outputIndex] // prevTx of newTx here?
  })

  input.clearSignatures = () => {} // eslint-disable-line
  input.isFullySigned = () => true

  newTx.addInput(input)

  const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_SINGLE | Signature.SIGHASH_FORKID
  const preimage = getPreimage(prevTx, newTx, sighashType, outputIndex)

  token.txContext = { tx: newTx, inputIndex: 0, inputSatoshis: prevTx.outputs[outputIndex].satoshis }

  if (details) {
    if (!rabinPrivKey) throw new Error("Missing rabin private key")

    const sigContent = detailsHash
    const signature = getOracleSig(sigContent, rabinPrivKey)

    const unlockingScript = token
      .update(
        new SigHashPreimage(preimage.toString("hex")),
        details ? 1 : 2,
        new Bytes(detailsHex),
        signature.signature,
        signature.paddingByteCount,
        burnSats
      )
      .toScript()

    newTx.inputs[0].setScript(unlockingScript)
  } else {
    const unlockingScript = token
      .update(new SigHashPreimage(preimage.toString("hex")), 2, new Bytes(""), 0n, 0, burnSats)
      .toScript()

    // console.log([
    //   new SigHashPreimage(preimage.toString("hex")).toLiteral(),
    //   2,
    //   new Bytes("").toLiteral(),
    //   0n,
    //   0,
    //   burnSats
    // ])

    newTx.inputs[0].setScript(unlockingScript)
  }

  return newTx
}

export function getOracleBurnTx(prevTx: bsv.Transaction, burnSats: number, outputIndex = 0): bsv.Transaction {
  return getOracleUpdateTx(prevTx, outputIndex, burnSats)
}

export function getOracleUpdateDetailsTx(
  prevTx: bsv.Transaction,
  outputIndex = 0,
  details: {
    description?: string
    domain: string
  },
  rabinPrivKey: rabinPrivKey
): bsv.Transaction {
  return getOracleUpdateTx(prevTx, outputIndex, 0, details, rabinPrivKey)
}

export function isValidOracleInitOutput(tx: bsv.Transaction, outputIndex = 0): boolean {
  const script = tx.outputs[outputIndex].script
  const asm = script.toASM().split(" ")
  return isValidScript(script, oracleContracts[0]) && asm[asm.length - 1] === sha256("00")
}

export function isValidMarketInitOutput(tx: bsv.Transaction, outputIndex = 0): boolean {
  const script = tx.outputs[outputIndex].script

  if (!isValidScript(script, marketContracts[0])) return false

  const market = getMarketFromScript(script)
  return isValidMarketInit(market)
}

export function isValidScript(script: bsv.Script, version: version): boolean {
  return getMd5(script, version.length, version.argPos, version.args.length) === version.md5
}

export function getDust(scriptPubKeySize: number, relayFee = 0.5) {
  const largestBnValueOut = 7 // if we are spending all of bitcoin simultaneously, then we need 7 bytes in the TxOut, that's the max.
  const largestVout = 3 // 63,000 outputs in one tx probably hits the limit on size, so 3 bytes required for a VarInt of 63000
  const txOutSize = scriptPubKeySize + largestBnValueOut + largestVout

  const buffer = 50 // Buffer for op_return later next tx

  const sats = 3 * Math.floor((148 + txOutSize) * relayFee) // the calculation is dumb, so uses a P2PKH size for assumed input.
  return sats > 135 ? sats : 135
}
