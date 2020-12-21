// import { marketInfo, balance } from "./pm"
// import { lmsr } from "./lmsr"

// export function addEntry(
//   market: marketInfo,
//   scriptCode: string,
//   liquidity: number,
//   sharesFor: number,
//   sharesAgainst: number,
//   publicKey: string,
//   newLmsrBalance: number,
//   newLmsrMerklePath: string,
//   lastEntry: string,
//   lastMerklePath: string
// ) {
//   if (liquidity < 0) throw new Error("Liquidity has to be zero or greater")
//   if (sharesFor < 0) throw new Error("SharesFor have to be zero or greater")
//   if (sharesAgainst < 0) throw new Error("SharesAgainst have to be zero or greater")

//   const scriptLen = scriptCode.length
//   const balanceTableRoot = scriptCode.slice(scriptLen - 32, scriptLen)
//   const shareStatus = scriptCode.slice(scriptLen - 35, scriptLen - 32)

//   const prevLiquidity = parseInt(shareStatus[0])
//   const prevSharesFor = parseInt(shareStatus[1])
//   const prevSharesAgainst = parseInt(shareStatus[2])

//   const newLiquidity = prevLiquidity + liquidity
//   const newSharesFor = prevSharesFor + sharesFor
//   const newSharesAgainst = prevSharesAgainst + sharesAgainst

//   const newBalance: balance = {
//     liquidity:newLiquidity,
//     sharesFor: newSharesFor,
//     sharesAgainst: newSharesAgainst
//   }

//   if (lmsr(newBalance) !==

// }
