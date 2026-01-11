const admin = require('firebase-admin');
const axios = require('axios');
const path = require('path');
const ZEROBOUNCE_API_KEY = '7f667f9f01484135adc1c22ea5932bad';

const serviceAccountPath = path.join(__dirname, '../secrets/serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccountPath) });
const db = admin.firestore();

async function test() {
  const ref = db.collection('emailCampaigns').doc('master').collection('contacts');
  const snapshot = await ref.where('sent', '==', true).get();

  let verified = 0;
  const unverified = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.zbVerified) {
      verified++;
    } else {
      unverified.push(data.email);
    }
  }

  console.log('Total sent:', snapshot.size);
  console.log('Verified (zbVerified=true):', verified);
  console.log('Unverified:', unverified.length);

  if (unverified.length === 0) {
    console.log('All emails verified!');
    process.exit(0);
  }

  // Test with first unverified email
  const testEmail = unverified[0];
  console.log('\nTesting credit consumption with:', testEmail);

  const before = await axios.get('https://api.zerobounce.net/v2/getcredits', { params: { api_key: ZEROBOUNCE_API_KEY }});
  console.log('Credits BEFORE:', before.data.Credits);

  const result = await axios.get('https://api.zerobounce.net/v2/validate', {
    params: { api_key: ZEROBOUNCE_API_KEY, email: testEmail, ip_address: '' }
  });
  console.log('Result:', result.data.status, result.data.sub_status || '');

  const after = await axios.get('https://api.zerobounce.net/v2/getcredits', { params: { api_key: ZEROBOUNCE_API_KEY }});
  console.log('Credits AFTER:', after.data.Credits);
  console.log('Credits consumed:', parseInt(before.data.Credits) - parseInt(after.data.Credits));
}

test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
