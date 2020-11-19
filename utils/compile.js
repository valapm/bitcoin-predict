const fs = require("fs")
const { compile } = require("scryptlib")

console.log("compiling...")

const contractPath = require.resolve("scrypt_boilerplate/contracts/predictionMarket.scrypt")
const compiled = compile({ path: contractPath }, { desc: true })

fs.writeFileSync(
  "../predictionMarket.json",
  JSON.stringify({ contract: compiled.contract, abi: compiled.abi, asm: compiled.asm }),
  "utf8"
)

console.log("done")
