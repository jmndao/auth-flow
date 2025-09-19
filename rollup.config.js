const resolve = require('@rollup/plugin-node-resolve');
const typescript = require('@rollup/plugin-typescript');
const { terser } = require('rollup-plugin-terser');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: 'dist/index.esm.js',
      format: 'es',
      sourcemap: true,
    },
  ],
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: false,
    }),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: 'dist',
      rootDir: 'src',
    }),
    ...(isProduction ? [terser()] : []),
  ],
  external: [],
};
