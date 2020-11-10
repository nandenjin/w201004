const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const package = require('./package.json')

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  context: path.resolve(__dirname, 'src'),
  entry: './index.ts',
  output: {
    filename: '[contenthash].js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.ts$/i,
        loader: 'ts-loader',
      },
      {
        test: /\.s[ac]ss/i,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
      {
        test: /\.clist$/,
        use: [
          {
            loader: '@nandenjin/emcc-loader',
            options: {
              cwd: __dirname,
              cc: 'docker run -v $(pwd):/src emscripten/emsdk emcc',
              cxx: 'docker run -v $(pwd):/src emscripten/emsdk em++',
              ld: 'docker run -v $(pwd):/src emscripten/emsdk emcc',
              buildDir: `${__dirname}/temp`,
              commonFlags: ['-O3'],
              cFlags: ['-std=c11'],
              cxxFlags: ['-std=c++1z'],
              ldFlags: [
                '-s',
                'TOTAL_MEMORY=1024MB',

                '-s',
                `EXTRA_EXPORTED_RUNTIME_METHODS=['ccall', 'cwrap', 'allocate', 'intArrayFromString']`,

                // https://github.com/emscripten-core/emscripten/issues/6882
                '-s',
                `EXPORTED_FUNCTIONS=['_malloc', '_free']`,
              ],
            },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
    fallback: { path: 'path-browserify' },
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: package.name,
      scriptLoading: 'defer',
    }),
  ],
  devServer: {
    port: 3000,
    inline: true,
    hot: true,
  },
  externals: {
    fs: 'empty',
  },
}
