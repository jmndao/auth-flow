// rollup.config.v2.mjs - V2 build (enhanced)
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
      sourcemap: false, // Never include source maps in published packages
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: 'dist',
        rootDir: '.',
        declarationMap: false, // Never include declaration maps
        sourceMap: false, // Ensure no source maps
      }),
      isProduction &&
        terser({
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.warn', 'console.error', 'console.debug'], // Remove ALL console calls
            passes: 2, // Run compression twice for better results
          },
          mangle: {
            keep_fnames: false, // Allow function name mangling for smaller bundles
          },
          format: {
            comments: false, // Remove all comments
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
      sourcemap: false, // Never include source maps
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false,
        sourceMap: false,
      }),
      isProduction &&
        terser({
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.warn', 'console.error', 'console.debug'],
            passes: 2,
          },
          mangle: {
            keep_fnames: false,
          },
          format: {
            comments: false,
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
              sourceMap: false,
            }),
            terser({
              compress: {
                drop_console: true,
                drop_debugger: true,
                pure_funcs: [
                  'console.log',
                  'console.warn',
                  'console.error',
                  'console.debug',
                  'console.info',
                ],
                passes: 3, // Extra compression for UMD
                unsafe: true, // Aggressive compression
              },
              mangle: {
                keep_fnames: false,
                toplevel: true, // Mangle top-level names
              },
              format: {
                comments: false,
              },
            }),
          ],
        },
      ]
    : []),
];
