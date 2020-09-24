import json from '@rollup/plugin-json'
import { terser } from 'rollup-plugin-terser'
import debugConfig from './rollup.debug.config'
import defaultConfig from './rollup.default.config'

export default (commandLineArgs) => {
  let base = defaultConfig
  if (commandLineArgs.configDebug === true) {
    base = debugConfig
  }

  // return merge(base, {})
  return [
    {
      input: 'src/main.js',
      output: [
        {
          file: 'dist/main.cjs',
          format: 'cjs',
        },
        {
          file: 'dist/main.iife.js',
          format: 'iife',
          // plugins: [terser()],
        },
      ],
      plugins: [json()],
    },
    {
      input: 'src/app.js',
      output: [
        {
          dir: 'dist',
          format: 'cjs',
        },
        {
          dir: 'dist',
          format: 'es',
          plugins: [terser()],
        },
      ],
    },
  ]
}
