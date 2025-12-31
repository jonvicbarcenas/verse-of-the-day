const { execSync } = require('child_process');
const fs = require('fs');

const DATA_FILE = 'contributions.json';
const README_FILE = 'README.md';
const API_BIBLE_KEY = process.env.API_BIBLE_KEY;
const BIBLE_ID = 'de4e12af7f28f599-02'; // King James Version

// Config: set to false to skip pushing (commit only)
const SHOULD_PUSH = process.argv.includes('--no-push') ? false : true;

async function fetchDailyVerse() {
  const fallbackVerse = {
    reference: 'Proverbs 3:5-6',
    text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.'
  };

  if (!API_BIBLE_KEY) {
    console.warn('⚠️ API_BIBLE_KEY not set, using fallback verse');
    return fallbackVerse;
  }

  try {
    // Get list of books
    const booksRes = await fetch(`https://api.scripture.api.bible/v1/bibles/${BIBLE_ID}/books`, {
      headers: { 'api-key': API_BIBLE_KEY }
    });
    
    if (!booksRes.ok) {
      console.error('API error (books):', booksRes.status, await booksRes.text());
      return fallbackVerse;
    }

    const booksData = await booksRes.json();
    if (!booksData.data || !Array.isArray(booksData.data) || booksData.data.length === 0) {
      console.error('No books returned from API');
      return fallbackVerse;
    }
    const books = booksData.data;

    // Pick a random book
    const randomBook = books[Math.floor(Math.random() * books.length)];

    // Get chapters for that book
    const chaptersRes = await fetch(
      `https://api.scripture.api.bible/v1/bibles/${BIBLE_ID}/books/${randomBook.id}/chapters`,
      { headers: { 'api-key': API_BIBLE_KEY } }
    );
    
    if (!chaptersRes.ok) {
      console.error('API error (chapters):', chaptersRes.status, await chaptersRes.text());
      return fallbackVerse;
    }

    const chaptersData = await chaptersRes.json();
    if (!chaptersData.data || !Array.isArray(chaptersData.data)) {
      console.error('No chapters returned');
      return fallbackVerse;
    }
    const chapters = chaptersData.data.filter(c => c.id !== `${randomBook.id}.intro`);

    if (chapters.length === 0) {
      console.error('No chapters found after filtering');
      return fallbackVerse;
    }

    // Pick a random chapter
    const randomChapter = chapters[Math.floor(Math.random() * chapters.length)];

    // Get verses for that chapter
    const versesRes = await fetch(
      `https://api.scripture.api.bible/v1/bibles/${BIBLE_ID}/chapters/${randomChapter.id}/verses`,
      { headers: { 'api-key': API_BIBLE_KEY } }
    );
    
    if (!versesRes.ok) {
      console.error('API error (verses):', versesRes.status, await versesRes.text());
      return fallbackVerse;
    }

    const versesData = await versesRes.json();
    if (!versesData.data || !Array.isArray(versesData.data) || versesData.data.length === 0) {
      console.error('No verses returned');
      return fallbackVerse;
    }
    const verses = versesData.data;

    // Pick a random verse
    const randomVerse = verses[Math.floor(Math.random() * verses.length)];

    // Get the verse content
    const verseRes = await fetch(
      `https://api.scripture.api.bible/v1/bibles/${BIBLE_ID}/verses/${randomVerse.id}?content-type=text`,
      { headers: { 'api-key': API_BIBLE_KEY } }
    );
    
    if (!verseRes.ok) {
      console.error('API error (verse content):', verseRes.status, await verseRes.text());
      return fallbackVerse;
    }

    const verseData = await verseRes.json();

    if (!verseData.data) {
      console.error('No verse content returned');
      return fallbackVerse;
    }

    return {
      reference: verseData.data.reference,
      text: verseData.data.content.trim()
    };
  } catch (error) {
    console.error('Failed to fetch verse:', error);
    return fallbackVerse;
  }
}

function syncWithRemote() {
  try {
    console.log('📥 Syncing with remote...');
    // Ensure we're on main branch
    const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    if (currentBranch !== 'main') {
      console.log(`⚠️ Currently on branch '${currentBranch}', switching to main...`);
      execSync('git stash', { stdio: 'pipe' });
      execSync('git checkout main', { stdio: 'inherit' });
    }
    execSync('git pull origin main', { stdio: 'inherit' });
  } catch (error) {
    console.warn('⚠️ Sync warning, continuing...');
    try {
      execSync('git fetch origin', { stdio: 'pipe' });
      execSync('git reset --hard origin/main', { stdio: 'pipe' });
      console.log('🔄 Reset to remote state');
    } catch {
      // Continue anyway
    }
  }
}

function updateReadme(verse) {
  let readme = fs.readFileSync(README_FILE, 'utf8');
  
  const verseSection = `<!-- VERSE_START -->
> **${verse.reference}**
>
> *"${verse.text}"*
<!-- VERSE_END -->`;

  readme = readme.replace(
    /<!-- VERSE_START -->[\s\S]*?<!-- VERSE_END -->/,
    verseSection
  );

  fs.writeFileSync(README_FILE, readme);
  console.log('📝 README updated with today\'s verse');
}

async function makeContribution() {
  syncWithRemote();

  // Fetch daily verse
  console.log('📖 Fetching daily Bible verse...');
  const verse = await fetchDailyVerse();
  console.log(`\n✝️ ${verse.reference}\n"${verse.text}"\n`);

  // Read or initialize the data file
  let data = { count: 0, history: [] };

  if (fs.existsSync(DATA_FILE)) {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }

  // Update the data
  data.count++;
  data.history.push({
    date: new Date().toISOString(),
    commit: data.count,
    verse: verse.reference,
    text: verse.text
  });

  // Keep only last 365 entries
  if (data.history.length > 365) {
    data.history = data.history.slice(-365);
  }

  // Write the updated data
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

  // Update README with today's verse
  updateReadme(verse);

  // Git commands
  try {
    execSync('git add .', { stdio: 'inherit' });
    execSync(`git commit -m "📖 ${verse.reference}"`, { stdio: 'inherit' });

    if (SHOULD_PUSH) {
      if (process.env.GITHUB_TOKEN) {
        const repo = process.env.GITHUB_REPOSITORY;
        const remote = `https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/${repo}.git`;
        execSync(`git push ${remote} HEAD:main`, { stdio: 'inherit' });
      } else {
        execSync('git push -u origin main', { stdio: 'inherit' });
      }
      console.log(`\n✅ Contribution #${data.count} pushed successfully!`);
    } else {
      console.log(`\n✅ Contribution #${data.count} committed (push skipped)`);
    }
  } catch (error) {
    console.error('❌ Git operation failed:', error.message);
    process.exit(1);
  }
}

makeContribution();
