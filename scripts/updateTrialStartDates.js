const admin = require("firebase-admin");
const serviceAccount = require('../secrets/serviceAccountKey.json');

// Initialize Admin SDK using credentials from secrets directory
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const EXCLUDED_UID = "KJ8uFnlhKhWgBa4NVcwT";

async function updateTrialStartDates() {
    try {
        console.log('🔄 Starting trial start date update process...');
        
        // Get all users from Firestore
        const usersSnapshot = await db.collection('users').get();
        console.log(`📊 Found ${usersSnapshot.size} total users`);
        
        if (usersSnapshot.empty) {
            console.log('⚠️  No users found in the database');
            return;
        }

        // Filter out the excluded UID
        const usersToUpdate = usersSnapshot.docs.filter(doc => doc.id !== EXCLUDED_UID);
        console.log(`✅ ${usersToUpdate.length} users will be updated (excluding ${EXCLUDED_UID})`);
        
        if (usersToUpdate.length === 0) {
            console.log('⚠️  No users to update after filtering');
            return;
        }

        // Current timestamp
        const now = admin.firestore.FieldValue.serverTimestamp();
        console.log(`🕒 Setting trialStartDate to: ${new Date().toISOString()}`);

        // Batch operations for better performance
        const batchSize = 500; // Firestore batch limit
        const batches = [];
        
        for (let i = 0; i < usersToUpdate.length; i += batchSize) {
            batches.push(usersToUpdate.slice(i, i + batchSize));
        }

        console.log(`📦 Processing ${batches.length} batch(es)...`);

        let totalUpdated = 0;
        let totalErrors = 0;

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = db.batch();
            const currentBatch = batches[batchIndex];
            
            console.log(`⬆️  Processing batch ${batchIndex + 1}/${batches.length} (${currentBatch.length} users)...`);

            // Add updates to batch
            currentBatch.forEach(userDoc => {
                const userRef = db.collection('users').doc(userDoc.id);
                batch.update(userRef, {
                    trialStartDate: now
                });
            });

            try {
                // Execute batch
                await batch.commit();
                totalUpdated += currentBatch.length;
                console.log(`✅ Batch ${batchIndex + 1} completed: ${currentBatch.length} users updated`);
                
                // Small delay between batches to be nice to Firestore
                if (batchIndex < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (error) {
                console.error(`❌ Error in batch ${batchIndex + 1}:`, error.message);
                totalErrors += currentBatch.length;
            }
        }

        // Summary
        console.log('\n📋 Update Summary:');
        console.log(`   Total users found: ${usersSnapshot.size}`);
        console.log(`   Excluded users: 1 (${EXCLUDED_UID})`);
        console.log(`   Users to update: ${usersToUpdate.length}`);
        console.log(`   Successfully updated: ${totalUpdated}`);
        console.log(`   Errors: ${totalErrors}`);
        console.log(`   Update timestamp: ${new Date().toISOString()}`);
        
        if (totalUpdated > 0) {
            console.log('\n🎉 Trial start date update completed successfully!');
        } else {
            console.log('\n⚠️  No users were updated');
        }

    } catch (error) {
        console.error('💥 Fatal error during update process:', error);
        process.exit(1);
    }
}

// Confirmation prompt
function promptConfirmation() {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        console.log('⚠️  WARNING: This will update trialStartDate for ALL users (except one excluded UID)');
        console.log(`   Excluded UID: ${EXCLUDED_UID}`);
        console.log('   This action cannot be undone easily.\n');
        
        rl.question('Are you sure you want to proceed? (yes/no): ', (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
        });
    });
}

// Main execution
async function main() {
    try {
        console.log('🚀 Firestore Trial Start Date Update Script\n');
        
        // Get confirmation from user
        const confirmed = await promptConfirmation();
        
        if (!confirmed) {
            console.log('❌ Operation cancelled by user');
            process.exit(0);
        }
        
        console.log('\n✅ Confirmed. Starting update process...\n');
        await updateTrialStartDates();
        
    } catch (error) {
        console.error('💥 Script failed:', error.message);
        process.exit(1);
    } finally {
        // Clean exit
        process.exit(0);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    updateTrialStartDates
};