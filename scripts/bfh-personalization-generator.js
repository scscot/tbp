#!/usr/bin/env node
/**
 * BFH AI Personalization Generator
 *
 * Uses Claude AI to generate personalized email content for BFH contacts.
 * Implements a two-pass approach: generate content, then self-validate.
 *
 * Strategy:
 * - English profiles: Generate 2-3 sentence personalized intro (inject into V9/V10 templates)
 * - Non-English profiles (ES/PT/DE): Generate full HTML email in native language
 *
 * Usage:
 *   node scripts/bfh-personalization-generator.js --generate --max=20
 *   node scripts/bfh-personalization-generator.js --generate --max=20 --force-review
 *   node scripts/bfh-personalization-generator.js --export-review --score-below=8
 *   node scripts/bfh-personalization-generator.js --approve --ids=id1,id2,id3
 *   node scripts/bfh-personalization-generator.js --regenerate --ids=id1,id2
 *   node scripts/bfh-personalization-generator.js --stats
 *   node scripts/bfh-personalization-generator.js --dry-run
 *
 * Environment:
 *   ANTHROPIC_API_KEY - Required for Claude API
 */

const Anthropic = require('@anthropic-ai/sdk');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ============================================================================
// CONFIGURATION
// ============================================================================

// Load Anthropic API key
const ANTHROPIC_API_KEY_PATH = path.join(__dirname, '..', 'secrets', 'Anthropic-API-Key');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ||
  (fs.existsSync(ANTHROPIC_API_KEY_PATH) ? fs.readFileSync(ANTHROPIC_API_KEY_PATH, 'utf8').trim() : '');

const CONFIG = {
  // Firestore
  COLLECTION: 'bfh_contacts',

  // Claude model
  MODEL: 'claude-sonnet-4-20250514',  // Using Sonnet for quality + speed balance

  // Rate limiting
  DELAY_BETWEEN_REQUESTS: 1000,  // 1 second between Claude calls

  // Auto-approve threshold
  AUTO_APPROVE_SCORE: 8,

  // CTA domains by language
  CTA_DOMAINS: {
    en: 'teambuildpro.com',
    es: 'es.teambuildpro.com',
    pt: 'pt.teambuildpro.com',
    de: 'de.teambuildpro.com',
  },

  // Language labels
  LANGUAGE_LABELS: {
    en: 'English',
    es: 'Spanish',
    pt: 'Portuguese',
    de: 'German',
  },
};

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

let db;

function initFirebase() {
  if (admin.apps.length === 0) {
    const serviceAccountPath = path.join(__dirname, '../secrets/serviceAccountKey.json');
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'teambuilder-plus-fe74d'
    });
  }
  db = admin.firestore();
  console.log('Firebase initialized');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// CLAUDE PROMPTS
// ============================================================================

function buildEnglishIntroPrompt(contact) {
  return `You are writing a personalized email opening for a direct sales professional.

Contact Information:
- Name: ${contact.fullName}
- Company: ${contact.company || 'Not specified'}
- Country: ${contact.country || 'Not specified'}

Profile Data from Business For Home:
- Bio: ${contact.profileBio || 'Not available'}
- Review Count: ${contact.reviewCount || 0}
- Star Rating: ${contact.starRating || 'Not available'}
- Sample Reviews: ${(contact.reviewSnippets || []).join(' | ') || 'None available'}

Write 2-3 sentences that:
1. Reference something specific from their BFH profile (a review, their rating, their reputation, etc.)
2. Feel genuine and researched, not templated or generic
3. Transition naturally to discussing AI tools for team building
4. Do NOT include subject line, greeting ("Hello", "Hi"), or sign-off

The tone should be professional but warm, like a colleague reaching out who has done their homework.

Example good output:
"Your 5-star reviews on Business For Home speak volumes about your leadership style—your team members clearly appreciate the support you provide. Building on that reputation with the right tools could help you scale even faster."

Example bad output (too generic):
"I noticed you're a successful network marketer. You might be interested in our tools."

Respond with ONLY the 2-3 sentence paragraph. No quotes, no explanation.`;
}

