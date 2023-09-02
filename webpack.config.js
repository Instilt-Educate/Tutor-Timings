const webpack = require('webpack')
const dotenv = require('dotenv-webpack')

module.exports = {
    entry: './src/home.js',
        output: {
            filename: 'bundle.js',
        },
    plugins: [
        new webpack.DefinePlugin({
          'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
        }),
        new dotenv(),
    ],
    }