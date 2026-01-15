# Daily Bible Verse

Automated daily GitHub contributions with a random Bible verse.

## 📖 Today's Verse

<!-- VERSE_START -->
![Today's Verse](verse.svg)

> **1 Thessalonians 1:8**
>
> *"[8] For from you sounded out the word of the Lord not only in Macedonia and Achaia, but also in every place your faith to God-ward is spread abroad; so that we need not to speak any thing."*
<!-- VERSE_END -->

---

## Setup

1. Get a free API key from [api.bible](https://api.bible)
2. Set up the secret (see below)
3. Run manually or let GitHub Actions handle it daily

### Local Usage

```bash
# Set your API key
$env:API_BIBLE_KEY="your-api-key"  # Windows PowerShell
export API_BIBLE_KEY="your-api-key"  # Linux/Mac

# Run
npm run commit
```

### GitHub Actions (Automatic)

1. Go to repo Settings → Secrets and variables → Actions
2. Add secret: `API_BIBLE_KEY` with your API key
3. Enable Actions write permissions: Settings → Actions → General → Workflow permissions → "Read and write permissions"

The workflow runs daily at midnight UTC, or trigger manually from the Actions tab.

## History

See [contributions.json](contributions.json) for verse history.
