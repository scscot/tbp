#!/usr/bin/env node

/**
 * Analyze Practice Areas in preintake_emails Collection
 *
 * Queries Firestore to determine the top 25-30 practice areas
 * for creating dynamic sample lead examples on the homepage.
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../secrets/serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Use the preintake database
const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

async function analyzePracticeAreas() {
  console.log('Analyzing practice areas in preintake_emails collection...\n');

  const practiceAreaCounts = {};
  let totalContacts = 0;
  let contactsWithPracticeArea = 0;

  // Query all documents (we'll batch this)
  const snapshot = await db.collection('preintake_emails').get();

  snapshot.forEach(doc => {
    totalContacts++;
    const data = doc.data();

    // Practice area field name varies - check common field names
    const practiceArea = data.practiceArea || data.practice_area || data.practiceAreas || data.primaryPracticeArea;

    if (practiceArea) {
      contactsWithPracticeArea++;

      // Handle if it's an array
      const areas = Array.isArray(practiceArea) ? practiceArea : [practiceArea];

      areas.forEach(area => {
        const normalized = (area || '').trim();
        if (normalized) {
          practiceAreaCounts[normalized] = (practiceAreaCounts[normalized] || 0) + 1;
        }
      });
    }
  });

  // Sort by count descending
  const sortedAreas = Object.entries(practiceAreaCounts)
    .sort((a, b) => b[1] - a[1]);

  console.log(`Total contacts: ${totalContacts}`);
  console.log(`Contacts with practice area: ${contactsWithPracticeArea} (${((contactsWithPracticeArea/totalContacts)*100).toFixed(1)}%)\n`);

  console.log('Top 40 Practice Areas:\n');
  console.log('Rank | Count | Practice Area');
  console.log('-----|-------|---------------');

  sortedAreas.slice(0, 40).forEach(([area, count], index) => {
    const rank = (index + 1).toString().padStart(2);
    const countStr = count.toString().padStart(5);
    console.log(`${rank}   | ${countStr} | ${area}`);
  });

  console.log('\n--- Summary for Plan ---\n');
  console.log('Unique practice areas found:', sortedAreas.length);

  // Group similar areas
  console.log('\nTop 30 areas (for sample lead generation):');
  sortedAreas.slice(0, 30).forEach(([area, count], index) => {
    console.log(`${index + 1}. ${area} (${count} contacts)`);
  });

  process.exit(0);
}

analyzePracticeAreas().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
