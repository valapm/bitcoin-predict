import resolve from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"
import typescript from "@rollup/plugin-typescript"
import nodePolyfills from "rollup-plugin-node-polyfills"
// import alias from "@rollup/plugin-alias"
import json from "@rollup/plugin-json"
import pkg from "./package.json"

export default [
  // browser-friendly UMD build
  {
    input: "src/index.ts",
    external: ["node-fetch"],
    output: {
      name: "bitcoinpredict",
      file: pkg.browser,
      format: "iife",
      sourcemap: true
    },
    plugins: [
      // alias({
      //   // elliptic: path.resolve(__dirname, "includes/elliptic.js"),
      // }),
      resolve({
        browser: true,
        preferBuiltins: false,
        extensions: [".js", ".ts"]
      }),
      commonjs({
        // include: "node_modules"
      }),
      nodePolyfills({
        // include: ["node_modules", ""],
        crypto: true
        // fs: true
        // exclude: "node_modules/bsv"
        // include: ["../node_modules/", "../scryptlib/**/*.js"]
      }),
      json(),
      typescript({
        sourceMap: true
        // module: "CommonJS"
      })
    ]
  }
]
