// rollup.config.middleware.mjs - Middleware build (optimized)
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.ROLLUP_WATCH;

export default {
  input: 'middleware/index.ts',
  output: [
    {
      file: 'dist/middleware.js',
      format: 'cjs',
      exports: 'named',
      sourcemap: isDevelopment, // Only in development
    },
    {
      file: 'dist/middleware.esm.js',
      format: 'es',
      exports: 'named',
      sourcemap: isDevelopment, // Only in development
    },
    // Only build UMD min in production
    ...(isProduction
      ? [
          {
            file: 'dist/middleware.umd.min.js',
            format: 'umd',
            name: 'AuthFlowMiddleware',
            exports: 'named',
            sourcemap: false, // Never for minified builds
            plugins: [
              terser({
                compress: {
                  drop_console: true,
                  drop_debugger: true,
                },
              }),
            ],
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
  external: [
    // No external dependencies for middleware
  ],
};