function buildLocalizedEmailPrompt(contact, language) {
  const languageLabel = CONFIG.LANGUAGE_LABELS[language] || 'the recipient\'s native language';
  const ctaDomain = CONFIG.CTA_DOMAINS[language] || CONFIG.CTA_DOMAINS.en;

  return `You are writing a complete personalized cold email in ${languageLabel} for a direct sales professional.

Contact Information:
- Name: ${contact.fullName}
- First Name: ${contact.firstName || contact.fullName.split(' ')[0]}
- Company: ${contact.company || 'Not specified'}
- Country: ${contact.country || 'Not specified'}
- Language: ${languageLabel}

Profile Data from Business For Home:
- Bio: ${contact.profileBio || 'Not available'}
- Review Count: ${contact.reviewCount || 0}
- Star Rating: ${contact.starRating || 'Not available'}
- Sample Reviews: ${(contact.reviewSnippets || []).join(' | ') || 'None available'}

Write a complete cold email that:
1. Is ENTIRELY in ${languageLabel} (not English)
2. Opens with a personalized reference to their BFH profile (reviews, achievements, reputation)
3. Introduces Team Build Pro as an AI-powered tool for building direct sales teams
4. Explains that it helps them pre-build their team with AI coaching and 16 pre-written messages
5. Includes a clear CTA directing them to ${ctaDomain}
6. Is warm, professional, and personal in tone (not salesy or aggressive)
7. Is under 400 words
8. Ends with unsubscribe notice

The sender is Stephen Scott from Team Build Pro.

Return ONLY valid HTML email body content. Use inline CSS styles for formatting.
Do not include <html>, <head>, or <body> tags - just the content that would go inside <body>.

Use this structure:
- Opening paragraph (personalized reference to their profile)
- Value proposition paragraph (AI tools for team building)
- Brief feature mention (AI coach, pre-written messages, team tracking)
- CTA (link to ${ctaDomain})
- Sign-off (Stephen Scott, Team Build Pro)
- Unsubscribe notice with {{unsubscribe_url}} placeholder

Respond with ONLY the HTML content. No explanation or markdown.`;
}

function buildValidationPrompt(content, contact, isFullHtml) {
  const contentType = isFullHtml ? 'full HTML email' : 'personalized intro paragraph';
  const languageLabel = CONFIG.LANGUAGE_LABELS[contact.detectedLanguage] || 'English';

  return `Review this ${contentType} for a direct sales professional outreach campaign.

CONTENT TO REVIEW:
${content}

RECIPIENT CONTEXT:
- Name: ${contact.fullName}
- Company: ${contact.company || 'Not specified'}
- Country: ${contact.country || 'Not specified'}
- Language: ${languageLabel}
- Profile Data Available: ${contact.profileBio ? 'Yes' : 'No'}
- Review Count: ${contact.reviewCount || 0}
- Star Rating: ${contact.starRating || 'N/A'}

Evaluate on these criteria (1-10 scale each):

1. PROFESSIONAL TONE (1-10)
   - Not too casual, not too formal
   - Appropriate for B2B cold outreach
   - Sounds like a real person, not a marketing bot

2. CULTURAL SENSITIVITY (1-10)
   - Appropriate for recipient's country/culture
   - No inappropriate idioms or assumptions
   - Respectful and inclusive

3. FACTUAL ACCURACY (1-10)
   - Only references information from the profile data
   - Does not make up achievements or claims
   - Does not hallucinate details

4. BRAND SAFETY (1-10)
   - No income claims or guarantees
   - No inappropriate language
   - No promises that could be misleading
   - Professional representation of Team Build Pro

5. PERSONALIZATION QUALITY (1-10)
   - Feels genuine and researched
   - Not generic or templated
   - Not "creepy" over-personalization
   - Natural connection to the product

CRITICAL ISSUES (automatic fail):
- Income claims or guarantees
- Made-up achievements not in profile data
- Offensive or inappropriate content
- Grammatically incorrect (for the target language)

Respond with ONLY a JSON object in this exact format:
{
  "scores": {
    "tone": 8,
    "cultural": 9,
    "accuracy": 7,
    "brandSafety": 10,
    "personalization": 8
  },
  "overallScore": 8.4,
  "approved": true,
  "issues": [],
  "suggestions": "Optional improvement suggestion or null"
}

Set "approved" to true only if:
- Overall score >= 8
- No critical issues
- All individual scores >= 6`;
}

// ============================================================================
// CLAUDE API FUNCTIONS
// ============================================================================

