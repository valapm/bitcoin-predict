import { sha256 } from "../src/sha"

test("sha256", () => {
  expect(sha256("testtesttest")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
})
