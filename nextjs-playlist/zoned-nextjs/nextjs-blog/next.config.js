const {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
} = require('next/constants');

module.exports = (phase, { defaultConfig }) => {
  const nextConfig = {
    ...defaultConfig,

    env: {
      customKey: 'my-blog-value',
    },

    basePath: '/blog',

    // target: 'serverless',

    webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
      // Note: we provide webpack above so you should not `require` it
      // Perform customizations to webpack config
      config.plugins.push(new webpack.IgnorePlugin(/\/__tests__\//));

      /*
      config.module.rules.push({
        test: /\.mdx/,
        use: [
          options.defaultLoaders.babel,
          {
            loader: '@mdx-js/loader',
            options: pluginOptions.options,
          },
        ],
      })
     */

      // Important: return the modified config
      return config;
    },

    publicRuntimeConfig: {
      // Will be available on both server and client
      staticFolder: '/static',
    },
  };
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    // do something to modify config
    // phase is development server
    nextConfig.compress = false;
    nextConfig.generateEtags = false;
  }
  if (phase === PHASE_PRODUCTION_BUILD) {
    // do something to modify config
    // phase is production build
  }
  if (phase === PHASE_PRODUCTION_SERVER) {
    // do something to modify config
    // phase is production server
    nextConfig.serverRuntimeConfig = {
      // Will only be available on the server side
      mySecret: 'secret',
      secondSecret: process.env.SECOND_SECRET, // Pass through env variables
    };

    nextConfig.poweredByHeader = false;
  }

  return nextConfig;
};
