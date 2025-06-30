const fs = require('fs');
const path = require('path');

// Read package.json
const packagePath = path.join(process.cwd(), 'package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

console.log(`Updating version references to ${pkg.version}...`);

// Update README.md version references
const readmePath = path.join(process.cwd(), 'README.md');
if (fs.existsSync(readmePath)) {
  let readme = fs.readFileSync(readmePath, 'utf8');

  // Update npm install command
  readme = readme.replace(
    /npm install @jmndao\/auth-flow@[\d.]+/g,
    `npm install @jmndao/auth-flow@${pkg.version}`
  );

  // Update any version badges
  readme = readme.replace(/badge\/version-[\d.]+-/g, `badge/version-${pkg.version}-`);

  fs.writeFileSync(readmePath, readme);
  console.log('Updated README.md');
}

// Update changelog with current date
const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
if (fs.existsSync(changelogPath)) {
  let changelog = fs.readFileSync(changelogPath, 'utf8');
  const today = new Date().toISOString().split('T')[0];

  // Replace [Unreleased] with current version and date
  changelog = changelog.replace(/## \[Unreleased\]/g, `## [${pkg.version}] - ${today}`);

  fs.writeFileSync(changelogPath, changelog);
  console.log('Updated CHANGELOG.md');
}

console.log('Version update complete!');
