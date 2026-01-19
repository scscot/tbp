#!/usr/bin/env node
/**
 * Analyze the unparseable firmNames to understand patterns
 */

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'teambuilder-plus-fe74d' });
}
const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

async function analyze() {
  const snapshot = await db.collection('preintake_emails').get();

  const messy = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    // Still missing firstName/lastName after parsing
    if (!data.firstName && !data.lastName) {
      messy.push({ id: doc.id, firmName: data.firmName, sent: data.sent === true });
    }
  });

  console.log('=== Analyzing Unparseable firmNames ===\n');
  console.log('Total:', messy.length);

  // Categorize patterns
  const hasPhone = messy.filter(m => /\(\d{3}\)|\d{3}[-.\s]\d{3}[-.\s]\d{4}/.test(m.firmName));
  const hasAddress = messy.filter(m => /\d+\s+[A-Z][a-z]+\s+(St|Ave|Dr|Rd|Blvd|Way|Lane|Ln|Court|Ct|Circle|Cir|Place|Pl|Drive)/i.test(m.firmName));
  const singleWord = messy.filter(m => !m.firmName.includes(' '));
  const hasLaw = messy.filter(m => /\blaw\b/i.test(m.firmName));
  const hasAmpersand = messy.filter(m => m.firmName.includes('&'));
  const hasComma = messy.filter(m => m.firmName.includes(','));
  const hasPLLC = messy.filter(m => /pllc|p\.?l\.?l\.?c/i.test(m.firmName));
  const hasPC = messy.filter(m => /\bp\.?c\.?\b/i.test(m.firmName));

  console.log('\n--- Pattern Analysis ---');
  console.log('Has phone number:', hasPhone.length);
  console.log('Has street address:', hasAddress.length);
  console.log('Single word (no spaces):', singleWord.length);
  console.log('Contains "Law":', hasLaw.length);
  console.log('Contains &:', hasAmpersand.length);
  console.log('Contains comma:', hasComma.length);
  console.log('Contains PLLC:', hasPLLC.length);
  console.log('Contains P.C.:', hasPC.length);

  console.log('\n--- All firmNames (with pattern flags) ---');
  console.log('Legend: 📞=phone, 🏠=address, 1️⃣=single word, ⚖️=Law, &=ampersand\n');

  messy.forEach((m, i) => {
    const flags = [];
    if (/\(\d{3}\)|\d{3}[-.\s]\d{3}[-.\s]\d{4}/.test(m.firmName)) flags.push('📞');
    if (/\d+\s+[A-Z][a-z]+\s+(St|Ave|Dr|Rd|Blvd|Way|Lane|Ln|Court|Ct|Circle|Cir|Place|Pl|Drive)/i.test(m.firmName)) flags.push('🏠');
    if (!m.firmName.includes(' ')) flags.push('1️⃣');
    if (/\blaw\b/i.test(m.firmName)) flags.push('⚖️');
    if (m.firmName.includes('&')) flags.push('&');

    const status = m.sent ? '✉️' : '📭';
    console.log(`${(i+1).toString().padStart(3)}. ${status} ${flags.join('').padEnd(6)} "${m.firmName}"`);
  });

  process.exit(0);
}

analyze().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
