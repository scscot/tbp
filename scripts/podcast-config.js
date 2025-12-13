/**
 * Podcast Configuration for Team Build Pro
 * ElevenLabs TTS settings and voice IDs
 */

const fs = require('fs');
const path = require('path');

// Load API key from secrets file
const API_KEY_PATH = path.join(__dirname, '..', 'secrets', 'ElevenLabs-API-Key');
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ||
  (fs.existsSync(API_KEY_PATH) ? fs.readFileSync(API_KEY_PATH, 'utf8').trim() : '');

// ElevenLabs API endpoints
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

// Voice IDs for each language (using ElevenLabs pre-built voices)
// These are professional, natural-sounding male voices
const VOICES = {
  en: 'pNInz6obpgDQGcFmaJgB',  // Adam - deep, professional American male
  es: 'onwK4e9ZLuTAKqWW03F9',  // Daniel - Spanish male voice
  pt: 'TX3LPaxmHKxFdv7VOQHJ',  // Liam - works well for Portuguese
  de: 'pqHfZKP75CvOlQylNhV4',  // Bill - works well for German
};

// Model settings
const MODEL_ID = 'eleven_multilingual_v2'; // Best for multilingual content

// Voice settings for natural podcast style
const VOICE_SETTINGS = {
  stability: 0.5,           // Balance between consistent and expressive
  similarity_boost: 0.75,   // Natural voice matching
  style: 0.4,               // Moderate expressiveness
  use_speaker_boost: true   // Enhance clarity
};

// Localized labels for the podcast player
const PODCAST_LABELS = {
  en: {
    listen: 'Listen to this article',
    duration: '5 min',
    download: 'Download'
  },
  es: {
    listen: 'Escucha este artículo',
    duration: '5 min',
    download: 'Descargar'
  },
  pt: {
    listen: 'Ouça este artigo',
    duration: '5 min',
    download: 'Baixar'
  },
  de: {
    listen: 'Diesen Artikel anhören',
    duration: '5 Min.',
    download: 'Herunterladen'
  },
};

// Firebase Storage bucket for podcast files
const FIREBASE_STORAGE_BUCKET = 'teambuilder-plus-fe74d.appspot.com';

// Podcast script generation prompt template
const PODCAST_SCRIPT_PROMPT = (blogContent, lang = 'en') => {
  const langInstructions = {
    en: 'Write the script in English.',
    es: 'Write the script in Spanish (Latin American).',
    pt: 'Write the script in Brazilian Portuguese.',
    de: 'Write the script in German.'
  };

  return `
Convert this blog post into a 5-minute podcast script.

Guidelines:
- Write for the ear, not the eye (conversational, natural tone)
- Start with a hook that captures the main problem or insight
- Summarize key points - don't read every paragraph verbatim
- Use natural transitions: "Here's the thing...", "Now let's talk about...", "The bottom line is..."
- End with a single, soft CTA: "If this resonates with you, check out Team Build Pro - the link is in the description."
- Target: 650-750 words (about 5 minutes at natural speaking pace)
- Tone: Experienced mentor sharing wisdom, not salesy or hype-y
- ${langInstructions[lang] || langInstructions.en}

IMPORTANT: Return ONLY the podcast script text. No stage directions, no formatting, no intro like "Here's the script:". Just the spoken words.

Blog content to convert:
${blogContent}
`;
};

// HTML template for the podcast player embed
const PODCAST_PLAYER_HTML = (audioUrl, lang = 'en', slug = '') => {
  const labels = PODCAST_LABELS[lang] || PODCAST_LABELS.en;

  return `
<!-- Podcast Player Section -->
<div class="podcast-player-section">
  <div class="podcast-player-wrapper">
    <span class="podcast-icon">🎧</span>
    <div class="podcast-info">
      <span class="podcast-label">${labels.listen}</span>
      <span class="podcast-duration">${labels.duration}</span>
    </div>
    <audio controls preload="metadata" class="podcast-audio" data-slug="${slug}" data-lang="${lang}">
      <source src="${audioUrl}" type="audio/mpeg">
      Your browser does not support the audio element.
    </audio>
  </div>
</div>
`;
};

// GA4 tracking script for podcast events
const PODCAST_TRACKING_SCRIPT = `
<script>
// Podcast tracking for GA4
document.addEventListener('DOMContentLoaded', function() {
  const audioElements = document.querySelectorAll('.podcast-audio');
  audioElements.forEach(function(audio) {
    const slug = audio.dataset.slug || 'unknown';
    const lang = audio.dataset.lang || 'en';

    audio.addEventListener('play', function() {
      if (typeof gtag === 'function') {
        gtag('event', 'podcast_play', {
          'event_category': 'engagement',
          'event_label': slug,
          'language': lang
        });
      }
    });

    audio.addEventListener('ended', function() {
      if (typeof gtag === 'function') {
        gtag('event', 'podcast_complete', {
          'event_category': 'engagement',
          'event_label': slug,
          'language': lang
        });
      }
    });

    // Track 50% completion
    let halfTracked = false;
    audio.addEventListener('timeupdate', function() {
      if (!halfTracked && audio.currentTime > audio.duration / 2) {
        halfTracked = true;
        if (typeof gtag === 'function') {
          gtag('event', 'podcast_halfway', {
            'event_category': 'engagement',
            'event_label': slug,
            'language': lang
          });
        }
      }
    });
  });
});
</script>
`;

module.exports = {
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
};
