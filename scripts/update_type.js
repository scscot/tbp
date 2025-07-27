// scripts/update_type.js

const serviceAccount = require('../secrets/serviceAccountKey.json');
const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isUpdate = args.includes('--update');

if (!isDryRun && !isUpdate) {
    console.error("\n❌ Please provide either '--dry-run' or '--update' as an argument.\n");
    process.exit(1);
}

console.log(`\n🚀 Starting ${isDryRun ? 'DRY-RUN' : 'UPDATE'} mode to convert currentPartner from string to boolean...\n`);

(async () => {
    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.get();
        let convertedTrueCount = 0;
        let convertedFalseCount = 0;
        let alreadyBooleanCount = 0;
        let noFieldCount = 0;

        console.log(`📊 Found ${snapshot.docs.length} user documents to process\n`);

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const uid = doc.id;
            const currentPartnerValue = data.currentPartner;
            const currentType = typeof currentPartnerValue;

            let targetValue = null;
            let needsUpdate = false;

            // Determine conversion logic - STRING TO BOOLEAN
            if (currentPartnerValue === undefined || currentPartnerValue === null) {
                // Field doesn't exist or is null - set default
                targetValue = false;
                needsUpdate = true;
                noFieldCount++;
            } else if (currentType === 'string') {
                // Convert string to boolean
                if (currentPartnerValue.toLowerCase() === 'true') {
                    targetValue = true;
                    convertedTrueCount++;
                } else {
                    targetValue = false;
                    convertedFalseCount++;
                }
                needsUpdate = true;
            } else if (currentType === 'boolean') {
                // Already a boolean - no conversion needed
                needsUpdate = false;
                alreadyBooleanCount++;
            } else {
                // Unexpected type - convert to boolean anyway (truthy/falsy logic)
                targetValue = Boolean(currentPartnerValue);
                needsUpdate = true;
                console.log(`⚠️  UNEXPECTED TYPE: ${uid} has currentPartner type: ${currentType}, value: ${currentPartnerValue}`);
            }

            if (isDryRun) {
                if (!needsUpdate) {
                    console.log(`✅ DRY-RUN SKIP: ${uid} (currentPartner already boolean: ${currentPartnerValue})`);
                } else {
                    console.log(`🔄 DRY-RUN CONVERT: ${uid} (${currentType}: "${currentPartnerValue}" → boolean: ${targetValue})`);
                }
            } else if (isUpdate) {
                if (!needsUpdate) {
                    console.log(`✅ SKIP: ${uid} (currentPartner already boolean: ${currentPartnerValue})`);
                } else {
                    await usersRef.doc(uid).update({
                        currentPartner: targetValue
                    });
                    console.log(`🔄 CONVERTED: ${uid} (${currentType}: "${currentPartnerValue}" → boolean: ${targetValue})`);
                }
            }
        }

        console.log(`\n📈 ${isDryRun ? 'Dry run' : 'Conversion'} complete:`);
        console.log(`   ${convertedTrueCount} users ${isDryRun ? 'would be converted' : 'converted'} from string "true" → boolean true`);
        console.log(`   ${convertedFalseCount} users ${isDryRun ? 'would be converted' : 'converted'} from string "false" → boolean false`);
        console.log(`   ${noFieldCount} users ${isDryRun ? 'would get default' : 'got default'} value false (field missing)`);
        console.log(`   ${alreadyBooleanCount} users already had boolean type (no change needed)`);
        console.log(`   ${snapshot.docs.length} total users processed\n`);

        console.log(`📋 Conversion rules applied:`);
        console.log(`   string "true" → boolean true`);
        console.log(`   string "false" → boolean false`);
        console.log(`   undefined/null → boolean false`);
        console.log(`   existing booleans → no change\n`);

    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
})();