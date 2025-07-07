import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';

const isProduction = process.env.NODE_ENV === 'production';

const basePlugins = [
  resolve({
    browser: true,
    preferBuiltins: false,
  }),
  commonjs(),
  typescript({
    tsconfig: './tsconfig.json',
    declaration: true,
    declarationDir: 'dist',
  }),
];

const productionPlugins = isProduction ? [terser()] : [];

export default [
  // Main library bundle
  {
    input: 'index.ts',
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
    plugins: [...basePlugins, ...productionPlugins],
    external: ['next/headers', 'next/server', 'react', 'vue'],
  },

  // Presets bundle
  {
    input: 'presets.ts',
    output: [
      {
        file: 'dist/presets.js',
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: 'dist/presets.esm.js',
        format: 'es',
        sourcemap: true,
      },
    ],
    plugins: [...basePlugins, ...productionPlugins],
    external: ['next/headers', 'next/server', 'react', 'vue'],
  },

  // Diagnostics bundle
  {
    input: 'diagnostics/index.ts',
    output: [
      {
        file: 'dist/diagnostics/index.js',
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: 'dist/diagnostics/index.esm.js',
        format: 'es',
        sourcemap: true,
      },
    ],
    plugins: [...basePlugins, ...productionPlugins],
    external: ['next/headers', 'next/server', 'react', 'vue'],
  },

  // Middleware bundle
  {
    input: 'middleware/index.ts',
    output: [
      {
        file: 'dist/middleware/index.js',
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: 'dist/middleware/index.esm.js',
        format: 'es',
        sourcemap: true,
      },
    ],
    plugins: [...basePlugins, ...productionPlugins],
    external: ['next/headers', 'next/server', 'react', 'vue'],
  },

  // React hooks bundle
  {
    input: 'frameworks/react/hooks.ts',
    output: [
      {
        file: 'dist/frameworks/react/hooks.js',
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: 'dist/frameworks/react/hooks.esm.js',
        format: 'es',
        sourcemap: true,
      },
    ],
    plugins: [...basePlugins, ...productionPlugins],
    external: ['react', 'next/headers', 'next/server', 'vue'],
  },

  // Vue composables bundle
  {
    input: 'frameworks/vue/composables.ts',
    output: [
      {
        file: 'dist/frameworks/vue/composables.js',
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: 'dist/frameworks/vue/composables.esm.js',
        format: 'es',
        sourcemap: true,
      },
    ],
    plugins: [...basePlugins, ...productionPlugins],
    external: ['vue', 'next/headers', 'next/server', 'react'],
  },

  // Next.js utilities bundle
  {
    input: 'frameworks/nextjs/index.ts',
    output: [
      {
        file: 'dist/frameworks/nextjs/index.js',
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: 'dist/frameworks/nextjs/index.esm.js',
        format: 'es',
        sourcemap: true,
      },
    ],
    plugins: [...basePlugins, ...productionPlugins],
    external: ['next/headers', 'next/server', 'react', 'vue'],
  },

  // Vanilla JavaScript utilities bundle
  {
    input: 'frameworks/vanilla/setup.ts',
    output: [
      {
        file: 'dist/frameworks/vanilla/setup.js',
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: 'dist/frameworks/vanilla/setup.esm.js',
        format: 'es',
        sourcemap: true,
      },
    ],
    plugins: [...basePlugins, ...productionPlugins],
    external: ['next/headers', 'next/server', 'react', 'vue'],
  },
];
