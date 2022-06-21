/**
 * These implementations mirror the Bitcoin Script based implementations used.
 * They are necessary to ensure that we produce the same results as the oracles.
 */

export const precision = 16
export const scale = 2 ** precision
const scale2 = 2 ** 20

const ln2 = Math.round((Math.log(10) * scale2) / Math.log2(10))
const ln10 = Math.round((Math.log10(10) * scale2) / Math.log2(10))

export const e = Math.round(Math.E * scale)

/**
 * Works for numbers:
 * With 10 loops: Between 1000 and 0.001
 * With 20 loops: Between 1000000 and 0.000001
 * ~ 4 decimal points precision
 */
export function log2(x: number): number {
  if (x > 65536000000 || x < 65536) {
    throw new Error() // loops arent sufficient;
  }

  let b = 32768
  let y = 0

  // // If less than 1; lmsr doesn't need values below 1
  // for (let i = 0; i < 20; i++) {
  //   if (x < scale) {
  //     x = x * 2
  //     y = y - scale
  //   }
  // }

  // If more than 1
  for (let i = 0; i < 20; i++) {
    if (x >= 2 * scale) {
      x = Math.floor(x / 2)
      y = y + scale
    }
  }

  let z = x

  // loop precision times
  for (let i = 0; i < 16; i++) {
    z = Math.floor((z * z) / scale)
    if (z >= 2 * scale) {
      z = Math.floor(z / 2)
      y = y + b
    }

    b = Math.floor(b / 2)
  }

  return y
}

export function log(x: number): number {
  return Math.floor((log2(x) * ln2) / scale2)
}

export function log10(x: number): number {
  return Math.floor((log2(x) * ln10) / scale2)
}

/**
 * Adapted from https://github.com/PetteriAimonen/libfixmath/blob/master/libfixmath/fix16_exp.c
 */
export function expOld(x: number): number {
  if (x >= 681391 || x < 0) throw new Error()

  if (x == 0) return scale
  if (x == 65536) return e

  let result = x + scale
  let term = x

  for (let i = 2; i < 30; i++) {
    term = Math.floor(Math.floor(term * x) / Math.floor(i * scale))
    result += term

    if (term < 500 && (i > 15 || term < 20)) break
  }

  return result
}

/**
 * Calculates the binary exponent of x using the binary fraction method.
 * Accepts and returns scaled by 2**64 (64-bit fixed-point number).
 * Adapted from https://github.com/paulrberg/prb-math
 */
