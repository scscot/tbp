const { db } = require('./shared/utilities');

async function updateEarlyAdopterLimit(newLimit) {
  try {
    const docRef = db.collection('settings').doc('earlyAdopter');

    // Check if document exists first
    const doc = await docRef.get();
    if (!doc.exists) {
      console.error('❌ Early adopter document does not exist. Run init_early_adopter.js first.');
      process.exit(1);
    }

    const currentData = doc.data();
    console.log('📊 Current settings:', currentData);

    // Update only the limit
    await docRef.update({
      limit: newLimit
    });

    console.log('✅ Early adopter limit updated successfully');
    console.log(`   Old limit: ${currentData.limit}`);
    console.log(`   New limit: ${newLimit}`);
    console.log(`   Total granted so far: ${currentData.totalGranted || 0}`);
    console.log(`   Remaining spots: ${newLimit - (currentData.totalGranted || 0)}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating limit:', error);
    process.exit(1);
  }
}

// Get limit from command line argument
const newLimit = parseInt(process.argv[2]);

if (isNaN(newLimit) || newLimit < 1) {
  console.error('❌ Usage: node update_early_adopter_limit.js <new_limit>');
  console.error('   Example: node update_early_adopter_limit.js 100');
  process.exit(1);
}

updateEarlyAdopterLimit(newLimit);
