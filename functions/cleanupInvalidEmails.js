const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '../secrets/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath)
});

const db = admin.firestore();

async function cleanupInvalidEmails(dryRun = true) {
  console.log(`\n🔍 Scanning contacts for invalid emails... (${dryRun ? 'DRY RUN' : 'LIVE MODE'})\n`);

  const contactsRef = db.collection('emailCampaigns').doc('master').collection('contacts');
  const snapshot = await contactsRef.get();

  const invalidEmails = [];
  const bouncedEmails = [];
  const validEmails = [];

  const validTLDs = ['com', 'net', 'org', 'edu', 'gov', 'io', 'co', 'us', 'uk', 'ca', 'au', 'de', 'fr', 'es', 'it', 'nl', 'be', 'ch', 'at', 'ru', 'jp', 'cn', 'in', 'br', 'mx', 'info', 'biz', 'tv', 'me', 'cc', 'ws', 'ly', 'fm', 'am', 'to', 'mobi', 'asia', 'pro', 'name', 'travel', 'museum', 'aero', 'coop', 'jobs', 'mil', 'int'];

  for (const doc of snapshot.docs) {
    const contact = doc.data();
    const email = contact.email || '';

    // Check for bounced emails
    if (contact.status === 'failed' || contact.deliveryStatus === 'failed') {
      bouncedEmails.push({
        id: doc.id,
        email: email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        reason: contact.errorMessage || contact.failureReason || 'Unknown'
      });
      continue;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      invalidEmails.push({
        id: doc.id,
        email: email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        reason: 'Invalid format (missing TLD or malformed)'
      });
      continue;
    }

    // Check for valid TLD
    const domain = email.split('@')[1];
    const tld = domain.split('.').pop().toLowerCase();
    if (!validTLDs.includes(tld) && tld.length < 2) {
      invalidEmails.push({
        id: doc.id,
        email: email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        reason: `Invalid TLD: .${tld}`
      });
      continue;
    }

    validEmails.push(email);
  }

  console.log('📊 SUMMARY:');
  console.log(`   Total contacts: ${snapshot.size}`);
  console.log(`   Valid emails: ${validEmails.length}`);
  console.log(`   Invalid emails: ${invalidEmails.length}`);
  console.log(`   Bounced emails: ${bouncedEmails.length}`);

  if (invalidEmails.length > 0) {
    console.log('\n❌ INVALID EMAILS:');
    invalidEmails.forEach(e => {
      console.log(`   ${e.email} (${e.firstName} ${e.lastName}) - ${e.reason}`);
    });
  }

  if (bouncedEmails.length > 0) {
    console.log('\n🔴 BOUNCED EMAILS:');
    bouncedEmails.forEach(e => {
      console.log(`   ${e.email} (${e.firstName} ${e.lastName}) - ${e.reason}`);
    });
  }

  if (!dryRun && (invalidEmails.length > 0 || bouncedEmails.length > 0)) {
    console.log('\n🗑️  REMOVING INVALID/BOUNCED CONTACTS...');

    const allBadEmails = [...invalidEmails, ...bouncedEmails];
    let removed = 0;

    for (const badEmail of allBadEmails) {
      try {
        await contactsRef.doc(badEmail.id).delete();
        console.log(`   ✅ Removed: ${badEmail.email}`);
        removed++;
      } catch (error) {
        console.log(`   ❌ Failed to remove ${badEmail.email}: ${error.message}`);
      }
    }

    console.log(`\n✅ Removed ${removed} contacts`);
  } else if (dryRun && (invalidEmails.length > 0 || bouncedEmails.length > 0)) {
    console.log('\n💡 Run with dryRun=false to remove these contacts');
  }

  return {
    total: snapshot.size,
    valid: validEmails.length,
    invalid: invalidEmails.length,
    bounced: bouncedEmails.length
  };
}

// Parse command line args
const args = process.argv.slice(2);
const dryRun = !args.includes('--delete');

cleanupInvalidEmails(dryRun)
  .then(result => {
    console.log('\n✅ Scan complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
