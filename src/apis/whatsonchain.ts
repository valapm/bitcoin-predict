import fetch from "node-fetch"

export async function broadcast(rawTx: string, network: string = "main") {
  const data = {
    txhex: rawTx
  }

  const res = await fetch(`https://api.whatsonchain.com/v1/bsv/${network}/tx/raw`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  })

  return res.json()
}