async function generatePersonalizedIntro(client, contact) {
  const prompt = buildEnglishIntroPrompt(contact);

  const response = await client.messages.create({
    model: CONFIG.MODEL,
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  return response.content[0].text.trim();
}

async function generateLocalizedEmail(client, contact) {
  const prompt = buildLocalizedEmailPrompt(contact, contact.detectedLanguage);

  const response = await client.messages.create({
    model: CONFIG.MODEL,
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  return response.content[0].text.trim();
}

async function validateContent(client, content, contact, isFullHtml) {
  const prompt = buildValidationPrompt(content, contact, isFullHtml);

  const response = await client.messages.create({
    model: CONFIG.MODEL,
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  try {
    const responseText = response.content[0].text.trim();
    // Extract JSON from response (handle potential markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (error) {
    console.error(`  Validation parse error: ${error.message}`);
    return {
      scores: { tone: 0, cultural: 0, accuracy: 0, brandSafety: 0, personalization: 0 },
      overallScore: 0,
      approved: false,
      issues: ['Failed to parse validation response'],
      suggestions: null
    };
  }
}

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

async function generatePersonalizations(maxContacts = 20, forceReview = false, dryRun = false) {
  console.log('\n=== BFH AI Personalization Generator ===\n');

  if (!ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY not found');
    console.error('Set environment variable or create secrets/Anthropic-API-Key file');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  console.log('Claude API initialized');

  // Query enriched contacts that need personalization
  // Note: Firestore doesn't match docs where field doesn't exist,
  // so we query all enriched profiles and filter locally
  const query = db.collection(CONFIG.COLLECTION)
    .where('profileEnriched', '==', true)
    .limit(maxContacts * 2);  // Fetch extra to account for filtering

  const rawSnapshot = await query.get();

  // Filter locally - include docs where personalizationGenerated is false or undefined
  const docs = rawSnapshot.docs.filter(doc => {
    const data = doc.data();
    return data.personalizationGenerated !== true;
  }).slice(0, maxContacts);

  const snapshot = { docs, size: docs.length };

  console.log(`Found ${snapshot.size} contacts to personalize (from ${rawSnapshot.size} enriched)\n`);

  if (snapshot.size === 0) {
    console.log('No contacts need personalization. Run enrichment first:');
    console.log('  node scripts/bfh-profile-enricher.js --enrich --max=50');
    return;
  }

  let generated = 0;
  let validated = 0;
  let autoApproved = 0;
  let needsReview = 0;
  let errors = 0;

  const results = { en: 0, es: 0, pt: 0, de: 0 };

  for (const doc of snapshot.docs) {
    const contact = doc.data();
    const language = contact.detectedLanguage || 'en';
    const isEnglish = language === 'en';

    console.log(`\nProcessing: ${contact.fullName}`);
    console.log(`  Language: ${CONFIG.LANGUAGE_LABELS[language] || language}`);
    console.log(`  Type: ${isEnglish ? 'Personalized Intro' : 'Full HTML Email'}`);

    if (dryRun) {
      console.log('  [DRY RUN] Would generate personalization');
      generated++;
      results[language] = (results[language] || 0) + 1;
      await sleep(200);
      continue;
    }

    try {
      // PASS 1: Generate content
      let content;
      if (isEnglish) {
        content = await generatePersonalizedIntro(client, contact);
      } else {
        content = await generateLocalizedEmail(client, contact);
      }

      console.log(`  Generated: ${content.substring(0, 100)}...`);
      generated++;

      await sleep(CONFIG.DELAY_BETWEEN_REQUESTS);

      // PASS 2: Self-validation
      const validation = await validateContent(client, content, contact, !isEnglish);
      validated++;

      console.log(`  Validation Score: ${validation.overallScore}/10`);
      console.log(`  Approved: ${validation.approved ? 'YES' : 'NO'}`);

      if (validation.issues && validation.issues.length > 0) {
        console.log(`  Issues: ${validation.issues.join(', ')}`);
      }

      // Determine approval status
      const shouldAutoApprove = validation.approved &&
        validation.overallScore >= CONFIG.AUTO_APPROVE_SCORE &&
        !forceReview;

      // Prepare update data
      const updateData = {
        personalizationGenerated: true,
        personalizationGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
        personalizationModel: CONFIG.MODEL,
        selfValidationPassed: validation.approved,
        selfValidationScore: validation.overallScore,
        selfValidationIssues: validation.issues || [],
        selfValidationScores: validation.scores,
        ctaDomain: CONFIG.CTA_DOMAINS[language] || CONFIG.CTA_DOMAINS.en,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (isEnglish) {
        updateData.personalizedIntro = content;
      } else {
        updateData.personalizedHtml = content;
      }

      if (shouldAutoApprove) {
        updateData.personalizationApproved = true;
        updateData.manualReviewRequired = false;
        console.log('  Status: AUTO-APPROVED');
        autoApproved++;
      } else {
        updateData.personalizationApproved = false;
        updateData.manualReviewRequired = true;
        console.log('  Status: NEEDS REVIEW');
        needsReview++;
      }

      await doc.ref.update(updateData);
      results[language] = (results[language] || 0) + 1;

      await sleep(CONFIG.DELAY_BETWEEN_REQUESTS);

    } catch (error) {
      console.error(`  Error: ${error.message}`);
      errors++;

      // Mark as failed
      await doc.ref.update({
        personalizationGenerated: false,
        personalizationError: error.message,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  console.log('\n=== Generation Complete ===');
  console.log(`Total processed: ${generated}`);
  console.log(`Validated: ${validated}`);
  console.log(`Auto-approved: ${autoApproved}`);
  console.log(`Needs review: ${needsReview}`);
  console.log(`Errors: ${errors}`);
  console.log(`\nBy language:`);
  console.log(`  English (intro): ${results.en || 0}`);
  console.log(`  Spanish (full): ${results.es || 0}`);
  console.log(`  Portuguese (full): ${results.pt || 0}`);
  console.log(`  German (full): ${results.de || 0}`);
  console.log('');

  return { generated, validated, autoApproved, needsReview, errors, results };
}

// ============================================================================
// EXPORT FOR REVIEW
// ============================================================================

async function exportForReview(scoreBelowOrEqual = 10) {
  console.log(`\nExporting contacts with score <= ${scoreBelowOrEqual} for review...\n`);

  const snapshot = await db.collection(CONFIG.COLLECTION)
    .where('personalizationGenerated', '==', true)
    .where('personalizationApproved', '==', false)
    .get();

  const contacts = [];

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if ((data.selfValidationScore || 0) <= scoreBelowOrEqual) {
      contacts.push({
        id: doc.id,
        fullName: data.fullName,
        company: data.company,
        language: data.detectedLanguage,
        score: data.selfValidationScore,
        issues: data.selfValidationIssues,
        content: data.personalizedIntro || data.personalizedHtml,
        profileBio: data.profileBio,
        reviewSnippets: data.reviewSnippets,
      });
    }
  });

  console.log(JSON.stringify(contacts, null, 2));
  console.log(`\nTotal contacts for review: ${contacts.length}`);

  return contacts;
}

// ============================================================================
// APPROVE CONTACTS
// ============================================================================

async function approveContacts(ids) {
  console.log(`\nApproving ${ids.length} contacts...\n`);

  let approved = 0;

  for (const id of ids) {
    const docRef = db.collection(CONFIG.COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log(`  ${id}: NOT FOUND`);
      continue;
    }

    await docRef.update({
      personalizationApproved: true,
      manualReviewRequired: false,
      manualReviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`  ${id}: APPROVED`);
    approved++;
  }

  console.log(`\nApproved: ${approved}/${ids.length}`);
  return approved;
}

// ============================================================================
// REGENERATE CONTACTS
// ============================================================================

async function regenerateContacts(ids) {
  console.log(`\nMarking ${ids.length} contacts for regeneration...\n`);

  let marked = 0;

  for (const id of ids) {
    const docRef = db.collection(CONFIG.COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log(`  ${id}: NOT FOUND`);
      continue;
    }

    await docRef.update({
      personalizationGenerated: false,
      personalizationApproved: false,
      personalizedIntro: null,
      personalizedHtml: null,
      selfValidationPassed: null,
      selfValidationScore: null,
      selfValidationIssues: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`  ${id}: MARKED FOR REGENERATION`);
    marked++;
  }

  console.log(`\nMarked for regeneration: ${marked}/${ids.length}`);
  return marked;
}

// ============================================================================
// STATS
// ============================================================================

async function showStats() {
  const collection = db.collection(CONFIG.COLLECTION);

  console.log('\n=== BFH Personalization Stats ===\n');

  // Get counts
  const [
    total,
    enriched,
    generated,
    approved,
    needsReview,
  ] = await Promise.all([
    collection.count().get(),
    collection.where('profileEnriched', '==', true).count().get().catch(() => ({ data: () => ({ count: 0 }) })),
    collection.where('personalizationGenerated', '==', true).count().get().catch(() => ({ data: () => ({ count: 0 }) })),
    collection.where('personalizationApproved', '==', true).count().get().catch(() => ({ data: () => ({ count: 0 }) })),
    collection.where('manualReviewRequired', '==', true).count().get().catch(() => ({ data: () => ({ count: 0 }) })),
  ]);

  console.log(`Total BFH contacts: ${total.data().count}`);
  console.log(`Profile enriched: ${enriched.data().count}`);
  console.log(`Personalization generated: ${generated.data().count}`);
  console.log(`Approved (ready to send): ${approved.data().count}`);
  console.log(`Needs manual review: ${needsReview.data().count}`);

  // Language breakdown
  const generatedSnapshot = await collection
    .where('personalizationGenerated', '==', true)
    .select('detectedLanguage', 'personalizationApproved', 'selfValidationScore')
    .get()
    .catch(() => ({ docs: [] }));

  const languageStats = { en: 0, es: 0, pt: 0, de: 0 };
  const approvedByLanguage = { en: 0, es: 0, pt: 0, de: 0 };
  let totalScore = 0;
  let scoreCount = 0;

  generatedSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const lang = data.detectedLanguage || 'en';
    languageStats[lang] = (languageStats[lang] || 0) + 1;
    if (data.personalizationApproved) {
      approvedByLanguage[lang] = (approvedByLanguage[lang] || 0) + 1;
    }
    if (data.selfValidationScore) {
      totalScore += data.selfValidationScore;
      scoreCount++;
    }
  });

  console.log(`\nBy Language (Generated/Approved):`);
  console.log(`  English: ${languageStats.en}/${approvedByLanguage.en}`);
  console.log(`  Spanish: ${languageStats.es}/${approvedByLanguage.es}`);
  console.log(`  Portuguese: ${languageStats.pt}/${approvedByLanguage.pt}`);
  console.log(`  German: ${languageStats.de}/${approvedByLanguage.de}`);

  if (scoreCount > 0) {
    console.log(`\nAverage validation score: ${(totalScore / scoreCount).toFixed(1)}/10`);
  }

  console.log('');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const generate = args.includes('--generate');
  const exportReview = args.includes('--export-review');
  const approve = args.includes('--approve');
  const regenerate = args.includes('--regenerate');
  const stats = args.includes('--stats');
  const dryRun = args.includes('--dry-run');
  const forceReview = args.includes('--force-review');

  // Parse --max=N
  let maxContacts = 20;
  const maxArg = args.find(a => a.startsWith('--max='));
  if (maxArg) {
    maxContacts = parseInt(maxArg.split('=')[1]) || 20;
  }

  // Parse --score-below=N
  let scoreBelowOrEqual = 10;
  const scoreArg = args.find(a => a.startsWith('--score-below='));
  if (scoreArg) {
    scoreBelowOrEqual = parseInt(scoreArg.split('=')[1]) || 10;
  }

  // Parse --ids=id1,id2,id3
  let ids = [];
  const idsArg = args.find(a => a.startsWith('--ids='));
  if (idsArg) {
    ids = idsArg.split('=')[1].split(',').map(id => id.trim()).filter(Boolean);
  }

  if (!generate && !exportReview && !approve && !regenerate && !stats) {
    console.log('BFH AI Personalization Generator');
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/bfh-personalization-generator.js --generate --max=20');
    console.log('  node scripts/bfh-personalization-generator.js --generate --max=20 --force-review');
    console.log('  node scripts/bfh-personalization-generator.js --export-review --score-below=8');
    console.log('  node scripts/bfh-personalization-generator.js --approve --ids=id1,id2');
    console.log('  node scripts/bfh-personalization-generator.js --regenerate --ids=id1,id2');
    console.log('  node scripts/bfh-personalization-generator.js --stats');
    console.log('  node scripts/bfh-personalization-generator.js --dry-run');
    console.log('');
    console.log('Options:');
    console.log('  --max=N           Maximum contacts to process (default: 20)');
    console.log('  --force-review    Require manual review for all (first batch safeguard)');
    console.log('  --score-below=N   Export contacts with score <= N (default: 10)');
    console.log('  --ids=id1,id2     Comma-separated document IDs');
    console.log('  --dry-run         Preview only, no writes');
    console.log('');
    console.log('Two-Pass Process:');
    console.log('  1. Generate personalized content (intro or full HTML)');
    console.log('  2. Self-validate for tone, accuracy, cultural sensitivity');
    console.log('  3. Auto-approve if score >= 8, else flag for review');
    console.log('');
    console.log('Workflow:');
    console.log('  1. First batch: --generate --max=20 --force-review');
    console.log('  2. Review: --export-review --score-below=10');
    console.log('  3. Approve good ones: --approve --ids=id1,id2');
    console.log('  4. Regenerate bad ones: --regenerate --ids=id3');
    console.log('  5. Production: --generate --max=200');
    process.exit(1);
  }

  initFirebase();

  if (stats) {
    await showStats();
    process.exit(0);
  }

  if (exportReview) {
    await exportForReview(scoreBelowOrEqual);
    process.exit(0);
  }

  if (approve && ids.length > 0) {
    await approveContacts(ids);
    process.exit(0);
  }

  if (regenerate && ids.length > 0) {
    await regenerateContacts(ids);
    process.exit(0);
  }

  if (generate) {
    await generatePersonalizations(maxContacts, forceReview, dryRun);
    await showStats();
  }

  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
