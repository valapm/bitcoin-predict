import resolve from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"
import typescript from "@rollup/plugin-typescript"
import nodePolyfills from "rollup-plugin-node-polyfills"
import alias from "@rollup/plugin-alias"
import json from "@rollup/plugin-json"
import pkg from "./package.json"

export default [
  // browser-friendly UMD build
  {
    input: "src/index.ts",
    external: ["node-fetch"],
    output: {
      name: "bitcoin-predict",
      file: pkg.browser,
      format: "es",
      sourcemap: true
    },
    plugins: [
      alias({
        elliptic: path.resolve(__dirname, "includes/elliptic.js")
      }),
      resolve({
        browser: true,
        preferBuiltins: true,
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
        // exclude: "node_modules/bsv"
        // include: ["../node_modules/", "../scryptlib/**/*.js"]
      })
    ]
  }

  // CommonJS (for Node) and ES module (for bundlers) build.
  // {
  //   input: "src/index.ts",
  //   external: ["rabinsig", "lodash", "scryptlib", "node-fetch", "scryptlib/dist/utils"],
  //   treeshake: {
  //     moduleSideEffects: false
  //   },
  //   plugins: [
  //     typescript({
  //       sourceMap: true
  //     })
  //   ],
  //   output: [
  //     { file: pkg.main, format: "cjs", sourcemap: true },
  //     { file: pkg.module, format: "es", sourcemap: true }
  //   ]
  // }
]
