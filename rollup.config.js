import resolve from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"
import typescript from "@rollup/plugin-typescript"
import nodePolyfills from "rollup-plugin-polyfill-node"
// import alias from "@rollup/plugin-alias"
import json from "@rollup/plugin-json"
import pkg from "./package.json"
// import elliptic from "elliptic"
// import path from "path"

export default [
  {
    input: "src/index.ts",
    external: ["node-fetch"],
    output: [
      {
        name: "bitcoin-predict",
        file: pkg.browser,
        format: "es",
        sourcemap: true
      }
    ],
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false,
        extensions: [".js", ".ts"]
      }),
      typescript({
        sourceMap: true
        // module: "CommonJS"
      }),
      commonjs({
        // include: "node_modules"
      }),
      json(),
      nodePolyfills({
        // exclude: "elliptic"
        // include: ["../node_modules/", "../scryptlib/**/*.js"]
      })
      // alias({
      // elliptic: elliptic
      //   elliptic: path.resolve(__dirname, "node_modules/elliptic/lin/elliptic.js")
      // })
    ]
  }
]
