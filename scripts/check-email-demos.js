#!/usr/bin/env node
/**
 * Check preintake_emails collection for website URLs and demo generation status
 */

const admin = require('firebase-admin');
const serviceAccount = require('../secrets/serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://teambuilder-plus-fe74d.firebaseio.com'
});

const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

async function check() {
    // Get recent sent emails - simpler query to avoid index requirement
    const snapshot = await db.collection('preintake_emails')
        .orderBy('sentTimestamp', 'desc')
        .limit(50)
        .get();

    let withWebsite = 0;
    let withoutWebsite = 0;
    let withDemoGenerated = 0;

    console.log('Recent 30 sent emails:');
    console.log('='.repeat(80));

    const noWebsiteList = [];
    const withWebsiteNoDemoList = [];
    let sentCount = 0;

    snapshot.forEach(doc => {
        const data = doc.data();
        // Only count sent emails
        if (!data.sent) return;
        sentCount++;

        const hasWebsite = Boolean(data.website);
        const hasDemoGen = Boolean(data.demoGenerated);

        if (hasWebsite) {
            withWebsite++;
            if (!hasDemoGen) {
                withWebsiteNoDemoList.push({
                    firmName: data.firmName,
                    email: data.email,
                    website: data.website
                });
            }
        } else {
            withoutWebsite++;
            noWebsiteList.push({
                firmName: data.firmName,
                email: data.email
            });
        }
        if (hasDemoGen) withDemoGenerated++;
    });

    console.log('\nContacts WITHOUT website URL:');
    noWebsiteList.forEach(c => {
        console.log(`  - ${c.firmName} | ${c.email}`);
    });

    console.log('\nContacts WITH website but NO demo generated:');
    withWebsiteNoDemoList.forEach(c => {
        console.log(`  - ${c.firmName} | ${c.website}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log(`Summary of last ${sentCount} sent emails:`);
    console.log(`   With website URL: ${withWebsite}`);
    console.log(`   Without website URL: ${withoutWebsite}`);
    console.log(`   Demo generated: ${withDemoGenerated}`);
    console.log(`   Demo NOT generated: ${sentCount - withDemoGenerated}`);

    process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
