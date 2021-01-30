import { bsv } from "scryptlib"

export function getSatBalance(utxos: bsv.Transaction.UnspentOutput[]): number {
  return utxos.reduce((amount: number, utxo: bsv.Transaction.UnspentOutput): number => amount + utxo.satoshis, 0)
}
