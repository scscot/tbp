#!/usr/bin/env node

/**
 * Podcast Generation Script for Team Build Pro
 *
 * Generates 5-minute podcast episodes for blog posts in all 4 languages.
 * Uses Claude API for script generation and ElevenLabs for TTS.
 * Uploads to Firebase Storage and embeds players in blog HTML.
 *
 * Usage:
 *   node generate-podcasts.js <slug>                    # Generate for specific blog post
 *   node generate-podcasts.js <slug> --lang=en         # Generate only English
 *   node generate-podcasts.js <slug> --skip-upload     # Skip Firebase upload (local only)
 *   node generate-podcasts.js --list                   # List available blog posts
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');

// Import podcast configuration
const {
  ELEVENLABS_API_KEY,
  ELEVENLABS_BASE_URL,
  VOICES,
  MODEL_ID,
  VOICE_SETTINGS,
  PODCAST_LABELS,
  FIREBASE_STORAGE_BUCKET,
  PODCAST_SCRIPT_PROMPT,
  PODCAST_PLAYER_HTML,
  PODCAST_TRACKING_SCRIPT
} = require('./podcast-config');

// Load Anthropic API key from secrets file or environment
const ANTHROPIC_API_KEY_PATH = path.join(__dirname, '..', 'secrets', 'Anthropic-API-Key');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ||
  (fs.existsSync(ANTHROPIC_API_KEY_PATH) ? fs.readFileSync(ANTHROPIC_API_KEY_PATH, 'utf8').trim() : '');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  red: '\x1b[31m'
};

// Parse command line arguments
const args = process.argv.slice(2);
const slug = args.find(arg => !arg.startsWith('--')) || null;
const langFlag = args.find(arg => arg.startsWith('--lang='));
const targetLang = langFlag ? langFlag.split('=')[1] : null;
const skipUpload = args.includes('--skip-upload');
const listBlogs = args.includes('--list');
const dryRun = args.includes('--dry-run');

// Directory paths
const WEB_DIR = path.join(__dirname, '..', 'web');
const WEB_ES_DIR = path.join(__dirname, '..', 'web-es');
const WEB_PT_DIR = path.join(__dirname, '..', 'web-pt');
const WEB_DE_DIR = path.join(__dirname, '..', 'web-de');
const TEMP_DIR = '/tmp/podcasts';

// Language configurations
const LANGUAGES = {
  en: { dir: WEB_DIR, domain: 'teambuildpro.com', name: 'English' },
  es: { dir: WEB_ES_DIR, domain: 'es.teambuildpro.com', name: 'Spanish' },
  pt: { dir: WEB_PT_DIR, domain: 'pt.teambuildpro.com', name: 'Portuguese' },
  de: { dir: WEB_DE_DIR, domain: 'de.teambuildpro.com', name: 'German' }
};

// ===== UTILITY FUNCTIONS =====

/**
 * List all available blog posts
 */
function listAvailableBlogPosts() {
  console.log(`\n${colors.bright}${colors.blue}Available Blog Posts:${colors.reset}\n`);

  const blogDir = path.join(WEB_DIR, 'blog');
  if (!fs.existsSync(blogDir)) {
    console.log(`${colors.red}Blog directory not found: ${blogDir}${colors.reset}`);
    return;
  }

  const files = fs.readdirSync(blogDir)
    .filter(f => f.endsWith('.html') && f !== 'index.html')
    .sort();

  files.forEach((file, i) => {
    const slug = file.replace('.html', '');
    const content = fs.readFileSync(path.join(blogDir, file), 'utf8');
    const titleMatch = content.match(/<title>([^<|]+)/);
    const title = titleMatch ? titleMatch[1].trim() : 'Unknown';
    console.log(`  ${i + 1}. ${colors.cyan}${slug}${colors.reset}`);
    console.log(`     ${title}\n`);
  });

  console.log(`\nUsage: ${colors.yellow}node generate-podcasts.js <slug>${colors.reset}`);
}

/**
 * Extract text content from blog HTML for podcast script generation
 */
