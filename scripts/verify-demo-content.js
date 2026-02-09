#!/usr/bin/env node
/**
 * Verify demo content has all expected fixes.
 */

const admin = require('firebase-admin');
const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, '../secrets/serviceAccountKey.json'), 'utf8'));
const app = initializeApp({
    credential: cert(serviceAccount),
    storageBucket: 'teambuilder-plus-fe74d.firebasestorage.app'
}, 'verify-html-' + Date.now());

const db = getFirestore(app, 'preintake');

async function verify() {
    // Get 5 demo_ready leads to verify
    const snapshot = await db.collection('preintake_leads')
        .where('status', '==', 'demo_ready')
        .limit(5)
        .get();

    console.log(`Verifying ${snapshot.size} demo files...\n`);

    const bucket = getStorage(app).bucket();
    let allPass = true;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const expectedFirmName = data.firmName || data.analysis?.firmName || 'Unknown';
        console.log(`\n--- ${doc.id} ---`);
        console.log(`Expected Firm: ${expectedFirmName}`);

        try {
            const file = bucket.file(`preintake-demos/${doc.id}/index.html`);
            const [content] = await file.download();
            const html = content.toString('utf8');

            console.log(`File size: ${html.length} bytes`);

            // Check for key fixes
            const checks = [
                { name: 'Button align-items: center', pattern: /align-items:\s*center/, shouldExist: true },
                { name: 'No "Powered by PreIntake"', pattern: /Powered by PreIntake/, shouldExist: false },
                { name: 'skip_onboarding logic', pattern: /skip_onboarding/, shouldExist: true },
                { name: 'No {{FIRM_NAME}} placeholder', pattern: /\{\{FIRM_NAME\}\}/, shouldExist: false },
                { name: 'No {{FIRM_NAME_JS}} placeholder', pattern: /\{\{FIRM_NAME_JS\}\}/, shouldExist: false },
                { name: 'No {{WEBHOOK_URL}} placeholder', pattern: /\{\{WEBHOOK_URL\}\}/, shouldExist: false }
            ];

            for (const check of checks) {
                const found = check.pattern.test(html);
                const pass = check.shouldExist ? found : !found;
                const status = pass ? '✅' : '❌';
                if (!pass) allPass = false;
                console.log(`  ${status} ${check.name}`);
            }

            // Look for firm name in CONFIG object
            const configFirmMatch = html.match(/FIRM_NAME:\s*['"]([^'"]+)['"]/);
            if (configFirmMatch) {
                console.log(`  ✅ CONFIG.FIRM_NAME: "${configFirmMatch[1]}"`);
            } else {
                console.log(`  ⚠️  CONFIG.FIRM_NAME not found (checking other patterns)`);
                // Try other patterns
                const altMatch = html.match(/firmName['":\s]+['"]([^'"]+)['"]/);
                if (altMatch) {
                    console.log(`  ✅ firmName found: "${altMatch[1]}"`);
                }
            }

            // Check "Start My Evaluation" button exists
            const hasStartBtn = html.includes('Start My Evaluation') || html.includes('Start Your Evaluation');
            console.log(`  ${hasStartBtn ? '✅' : '❌'} Start Evaluation button text`);
            if (!hasStartBtn) allPass = false;

        } catch (err) {
            console.log(`  ❌ Error: ${err.message}`);
            allPass = false;
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log(allPass ? '✅ All demos verified successfully!' : '❌ Some demos have issues');

    process.exit(allPass ? 0 : 1);
}

verify();
