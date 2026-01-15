#!/usr/bin/env node
/**
 * Diagnostic script to analyze FL Bar data in preintake_emails
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase
const serviceAccountPath = path.join(__dirname, '..', 'secrets', 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error('Service account key not found');
    process.exit(1);
}
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

async function main() {
    console.log('FL Bar Data Diagnostic');
    console.log('======================\n');

    // Get ALL documents in preintake_emails
    const allDocs = await db.collection('preintake_emails').get();
    console.log(`Total documents in preintake_emails: ${allDocs.size}\n`);

    // Count by source
    const bySource = {};
    // Count by practiceArea
    const byPracticeArea = {};
    // Count by source + practiceArea
    const bySourceAndPracticeArea = {};
    // Count FL Bar without practiceArea
    let flbarNoPracticeArea = 0;
    // Sample some FL Bar records
    const flbarSamples = [];

    allDocs.forEach(doc => {
        const data = doc.data();
        const source = data.source || 'no_source';
        const practiceArea = data.practiceArea || 'no_practiceArea';

        // By source
        bySource[source] = (bySource[source] || 0) + 1;

        // By practiceArea
        byPracticeArea[practiceArea] = (byPracticeArea[practiceArea] || 0) + 1;

        // By source + practiceArea
        const key = `${source} | ${practiceArea}`;
        bySourceAndPracticeArea[key] = (bySourceAndPracticeArea[key] || 0) + 1;

        // Check FL Bar without practiceArea
        if (source === 'flbar' && !data.practiceArea) {
            flbarNoPracticeArea++;
        }

        // Sample FL Bar records
        if (source === 'flbar' && flbarSamples.length < 5) {
            flbarSamples.push({
                id: doc.id,
                email: data.email,
                practiceArea: data.practiceArea,
                barNumber: data.barNumber,
                firstName: data.firstName,
                lastName: data.lastName
            });
        }
    });

    console.log('By Source:');
    console.log('-----------');
    Object.entries(bySource).sort((a, b) => b[1] - a[1]).forEach(([source, count]) => {
        console.log(`  ${source}: ${count}`);
    });

    console.log('\nBy Practice Area:');
    console.log('------------------');
    Object.entries(byPracticeArea).sort((a, b) => b[1] - a[1]).forEach(([area, count]) => {
        console.log(`  ${area}: ${count}`);
    });

    console.log('\nBy Source + Practice Area:');
    console.log('---------------------------');
    Object.entries(bySourceAndPracticeArea).sort((a, b) => b[1] - a[1]).forEach(([key, count]) => {
        console.log(`  ${key}: ${count}`);
    });

    console.log(`\nFL Bar contacts without practiceArea: ${flbarNoPracticeArea}`);

    console.log('\nSample FL Bar records:');
    console.log('-----------------------');
    flbarSamples.forEach((sample, i) => {
        console.log(`  ${i + 1}. ${sample.firstName} ${sample.lastName}`);
        console.log(`     Email: ${sample.email}`);
        console.log(`     Practice Area: ${sample.practiceArea || '(none)'}`);
        console.log(`     Bar Number: ${sample.barNumber || '(none)'}`);
    });

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
