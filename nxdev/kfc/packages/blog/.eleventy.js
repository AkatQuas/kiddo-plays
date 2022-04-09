const { EleventyRenderPlugin } = require('@11ty/eleventy');

module.exports = function (/** @type import('@11ty/eleventy/src/UserConfig') */ eleventyConfig) {
  eleventyConfig.addPlugin(EleventyRenderPlugin);
  eleventyConfig.extensionMap.add({
    key: 'txt',
    extension: 'txt',
    compile: (str, input, preTemplateEngine, bypass) => {
      return (data) => str;
    }
  })
}
