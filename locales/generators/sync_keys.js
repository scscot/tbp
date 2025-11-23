#!/usr/bin/env node

/**
 * Automatically synchronizes localization keys across all locale files.
 *
 * Rules:
 * - English (en) is the source of truth for all keys
 * - If es/pt/tl are missing keys that exist in en, auto-copy the English text as placeholder
 * - If es/pt/tl have extra keys not in en, report as error (fail the sync)
 * - Preserves existing translations (only adds missing keys)
 * - Maintains key order from English file
 *
 * Usage:
 *   npm run sync              # Auto-sync all locales
 *   node generators/sync_keys.js
 */

const fs = require('fs');
const path = require('path');

const L10N_DIR = path.join(__dirname, '../../lib/l10n');
const SUPPORTED_LOCALES = ['en', 'es', 'pt', 'de'];
const EN_LOCALE = 'en';

/**
 * Read and parse an ARB file
 */
function readArbFile(locale) {
  const filePath = path.join(L10N_DIR, `app_${locale}.arb`);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ ARB file not found: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

/**
 * Write ARB file with proper formatting
 */
function writeArbFile(locale, data) {
  const filePath = path.join(L10N_DIR, `app_${locale}.arb`);
  const content = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * Extract user-facing keys (exclude metadata keys starting with @)
 */
function extractKeys(arbData) {
  return Object.keys(arbData).filter(key => !key.startsWith('@'));
}

/**
 * Extract metadata keys
 */
function extractMetadataKeys(arbData) {
  return Object.keys(arbData).filter(key => key.startsWith('@'));
}

/**
 * Sync a single locale against English (source of truth)
 */
function syncLocale(locale, enData, localeData) {
  const enKeys = extractKeys(enData);
  const localeKeys = extractKeys(localeData);

  const missingInLocale = enKeys.filter(key => !localeKeys.includes(key));
  const extraInLocale = localeKeys.filter(key => !enKeys.includes(key));

  let changesMade = false;
  const issues = [];

  // Report extra keys as errors (these shouldn't exist)
  if (extraInLocale.length > 0) {
    issues.push({
      severity: 'error',
      locale,
      message: `Extra keys found in ${locale} that don't exist in English:`,
      keys: extraInLocale,
    });
  }

  // Auto-add missing keys with English placeholder text
  if (missingInLocale.length > 0) {
    issues.push({
      severity: 'info',
      locale,
      message: `Adding ${missingInLocale.length} missing key${missingInLocale.length > 1 ? 's' : ''} to ${locale}:`,
      keys: missingInLocale,
    });

    // Create new locale data with keys in same order as English
    const syncedData = {};

    for (const enKey of enKeys) {
      if (localeData.hasOwnProperty(enKey)) {
        // Keep existing translation
        syncedData[enKey] = localeData[enKey];
      } else {
        // Copy English text as placeholder
        syncedData[enKey] = enData[enKey];
        changesMade = true;
      }

      // Copy metadata if it exists in English
      const metadataKey = `@${enKey}`;
      if (enData.hasOwnProperty(metadataKey)) {
        if (localeData.hasOwnProperty(metadataKey)) {
          // Keep existing metadata
          syncedData[metadataKey] = localeData[metadataKey];
        } else {
          // Copy metadata from English
          syncedData[metadataKey] = enData[metadataKey];
          changesMade = true;
        }
      }
    }

    return { syncedData, changesMade, issues };
  }

  return { syncedData: localeData, changesMade, issues };
}

/**
 * Main sync function
 */
function syncAllLocales() {
  console.log('🔄 Syncing localization keys...\n');

  // Read English (source of truth)
  const enData = readArbFile(EN_LOCALE);
  const enKeys = extractKeys(enData);
  console.log(`📋 English locale has ${enKeys.length} keys\n`);

  let totalChangesMade = false;
  let totalErrors = 0;
  let totalKeysAdded = 0;

  // Sync each non-English locale
  for (const locale of SUPPORTED_LOCALES) {
    if (locale === EN_LOCALE) continue;

    console.log(`🌍 Syncing ${locale.toUpperCase()}...`);

    const localeData = readArbFile(locale);
    const { syncedData, changesMade, issues } = syncLocale(locale, enData, localeData);

    // Report issues
    for (const issue of issues) {
      if (issue.severity === 'error') {
        console.log(`   ❌ ERROR: ${issue.message}`);
        issue.keys.forEach(key => console.log(`      - ${key}`));
        totalErrors++;
      } else if (issue.severity === 'info') {
        console.log(`   ℹ️  ${issue.message}`);
        issue.keys.forEach(key => console.log(`      - ${key}`));
        totalKeysAdded += issue.keys.length;
      }
    }

    if (changesMade) {
      writeArbFile(locale, syncedData);
      console.log(`   ✅ Updated ${locale}.arb with ${issues[0]?.keys.length || 0} new key${issues[0]?.keys.length > 1 ? 's' : ''}`);
      totalChangesMade = true;
    } else {
      console.log(`   ✓ ${locale}.arb already in sync`);
    }

    console.log('');
  }

  // Summary
  console.log('═'.repeat(60));
  if (totalErrors > 0) {
    console.log(`❌ Sync FAILED: ${totalErrors} error${totalErrors > 1 ? 's' : ''} found`);
    console.log('   Please remove extra keys from locale files.');
    process.exit(1);
  } else if (totalChangesMade) {
    console.log(`✅ Sync COMPLETE: Added ${totalKeysAdded} key${totalKeysAdded > 1 ? 's' : ''} across all locales`);
    console.log('   English placeholder text copied for missing keys.');
    process.exit(0);
  } else {
    console.log('✅ All locales already in sync');
    process.exit(0);
  }
}

// Run sync
syncAllLocales();
