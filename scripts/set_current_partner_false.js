// scripts/set_current_partner_false.js

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

console.log(`\n🚀 Starting ${isDryRun ? 'DRY-RUN' : 'UPDATE'} mode to set currentPartner based on business criteria...\n`);

(async () => {
    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.get();
        let setToTrueCount = 0;
        let setToFalseCount = 0;
        let noChangeCount = 0;

        console.log(`📊 Found ${snapshot.docs.length} user documents to process\n`);

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const uid = doc.id;
            const currentPartnerValue = data.currentPartner;
            const bizOppRefUrl = data.biz_opp_ref_url;
            const totalTeamCount = data.totalTeamCount || 0;

            // Determine if user should be currentPartner = true
            const shouldBeCurrentPartner = bizOppRefUrl != null &&
                bizOppRefUrl !== '' &&
                totalTeamCount < 20;

            const targetValue = shouldBeCurrentPartner;

            if (isDryRun) {
                if (currentPartnerValue === targetValue) {
                    console.log(`✅ DRY-RUN SKIP: ${uid} (currentPartner already ${targetValue}) - bizOppRefUrl: ${bizOppRefUrl ? 'exists' : 'null'}, totalTeam: ${totalTeamCount}`);
                    noChangeCount++;
                } else {
                    console.log(`🔄 DRY-RUN UPDATE: ${uid} (currentPartner: ${currentPartnerValue} → ${targetValue}) - bizOppRefUrl: ${bizOppRefUrl ? 'exists' : 'null'}, totalTeam: ${totalTeamCount}`);
                    if (targetValue) {
                        setToTrueCount++;
                    } else {
                        setToFalseCount++;
                    }
                }
            } else if (isUpdate) {
                if (currentPartnerValue === targetValue) {
                    console.log(`✅ SKIP: ${uid} (currentPartner already ${targetValue}) - bizOppRefUrl: ${bizOppRefUrl ? 'exists' : 'null'}, totalTeam: ${totalTeamCount}`);
                    noChangeCount++;
                } else {
                    await usersRef.doc(uid).update({
                        currentPartner: targetValue
                    });
                    console.log(`🔄 UPDATED: ${uid} (currentPartner: ${currentPartnerValue} → ${targetValue}) - bizOppRefUrl: ${bizOppRefUrl ? 'exists' : 'null'}, totalTeam: ${totalTeamCount}`);
                    if (targetValue) {
                        setToTrueCount++;
                    } else {
                        setToFalseCount++;
                    }
                }
            }
        }

        console.log(`\n📈 ${isDryRun ? 'Dry run' : 'Update'} complete:`);
        console.log(`   ${setToTrueCount} users ${isDryRun ? 'would be set' : 'set'} to currentPartner: true`);
        console.log(`   ${setToFalseCount} users ${isDryRun ? 'would be set' : 'set'} to currentPartner: false`);
        console.log(`   ${noChangeCount} users required no changes`);
        console.log(`   ${snapshot.docs.length} total users processed\n`);

        console.log(`📋 Criteria applied:`);
        console.log(`   currentPartner = true: biz_opp_ref_url exists AND totalTeamCount < 20`);
        console.log(`   currentPartner = false: all other cases\n`);

    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
})();