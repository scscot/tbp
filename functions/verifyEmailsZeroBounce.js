const admin = require('firebase-admin');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const ZEROBOUNCE_API_KEY = '7f667f9f01484135adc1c22ea5932bad';

const serviceAccountPath = path.join(__dirname, '../secrets/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath)
});

const db = admin.firestore();

async function checkCredits() {
  try {
    const response = await axios.get('https://api.zerobounce.net/v2/getcredits', {
      params: { api_key: ZEROBOUNCE_API_KEY }
    });
    console.log(`ZeroBounce Credits: ${response.data.Credits}`);
    return parseInt(response.data.Credits);
  } catch (error) {
    console.error('Error checking credits:', error.message);
    return 0;
  }
}

async function validateSingleEmail(email) {
  try {
    const response = await axios.get('https://api.zerobounce.net/v2/validate', {
      params: {
        api_key: ZEROBOUNCE_API_KEY,
        email: email,
        ip_address: ''
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Error validating ${email}:`, error.message);
    return { status: 'error', error: error.message };
  }
}

async function verifyEmails(dryRun = true, limit = null) {
  console.log(`\nZeroBounce Email Verification (${dryRun ? 'DRY RUN' : 'LIVE MODE'})\n`);

  const credits = await checkCredits();
  if (credits === 0) {
    console.error('No ZeroBounce credits available!');
    return;
  }

  const contactsRef = db.collection('emailCampaigns').doc('master').collection('contacts');
  let query = contactsRef.where('sent', '==', false);

  if (limit) {
    query = query.limit(limit);
  }

  const snapshot = await query.get();
  console.log(`Found ${snapshot.size} unsent contacts`);
  console.log(`Available credits: ${credits}`);

  if (snapshot.size > credits) {
    console.warn(`WARNING: Not enough credits for all emails (${snapshot.size} emails, ${credits} credits)`);
  }

  const results = {
    valid: [],
    invalid: [],
    catchAll: [],
    spamtrap: [],
    abuse: [],
    doNotMail: [],
    unknown: [],
    errors: []
  };

  let processed = 0;
  const toProcess = Math.min(snapshot.size, credits, limit || Infinity);

  for (const doc of snapshot.docs) {
    if (processed >= toProcess) break;

    const contact = doc.data();
    const email = contact.email;

    if (dryRun) {
      console.log(`[DRY RUN] Would verify: ${email}`);
      processed++;
      continue;
    }

    console.log(`[${processed + 1}/${toProcess}] Verifying: ${email}`);

    const result = await validateSingleEmail(email);

    const status = result.status?.toLowerCase() || 'unknown';
    const subStatus = result.sub_status || '';

    const updateData = {
      zbVerified: true,
      zbStatus: status,
      zbSubStatus: subStatus,
      zbVerifiedAt: new Date()
    };

    switch (status) {
      case 'valid':
        results.valid.push({ email, subStatus });
        console.log(`   Valid: ${email}`);
        break;
      case 'invalid':
        results.invalid.push({ email, subStatus });
        updateData.zbInvalid = true;
        console.log(`   Invalid: ${email} (${subStatus})`);
        break;
      case 'catch-all':
        results.catchAll.push({ email, subStatus });
        console.log(`   Catch-all: ${email}`);
        break;
      case 'spamtrap':
        results.spamtrap.push({ email, subStatus });
        updateData.zbInvalid = true;
        console.log(`   SPAMTRAP: ${email}`);
        break;
      case 'abuse':
        results.abuse.push({ email, subStatus });
        updateData.zbInvalid = true;
        console.log(`   Abuse: ${email}`);
        break;
      case 'do_not_mail':
        results.doNotMail.push({ email, subStatus });
        updateData.zbInvalid = true;
        console.log(`   Do Not Mail: ${email} (${subStatus})`);
        break;
      default:
        results.unknown.push({ email, status, subStatus });
        console.log(`   Unknown: ${email} (${status})`);
    }

    await doc.ref.update(updateData);
    processed++;

    if (processed < toProcess) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log('\n=== VERIFICATION SUMMARY ===');
  console.log(`Valid:       ${results.valid.length}`);
  console.log(`Invalid:     ${results.invalid.length}`);
  console.log(`Catch-all:   ${results.catchAll.length}`);
  console.log(`Spamtrap:    ${results.spamtrap.length}`);
  console.log(`Abuse:       ${results.abuse.length}`);
  console.log(`Do Not Mail: ${results.doNotMail.length}`);
  console.log(`Unknown:     ${results.unknown.length}`);
  console.log(`Errors:      ${results.errors.length}`);
  console.log(`\nTotal processed: ${processed}`);

  return results;
}

async function verifyResendEmails(dryRun = true, limit = null) {
  console.log(`\nZeroBounce Resend Email Verification (${dryRun ? 'DRY RUN' : 'LIVE MODE'})\n`);

  const credits = await checkCredits();
  if (credits === 0) {
    console.error('No ZeroBounce credits available!');
    return;
  }

  const contactsRef = db.collection('emailCampaigns').doc('master').collection('contacts');
  const nov12 = new Date('2025-11-12T00:00:00Z');

  let query = contactsRef
    .where('sent', '==', true)
    .where('sentAt', '<', nov12);

  const snapshot = await query.get();

  const toVerify = snapshot.docs.filter(doc => {
    const data = doc.data();
    return !data.zbVerified;
  });

  console.log(`Found ${snapshot.size} sent contacts before Nov 12`);
  console.log(`Already verified: ${snapshot.size - toVerify.length}`);
  console.log(`Need verification: ${toVerify.length}`);
  console.log(`Available credits: ${credits}`);

  if (toVerify.length > credits) {
    console.warn(`WARNING: Not enough credits for all emails (${toVerify.length} emails, ${credits} credits)`);
  }

  const results = {
    valid: [],
    invalid: [],
    catchAll: [],
    spamtrap: [],
    abuse: [],
    doNotMail: [],
    unknown: [],
    errors: []
  };

  let processed = 0;
  const toProcess = Math.min(toVerify.length, credits, limit || Infinity);

  for (const doc of toVerify) {
    if (processed >= toProcess) break;

    const contact = doc.data();
    const email = contact.email;

    if (dryRun) {
      console.log(`[DRY RUN] Would verify: ${email}`);
      processed++;
      continue;
    }

    console.log(`[${processed + 1}/${toProcess}] Verifying: ${email}`);

    const result = await validateSingleEmail(email);

    const status = result.status?.toLowerCase() || 'unknown';
    const subStatus = result.sub_status || '';

    const updateData = {
      zbVerified: true,
      zbStatus: status,
      zbSubStatus: subStatus,
      zbVerifiedAt: new Date()
    };

    switch (status) {
      case 'valid':
        results.valid.push({ email, subStatus });
        console.log(`   Valid: ${email}`);
        break;
      case 'invalid':
        results.invalid.push({ email, subStatus });
        updateData.zbInvalid = true;
        console.log(`   Invalid: ${email} (${subStatus})`);
        break;
      case 'catch-all':
        results.catchAll.push({ email, subStatus });
        console.log(`   Catch-all: ${email}`);
        break;
      case 'spamtrap':
        results.spamtrap.push({ email, subStatus });
        updateData.zbInvalid = true;
        console.log(`   SPAMTRAP: ${email}`);
        break;
      case 'abuse':
        results.abuse.push({ email, subStatus });
        updateData.zbInvalid = true;
        console.log(`   Abuse: ${email}`);
        break;
      case 'do_not_mail':
        results.doNotMail.push({ email, subStatus });
        updateData.zbInvalid = true;
        console.log(`   Do Not Mail: ${email} (${subStatus})`);
        break;
      default:
        results.unknown.push({ email, status, subStatus });
        console.log(`   Unknown: ${email} (${status})`);
    }

    await doc.ref.update(updateData);
    processed++;

    if (processed < toProcess) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log('\n=== VERIFICATION SUMMARY ===');
  console.log(`Valid:       ${results.valid.length}`);
  console.log(`Invalid:     ${results.invalid.length}`);
  console.log(`Catch-all:   ${results.catchAll.length}`);
  console.log(`Spamtrap:    ${results.spamtrap.length}`);
  console.log(`Abuse:       ${results.abuse.length}`);
  console.log(`Do Not Mail: ${results.doNotMail.length}`);
  console.log(`Unknown:     ${results.unknown.length}`);
  console.log(`Errors:      ${results.errors.length}`);
  console.log(`\nTotal processed: ${processed}`);

  return results;
}

async function verifyAllSentEmails(dryRun = true, limit = null) {
  console.log(`\nZeroBounce Sent Email Verification (${dryRun ? 'DRY RUN' : 'LIVE MODE'})\n`);

  const credits = await checkCredits();
  if (credits === 0) {
    console.error('No ZeroBounce credits available!');
    return;
  }

  const contactsRef = db.collection('emailCampaigns').doc('master').collection('contacts');
  const snapshot = await contactsRef.where('sent', '==', true).get();

  const toVerify = snapshot.docs.filter(doc => {
    const data = doc.data();
    return !data.zbVerified;
  });

  console.log(`Found ${snapshot.size} total sent contacts`);
  console.log(`Already verified: ${snapshot.size - toVerify.length}`);
  console.log(`Need verification: ${toVerify.length}`);
  console.log(`Available credits: ${credits}`);

  if (toVerify.length > credits) {
    console.warn(`WARNING: Not enough credits for all emails (${toVerify.length} emails, ${credits} credits)`);
  }

  const results = {
    valid: [],
    invalid: [],
    catchAll: [],
    spamtrap: [],
    abuse: [],
    doNotMail: [],
    unknown: [],
    errors: []
  };

  let processed = 0;
  const toProcess = Math.min(toVerify.length, credits, limit || Infinity);

  for (const doc of toVerify) {
    if (processed >= toProcess) break;

    const contact = doc.data();
    const email = contact.email;

    if (dryRun) {
      console.log(`[DRY RUN] Would verify: ${email}`);
      processed++;
      continue;
    }

    console.log(`[${processed + 1}/${toProcess}] Verifying: ${email}`);

    const result = await validateSingleEmail(email);

    const status = result.status?.toLowerCase() || 'unknown';
    const subStatus = result.sub_status || '';

    const updateData = {
      zbVerified: true,
      zbStatus: status,
      zbSubStatus: subStatus,
      zbVerifiedAt: new Date()
    };

    switch (status) {
      case 'valid':
        results.valid.push({ email, subStatus });
        console.log(`   Valid: ${email}`);
        break;
      case 'invalid':
        results.invalid.push({ email, subStatus });
        updateData.zbInvalid = true;
        console.log(`   Invalid: ${email} (${subStatus})`);
        break;
      case 'catch-all':
        results.catchAll.push({ email, subStatus });
        console.log(`   Catch-all: ${email}`);
        break;
      case 'spamtrap':
        results.spamtrap.push({ email, subStatus });
        updateData.zbInvalid = true;
        console.log(`   SPAMTRAP: ${email}`);
        break;
      case 'abuse':
        results.abuse.push({ email, subStatus });
        updateData.zbInvalid = true;
        console.log(`   Abuse: ${email}`);
        break;
      case 'do_not_mail':
        results.doNotMail.push({ email, subStatus });
        updateData.zbInvalid = true;
        console.log(`   Do Not Mail: ${email} (${subStatus})`);
        break;
      default:
        results.unknown.push({ email, status, subStatus });
        console.log(`   Unknown: ${email} (${status})`);
    }

    await doc.ref.update(updateData);
    processed++;

    if (processed < toProcess) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log('\n=== VERIFICATION SUMMARY ===');
  console.log(`Valid:       ${results.valid.length}`);
  console.log(`Invalid:     ${results.invalid.length}`);
  console.log(`Catch-all:   ${results.catchAll.length}`);
  console.log(`Spamtrap:    ${results.spamtrap.length}`);
  console.log(`Abuse:       ${results.abuse.length}`);
  console.log(`Do Not Mail: ${results.doNotMail.length}`);
  console.log(`Unknown:     ${results.unknown.length}`);
  console.log(`Errors:      ${results.errors.length}`);
  console.log(`\nTotal processed: ${processed}`);

  return results;
}

async function removeInvalidEmails(dryRun = true) {
  console.log(`\nRemoving Invalid Emails (${dryRun ? 'DRY RUN' : 'LIVE MODE'})\n`);

  const contactsRef = db.collection('emailCampaigns').doc('master').collection('contacts');
  const invalidSnapshot = await contactsRef.where('zbInvalid', '==', true).get();

  console.log(`Found ${invalidSnapshot.size} invalid emails to remove`);

  if (dryRun) {
    invalidSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`[DRY RUN] Would remove: ${data.email} (${data.zbStatus}: ${data.zbSubStatus})`);
    });
    return;
  }

  let removed = 0;
  for (const doc of invalidSnapshot.docs) {
    const data = doc.data();
    try {
      await doc.ref.delete();
      console.log(`Removed: ${data.email}`);
      removed++;
    } catch (error) {
      console.error(`Failed to remove ${data.email}: ${error.message}`);
    }
  }

  console.log(`\nRemoved ${removed} invalid contacts`);
}

async function exportUnsentToCsv() {
  console.log('\nExporting unsent emails to CSV...\n');

  const contactsRef = db.collection('emailCampaigns').doc('master').collection('contacts');
  const snapshot = await contactsRef.where('sent', '==', false).get();

  const csvPath = path.join(__dirname, 'unsent_emails.csv');
  const emails = snapshot.docs.map(doc => doc.data().email);

  fs.writeFileSync(csvPath, 'email\n' + emails.join('\n'));
  console.log(`Exported ${emails.length} emails to ${csvPath}`);
  console.log('You can upload this file to ZeroBounce web interface for bulk validation');
}

const args = process.argv.slice(2);
const command = args[0] || 'help';
const dryRun = !args.includes('--live');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

switch (command) {
  case 'credits':
    checkCredits().then(() => process.exit(0));
    break;
  case 'verify':
    verifyEmails(dryRun, limit).then(() => process.exit(0));
    break;
  case 'verify-resend':
    verifyResendEmails(dryRun, limit).then(() => process.exit(0));
    break;
  case 'verify-sent':
    verifyAllSentEmails(dryRun, limit).then(() => process.exit(0));
    break;
  case 'remove':
    removeInvalidEmails(dryRun).then(() => process.exit(0));
    break;
  case 'export':
    exportUnsentToCsv().then(() => process.exit(0));
    break;
  default:
    console.log(`
ZeroBounce Email Verification Script

Commands:
  credits           Check available ZeroBounce credits
  verify            Verify unsent emails (dry run by default)
  verify-sent       Verify ALL sent emails that haven't been verified (dry run by default)
  verify-resend     Verify resend-eligible emails sent before Nov 12 (dry run by default)
  remove            Remove emails marked as invalid (dry run by default)
  export            Export unsent emails to CSV for manual upload

Options:
  --live            Execute changes (default is dry run)
  --limit=N         Limit number of emails to process

Examples:
  node verifyEmailsZeroBounce.js credits
  node verifyEmailsZeroBounce.js verify --limit=10
  node verifyEmailsZeroBounce.js verify --live
  node verifyEmailsZeroBounce.js verify-resend --live
  node verifyEmailsZeroBounce.js remove --live
  node verifyEmailsZeroBounce.js export
`);
    process.exit(0);
}
