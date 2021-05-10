export function reverseHex(s: string): string {
  s = s.length % 2 ? "0" + s : s

  const array = []
  for (let i = 0; i <= s.length - 2; i++) {
    if (i % 2 === 0) array.push(s.substring(i, i + 2))
  }
  return array.reverse().join("")
}

export function int2Hex(num: number | bigint, byteSize?: number): string {
  let hex = num.toString(16)

  if (byteSize) {
    hex = ("0".repeat(byteSize * 4) + hex).slice(-byteSize * 2)
  }

  return reverseHex(hex)
}

export function bool2Hex(bool: boolean): string {
  return bool ? "01" : "00"
}

export function hex2Bool(hex: string): boolean {
  return hex === "00" ? false : true
}

export function toHex(s: string): string {
  return s
    .split("")
    .map(char => ("000" + char.charCodeAt(0).toString(16)).slice(-4))
    .join("")
}

export function fromHex(s: string): string {
  const chars = s.match(/.{1,4}/g) || []

  return chars.map(char => String.fromCharCode(parseInt(char, 16))).join("")
}

export function hex2BigInt(hex: string): bigint {
  return BigInt("0x" + reverseHex(hex))
}

export function hex2IntArray(hex: string, bytes = 1): number[] {
  const byteChars = bytes * 2

  return hex
    .split("")
    .reduce((shares: string[], n, i) => (!(i % byteChars) ? shares.concat([hex.slice(i, i + byteChars)]) : shares), [])
    .map(x => parseInt(x, 16))
}

export function splitHexByNumber(hex: string, length: number): string[] {
  return hex.match(new RegExp(".{1," + length.toString() + "}", "g")) || [] // eslint-disable-line
}

export function getIntFromOP(op: string): number {
  return op.startsWith("OP") ? parseInt(op.slice(3)) : parseInt(op, 16)
}
