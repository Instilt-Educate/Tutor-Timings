const dotenv = require('dotenv-webpack')

module.exports = {
    entry: './src/home.js',
        output: {
            filename: 'bundle.js',
        },
    plugins: [
        new dotenv(),
    ],
    }