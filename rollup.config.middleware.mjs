import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';

const production = !process.env.ROLLUP_WATCH;

export default {
  input: 'middleware/index.ts',
  output: [
    {
      file: 'dist/middleware.js',
      format: 'cjs',
      exports: 'named',
      sourcemap: true,
    },
    {
      file: 'dist/middleware.esm.js',
      format: 'es',
      exports: 'named',
      sourcemap: true,
    },
    {
      file: 'dist/middleware.umd.js',
      format: 'umd',
      name: 'AuthFlowMiddleware',
      exports: 'named',
      sourcemap: true,
    },
    ...(production
      ? [
          {
            file: 'dist/middleware.umd.min.js',
            format: 'umd',
            name: 'AuthFlowMiddleware',
            exports: 'named',
            sourcemap: true,
            plugins: [terser()],
          },
        ]
      : []),
  ],
  plugins: [
    resolve({
      browser: false,
      preferBuiltins: true,
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.middleware.json',
      declaration: true,
      declarationDir: 'dist',
      rootDir: '.',
    }),
  ],
  external: [
    // No external dependencies for middleware
  ],
};
