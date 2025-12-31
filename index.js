const { execSync } = require('child_process');
const fs = require('fs');

const DATA_FILE = 'contributions.json';
const README_FILE = 'README.md';
const API_BIBLE_KEY = process.env.API_BIBLE_KEY;
const BIBLE_ID = 'de4e12af7f28f599-02'; // King James Version

async function fetchDailyVerse() {
  try {
    // Get list of books
    const booksRes = await fetch(`https://api.scripture.api.bible/v1/bibles/${BIBLE_ID}/books`, {
      headers: { 'api-key': API_BIBLE_KEY }
    });
    const booksData = await booksRes.json();
    const books = booksData.data;

    // Pick a random book
    const randomBook = books[Math.floor(Math.random() * books.length)];

    // Get chapters for that book
    const chaptersRes = await fetch(
      `https://api.scripture.api.bible/v1/bibles/${BIBLE_ID}/books/${randomBook.id}/chapters`,
      { headers: { 'api-key': API_BIBLE_KEY } }
    );
    const chaptersData = await chaptersRes.json();
    const chapters = chaptersData.data.filter(c => c.id !== `${randomBook.id}.intro`);

    // Pick a random chapter
    const randomChapter = chapters[Math.floor(Math.random() * chapters.length)];

    // Get verses for that chapter
    const versesRes = await fetch(
      `https://api.scripture.api.bible/v1/bibles/${BIBLE_ID}/chapters/${randomChapter.id}/verses`,
      { headers: { 'api-key': API_BIBLE_KEY } }
    );
    const versesData = await versesRes.json();
    const verses = versesData.data;

    // Pick a random verse
    const randomVerse = verses[Math.floor(Math.random() * verses.length)];

    // Get the verse content
    const verseRes = await fetch(
      `https://api.scripture.api.bible/v1/bibles/${BIBLE_ID}/verses/${randomVerse.id}?content-type=text`,
      { headers: { 'api-key': API_BIBLE_KEY } }
    );
    const verseData = await verseRes.json();

    return {
      reference: verseData.data.reference,
      text: verseData.data.content.trim()
    };
  } catch (error) {
    console.error('Failed to fetch verse:', error.message);
    return {
      reference: 'Proverbs 3:5-6',
      text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.'
    };
  }
}

function syncWithRemote() {
  try {
    console.log('📥 Syncing with remote...');
    execSync('git stash', { stdio: 'pipe' });
    execSync('git pull origin main', { stdio: 'inherit' });
    try {
      execSync('git stash pop', { stdio: 'pipe' });
    } catch {
      // No stash to pop
    }
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
