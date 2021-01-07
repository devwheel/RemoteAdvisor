/// <binding BeforeBuild='Run - Development' />
const path = require('path');
module.exports = {
    entry: './Scripts/App/Index.js',
    output: {
        path: path.resolve(__dirname, 'Scripts/App'),
        filename: 'Bundle.js'
    },
    optimization: { minimize: false },
    mode: 'none'
};