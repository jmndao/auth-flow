const fs = require('fs');
const path = require('path');

/**
 * Verify that all expected build outputs are present
 */
function verifyBuild() {
  const distDir = path.join(__dirname, '../dist');

  if (!fs.existsSync(distDir)) {
    console.log('dist directory does not exist!');
    console.log('Run: npm run build:all');
    return false;
  }

  const expectedFiles = [
    // v1 files
    'index.js',
    'index.esm.js',
    'index.d.ts',

    // v2 files
    'index-v2.js',
    'index-v2.esm.js',
    'index-v2.d.ts',

    // Middleware files
    'middleware.js',
    'middleware.esm.js',
  ];

  // Check for middleware types in either location
  const middlewareTypesPaths = ['middleware.d.ts', 'middleware/index.d.ts'];

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

  // Check middleware types separately
  let middlewareTypesFound = false;
  let middlewareTypesPath = '';

  for (const typesPath of middlewareTypesPaths) {
    const filePath = path.join(distDir, typesPath);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      console.log(`FOUND ${typesPath} (${sizeKB} KB)`);
      middlewareTypesFound = true;
      middlewareTypesPath = filePath;
      presentFiles.push(typesPath);
      break;
    }
  }

  if (!middlewareTypesFound) {
    console.log(`MISSING middleware types (checked: ${middlewareTypesPaths.join(', ')})`);
    missingFiles.push('middleware.d.ts');
    allPresent = false;
  }

  console.log('\n' + '='.repeat(50));

  if (allPresent) {
    console.log('All build outputs are present!');
    console.log(`Found ${presentFiles.length} files in dist/`);

    // Check middleware.d.ts content
    if (middlewareTypesFound && middlewareTypesPath) {
      const content = fs.readFileSync(middlewareTypesPath, 'utf8');
      if (content.includes('TokenValidationResult') && content.includes('MiddlewareConfig')) {
        console.log('Middleware types are properly exported!');
      } else {
        console.log('WARNING: Middleware types may be incomplete');
        console.log('   Expected: TokenValidationResult, MiddlewareConfig');
      }
    }

    // Show package.json exports check
    const packagePath = path.join(__dirname, '../package.json');
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      if (pkg.exports && pkg.exports['./middleware']) {
        console.log('Middleware export path configured in package.json');
      } else {
        console.log('WARNING: Middleware export path missing in package.json');
      }
    }

    console.log('\nReady to publish!');
    return true;
  } else {
    console.log(`Missing ${missingFiles.length} build outputs:`);
    missingFiles.forEach((file) => console.log(`   - ${file}`));

    console.log('\nTo fix this, run:');
    if (missingFiles.some((f) => f.startsWith('index.'))) {
      console.log('   npm run build');
    }
    if (missingFiles.some((f) => f.startsWith('index-v2.'))) {
      console.log('   npm run build:v2');
    }
    if (missingFiles.some((f) => f.startsWith('middleware.'))) {
      console.log('   npm run build:middleware');
    }
    console.log('\n   Or run all at once:');
    console.log('   npm run build:all');

    return false;
  }
}

/**
 * Additional verification checks
 */
function runDiagnostics() {
  console.log('\nRunning additional diagnostics...\n');

  const rootDir = path.join(__dirname, '..');

  // Check TypeScript configs
  const tsConfigs = ['tsconfig.json', 'tsconfig.v2.json', 'tsconfig.middleware.json'];
  tsConfigs.forEach((config) => {
    const configPath = path.join(rootDir, config);
    if (fs.existsSync(configPath)) {
      console.log(`FOUND ${config}`);
    } else {
      console.log(`MISSING ${config}`);
    }
  });

  // Check Rollup configs
  const rollupConfigs = [
    'rollup.config.mjs',
    'rollup.config.v2.mjs',
    'rollup.config.middleware.mjs',
  ];
  rollupConfigs.forEach((config) => {
    const configPath = path.join(rootDir, config);
    if (fs.existsSync(configPath)) {
      console.log(`FOUND ${config}`);
    } else {
      console.log(`MISSING ${config}`);
    }
  });

  // Check source files
  const sourceFiles = ['index.ts', 'index-v2.ts', 'middleware/index.ts', 'middleware/types.ts'];

  sourceFiles.forEach((file) => {
    const filePath = path.join(rootDir, file);
    if (fs.existsSync(filePath)) {
      console.log(`FOUND ${file}`);
    } else {
      console.log(`MISSING ${file}`);
    }
  });

  console.log('\n' + '='.repeat(50));
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