function extractBlogContent(htmlPath) {
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`Blog file not found: ${htmlPath}`);
  }

  const html = fs.readFileSync(htmlPath, 'utf8');

  // Extract title
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                     html.match(/<title>([^<|]+)/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Unknown Title';

  // Extract article content
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  let content = articleMatch ? articleMatch[1] : '';

  // Strip HTML tags but preserve structure
  content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  content = content.replace(/<h[1-6][^>]*>/gi, '\n\n');
  content = content.replace(/<\/h[1-6]>/gi, '\n');
  content = content.replace(/<li[^>]*>/gi, '\n- ');
  content = content.replace(/<p[^>]*>/gi, '\n');
  content = content.replace(/<br\s*\/?>/gi, '\n');
  content = content.replace(/<[^>]+>/g, ' ');

  // Clean up whitespace and HTML entities
  content = content.replace(/&nbsp;/g, ' ');
  content = content.replace(/&amp;/g, '&');
  content = content.replace(/&lt;/g, '<');
  content = content.replace(/&gt;/g, '>');
  content = content.replace(/&quot;/g, '"');
  content = content.replace(/&#39;/g, "'");
  content = content.replace(/\s+/g, ' ');
  content = content.replace(/\n\s+/g, '\n');
  content = content.trim();

  return { title, content };
}

/**
 * Call Claude API to generate podcast script from blog content
 */
async function generatePodcastScript(blogContent, lang = 'en') {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not found. Set env var or create secrets/Anthropic-API-Key');
  }

  console.log(`${colors.cyan}  Generating ${LANGUAGES[lang].name} podcast script via Claude API...${colors.reset}`);

  const prompt = PODCAST_SCRIPT_PROMPT(blogContent, lang);

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      timeout: 120000
    });

    if (response.data && response.data.content && response.data.content[0]) {
      const script = response.data.content[0].text.trim();
      const wordCount = script.split(/\s+/).length;
      console.log(`${colors.green}  ✓ Generated script: ${wordCount} words${colors.reset}`);
      return script;
    }

    throw new Error('Unexpected API response format');
  } catch (error) {
    if (error.response) {
      throw new Error(`Claude API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    throw new Error(`Claude API call failed: ${error.message}`);
  }
}

/**
 * Generate audio using ElevenLabs TTS API
 */
async function generateAudio(script, lang = 'en') {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not found. Check secrets/ElevenLabs-API-Key');
  }

  const voiceId = VOICES[lang];
  if (!voiceId) {
    throw new Error(`No voice configured for language: ${lang}`);
  }

  console.log(`${colors.cyan}  Generating ${LANGUAGES[lang].name} audio via ElevenLabs...${colors.reset}`);
  console.log(`${colors.cyan}  Script length: ${script.length} characters${colors.reset}`);

  try {
    const response = await axios.post(
      `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`,
      {
        text: script,
        model_id: MODEL_ID,
        voice_settings: VOICE_SETTINGS
      },
      {
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY
        },
        responseType: 'arraybuffer',
        timeout: 300000 // 5 minutes for long audio
      }
    );

    const audioBuffer = Buffer.from(response.data);
    const fileSizeKB = Math.round(audioBuffer.length / 1024);
    console.log(`${colors.green}  ✓ Generated audio: ${fileSizeKB}KB${colors.reset}`);

    return audioBuffer;
  } catch (error) {
    if (error.response) {
      const errorData = error.response.data instanceof Buffer
        ? error.response.data.toString()
        : JSON.stringify(error.response.data);
      throw new Error(`ElevenLabs API error: ${error.response.status} - ${errorData}`);
    }
    throw new Error(`ElevenLabs API call failed: ${error.message}`);
  }
}

/**
 * Save audio file locally
 */
function saveAudioLocally(audioBuffer, slug, lang) {
  const langDir = path.join(TEMP_DIR, lang);
  if (!fs.existsSync(langDir)) {
    fs.mkdirSync(langDir, { recursive: true });
  }

  const filePath = path.join(langDir, `${slug}.mp3`);
  fs.writeFileSync(filePath, audioBuffer);
  console.log(`${colors.green}  ✓ Saved: ${filePath}${colors.reset}`);

  return filePath;
}

/**
 * Upload audio to Firebase Storage using gsutil
 */
async function uploadToFirebaseStorage(localPath, slug, lang) {
  const remotePath = `gs://${FIREBASE_STORAGE_BUCKET}/podcasts/${lang}/${slug}.mp3`;

  console.log(`${colors.cyan}  Uploading to Firebase Storage...${colors.reset}`);

  try {
    // Upload with public read access
    execSync(`gsutil -h "Content-Type:audio/mpeg" -h "Cache-Control:public, max-age=31536000" cp "${localPath}" "${remotePath}"`, {
      stdio: 'pipe'
    });

    // Make publicly accessible
    execSync(`gsutil acl ch -u AllUsers:R "${remotePath}"`, {
      stdio: 'pipe'
    });

    const publicUrl = `https://storage.googleapis.com/${FIREBASE_STORAGE_BUCKET}/podcasts/${lang}/${slug}.mp3`;
    console.log(`${colors.green}  ✓ Uploaded: ${publicUrl}${colors.reset}`);

    return publicUrl;
  } catch (error) {
    throw new Error(`Firebase Storage upload failed: ${error.message}`);
  }
}

/**
 * Update blog HTML to include podcast player
 */
function updateBlogWithPlayer(htmlPath, audioUrl, slug, lang) {
  if (!fs.existsSync(htmlPath)) {
    console.log(`${colors.yellow}  ⚠ Blog file not found: ${htmlPath}${colors.reset}`);
    return false;
  }

  let html = fs.readFileSync(htmlPath, 'utf8');

  // Check if podcast player already exists
  if (html.includes('podcast-player-section')) {
    console.log(`${colors.cyan}  Podcast player already exists in ${lang.toUpperCase()} blog${colors.reset}`);
    return true;
  }

  // Generate player HTML
  const playerHtml = PODCAST_PLAYER_HTML(audioUrl, lang, slug);

  // Find insertion point: after the hero section / h1, before the article content
  // Look for the article opening tag
  const articleMatch = html.match(/<article[^>]*>/i);
  if (articleMatch) {
    const insertPos = html.indexOf(articleMatch[0]) + articleMatch[0].length;

    // Find the h1 tag inside article and insert after it
    const afterArticle = html.substring(insertPos);
    const h1Match = afterArticle.match(/<\/h1>/i);

    if (h1Match) {
      const h1EndPos = insertPos + afterArticle.indexOf(h1Match[0]) + h1Match[0].length;
      html = html.slice(0, h1EndPos) + '\n' + playerHtml + html.slice(h1EndPos);
    } else {
      // No h1 found, insert right after article tag
      html = html.slice(0, insertPos) + '\n' + playerHtml + html.slice(insertPos);
    }
  } else {
    console.log(`${colors.yellow}  ⚠ Could not find <article> tag in ${htmlPath}${colors.reset}`);
    return false;
  }

  // Add tracking script if not present
  if (!html.includes('podcast_play') && !html.includes('podcast-tracking')) {
    // Insert before closing </body> tag
    const bodyClosePos = html.lastIndexOf('</body>');
    if (bodyClosePos !== -1) {
      html = html.slice(0, bodyClosePos) + PODCAST_TRACKING_SCRIPT + '\n' + html.slice(bodyClosePos);
    }
  }

  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`${colors.green}  ✓ Updated ${lang.toUpperCase()} blog with podcast player${colors.reset}`);

  return true;
}

/**
 * Generate podcast for a single blog post in one language
 */
async function generatePodcastForLanguage(slug, lang) {
  const langConfig = LANGUAGES[lang];
  const blogPath = path.join(langConfig.dir, 'blog', `${slug}.html`);

  console.log(`\n${colors.bright}${colors.magenta}[${lang.toUpperCase()}] Processing: ${slug}${colors.reset}`);

  // Step 1: Extract blog content
  console.log(`${colors.blue}Step 1: Extracting blog content...${colors.reset}`);
  const { title, content } = extractBlogContent(blogPath);
  console.log(`${colors.green}  ✓ Extracted: "${title}" (${content.length} chars)${colors.reset}`);

  if (dryRun) {
    console.log(`${colors.yellow}  [DRY RUN] Would generate script and audio${colors.reset}`);
    return { success: true, audioUrl: 'https://example.com/dry-run.mp3' };
  }

  // Step 2: Generate podcast script
  console.log(`${colors.blue}Step 2: Generating podcast script...${colors.reset}`);
  const script = await generatePodcastScript(`Title: ${title}\n\n${content}`, lang);

  // Step 3: Generate audio
  console.log(`${colors.blue}Step 3: Generating audio...${colors.reset}`);
  const audioBuffer = await generateAudio(script, lang);

  // Step 4: Save locally
  console.log(`${colors.blue}Step 4: Saving audio locally...${colors.reset}`);
  const localPath = saveAudioLocally(audioBuffer, slug, lang);

  let audioUrl;

  // Step 5: Upload to Firebase Storage
  if (!skipUpload) {
    console.log(`${colors.blue}Step 5: Uploading to Firebase Storage...${colors.reset}`);
    audioUrl = await uploadToFirebaseStorage(localPath, slug, lang);
  } else {
    audioUrl = `file://${localPath}`;
    console.log(`${colors.yellow}  [SKIP UPLOAD] Using local file: ${audioUrl}${colors.reset}`);
  }

  // Step 6: Update blog HTML
  console.log(`${colors.blue}Step 6: Updating blog HTML...${colors.reset}`);
  updateBlogWithPlayer(blogPath, audioUrl, slug, lang);

  return { success: true, audioUrl, localPath };
}

/**
 * Main entry point
 */
async function main() {
  console.log(`\n${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}  Team Build Pro Podcast Generator${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}\n`);

  // Handle --list flag
  if (listBlogs) {
    listAvailableBlogPosts();
    return;
  }

  // Validate slug
  if (!slug) {
    console.log(`${colors.red}Error: No blog slug provided${colors.reset}`);
    console.log(`\nUsage: ${colors.yellow}node generate-podcasts.js <slug> [options]${colors.reset}`);
    console.log(`\nOptions:`);
    console.log(`  ${colors.cyan}--lang=<en|es|pt|de>${colors.reset}  Generate for specific language only`);
    console.log(`  ${colors.cyan}--skip-upload${colors.reset}         Skip Firebase upload (local only)`);
    console.log(`  ${colors.cyan}--dry-run${colors.reset}             Show what would be done without executing`);
    console.log(`  ${colors.cyan}--list${colors.reset}                List available blog posts`);
    console.log(`\nExample: ${colors.yellow}node generate-podcasts.js why-75-percent-quit --lang=en${colors.reset}`);
    process.exit(1);
  }

  // Verify English blog exists (source of truth)
  const enBlogPath = path.join(WEB_DIR, 'blog', `${slug}.html`);
  if (!fs.existsSync(enBlogPath)) {
    console.log(`${colors.red}Error: Blog not found: ${enBlogPath}${colors.reset}`);
    console.log(`\nRun ${colors.yellow}node generate-podcasts.js --list${colors.reset} to see available blogs.`);
    process.exit(1);
  }

  // Determine which languages to process
  const langsToProcess = targetLang ? [targetLang] : ['en', 'es', 'pt', 'de'];

  console.log(`${colors.cyan}Blog: ${slug}${colors.reset}`);
  console.log(`${colors.cyan}Languages: ${langsToProcess.join(', ').toUpperCase()}${colors.reset}`);
  console.log(`${colors.cyan}Skip Upload: ${skipUpload}${colors.reset}`);
  console.log(`${colors.cyan}Dry Run: ${dryRun}${colors.reset}`);

  // Create temp directory
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  const results = {};
  let hasErrors = false;

  // Process each language
  for (const lang of langsToProcess) {
    try {
      results[lang] = await generatePodcastForLanguage(slug, lang);
    } catch (error) {
      console.log(`${colors.red}  ✗ Error processing ${lang.toUpperCase()}: ${error.message}${colors.reset}`);
      results[lang] = { success: false, error: error.message };
      hasErrors = true;
    }
  }

  // Summary
  console.log(`\n${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}  Summary${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}\n`);

  for (const [lang, result] of Object.entries(results)) {
    if (result.success) {
      console.log(`${colors.green}✓ ${lang.toUpperCase()}: ${result.audioUrl}${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ ${lang.toUpperCase()}: ${result.error}${colors.reset}`);
    }
  }

  if (hasErrors) {
    console.log(`\n${colors.yellow}Some languages failed. Check errors above.${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}${colors.bright}All podcasts generated successfully!${colors.reset}`);
  }
}

// Export functions for use by generate-ai-blog.js
module.exports = {
  generatePodcastForLanguage,
  extractBlogContent,
  generatePodcastScript,
  generateAudio,
  uploadToFirebaseStorage,
  updateBlogWithPlayer,
  LANGUAGES
};

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}
