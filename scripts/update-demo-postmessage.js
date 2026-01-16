#!/usr/bin/env node
/**
 * Update existing PreIntake demos to add postMessage tracking
 *
 * This script updates all demo HTML files in Firebase Storage to add
 * the postMessage code that notifies the parent window when the user
 * clicks "Start Demo" in the onboarding modal.
 *
 * Usage:
 *   DRY_RUN=true node update-demo-postmessage.js   # Preview changes
 *   node update-demo-postmessage.js                 # Apply changes
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../secrets/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'teambuilder-plus-fe74d.firebasestorage.app'
  });
}

const bucket = admin.storage().bucket();
const DRY_RUN = process.env.DRY_RUN === 'true';

// The OLD pattern to find (exact match including whitespace)
const OLD_PATTERN = `closeBtn.addEventListener('click', function() {
                modal.classList.add('hidden');
                sessionStorage.setItem('preintake_onboarding_seen', 'true');
            });`;

// Function to generate the NEW code with the specific leadId
function getNewCode(leadId) {
  return `closeBtn.addEventListener('click', function() {
                modal.classList.add('hidden');
                sessionStorage.setItem('preintake_onboarding_seen', 'true');

                // Notify parent window that demo has actually started (for view tracking)
                if (window.parent !== window) {
                    window.parent.postMessage({
                        type: 'demo-started',
                        firmId: '${leadId}'
                    }, '*');
                }
            });`;
}

// Pattern to check if already updated (to skip demos that already have the code)
const ALREADY_UPDATED_CHECK = "type: 'demo-started'";

async function listAllDemos() {
  const [files] = await bucket.getFiles({ prefix: 'preintake-demos/' });
  return files.filter(f => f.name.endsWith('/index.html'));
}

async function updateDemo(file) {
  const filePath = file.name;
  // Extract leadId from path: preintake-demos/{leadId}/index.html
  const leadId = filePath.split('/')[1];

  try {
    // Download the file
    const [contents] = await file.download();
    const html = contents.toString('utf8');

    // Check if already updated
    if (html.includes(ALREADY_UPDATED_CHECK)) {
      return { status: 'skipped', reason: 'already updated', leadId };
    }

    // Check if the old pattern exists
    if (!html.includes(OLD_PATTERN)) {
      return { status: 'skipped', reason: 'pattern not found', leadId };
    }

    // Replace the old pattern with the new code
    const newHtml = html.replace(OLD_PATTERN, getNewCode(leadId));

    // Verify the replacement worked
    if (newHtml === html) {
      return { status: 'error', reason: 'replacement failed', leadId };
    }

    // Verify the new code is in the updated HTML
    if (!newHtml.includes(ALREADY_UPDATED_CHECK)) {
      return { status: 'error', reason: 'verification failed', leadId };
    }

    if (DRY_RUN) {
      return { status: 'would_update', leadId };
    }

    // Upload the updated file
    await file.save(newHtml, {
      contentType: 'text/html',
      metadata: {
        cacheControl: 'public, max-age=3600'
      }
    });

    return { status: 'updated', leadId };

  } catch (error) {
    return { status: 'error', reason: error.message, leadId };
  }
}

async function main() {
  console.log(`\n📋 PreIntake Demo PostMessage Updater`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes will be made)' : '🚀 LIVE (changes will be applied)'}\n`);

  // List all demos
  console.log('Listing demos in Firebase Storage...');
  const demos = await listAllDemos();
  console.log(`Found ${demos.length} demos\n`);

  // Process each demo
  const results = {
    updated: [],
    would_update: [],
    skipped_already: [],
    skipped_pattern: [],
    errors: []
  };

  for (let i = 0; i < demos.length; i++) {
    const demo = demos[i];
    const result = await updateDemo(demo);

    switch (result.status) {
      case 'updated':
        results.updated.push(result.leadId);
        process.stdout.write(`✅`);
        break;
      case 'would_update':
        results.would_update.push(result.leadId);
        process.stdout.write(`📝`);
        break;
      case 'skipped':
        if (result.reason === 'already updated') {
          results.skipped_already.push(result.leadId);
          process.stdout.write(`⏭️`);
        } else {
          results.skipped_pattern.push(result.leadId);
          process.stdout.write(`⚠️`);
        }
        break;
      case 'error':
        results.errors.push({ leadId: result.leadId, reason: result.reason });
        process.stdout.write(`❌`);
        break;
    }

    // Progress indicator every 50
    if ((i + 1) % 50 === 0) {
      process.stdout.write(` ${i + 1}/${demos.length}\n`);
    }
  }

  console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 Results Summary:`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  if (DRY_RUN) {
    console.log(`📝 Would update: ${results.would_update.length} demos`);
  } else {
    console.log(`✅ Updated: ${results.updated.length} demos`);
  }
  console.log(`⏭️  Skipped (already updated): ${results.skipped_already.length}`);
  console.log(`⚠️  Skipped (pattern not found): ${results.skipped_pattern.length}`);
  console.log(`❌ Errors: ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log(`\n❌ Error details:`);
    results.errors.forEach(e => {
      console.log(`   - ${e.leadId}: ${e.reason}`);
    });
  }

  if (results.skipped_pattern.length > 0 && results.skipped_pattern.length <= 10) {
    console.log(`\n⚠️  Pattern not found in:`);
    results.skipped_pattern.forEach(id => {
      console.log(`   - ${id}`);
    });
  }

  console.log(`\n✨ Done!\n`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
