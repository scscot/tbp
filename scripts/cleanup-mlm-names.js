#!/usr/bin/env node
/**
 * Cleanup invalid names from mlm_contacts collection
 *
 * Removes contacts where firstName/lastName/fullName look like:
 * - Business/organization names (The Platinum Lounge, Wildlife Science Career Network)
 * - Group names (Monat VIP's)
 * - Error page text (Page isn't available)
 * - Brand names (HealthEsse)
 * - Role descriptions (DoTerra Wellness Advocate)
 *
 * Usage:
 *   node scripts/cleanup-mlm-names.js             # Dry run (preview)
 *   node scripts/cleanup-mlm-names.js --delete    # Actually delete invalid contacts
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({ credential: cert(require('../secrets/serviceAccountKey.json')) });
const db = getFirestore();

// Invalid name patterns (same as mlm-profile-extractor.js)
const INVALID_NAMES = [
  'profile / x', 'profile', 'x', 'twitter', 'thread', 'threads', 'instagram',
  'facebook', 'linkedin', 'tiktok', 'youtube', 'log in', 'sign up', 'login',
  'sign in', 'home', 'feed', 'explore', 'search', 'reels', 'watch',
  'not found', '404', 'error', 'page not found', 'access denied',
  'video', 'photo', 'post', 'story', 'reel', 'shorts',
  'hello partner!', 'what is required', 'what does an independent',
  'selling and buying', 'urban retreat', 'log in or sign up',
  'network', 'lounge', 'group', 'team', 'club', 'academy', 'center', 'centre',
  'studio', 'shop', 'store', 'boutique', 'llc', 'inc', 'corp', 'ltd',
  'wellness', 'advocate', 'consultant', 'distributor', 'representative',
  "page isn't available", 'page not available', 'content not found',
  'this page', 'unavailable', 'private account',
  // Business/group page names
  'entrepreneurs', 'mompreneurs', 'professionals', 'business owners',
  'help wanted', 'everything', 'rules', 'profil', 'pylon',
  'travel agent', 'real estate', 'insurance agent',
  // Single words that aren't names
  'haven', 'retreat', 'basics', 'essentials',
];

const INVALID_NAME_PATTERNS = [
  /^profile\s*\/?\s*x$/i,
  /on\s+x:/i,
  /\|\s*x$/i,
  /\|\s*facebook$/i,
  /\|\s*instagram$/i,
  /\|\s*linkedin$/i,
  /\|\s*tiktok$/i,
  /^\(@?\w+\)$/,
  /^@\w+$/,
  /\/\s*x$/i,
  /https?:\/\//,
  /\.(com|org|net)/i,
  /^the\s+\w+\s+\w+/i,
  /\bvip'?s?\b/i,
  /\bnetwork\b/i,
  /\blounge\b/i,
  /\bcareer\b/i,
  /\bfor\s+foreigners?\b/i,
  /\bwellness\s+advocate\b/i,
  /\bindependent\s+\w+\b/i,
  /\b(distributor|consultant|representative|associate)\b/i,
  /\b(llc|inc|corp|ltd|co\.?)\b/i,
  /\b(group|team|club|academy|studio)\b/i,
  /\bisn'?t\s+available\b/i,
  /^\w+esse$/i,
  // Additional patterns for page/business names
  /\bwith\s+\w+$/i,          // "My Monat with Megan" - "with Name" at end
  /^my\s+\w+\s+with\b/i,     // "My Brand with..."
  /\b(entrepreneurs?|mompreneurs?)\b/i,  // Entrepreneur groups
  /\bhelp\s+wanted\b/i,      // Job listings
  /\bwomen\s+\w+$/i,         // "Women Entrepreneurs", etc.
  /\beverything$/i,          // "City Everything" pages
  /\brules$/i,               // "Partner Rules" pages
  /\bhaven$/i,               // "Soaper's Haven"
  /^travel\s+agent$/i,       // Role descriptions
  /^real\s+estate$/i,
  /\s+&\s+/,                 // Names with ampersand are usually groups
  /\b[A-Z]{2}\s+help\b/i,    // "NE Help Wanted" (state abbreviation patterns)
  /\bprofil\b/i,             // Non-English "profile"
  /^basic\s+\w+$/i,          // "Basic Partner Rules"
  /\bchristian\s+\w+$/i,     // "Christian Entrepreneurs"
];

function isValidName(name) {
  if (!name || typeof name !== 'string') return false;

  const cleaned = name.trim().toLowerCase();

  // Too short or too long
  if (cleaned.length < 3 || cleaned.length > 50) return false;

  // Check against invalid names list
  if (INVALID_NAMES.some(invalid => cleaned === invalid || cleaned.includes(invalid))) {
    return false;
  }

  // Check against invalid patterns
  if (INVALID_NAME_PATTERNS.some(pattern => pattern.test(name))) {
    return false;
  }

  // Should contain at least one letter
  if (!/[a-zA-Z]/.test(name)) return false;

  // Shouldn't be all caps unless short (initials)
  if (name === name.toUpperCase() && name.length > 5) return false;

  // Shouldn't contain too many special chars or pipes
  const specialCount = (name.match(/[|\/\\<>{}[\]]/g) || []).length;
  if (specialCount > 1) return false;

  // Name should have 1-4 words (first + optional middle + last)
  const words = name.trim().split(/\s+/);
  if (words.length > 5) return false;

  // First word should look like a first name
  const firstName = words[0].toLowerCase().replace(/[^a-z]/g, '');
  if (firstName.length < 2) return false;

  // Check for brand name patterns (CamelCase single word, all caps abbreviations)
  if (words.length === 1 && name.length > 6) {
    if (/[a-z][A-Z]/.test(name)) return false;
  }

  return true;
}

/**
 * Try to extract a real name from a messy fullName string
 * e.g., "Shakirah Ali | Psychotherapist" -> "Shakirah Ali"
 */