export function exp2(x: bigint): bigint {
  if (x > 3541774862152233910272n) throw new Error("exp2 above max value") // 192 max value
  if (x < -1103017633157748883456n) throw new Error("exp2 below min value") // -59.794705707972522261 min value

  // Start from 0.5 in the 192.64-bit fixed-point format.
  let result = 0x800000000000000000000000000000000000000000000000n
  // let result = 0x1000000000000000000000000n // 2**96

  // Multiply the result by root(2, 2^-i) when the bit at position i is 1. None of the intermediary results overflows
  // because the initial result is 2^191 and all magic factors are less than 2^65.
  if ((x & 0x8000000000000000n) > 0n) {
    result = (result * 0x16a09e667f3bcc909n) >> 64n
  }
  if ((x & 0x4000000000000000n) > 0n) {
    result = (result * 0x1306fe0a31b7152dfn) >> 64n
  }
  if ((x & 0x2000000000000000n) > 0n) {
    result = (result * 0x1172b83c7d517adcen) >> 64n
  }
  if ((x & 0x1000000000000000n) > 0n) {
    result = (result * 0x10b5586cf9890f62an) >> 64n
  }
  if ((x & 0x800000000000000n) > 0n) {
    result = (result * 0x1059b0d31585743aen) >> 64n
  }
  if ((x & 0x400000000000000n) > 0n) {
    result = (result * 0x102c9a3e778060ee7n) >> 64n
  }
  if ((x & 0x200000000000000n) > 0n) {
    result = (result * 0x10163da9fb33356d8n) >> 64n
  }
  if ((x & 0x100000000000000n) > 0n) {
    result = (result * 0x100b1afa5abcbed61n) >> 64n
  }
  if ((x & 0x80000000000000n) > 0n) {
    result = (result * 0x10058c86da1c09ea2n) >> 64n
  }
  if ((x & 0x40000000000000n) > 0n) {
    result = (result * 0x1002c605e2e8cec50n) >> 64n
  }
  if ((x & 0x20000000000000n) > 0n) {
    result = (result * 0x100162f3904051fa1n) >> 64n
  }
  if ((x & 0x10000000000000n) > 0n) {
    result = (result * 0x1000b175effdc76ban) >> 64n
  }
  if ((x & 0x8000000000000n) > 0n) {
    result = (result * 0x100058ba01fb9f96dn) >> 64n
  }
  if ((x & 0x4000000000000n) > 0n) {
    result = (result * 0x10002c5cc37da9492n) >> 64n
  }
  if ((x & 0x2000000000000n) > 0n) {
    result = (result * 0x1000162e525ee0547n) >> 64n
  }
  if ((x & 0x1000000000000n) > 0n) {
    result = (result * 0x10000b17255775c04n) >> 64n
  }
  if ((x & 0x800000000000n) > 0n) {
    result = (result * 0x1000058b91b5bc9aen) >> 64n
  }
  if ((x & 0x400000000000n) > 0n) {
    result = (result * 0x100002c5c89d5ec6dn) >> 64n
  }
  if ((x & 0x200000000000n) > 0n) {
    result = (result * 0x10000162e43f4f831n) >> 64n
  }
  if ((x & 0x100000000000n) > 0n) {
    result = (result * 0x100000b1721bcfc9an) >> 64n
  }
  if ((x & 0x80000000000n) > 0n) {
    result = (result * 0x10000058b90cf1e6en) >> 64n
  }
  if ((x & 0x40000000000n) > 0n) {
    result = (result * 0x1000002c5c863b73fn) >> 64n
  }
  if ((x & 0x20000000000n) > 0n) {
    result = (result * 0x100000162e430e5a2n) >> 64n
  }
  if ((x & 0x10000000000n) > 0n) {
    result = (result * 0x1000000b172183551n) >> 64n
  }
  if ((x & 0x8000000000n) > 0n) {
    result = (result * 0x100000058b90c0b49n) >> 64n
  }
  if ((x & 0x4000000000n) > 0n) {
    result = (result * 0x10000002c5c8601ccn) >> 64n
  }
  if ((x & 0x2000000000n) > 0n) {
    result = (result * 0x1000000162e42fff0n) >> 64n
  }
  if ((x & 0x1000000000n) > 0n) {
    result = (result * 0x10000000b17217fbbn) >> 64n
  }
  if ((x & 0x800000000n) > 0n) {
    result = (result * 0x1000000058b90bfcen) >> 64n
  }
  if ((x & 0x400000000n) > 0n) {
    result = (result * 0x100000002c5c85fe3n) >> 64n
  }
  if ((x & 0x200000000n) > 0n) {
    result = (result * 0x10000000162e42ff1n) >> 64n
  }
  if ((x & 0x100000000n) > 0n) {
    result = (result * 0x100000000b17217f8n) >> 64n
  }
  if ((x & 0x80000000n) > 0n) {
    result = (result * 0x10000000058b90bfcn) >> 64n
  }
  if ((x & 0x40000000n) > 0n) {
    result = (result * 0x1000000002c5c85fen) >> 64n
  }
  if ((x & 0x20000000n) > 0n) {
    result = (result * 0x100000000162e42ffn) >> 64n
  }
  if ((x & 0x10000000n) > 0n) {
    result = (result * 0x1000000000b17217fn) >> 64n
  }
  if ((x & 0x8000000n) > 0n) {
    result = (result * 0x100000000058b90c0n) >> 64n
  }
  if ((x & 0x4000000n) > 0n) {
    result = (result * 0x10000000002c5c860n) >> 64n
  }
  if ((x & 0x2000000n) > 0n) {
    result = (result * 0x1000000000162e430n) >> 64n
  }
  if ((x & 0x1000000n) > 0n) {
    result = (result * 0x10000000000b17218n) >> 64n
  }
  if ((x & 0x800000n) > 0n) {
    result = (result * 0x1000000000058b90cn) >> 64n
  }
  if ((x & 0x400000n) > 0n) {
    result = (result * 0x100000000002c5c86n) >> 64n
  }
  if ((x & 0x200000n) > 0n) {
    result = (result * 0x10000000000162e43n) >> 64n
  }
  if ((x & 0x100000n) > 0n) {
    result = (result * 0x100000000000b1721n) >> 64n
  }
  if ((x & 0x80000n) > 0n) {
    result = (result * 0x10000000000058b91n) >> 64n
  }
  if ((x & 0x40000n) > 0n) {
    result = (result * 0x1000000000002c5c8n) >> 64n
  }
  if ((x & 0x20000n) > 0n) {
    result = (result * 0x100000000000162e4n) >> 64n
  }
  if ((x & 0x10000n) > 0n) {
    result = (result * 0x1000000000000b172n) >> 64n
  }
  if ((x & 0x8000n) > 0n) {
    result = (result * 0x100000000000058b9n) >> 64n
  }
  if ((x & 0x4000n) > 0n) {
    result = (result * 0x10000000000002c5dn) >> 64n
  }
  if ((x & 0x2000n) > 0n) {
    result = (result * 0x1000000000000162en) >> 64n
  }
  if ((x & 0x1000n) > 0n) {
    result = (result * 0x10000000000000b17n) >> 64n
  }
  if ((x & 0x800n) > 0n) {
    result = (result * 0x1000000000000058cn) >> 64n
  }
  if ((x & 0x400n) > 0n) {
    result = (result * 0x100000000000002c6n) >> 64n
  }
  if ((x & 0x200n) > 0n) {
    result = (result * 0x10000000000000163n) >> 64n
  }
  if ((x & 0x100n) > 0n) {
    result = (result * 0x100000000000000b1n) >> 64n
  }
  if ((x & 0x80n) > 0n) {
    result = (result * 0x10000000000000059n) >> 64n
  }
  if ((x & 0x40n) > 0n) {
    result = (result * 0x1000000000000002cn) >> 64n
  }
  if ((x & 0x20n) > 0n) {
    result = (result * 0x10000000000000016n) >> 64n
  }
  if ((x & 0x10n) > 0n) {
    result = (result * 0x1000000000000000bn) >> 64n
  }
  if ((x & 0x8n) > 0n) {
    result = (result * 0x10000000000000006n) >> 64n
  }
  if ((x & 0x4n) > 0n) {
    result = (result * 0x10000000000000003n) >> 64n
  }
  if ((x & 0x2n) > 0n) {
    result = (result * 0x10000000000000001n) >> 64n
  }
  if ((x & 0x1n) > 0n) {
    result = (result * 0x10000000000000001n) >> 64n
  }

  // We're doing two things at the same time:
  //
  //   1. Multiply the result by 2^n + 1, where "2^n" is the integer part and the one is added to account for
  //      the fact that we initially set the result to 0.5. This is accomplished by subtracting from 191
  //      rather than 192.
  //   2. Convert the result to the unsigned 60.18-decimal fixed-point format.
  //
  // This works because 2^(191-ip) = 2^ip / 2^191, where "ip" is the integer part "2^n".
  result = result << 64n
  result = result >> (191n - (x >> 64n))

  return result // Scaled to 64 bits fixed-point number
}

const log2e = 26613026195688645000n // Math.floor(Math.log2(Math.E) * 2**64)

/**
 * Accepts and returns scaled by 2**64 (64-bit fixed-point number).
 */
export function expNew(x: bigint): bigint {
  if (x > 2454971259878909673472n) throw new Error("exp above max value") // Max value is 133.084258667509499441
  if (x < -764553562531197616128n) throw new Error("exp below min value") // Min value is -41.446531673892822322

  return exp2((x * log2e) >> 64n)
}
