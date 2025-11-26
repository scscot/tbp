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

async function countAll() {
  const contactsRef = db.collection('emailCampaigns').doc('master').collection('contacts');
  const yahooRef = db.collection('emailCampaigns').doc('master').collection('contacts_yahoo');

  const allContacts = await contactsRef.get();
  let yahooInContacts = 0;
  let sentYahoo = 0;
  let unsentYahoo = 0;

  allContacts.docs.forEach(doc => {
    const data = doc.data();
    if (isYahooDomain(data.email)) {
      yahooInContacts++;
      if (data.sent) sentYahoo++;
      else unsentYahoo++;
    }
  });

  const yahooContacts = await yahooRef.get();

  console.log('=== Yahoo/AOL Contact Summary ===');
  console.log('');
  console.log('In contacts collection:');
  console.log('  Total Yahoo/AOL:', yahooInContacts);
  console.log('    - Sent:', sentYahoo);
  console.log('    - Unsent:', unsentYahoo);
  console.log('');
  console.log('In contacts_yahoo collection:', yahooContacts.size);
  console.log('');
  console.log('Total contacts in main collection:', allContacts.size);
}

countAll().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
