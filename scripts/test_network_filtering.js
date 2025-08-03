const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccount = require('../secrets/serviceAccountKey.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function testNetworkFiltering(adminUserId) {
  console.log(`🧪 NETWORK FILTER TEST: Testing filtering logic for admin ${adminUserId}`);
  
  try {
    // Step 1: Get admin user info
    console.log(`\n📋 STEP 1: Getting admin user info...`);
    const adminDoc = await db.collection('users').doc(adminUserId).get();
    
    if (!adminDoc.exists) {
      console.log(`❌ Admin user ${adminUserId} not found`);
      return;
    }
    
    const adminData = adminDoc.data();
    console.log(`✅ Admin: ${adminData.firstName} ${adminData.lastName}`);
    console.log(`   - Level: ${adminData.level}`);
    console.log(`   - Role: ${adminData.role}`);
    
    // Step 2: Test Direct Sponsors query (should match Firebase Functions logic)
    console.log(`\n📋 STEP 2: Testing Direct Sponsors filter...`);
    const directSponsorsQuery = await db.collection('users')
      .where('sponsor_id', '==', adminUserId)
      .get();
    
    console.log(`✅ Direct Sponsors found: ${directSponsorsQuery.size}`);
    
    if (directSponsorsQuery.size > 0) {
      console.log(`   Sample direct sponsors:`);
      directSponsorsQuery.docs.slice(0, 3).forEach((doc, index) => {
        const userData = doc.data();
        console.log(`   ${index + 1}. ${userData.firstName} ${userData.lastName} (Level: ${userData.level})`);
      });
    }
    
    // Step 3: Test Joined Members query
    console.log(`\n📋 STEP 3: Testing Joined Members filter...`);
    const joinedMembersQuery = await db.collection('users')
      .where('upline_refs', 'array-contains', adminUserId)
      .where('biz_join_date', '!=', null)
      .get();
    
    console.log(`✅ Joined Members found: ${joinedMembersQuery.size}`);
    
    if (joinedMembersQuery.size > 0) {
      console.log(`   Sample joined members:`);
      joinedMembersQuery.docs.slice(0, 3).forEach((doc, index) => {
        const userData = doc.data();
        const joinDate = userData.biz_join_date ? userData.biz_join_date.toDate() : 'null';
        console.log(`   ${index + 1}. ${userData.firstName} ${userData.lastName} (Joined: ${joinDate})`);
      });
    }
    
    // Step 4: Test All Members query (for comparison)
    console.log(`\n📋 STEP 4: Testing All Members query...`);
    const allMembersQuery = await db.collection('users')
      .where('upline_refs', 'array-contains', adminUserId)
      .limit(10)
      .get();
    
    console.log(`✅ All Members sample: ${allMembersQuery.size} (limited to 10)`);
    
    // Step 5: Analyze the level distribution
    console.log(`\n📋 STEP 5: Analyzing level distribution...`);
    const levelCounts = {};
    
    allMembersQuery.docs.forEach(doc => {
      const userData = doc.data();
      const level = userData.level;
      levelCounts[level] = (levelCounts[level] || 0) + 1;
    });
    
    console.log(`   Level distribution (sample):`, levelCounts);
    
    // Step 6: Check if the old level-based logic would work
    console.log(`\n📋 STEP 6: Testing old level-based logic...`);
    const adminLevel = adminData.level;
    const levelOneMembers = allMembersQuery.docs.filter(doc => {
      const userData = doc.data();
      return (userData.level - adminLevel) === 1;
    });
    
    console.log(`   Old logic (level - ${adminLevel} == 1): ${levelOneMembers.length} members`);
    console.log(`   New logic (sponsor_id == ${adminUserId}): ${directSponsorsQuery.size} members`);
    
    if (levelOneMembers.length !== directSponsorsQuery.size) {
      console.log(`   ⚠️  DIFFERENCE FOUND: Level-based vs sponsor_id-based filtering gives different results`);
      console.log(`   This confirms the fix was necessary!`);
    } else {
      console.log(`   ✅ Both methods give same result`);
    }
    
    console.log(`\n🎉 SUMMARY:`);
    console.log(`   - Direct Sponsors (corrected): ${directSponsorsQuery.size}`);
    console.log(`   - Joined Members: ${joinedMembersQuery.size}`);
    console.log(`   - All Members (sample): ${allMembersQuery.size}`);
    console.log(`   - Fix should resolve the filtering issue!`);
    
  } catch (error) {
    console.error(`❌ Error in network filtering test:`, error);
  }
}

// Get admin user ID from command line arguments
const adminUserId = process.argv[2];

if (!adminUserId) {
  console.log('Usage: node test_network_filtering.js <adminUserId>');
  console.log('Example: node test_network_filtering.js KJ8uFnlhKhWgBa4NVcwT');
  process.exit(1);
}

testNetworkFiltering(adminUserId)
  .then(() => {
    console.log('\nTest complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