function extractRealName(fullName) {
  if (!fullName) return null;

  // Try splitting by common delimiters
  const delimiters = ['|', ',', '-', '➡️', '•', '/', '✨', '💪', '🌟'];
  let name = fullName;

  for (const delim of delimiters) {
    if (name.includes(delim)) {
      const parts = name.split(delim);
      // Take the first part that looks like a name
      const firstPart = parts[0].trim();
      if (firstPart.length > 3 && firstPart.length < 40) {
        name = firstPart;
        break;
      }
    }
  }

  // Remove trailing business terms
  name = name.replace(/\s+(independent|consultant|distributor|representative|stylist|advocate).*$/i, '').trim();

  // Check if the cleaned name is valid
  if (isValidName(name) && name.split(/\s+/).length <= 4) {
    return name;
  }

  return null;
}

function parseName(fullName) {
  if (!fullName) return { firstName: null, lastName: null };
  const cleaned = fullName.trim().replace(/\s+/g, ' ');
  const parts = cleaned.split(' ');
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

async function cleanupInvalidNames() {
  const args = process.argv.slice(2);
  const deleteMode = args.includes('--delete');

  console.log('='.repeat(60));
  console.log('MLM CONTACTS - Invalid Name Cleanup');
  console.log('='.repeat(60));
  console.log(`Mode: ${deleteMode ? 'DELETE/FIX' : 'DRY RUN (preview)'}`);
  console.log();

  const snapshot = await db.collection('mlm_contacts').get();

  let validCount = 0;
  let fixableCount = 0;
  let deleteCount = 0;
  const toFix = [];
  const toDelete = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const fullName = data.fullName || data.firstName || '';

    if (isValidName(fullName)) {
      validCount++;
    } else {
      // Try to extract a real name
      const extractedName = extractRealName(fullName);

      if (extractedName && data.email) {
        // We can fix this contact - it has a salvageable name and email
        toFix.push({
          id: doc.id,
          oldFullName: fullName,
          newFullName: extractedName,
          email: data.email,
        });
        fixableCount++;
      } else {
        // Can't salvage - delete it
        toDelete.push({
          id: doc.id,
          fullName: fullName,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
        });
        deleteCount++;
      }
    }
  }

  // Show fixable contacts
  if (toFix.length > 0) {
    console.log('FIXABLE NAMES (will be corrected):');
    console.log('-'.repeat(60));

    for (const contact of toFix) {
      console.log(`  "${contact.oldFullName}" (${contact.email})`);
      console.log(`    -> Will fix to: "${contact.newFullName}"`);

      if (deleteMode) {
        const { firstName, lastName } = parseName(contact.newFullName);
        await db.collection('mlm_contacts').doc(contact.id).update({
          fullName: contact.newFullName,
          firstName: firstName,
          lastName: lastName,
        });
        console.log('    -> FIXED');
      }
      console.log();
    }
  }

  // Show deletable contacts
  if (toDelete.length > 0) {
    console.log('INVALID NAMES (will be deleted):');
    console.log('-'.repeat(60));

    for (const contact of toDelete) {
      console.log(`  "${contact.fullName}" (${contact.email || 'no email'})`);
      console.log(`    firstName: "${contact.firstName}", lastName: "${contact.lastName}"`);

      if (deleteMode) {
        await db.collection('mlm_contacts').doc(contact.id).delete();
        console.log('    -> DELETED');
      }
      console.log();
    }
  }

  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total contacts: ${snapshot.size}`);
  console.log(`Valid names: ${validCount}`);
  console.log(`Fixable names: ${fixableCount}`);
  console.log(`Invalid names (to delete): ${deleteCount}`);

  if (!deleteMode && (fixableCount > 0 || deleteCount > 0)) {
    console.log();
    console.log('Run with --delete to fix/remove invalid contacts:');
    console.log('  node scripts/cleanup-mlm-names.js --delete');
  }
}

cleanupInvalidNames().catch(console.error);
