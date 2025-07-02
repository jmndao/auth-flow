import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';

const external = ['axios'];
const globals = { axios: 'axios' };

export default [
  // v2.0 Main Build - ES Module
  {
    input: 'index-v2.ts',
    external,
    output: {
      file: 'dist/index-v2.esm.js',
      format: 'es',
      globals,
      sourcemap: true,
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: 'dist',
        rootDir: '.',
      }),
    ],
  },

  // v2.0 Main Build - CommonJS
  {
    input: 'index-v2.ts',
    external,
    output: {
      file: 'dist/index-v2.js',
      format: 'cjs',
      globals,
      sourcemap: true,
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
      }),
    ],
  },

  // v2.0 Main Build - UMD (Browser)
  {
    input: 'index-v2.ts',
    external,
    output: {
      file: 'dist/index-v2.umd.js',
      format: 'umd',
      name: 'AuthFlowV2',
      globals,
      sourcemap: true,
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
      }),
    ],
  },

  // v2.0 Main Build - UMD Minified
  {
    input: 'index-v2.ts',
    external,
    output: {
      file: 'dist/index-v2.umd.min.js',
      format: 'umd',
      name: 'AuthFlowV2',
      globals,
      sourcemap: true,
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
      }),
      terser(),
    ],
  },
];
