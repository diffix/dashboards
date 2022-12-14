function excludeModules(modules) {
  return new RegExp(`node_modules[/\\\\](?:${modules.join('|')})`);
}

module.exports = [
  // Add support for native node modules
  {
    test: /\.node$/,
    use: 'node-loader',
  },
  {
    test: /\.(m?js|node)$/,
    exclude: excludeModules(['react-markdown', 'jotai']),
    parser: { amd: false },
    use: {
      loader: '@marshallofsound/webpack-asset-relocator-loader',
      options: {
        outputAssetBase: 'native_modules',
      },
    },
  },
  {
    test: /\.tsx?$/,
    exclude: /(node_modules|\.webpack)/,
    use: {
      loader: 'ts-loader',
    },
  },
  {
    test: /\.(svg|gif|icns|ico|jpg|png|otf|eot|woff|woff2|ttf)$/,
    type: 'asset/resource',
  },
];
