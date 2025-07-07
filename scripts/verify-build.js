const fs = require('fs');
const path = require('path');

/**
 * Verify that all expected build outputs are present
 */
function verifyBuild() {
  const distDir = path.join(__dirname, '../dist');

  if (!fs.existsSync(distDir)) {
    console.log('dist directory does not exist!');
    console.log('Run: npm run build');
    return false;
  }

  const expectedFiles = [
    // Main files
    'index.js',
    'index.esm.js',
    'index.d.ts',

    // Presets
    'presets.js',
    'presets.esm.js',
    'presets.d.ts',

    // Diagnostics
    'diagnostics/index.js',
    'diagnostics/index.esm.js',
    'diagnostics/index.d.ts',

    // Middleware
    'middleware/index.js',
    'middleware/index.esm.js',
    'middleware/index.d.ts',

    // Framework integrations
    'frameworks/react/hooks.js',
    'frameworks/react/hooks.esm.js',
    'frameworks/react/hooks.d.ts',

    'frameworks/vue/composables.js',
    'frameworks/vue/composables.esm.js',
    'frameworks/vue/composables.d.ts',

    'frameworks/nextjs/index.js',
    'frameworks/nextjs/index.esm.js',
    'frameworks/nextjs/index.d.ts',

    'frameworks/vanilla/setup.js',
    'frameworks/vanilla/setup.esm.js',
    'frameworks/vanilla/setup.d.ts',
  ];

  console.log('Verifying build outputs...\n');

  let allPresent = true;
  const missingFiles = [];
  const presentFiles = [];

  for (const file of expectedFiles) {
    const filePath = path.join(distDir, file);
    const exists = fs.existsSync(filePath);

    if (exists) {
      const stats = fs.statSync(filePath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      console.log(`FOUND ${file} (${sizeKB} KB)`);
      presentFiles.push(file);
    } else {
      console.log(`MISSING ${file}`);
      missingFiles.push(file);
      allPresent = false;
    }
  }

  console.log('\n' + '='.repeat(60));

  if (allPresent) {
    console.log(`All build outputs are present! (${presentFiles.length} files)`);

    // Verify package.json exports
    const packagePath = path.join(__dirname, '../package.json');
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const exportPaths = Object.keys(pkg.exports || {});
      console.log(`Package exports: ${exportPaths.join(', ')}`);
    }

    console.log('\nReady to publish!');
    return true;
  } else {
    console.log(`Missing ${missingFiles.length} build outputs:`);
    missingFiles.forEach((file) => console.log(`   - ${file}`));

    console.log('\nTo fix this, run:');
    console.log('   npm run build');

    return false;
  }
}

/**
 * Additional verification checks
 */
function runDiagnostics() {
  console.log('\nRunning additional diagnostics...\n');

  const rootDir = path.join(__dirname, '..');

  // Check essential files
  const essentialFiles = [
    'package.json',
    'tsconfig.json',
    'rollup.config.mjs',
    'index.ts',
    'presets.ts',
    'README.md',
    'CHANGELOG.md',
  ];

  essentialFiles.forEach((file) => {
    const filePath = path.join(rootDir, file);
    if (fs.existsSync(filePath)) {
      console.log(`FOUND ${file}`);
    } else {
      console.log(`MISSING ${file}`);
    }
  });

  // Check core modules
  const coreModules = [
    'core/auth-client.ts',
    'core/token-manager.ts',
    'core/request-handler.ts',
    'types/index.ts',
    'storage/index.ts',
    'diagnostics/index.ts',
  ];

  console.log('\nCore modules:');
  coreModules.forEach((file) => {
    const filePath = path.join(rootDir, file);
    if (fs.existsSync(filePath)) {
      console.log(`FOUND ${file}`);
    } else {
      console.log(`MISSING ${file}`);
    }
  });

  console.log('\n' + '='.repeat(60));
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--diagnostics') || args.includes('-d')) {
    runDiagnostics();
  }

  const success = verifyBuild();

  if (!success && (args.includes('--verbose') || args.includes('-v'))) {
    runDiagnostics();
  }

  process.exit(success ? 0 : 1);
}

module.exports = { verifyBuild, runDiagnostics };
