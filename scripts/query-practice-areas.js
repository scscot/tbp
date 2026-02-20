#!/usr/bin/env node
/**
 * Query preintake_emails collection for distinct practiceArea values with counts
 * This helps determine which practice areas need specialized button detection
 */

const admin = require('firebase-admin');
const serviceAccount = require('../secrets/serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// Use the preintake database
const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

async function queryPracticeAreas() {
    console.log('Querying preintake_emails for practice area distribution...\n');

    // Get all documents (we'll aggregate in memory since Firestore doesn't have GROUP BY)
    const snapshot = await db.collection('preintake_emails').get();

    const practiceAreaCounts = {};
    let totalCount = 0;
    let nullCount = 0;

    snapshot.forEach(doc => {
        const data = doc.data();
        totalCount++;

        const practiceArea = data.practiceArea;
        if (!practiceArea) {
            nullCount++;
            return;
        }

        if (!practiceAreaCounts[practiceArea]) {
            practiceAreaCounts[practiceArea] = 0;
        }
        practiceAreaCounts[practiceArea]++;
    });

    // Sort by count descending
    const sorted = Object.entries(practiceAreaCounts)
        .sort((a, b) => b[1] - a[1]);

    console.log('='.repeat(70));
    console.log('PRACTICE AREA DISTRIBUTION');
    console.log('='.repeat(70));
    console.log(`Total contacts: ${totalCount.toLocaleString()}`);
    console.log(`With practice area: ${(totalCount - nullCount).toLocaleString()}`);
    console.log(`Without practice area: ${nullCount.toLocaleString()}`);
    console.log('='.repeat(70));
    console.log('');
    console.log('Rank | Practice Area                              | Count    | %');
    console.log('-'.repeat(70));

    sorted.forEach(([area, count], index) => {
        const pct = ((count / totalCount) * 100).toFixed(1);
        const rank = String(index + 1).padStart(4);
        const areaStr = area.padEnd(42);
        const countStr = count.toLocaleString().padStart(8);
        console.log(`${rank} | ${areaStr} | ${countStr} | ${pct}%`);
    });

    console.log('-'.repeat(70));
    console.log('');

    // Identify gaps - practice areas without specialized button detection
    const specializedAreas = [
        'Personal Injury',
        'Immigration',
        'Family Law',
        'Bankruptcy',
        'Criminal Defense',
        'Tax/IRS',
        'Estate Planning'
    ];

    console.log('='.repeat(70));
    console.log('HIGH-VOLUME GAPS (need specialized button detection)');
    console.log('='.repeat(70));

    const gaps = sorted.filter(([area, count]) => {
        return !specializedAreas.some(s => area.toLowerCase().includes(s.toLowerCase())) && count >= 100;
    });

    if (gaps.length === 0) {
        console.log('No high-volume gaps found (all areas with 100+ contacts have specialized detection)');
    } else {
        gaps.forEach(([area, count], index) => {
            console.log(`${index + 1}. ${area}: ${count.toLocaleString()} contacts`);
        });
    }

    console.log('');
}

queryPracticeAreas()
    .then(() => {
        console.log('Done.');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
