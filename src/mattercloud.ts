import fetch from "node-fetch"

export async function fetchMattercloudKey(): Promise<string> {
  const response = await fetch("https://api.bitindex.network/api/v2/registration/account?secret=secretkey", {
    method: "POST"
  })
  const json = await response.json()

  if (!json.apiKey) {
    throw new Error("Failed to request MatterCloud API key.")
  }

  return json.apiKey
}

export async function fetchUTXOs(address: string, apiKey: string): Promise<[Object]> {
  try {
    const response = await fetch("https://api.mattercloud.net/api/v3/main/addrs/utxo", {
      method: "POST",
      body: JSON.stringify({ addrs: address }),
      headers: { api_key: apiKey }
    })
    const utxos = await response.json()
    return utxos
  } catch (err) {
    throw new Error(`Failed to retrieve utxo's for ${address}: ${err.message}`)
  }
}

export async function getSatBalance(address: string, apiKey: string): Promise<number> {
  const utxos = await fetchUTXOs(address, apiKey)
  const sats = utxos.reduce((amount: number, utxo: any): number => amount + utxo.satoshis, 0)
  return sats
}
