const path = require("path")
const webpack = require("webpack")

module.exports = {
  entry: "./src/index.ts",
  devtool: "inline-source-map",
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
      os: require.resolve("os-browserify/browser"),
      stream: require.resolve("stream-browserify"),
      buffer: require.resolve("buffer"),
      url: require.resolve("url"),
      assert: require.resolve("assert")
    },
    alias: {
      child_process: path.resolve(__dirname, "mock/mock_module.js"),
      fs: path.resolve(__dirname, "mock/mock_module.js")
    }
  },
  output: {
    filename: "bitcoin-predict.js",
    sourceMapFilename: "bitcoin-predict.map",
    path: path.resolve(__dirname, "dist"),
    libraryTarget: "umd"
  },
  plugins: [
    // new webpack.IgnorePlugin({ resourceRegExp: /child_process$/ }),
    new webpack.IgnorePlugin({ resourceRegExp: /predictionMarket.scrypt$/ }),
    new webpack.ProvidePlugin({
      process: "process/browser"
    })
  ]
}
