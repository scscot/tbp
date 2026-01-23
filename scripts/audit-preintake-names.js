#!/usr/bin/env node
/**
 * Audit preintake_emails to verify all documents have firstName and lastName
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
    const serviceAccountPath = path.join(__dirname, '..', 'secrets', 'serviceAccountKey.json');
    if (!fs.existsSync(serviceAccountPath)) {
        throw new Error(`Service account key not found at ${serviceAccountPath}`);
    }
    serviceAccount = require(serviceAccountPath);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

async function audit() {
    console.log('Auditing preintake_emails collection...\n');

    // Get total count
    const totalSnapshot = await db.collection('preintake_emails').get();
    console.log('Total documents in preintake_emails:', totalSnapshot.size);

    // Check for missing names
    let missingNames = [];
    for (const doc of totalSnapshot.docs) {
        const data = doc.data();
        if (!data.firstName || !data.lastName) {
            missingNames.push({
                id: doc.id,
                source: data.source,
                email: data.email,
                firstName: data.firstName || '(missing)',
                lastName: data.lastName || '(missing)'
            });
        }
    }

    console.log('Documents missing firstName or lastName:', missingNames.length);

    if (missingNames.length > 0) {
        // Group by source
        const bySource = {};
        for (const doc of missingNames) {
            bySource[doc.source || 'unknown'] = (bySource[doc.source || 'unknown'] || 0) + 1;
        }
        console.log('\nBreakdown by source:');
        for (const [source, count] of Object.entries(bySource).sort((a,b) => b[1] - a[1])) {
            console.log('  ' + source + ':', count);
        }

        console.log('\nSample (first 10):');
        for (const doc of missingNames.slice(0, 10)) {
            console.log('  ' + doc.source + ' | ' + doc.email + ' | firstName: ' + doc.firstName + ' | lastName: ' + doc.lastName);
        }
    } else {
        console.log('\n✓ All documents have firstName and lastName!');
    }

    // Also show count by source
    const bySource = {};
    for (const doc of totalSnapshot.docs) {
        const source = doc.data().source || 'unknown';
        bySource[source] = (bySource[source] || 0) + 1;
    }
    console.log('\nTotal documents by source:');
    for (const [source, count] of Object.entries(bySource).sort((a,b) => b[1] - a[1])) {
        console.log('  ' + source + ':', count);
    }
}

audit().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
