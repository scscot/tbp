const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '../secrets/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath)
});

const db = admin.firestore();

const YAHOO_DOMAINS = [
  'yahoo.com', 'yahoo.co.uk', 'yahoo.ca', 'yahoo.com.au', 'yahoo.fr',
  'yahoo.de', 'yahoo.es', 'yahoo.it', 'yahoo.co.jp', 'yahoo.co.in',
  'ymail.com', 'rocketmail.com', 'aol.com', 'aim.com', 'att.net',
  'sbcglobal.net', 'bellsouth.net', 'cox.net', 'ameritech.net'
];

function isYahooDomain(email) {
  if (!email) return false;
  const domain = email.toLowerCase().split('@')[1];
  if (!domain) return false;
  return YAHOO_DOMAINS.includes(domain) || domain.startsWith('yahoo.');
}

async function moveYahooContacts(dryRun = true) {
  console.log(`\nMoving ALL Yahoo/AOL contacts to separate collection (${dryRun ? 'DRY RUN' : 'LIVE MODE'})\n`);

  const contactsRef = db.collection('emailCampaigns').doc('master').collection('contacts');
  const yahooRef = db.collection('emailCampaigns').doc('master').collection('contacts_yahoo');

  const snapshot = await contactsRef.get();

  let yahooCount = 0;
  let yahooSent = 0;
  let yahooUnsent = 0;
  let nonYahooCount = 0;
  const yahooContacts = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (isYahooDomain(data.email)) {
      yahooCount++;
      if (data.sent) yahooSent++;
      else yahooUnsent++;
      yahooContacts.push({ id: doc.id, data });
    } else {
      nonYahooCount++;
    }
  }

  console.log(`All contacts breakdown:`);
  console.log(`  Yahoo/AOL: ${yahooCount} (${yahooSent} sent, ${yahooUnsent} unsent)`);
  console.log(`  Non-Yahoo: ${nonYahooCount}`);
  console.log(`  Total: ${snapshot.size}`);

  if (dryRun) {
    console.log(`\n[DRY RUN] Would move ${yahooCount} Yahoo/AOL contacts to contacts_yahoo`);
    if (yahooCount > 0) {
      console.log(`\nSample Yahoo/AOL emails:`);
      yahooContacts.slice(0, 10).forEach(c => console.log(`  ${c.data.email}`));
    }
    return;
  }

  console.log(`\nMoving ${yahooCount} contacts...`);

  let moved = 0;
  const batchSize = 500;
  let batch = db.batch();
  let batchCount = 0;

  for (const contact of yahooContacts) {
    const newDocRef = yahooRef.doc(contact.id);
    const oldDocRef = contactsRef.doc(contact.id);

    batch.set(newDocRef, {
      ...contact.data,
      movedAt: new Date(),
      movedFrom: 'contacts'
    });
    batch.delete(oldDocRef);

    batchCount++;
    moved++;

    if (batchCount >= batchSize) {
      await batch.commit();
      console.log(`  Moved ${moved}/${yahooCount}...`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`\nMoved ${moved} Yahoo/AOL contacts to contacts_yahoo`);
}

const args = process.argv.slice(2);
const dryRun = !args.includes('--live');

moveYahooContacts(dryRun)
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
