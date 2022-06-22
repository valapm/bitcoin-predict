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
 * Works for numbers between 100 and 0.001
 */
export function log2(x: number): number {
  if (x > 6553600 || x < 66) {
    throw new Error() // loops arent sufficient;
  }

  let b = 32768
  let y = 0

  // If less than 1
  for (let i = 0; i < 10; i++) {
    if (x < scale) {
      x = x * 2
      y = y - scale
    }
  }

  // If more than 1
  for (let i = 0; i < 10; i++) {
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
export function exp(x: number): number {
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
