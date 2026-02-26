#!/usr/bin/env node
/**
 * Set Analytics Benchmark Date
 *
 * Sets the benchmark date in Firestore config/analytics document.
 * When set, the TBP Analytics dashboard will only show data from this date forward.
 *
 * Usage:
 *   node scripts/set-analytics-benchmark.js              # Set to today
 *   node scripts/set-analytics-benchmark.js 2026-02-25   # Set to specific date
 *   node scripts/set-analytics-benchmark.js --clear      # Remove benchmark (show all data)
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../secrets/serviceAccountKey.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath))
  });
}

const db = admin.firestore();

async function setBenchmarkDate(dateStr) {
  const configRef = db.collection('config').doc('analytics');

  if (dateStr === '--clear' || dateStr === 'clear') {
    // Remove benchmark
    await configRef.set({ benchmarkDate: admin.firestore.FieldValue.delete() }, { merge: true });
    console.log('Benchmark cleared - dashboard will show all historical data');
    return;
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    console.error(`Invalid date format: ${dateStr}. Use YYYY-MM-DD format.`);
    process.exit(1);
  }

  // Validate it's a real date
  const date = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(date.getTime())) {
    console.error(`Invalid date: ${dateStr}`);
    process.exit(1);
  }

  // Set benchmark date
  await configRef.set({ benchmarkDate: dateStr }, { merge: true });
  console.log(`Benchmark date set to: ${dateStr}`);
  console.log('TBP Analytics dashboard will now only show data from this date forward.');
  console.log('\nNote: This affects:');
  console.log('  - iOS App Store metrics (downloads, impressions)');
  console.log('  - Google Play Store metrics (installs, visits)');
  console.log('  - Email campaign sent counts');
  console.log('\nGA4 website analytics are controlled by the date range selector, not this benchmark.');
}

// Get date argument or default to today
const arg = process.argv[2];
let benchmarkDate;

if (arg === '--clear' || arg === 'clear') {
  benchmarkDate = '--clear';
} else if (arg) {
  benchmarkDate = arg;
} else {
  // Default to today in YYYY-MM-DD format (PT timezone)
  const now = new Date();
  const ptDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  benchmarkDate = ptDate.toISOString().split('T')[0];
}

console.log('Setting analytics benchmark...\n');
setBenchmarkDate(benchmarkDate)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
