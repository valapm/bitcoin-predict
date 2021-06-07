const path = require("path")
const webpack = require("webpack")
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin")

module.exports = {
  entry: "./src/index.ts",
  devtool: "source-map",
  target: "web",
  mode: "production",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [".ts", ".js"],
    fallback: {
      crypto: require.resolve("crypto-browserify"),
      path: require.resolve("path-browserify"),
      // fs: require.resolve("browserfs"),
      os: require.resolve("os-browserify/browser"),
      stream: require.resolve("stream-browserify")
    },
    alias: {
      child_process: path.resolve(__dirname, "mock/mock_module.js"),
      fs: path.resolve(__dirname, "mock/mock_module.js")
    }
  },
  output: {
    filename: "bitcoin-predict.mjs",
    sourceMapFilename: "bitcoin-predict.map",
    path: path.resolve(__dirname, "dist"),
    library: {
      type: "module"
    }
  },
  plugins: [
    // new webpack.IgnorePlugin({ resourceRegExp: /child_process$/ }),
    new webpack.IgnorePlugin({ resourceRegExp: /predictionMarket.scrypt$/ }),
    new NodePolyfillPlugin()
  ],
  experiments: {
    outputModule: true
  }
}
