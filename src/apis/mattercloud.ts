import fetch from "node-fetch"
import { bsv } from "scryptlib"

type apiKeyRes = {
  apiKey: string
}

export async function fetchMattercloudKey(): Promise<string> {
  const response = await fetch("https://api.bitindex.network/api/v2/registration/account?secret=secretkey", {
    method: "POST"
  })
  const json = (await response.json()) as apiKeyRes

  if (!json.apiKey) throw new Error("Failed to request MatterCloud API key.")

  return json.apiKey
}

export async function fetchUTXOs(address: string, apiKey: string): Promise<bsv.Transaction.UnspentOutput[]> {
  const response = await fetch("https://api.mattercloud.net/api/v3/main/addrs/utxo", {
    method: "POST",
    body: JSON.stringify({ addrs: address }),
    headers: { api_key: apiKey }
  })
  const utxos = (await response.json()) as bsv.Transaction.UnspentOutput[]
  return utxos
}

// export async function fetchOracleDetails(): Promise<oracleDetail[]> {
//   // TODO: Implement
// }
