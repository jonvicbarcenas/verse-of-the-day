const { execSync } = require('child_process');
const fs = require('fs');

const DATA_FILE = 'contributions.json';

function syncWithRemote() {
  try {
    console.log('📥 Syncing with remote...');
    // Stash any local changes, pull, then pop
    execSync('git stash', { stdio: 'pipe' });
    execSync('git pull origin main', { stdio: 'inherit' });
    try {
      execSync('git stash pop', { stdio: 'pipe' });
    } catch {
      // No stash to pop, that's fine
    }
  } catch (error) {
    console.warn('⚠️ Sync warning, continuing...');
    // If pull fails, force reset to remote to avoid conflicts
    try {
      execSync('git fetch origin', { stdio: 'pipe' });
      execSync('git reset --hard origin/main', { stdio: 'pipe' });
      console.log('🔄 Reset to remote state');
    } catch {
      // Continue anyway
    }
  }
}

function getRandomCommitMessage() {
  const messages = [
    'Daily update',
    'Keep the streak alive',
    'Another day, another commit',
    'Consistency is key',
    'Building habits',
    'Progress update',
    'Daily contribution'
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

function makeContribution() {
  // Sync with remote first to avoid conflicts
  syncWithRemote();

  // Read or initialize the data file (re-read after sync)
  let data = { count: 0, history: [] };

  if (fs.existsSync(DATA_FILE)) {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }

  // Update the data
  data.count++;
  data.history.push({
    date: new Date().toISOString(),
    commit: data.count
  });

  // Keep only last 365 entries
  if (data.history.length > 365) {
    data.history = data.history.slice(-365);
  }

  // Write the updated data
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

  // Git commands
  try {
    execSync('git add .', { stdio: 'inherit' });
    execSync(`git commit -m "${getRandomCommitMessage()} #${data.count}"`, {
      stdio: 'inherit'
    });

    // In GitHub Actions, use GITHUB_TOKEN for authentication
    if (process.env.GITHUB_TOKEN) {
      const repo = process.env.GITHUB_REPOSITORY;
      const remote = `https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/${repo}.git`;
      execSync(`git push ${remote} HEAD:main`, { stdio: 'inherit' });
    } else {
      execSync('git push -u origin main', { stdio: 'inherit' });
    }

    console.log(`\n✅ Contribution #${data.count} pushed successfully!`);
  } catch (error) {
    console.error('❌ Git operation failed:', error.message);
    process.exit(1);
  }
}

makeContribution();
