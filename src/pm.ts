import { buildContractClass, compile, Bytes, bsv } from "scryptlib"
// import CompileResult = require("scryptlib/compilerWrapper")
// import bsv from "bsv"
import { marketDetails } from "./transaction"

import { num2bin } from "./hex"
import { sha256 } from "./sha"
// import { compileContract } from "scrypt_boilerplate/helper"

type contract = {
  asm: string
}

export function getCompiledPM(): void {
  const contractPath = require.resolve("scrypt_boilerplate/contracts/predictionMarket.scrypt")
  compile({ path: contractPath }, { desc: true })
}

export function getASM(minerKeys: string): string {
  const compiled = require("../predictionMarket.json") as contract
  const asmTemplate = compiled.asm.split(" ")
  asmTemplate[7] = minerKeys
  return asmTemplate.join(" ")
  // return asmTemplate.map((code): string => (code[0] === "$" ? contractVars[code.slice(1)] : code)).join(" ")
}

// export function getInitScript(minerKeys: string, marketDetails: marketDetails, marketStatus: string): bsv.Script {
//   // const compiled = require("../predictionMarket.json")
//   // const PM = buildContractClass(compiled)
//   // const pm = new PM(minerKeys)

//   // pm.setDataPart(marketStatus)

//   const asm = getASM({ $minerKeys: minerKeys })

//   const fullScript = `${asm} OP_RETURN ${JSON.stringify(marketDetails)} ${marketStatus}`

//   return bsv.Script.fromASM(fullScript)
// }

export function getInitMarketStatus(pubKey: string, liquidity: number): string {
  const status = liquidity.toString() + "00" + "00"
  const entry = pubKey + status
  const balanceTableRoot = sha256(sha256(entry).repeat(2))
  return status + balanceTableRoot
}

// export function getAddEntryMarketStatus(
//   prevMarketStatus: string,
//   pubKeyHex: string,
//   liquidity: number,
//   sharesFor: number,
//   sharesAgainst: number
// ): string {
//   const newEntry = pubKeyHex + num2bin(liquidity, 1) + num2bin(sharesFor, 1) + num2bin(sharesAgainst, 1)
//   const newLeaf = sha256(newEntry)
// }

// export function getAddEntryScript(
//   prevScript: string,
//   balances: string[],
//   liquidity: number,
//   sharesFor: number,
//   sharesAgainst: number,
//   publicKey: string
// ): string {}

// export function getUpdateEntryScript(
//   prevScript: string,
//   balances: string[],
//   liquidity: number,
//   sharesFor: number,
//   sharesAgainst: number,
//   publicKey: string,
//   signature: string
// ): string {}

// export function getRedeemScript(prevScript: string, balances: string[], publicKey: string, signature: string): string {}

// export function getDecideScript(prevScript: string, result: number, minerSigs: string): string {}

//   const asm = compiled.asm.toString().split(" ")
//   const script = asm.map((x: string) => (x.startsWith("OP") ? bsv.OpCode[x] : x))

//   const minerKeysIndex = asm.findIndex((x: string) => x === "$minerKeys")
//   script[minerKeysIndex] = (minerKeys: string) => minerKeysIndex

//   console.log(script.slice(0, 20))

//   //@ts-ignore
//   // const Token = buildContractClass(compiled)

//   function setup() {}

//   return {
//     script,
//     size: 26000
//   }
// }
