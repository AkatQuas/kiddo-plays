const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add .wasm to the list of asset extensions so Metro can resolve them
config.resolver.assetExts.push('wasm');

// Add .wasm as a source extension Metro can resolve
config.resolver.sourceExts.push('wasm');

module.exports = config;