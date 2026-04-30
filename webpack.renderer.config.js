const rules = require('./webpack.rules');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');

rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
});

module.exports = {
  // Put your normal webpack config below here
  module: {
    rules,
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'src/lib'),
          to: path.resolve(__dirname, '.webpack/renderer/main_window/lib'),
        },
        {
          from: path.resolve(__dirname, 'src/lib'),
          to: path.resolve(__dirname, '.webpack/renderer/editor_window/lib'),
        },
      ],
    }),
  ],
};
