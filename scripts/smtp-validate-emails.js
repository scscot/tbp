#!/usr/bin/env node
/**
 * SMTP Email Validator using deep-email-validator
 *
 * Performs SMTP mailbox verification on email lists.
 * Features:
 * - Progress saving (resume if interrupted)
 * - Rate limiting to avoid IP blocks
 * - Categorizes: valid, invalid, unverifiable
 * - Exports results for Firestore import
 *
 * Usage:
 *   node smtp-validate-emails.js                    # Process all files
 *   node smtp-validate-emails.js --resume           # Resume from last checkpoint
 *   node smtp-validate-emails.js --file tbpleads.csv  # Process specific file
 *   node smtp-validate-emails.js --test             # Test with 10 emails only
 *
 * Install dependencies first:
 *   cd scripts && npm install deep-email-validator csv-parse csv-stringify
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

// Configuration
const CONFIG = {
  emailsDir: path.join(__dirname, '../emails'),
  outputDir: path.join(__dirname, '../emails/smtp_validated'),
  progressFile: path.join(__dirname, '../emails/smtp_validated/progress.json'),

  // Rate limiting
  delayBetweenEmails: 1000,      // 1 second between emails
  delayBetweenBatches: 5000,     // 5 seconds between batches of 50
  batchSize: 50,                  // Process 50 emails then pause

  // Files to process
  sourceFiles: [
    'tbpleads.csv',
    'tbpleads_non_google.csv'
  ],

  // Validation options
  validateOptions: {
    validateRegex: true,
    validateMx: true,
    validateTypo: false,        // Skip typo suggestions
    validateDisposable: true,
    validateSMTP: true          // The key SMTP check
  }
};

// Dynamically import deep-email-validator (ESM module)
let validate;

async function loadValidator() {
  const module = await import('deep-email-validator');
  validate = module.validate;  // Use named export, not default
}

// Progress tracking
let progress = {
  currentFile: null,
  currentIndex: 0,
  results: {
    valid: [],
    invalid: [],
    unverifiable: []
  },
  stats: {
    total: 0,
    processed: 0,
    valid: 0,
    invalid: 0,
    unverifiable: 0
  },
  startTime: null,
  lastUpdate: null
};

function loadProgress() {
  try {
    if (fs.existsSync(CONFIG.progressFile)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG.progressFile, 'utf8'));
      console.log(`\nResuming from checkpoint:`);
      console.log(`  File: ${saved.currentFile}`);
      console.log(`  Position: ${saved.currentIndex}/${saved.stats.total}`);
      console.log(`  Valid: ${saved.stats.valid}, Invalid: ${saved.stats.invalid}, Unverifiable: ${saved.stats.unverifiable}`);
      return saved;
    }
  } catch (e) {
    console.log('No valid checkpoint found, starting fresh');
  }
  return null;
}

function saveProgress() {
  progress.lastUpdate = new Date().toISOString();
  fs.mkdirSync(path.dirname(CONFIG.progressFile), { recursive: true });
  fs.writeFileSync(CONFIG.progressFile, JSON.stringify(progress, null, 2));
}

function saveResults() {
  const outputDir = CONFIG.outputDir;
  fs.mkdirSync(outputDir, { recursive: true });

  // Save valid emails
  if (progress.results.valid.length > 0) {
    const validCsv = stringify(progress.results.valid, { header: true });
    fs.writeFileSync(path.join(outputDir, 'valid_emails.csv'), validCsv);
  }

  // Save invalid emails
  if (progress.results.invalid.length > 0) {
    const invalidCsv = stringify(progress.results.invalid, { header: true });
    fs.writeFileSync(path.join(outputDir, 'invalid_emails.csv'), invalidCsv);
  }

  // Save unverifiable emails
  if (progress.results.unverifiable.length > 0) {
    const unverifiableCsv = stringify(progress.results.unverifiable, { header: true });
    fs.writeFileSync(path.join(outputDir, 'unverifiable_emails.csv'), unverifiableCsv);
  }

  // Save Firestore-ready JSON (valid emails only)
  const firestoreData = progress.results.valid.map(row => ({
    email: row.email,
    firstName: row.firstName || row.first_name || '',
    lastName: row.lastName || row.last_name || '',
    validatedAt: new Date().toISOString(),
    validationMethod: 'smtp',
    source: row.sourceFile || 'unknown'
  }));
  fs.writeFileSync(
    path.join(outputDir, 'firestore_import.json'),
    JSON.stringify(firestoreData, null, 2)
  );

  console.log(`\nResults saved to ${outputDir}/`);
  console.log(`  - valid_emails.csv (${progress.results.valid.length})`);
  console.log(`  - invalid_emails.csv (${progress.results.invalid.length})`);
  console.log(`  - unverifiable_emails.csv (${progress.results.unverifiable.length})`);
  console.log(`  - firestore_import.json (${firestoreData.length} records)`);
}

async function validateEmail(email) {
  try {
    const result = await validate({
      email: email,
      ...CONFIG.validateOptions
    });

    return {
      email,
      valid: result.valid,
      reason: result.reason || 'unknown',
      validators: result.validators || {}
    };
  } catch (error) {
    return {
      email,
      valid: null,  // null = unverifiable
      reason: error.message,
      validators: {}
    };
  }
}

function categorizeResult(result, row, sourceFile) {
  const enrichedRow = {
    ...row,
    sourceFile,
    validatedAt: new Date().toISOString(),
    validationReason: result.reason
  };

  if (result.valid === true) {
    progress.results.valid.push(enrichedRow);
    progress.stats.valid++;
    return 'valid';
  } else if (result.valid === false) {
    // Check if it's truly invalid or just unverifiable
    const validators = result.validators || {};

    // If SMTP check failed but MX exists, it might just be unverifiable
    if (validators.mx?.valid && !validators.smtp?.valid) {
      // SMTP blocked but domain exists - mark as unverifiable
      if (result.reason === 'smtp' || result.reason?.includes('timeout') || result.reason?.includes('blocked')) {
        progress.results.unverifiable.push(enrichedRow);
        progress.stats.unverifiable++;
        return 'unverifiable';
      }
    }

    // Definitely invalid (bad syntax, no MX, disposable, etc.)
    progress.results.invalid.push(enrichedRow);
    progress.stats.invalid++;
    return 'invalid';
  } else {
    // null/undefined = couldn't determine
    progress.results.unverifiable.push(enrichedRow);
    progress.stats.unverifiable++;
    return 'unverifiable';
  }
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function printProgress(email, status, index, total) {
  const elapsed = Date.now() - progress.startTime;
  const rate = progress.stats.processed / (elapsed / 1000); // emails per second
  const remaining = total - index;
  const eta = remaining / rate * 1000;

  const statusIcon = status === 'valid' ? '\u2713' : status === 'invalid' ? '\u2717' : '?';
  const statusColor = status === 'valid' ? '\x1b[32m' : status === 'invalid' ? '\x1b[31m' : '\x1b[33m';

  process.stdout.write(`\r\x1b[K[${index}/${total}] ${statusColor}${statusIcon}\x1b[0m ${email.substring(0, 40).padEnd(40)} | ` +
    `V:${progress.stats.valid} I:${progress.stats.invalid} U:${progress.stats.unverifiable} | ` +
    `ETA: ${formatDuration(eta)}`);
}

async function processFile(filename, startIndex = 0) {
  const filePath = path.join(CONFIG.emailsDir, filename);

  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${filename}`);
  console.log(`${'='.repeat(60)}`);

  const content = fs.readFileSync(filePath, 'utf8');
  const rows = parse(content, { columns: true, skip_empty_lines: true });

  progress.stats.total = rows.length;
  progress.currentFile = filename;

  console.log(`Total emails: ${rows.length}`);
  console.log(`Starting from index: ${startIndex}`);
  console.log(`Estimated time: ${formatDuration(rows.length * CONFIG.delayBetweenEmails)}`);
  console.log('');

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    const email = row.email || row.Email || row.EMAIL;

    if (!email) {
      console.log(`Skipping row ${i}: no email field`);
      continue;
    }

    progress.currentIndex = i;

    // Validate email
    const result = await validateEmail(email);
    const status = categorizeResult(result, row, filename);
    progress.stats.processed++;

    // Print progress
    printProgress(email, status, i + 1, rows.length);

    // Save checkpoint every 50 emails
    if ((i + 1) % CONFIG.batchSize === 0) {
      saveProgress();
      saveResults();
      console.log(`\n  [Checkpoint saved at ${i + 1}]`);

      // Longer pause between batches
      await sleep(CONFIG.delayBetweenBatches);
    } else {
      // Regular delay between emails
      await sleep(CONFIG.delayBetweenEmails);
    }
  }

  console.log('\n');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const resume = args.includes('--resume');
  const testMode = args.includes('--test');
  const fileArg = args.find(a => a.startsWith('--file='));
  const specificFile = fileArg ? fileArg.split('=')[1] : null;

  console.log('SMTP Email Validator using deep-email-validator');
  console.log('='.repeat(60));

  // Load the validator module
  console.log('Loading deep-email-validator...');
  await loadValidator();
  console.log('Validator loaded successfully');

  // Initialize or resume progress
  if (resume) {
    const saved = loadProgress();
    if (saved) {
      progress = saved;
    }
  }

  progress.startTime = Date.now();

  // Determine which files to process
  let filesToProcess = specificFile ? [specificFile] : CONFIG.sourceFiles;

  if (testMode) {
    console.log('\n*** TEST MODE: Processing only 10 emails ***\n');
    CONFIG.batchSize = 10;
  }

  // Create output directory
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });

  // Process each file
  for (const filename of filesToProcess) {
    const startIndex = (resume && progress.currentFile === filename) ? progress.currentIndex : 0;

    // In test mode, only process first file and first 10 emails
    if (testMode) {
      const filePath = path.join(CONFIG.emailsDir, filename);
      const content = fs.readFileSync(filePath, 'utf8');
      const rows = parse(content, { columns: true, skip_empty_lines: true });

      // Create temp file with just 10 emails
      const testFile = 'test_sample.csv';
      const testContent = stringify(rows.slice(0, 10), { header: true });
      fs.writeFileSync(path.join(CONFIG.emailsDir, testFile), testContent);

      await processFile(testFile, 0);

      // Clean up test file
      fs.unlinkSync(path.join(CONFIG.emailsDir, testFile));
      break;
    }

    await processFile(filename, startIndex);
  }

  // Final save
  saveProgress();
  saveResults();

  // Print summary
  const elapsed = Date.now() - progress.startTime;
  console.log('\n' + '='.repeat(60));
  console.log('VALIDATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total processed: ${progress.stats.processed}`);
  console.log(`Valid: ${progress.stats.valid} (${(progress.stats.valid / progress.stats.processed * 100).toFixed(1)}%)`);
  console.log(`Invalid: ${progress.stats.invalid} (${(progress.stats.invalid / progress.stats.processed * 100).toFixed(1)}%)`);
  console.log(`Unverifiable: ${progress.stats.unverifiable} (${(progress.stats.unverifiable / progress.stats.processed * 100).toFixed(1)}%)`);
  console.log(`Time elapsed: ${formatDuration(elapsed)}`);
  console.log(`\nOutput files in: ${CONFIG.outputDir}/`);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nInterrupted! Saving progress...');
  saveProgress();
  saveResults();
  console.log('Progress saved. Run with --resume to continue.');
  process.exit(0);
});

main().catch(err => {
  console.error('Error:', err);
  saveProgress();
  saveResults();
  process.exit(1);
});
