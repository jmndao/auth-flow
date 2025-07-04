// rollup.config.mjs - Main build (optimized)
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.ROLLUP_WATCH;

export default [
  // ES Module build
  {
    input: 'index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'es',
      sourcemap: isDevelopment, // Only in development
    },
    external: ['axios'],
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: 'dist',
        declarationMap: isDevelopment, // Only in development
      }),
      isProduction &&
        terser({
          compress: {
            drop_console: true,
            drop_debugger: true,
          },
        }),
    ].filter(Boolean),
  },
  // CommonJS build
  {
    input: 'index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: isDevelopment, // Only in development
      exports: 'named',
    },
    external: ['axios'],
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false,
      }),
      isProduction &&
        terser({
          compress: {
            drop_console: true,
            drop_debugger: true,
          },
        }),
    ].filter(Boolean),
  },
];
