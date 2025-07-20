// scripts/migrate_profile_completion.js

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

console.log(`\n🚀 Starting profile completion migration in ${isDryRun ? 'DRY-RUN' : 'UPDATE'} mode...\n`);

(async () => {
    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.get();
        
        if (snapshot.empty) {
            console.log('❌ No users found in database');
            return;
        }

        console.log(`📊 Found ${snapshot.size} users to process\n`);
        
        let updatedCount = 0;
        let completedCount = 0;
        let incompleteCount = 0;
        let alreadyCorrectCount = 0;
        let errorCount = 0;

        for (const doc of snapshot.docs) {
            try {
                const userData = doc.data();
                const userId = doc.id;
                const photoUrl = userData.photoUrl;
                
                // Determine if profile is complete based on photoUrl
                const isProfileComplete = photoUrl && photoUrl.trim() !== '';
                
                // Check current value
                const currentIsProfileComplete = userData.isProfileComplete;
                
                if (currentIsProfileComplete !== isProfileComplete) {
                    if (isDryRun) {
                        if (isProfileComplete) {
                            console.log(`✅ DRY-RUN COMPLETE: ${userId} (${userData.firstName} ${userData.lastName}) - Would set isProfileComplete: true`);
                            completedCount++;
                        } else {
                            console.log(`⚠️  DRY-RUN INCOMPLETE: ${userId} (${userData.firstName} ${userData.lastName}) - Would set isProfileComplete: false`);
                            incompleteCount++;
                        }
                        updatedCount++;
                    } else if (isUpdate) {
                        await usersRef.doc(userId).update({
                            isProfileComplete: isProfileComplete
                        });
                        
                        if (isProfileComplete) {
                            console.log(`✅ UPDATED COMPLETE: ${userId} (${userData.firstName} ${userData.lastName}) - Set isProfileComplete: true`);
                            completedCount++;
                        } else {
                            console.log(`⚠️  UPDATED INCOMPLETE: ${userId} (${userData.firstName} ${userData.lastName}) - Set isProfileComplete: false`);
                            incompleteCount++;
                        }
                        updatedCount++;
                    }
                } else {
                    console.log(`⏭️  ALREADY CORRECT: ${userId} (${userData.firstName} ${userData.lastName}) - isProfileComplete: ${isProfileComplete}`);
                    alreadyCorrectCount++;
                }
                
            } catch (error) {
                console.error(`❌ Error processing user ${doc.id}:`, error);
                errorCount++;
            }
        }

        console.log(`\n🎉 ${isDryRun ? 'Dry run' : 'Migration'} completed!`);
        console.log('📊 Summary:');
        console.log(`   Total users processed: ${snapshot.size}`);
        console.log(`   Users ${isDryRun ? 'would be updated' : 'updated'}: ${updatedCount}`);
        console.log(`   Complete profiles: ${completedCount}`);
        console.log(`   Incomplete profiles: ${incompleteCount}`);
        console.log(`   Already correct: ${alreadyCorrectCount}`);
        console.log(`   Errors: ${errorCount}\n`);
        
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
})();
