const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');

// Generate changelog from git commits
function generateChangelog() {
  try {
    // Get the latest tag
    let latestTag;
    try {
      latestTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
    } catch {
      latestTag = null; // No tags yet
    }

    // Get commits since the latest tag (or all commits if no tags)
    const gitLogCommand = latestTag
      ? `git log ${latestTag}..HEAD --oneline --no-merges`
      : 'git log --oneline --no-merges';

    const commits = execSync(gitLogCommand, { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter((line) => line.length > 0);

    if (commits.length === 0) {
      console.log('No new commits since last release');
      return;
    }

    // Categorize commits
    const categories = {
      features: [],
      fixes: [],
      docs: [],
      style: [],
      refactor: [],
      test: [],
      chore: [],
      breaking: [],
      other: [],
    };

    commits.forEach((commit) => {
      const [hash, ...messageParts] = commit.split(' ');
      const message = messageParts.join(' ');
      const shortHash = hash.substring(0, 7);

      if (message.includes('BREAKING CHANGE') || message.startsWith('!')) {
        categories.breaking.push(`- ${message} (${shortHash})`);
      } else if (message.startsWith('feat')) {
        categories.features.push(`- ${message.replace(/^feat:\s*/, '')} (${shortHash})`);
      } else if (message.startsWith('fix')) {
        categories.fixes.push(`- ${message.replace(/^fix:\s*/, '')} (${shortHash})`);
      } else if (message.startsWith('docs')) {
        categories.docs.push(`- ${message.replace(/^docs:\s*/, '')} (${shortHash})`);
      } else if (message.startsWith('style')) {
        categories.style.push(`- ${message.replace(/^style:\s*/, '')} (${shortHash})`);
      } else if (message.startsWith('refactor')) {
        categories.refactor.push(`- ${message.replace(/^refactor:\s*/, '')} (${shortHash})`);
      } else if (message.startsWith('test')) {
        categories.test.push(`- ${message.replace(/^test:\s*/, '')} (${shortHash})`);
      } else if (message.startsWith('chore')) {
        categories.chore.push(`- ${message.replace(/^chore:\s*/, '')} (${shortHash})`);
      } else {
        categories.other.push(`- ${message} (${shortHash})`);
      }
    });

    // Generate changelog content
    let changelogContent = `## [Unreleased]\n\n`;

    if (categories.breaking.length > 0) {
      changelogContent += `### BREAKING CHANGES\n\n${categories.breaking.join('\n')}\n\n`;
    }

    if (categories.features.length > 0) {
      changelogContent += `### Features\n\n${categories.features.join('\n')}\n\n`;
    }

    if (categories.fixes.length > 0) {
      changelogContent += `### Bug Fixes\n\n${categories.fixes.join('\n')}\n\n`;
    }

    if (categories.docs.length > 0) {
      changelogContent += `### Documentation\n\n${categories.docs.join('\n')}\n\n`;
    }

    if (categories.refactor.length > 0) {
      changelogContent += `### Code Refactoring\n\n${categories.refactor.join('\n')}\n\n`;
    }

    if (categories.test.length > 0) {
      changelogContent += `### Tests\n\n${categories.test.join('\n')}\n\n`;
    }

    if (categories.style.length > 0) {
      changelogContent += `### Styles\n\n${categories.style.join('\n')}\n\n`;
    }

    if (categories.chore.length > 0) {
      changelogContent += `### Chores\n\n${categories.chore.join('\n')}\n\n`;
    }

    if (categories.other.length > 0) {
      changelogContent += `### Other Changes\n\n${categories.other.join('\n')}\n\n`;
    }

    // Read existing changelog or create header
    let existingChangelog = '';
    if (fs.existsSync(changelogPath)) {
      existingChangelog = fs.readFileSync(changelogPath, 'utf8');
      // Remove existing [Unreleased] section if it exists
      existingChangelog = existingChangelog.replace(/## \[Unreleased\][\s\S]*?(?=## \[|$)/, '');
    } else {
      existingChangelog = `# Changelog\n\nAll notable changes to this project will be documented in this file.\n\nThe format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),\nand this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n\n`;
    }

    // Combine new content with existing
    const finalChangelog = existingChangelog.replace(
      /(# Changelog[\s\S]*?\n\n)/,
      `$1${changelogContent}`
    );

    fs.writeFileSync(changelogPath, finalChangelog);
    console.log('Changelog updated successfully!');
  } catch (error) {
    console.error('Error generating changelog:', error.message);
    process.exit(1);
  }
}

generateChangelog();
