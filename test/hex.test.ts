import { int2Hex, hex2BigInt, fromHex, toHex } from "../src/hex"

test("num2hex", () => {
  expect(
    int2Hex(
      0x12f1dd2e0965dc433b0d32b86333b0fb432df592f6108803d7afe51a14a0e867045fe22af85862b8e744700920e0b7e430a192440a714277efb895b51120e4ccn
    )
  ).toBe(
    "cce42011b595b8ef7742710a4492a130e4b7e020097044e7b86258f82ae25f0467e8a0141ae5afd7038810f692f52d43fbb03363b8320d3b43dc65092eddf112"
  )
})

test("hex2num", () => {
  expect(
    hex2BigInt(
      "cce42011b595b8ef7742710a4492a130e4b7e020097044e7b86258f82ae25f0467e8a0141ae5afd7038810f692f52d43fbb03363b8320d3b43dc65092eddf112"
    )
  ).toBe(
    0x12f1dd2e0965dc433b0d32b86333b0fb432df592f6108803d7afe51a14a0e867045fe22af85862b8e744700920e0b7e430a192440a714277efb895b51120e4ccn
  )
})

test("convert from and to hex", () => {
  const string = "abcdefg123"
  const hex = toHex(string)
  expect(fromHex(hex)).toBe(string)
})
