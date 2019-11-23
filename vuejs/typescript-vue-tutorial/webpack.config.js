var path = require('path')
var webpack = require('webpack')

module.exports = {
    entry: './src/index.ts',
    output: {
        path: path.resolve(__dirname, './dist'),
        publicPath: '/dist/',
        filename:'build.js'
    },
    module: {
        rules: [
            {
                test: /\.vue$/,
                loader: 'vue-loader',
                options: {
                    loaders: {
                        'scss': 'vue-style-loader!css-loader!sass-loader',
                        'sass': 'vue-style-lodaer!css-loader!sass-loader?indentedSyntax'
                    }
                }
            },
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                exclude:[' /node_modules/'],
                options: {
                    appendTsSuffixTo: [/\.vue$/]
                }
            },
            {
                test: /\.(png|jpg|gif|svg)$/,
                loader: 'file-loader',
                options: {
                    name: '[name].[ext]?[hash]'
                }
            }
        ]
    },
    resolve:{
        extensions: ['.ts', '.js', '.vue', '.json'],
        alias: {
            'vue$': 'vue/dist/vue.esm.js'
        }
    },
    devServer: {
        historyApiFallback: true,
        noInfo: true
    },
    performance: {
        hints: false
    },
    devtool: '#eval-source-map'
}

if (process.env.NODE_ENV === 'production') {
    module.exports.devtool = '#source-map'
    module.exports.plugins = (module.exports.plugins || []).concat([
        new webpack.DefinPlugin({
            'process.env': {
                NODE_ENV:'"production"'
            }
        }),
        new webpack.optimize.UglifyJsPlugin({
            sourceMap: true,
            compress: {
                warnings: false
            } 
        }),
        new webpack.LoaderOptionsPlugin({
            minimize: true
        })
    ])
}
