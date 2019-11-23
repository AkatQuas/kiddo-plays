module.exports = {
    'root': true,
    'env': {
        'browser': true,
        'commonjs': true,
        'es6': true,
        'node': true
    },
    'globals': {
        'AMap': true,
        'tinymce': true
    },
    'extends': ['eslint:recommended', 'plugin:vue/recommended'],
    'parserOptions': {
        'parser': 'babel-eslint',
        'sourceType': 'module'
    },
    'settings': {
        'import/resolver': {
            'webpack': {
                'config': 'build/webpack.conf.js'
            }
        }
    },
    'rules': {
        'indent': ['off', 4],
        'linebreak-style': ['error', 'unix'],
        'no-console': ['warn', { 'allow': ['log', 'info', 'error'] }],
        'no-constant-condition': ['off'],
        'no-undef': ['error'],
        'no-multi-spaces': ['warn'],
        'no-unused-vars': ['off', { 'args': 'none', 'vars': 'all' }],
        'quotes': ['error', 'single', { 'allowTemplateLiterals': true, 'avoidEscape': true }],
        'semi': ['error', 'always'],
        //    ES6 rules
        'arrow-spacing': ['error', { 'after': true, 'before': true }],
        'no-duplicate-imports': ['error'],
        'no-var': ['error']
    }
}