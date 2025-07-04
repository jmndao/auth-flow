// rollup.config.v2.mjs - V2 build (optimized)
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';

const external = ['axios'];
const globals = { axios: 'axios' };
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.ROLLUP_WATCH;

export default [
  // v2.0 ES Module
  {
    input: 'index-v2.ts',
    external,
    output: {
      file: 'dist/index-v2.esm.js',
      format: 'es',
      globals,
      sourcemap: isDevelopment, // Only in development
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: 'dist',
        rootDir: '.',
        declarationMap: isDevelopment, // Only in development
      }),
      isProduction &&
        terser({
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.warn'], // Remove specific console calls
          },
        }),
    ].filter(Boolean),
  },

  // v2.0 CommonJS
  {
    input: 'index-v2.ts',
    external,
    output: {
      file: 'dist/index-v2.js',
      format: 'cjs',
      globals,
      sourcemap: isDevelopment, // Only in development
    },
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

  // v2.0 UMD (only in production, minified, no source maps)
  ...(isProduction
    ? [
        {
          input: 'index-v2.ts',
          external,
          output: {
            file: 'dist/index-v2.umd.min.js',
            format: 'umd',
            name: 'AuthFlowV2',
            globals,
            sourcemap: false, // Never for UMD builds
          },
          plugins: [
            resolve(),
            commonjs(),
            typescript({
              tsconfig: './tsconfig.json',
              declaration: false,
              declarationMap: false,
            }),
            terser({
              compress: {
                drop_console: true,
                drop_debugger: true,
                pure_funcs: ['console.log', 'console.warn', 'console.error'],
              },
              mangle: {
                keep_fnames: true, // Keep function names for better stack traces
              },
            }),
          ],
        },
      ]
    : []),
];
