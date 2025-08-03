const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccount = require('../secrets/serviceAccountKey.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function testIntelligentPagination(adminUserId) {
  console.log(`🧪 PAGINATION TEST: Testing intelligent pagination for admin ${adminUserId}`);
  
  try {
    // Step 1: Get network counts to determine pagination strategy
    console.log(`\n📋 STEP 1: Getting network counts...`);
    
    const networkSnapshot = await db.collection('users')
      .where('upline_refs', 'array-contains', adminUserId)
      .get();
    
    const totalNetworkSize = networkSnapshot.size;
    console.log(`✅ Total network size: ${totalNetworkSize}`);
    
    // Step 2: Determine what pagination strategy should be used
    console.log(`\n📋 STEP 2: Determining optimal pagination strategy...`);
    
    let strategy, pageSize;
    if (totalNetworkSize <= 2000) {
      strategy = 'Load All';
      pageSize = totalNetworkSize + 100;
      console.log(`✅ Strategy: ${strategy} (${pageSize} limit)`);
    } else if (totalNetworkSize <= 5000) {
      strategy = 'Moderate Pagination';
      pageSize = 1500;
      console.log(`✅ Strategy: ${strategy} (${pageSize} per page)`);
    } else {
      strategy = 'Aggressive Pagination';
      pageSize = 1000;
      console.log(`✅ Strategy: ${strategy} (${pageSize} per page)`);
    }
    
    // Step 3: Test pagination by simulating the first few pages
    console.log(`\n📋 STEP 3: Testing pagination simulation...`);
    
    let currentOffset = 0;
    let totalLoaded = 0;
    let pageNumber = 1;
    const maxPagesToTest = 3;
    
    while (pageNumber <= maxPagesToTest && currentOffset < totalNetworkSize) {
      console.log(`\n   📄 Page ${pageNumber}:`);
      
      const pageQuery = await db.collection('users')
        .where('upline_refs', 'array-contains', adminUserId)
        .orderBy('createdAt', 'desc')
        .limit(pageSize)
        .offset(currentOffset)
        .get();
      
      const pageMembers = pageQuery.docs;
      totalLoaded += pageMembers.length;
      
      console.log(`   ✅ Loaded: ${pageMembers.length} members`);
      console.log(`   ✅ Total loaded so far: ${totalLoaded}/${totalNetworkSize}`);
      console.log(`   ✅ Has more data: ${totalLoaded < totalNetworkSize}`);
      
      // Show sample members from this page
      if (pageMembers.length > 0) {
        console.log(`   📝 Sample members from page ${pageNumber}:`);
        pageMembers.slice(0, 3).forEach((doc, index) => {
          const userData = doc.data();
          console.log(`      ${index + 1}. ${userData.firstName} ${userData.lastName} (Level: ${userData.level})`);
        });
      }
      
      currentOffset += pageMembers.length;
      pageNumber++;
      
      // Break if we got fewer members than expected (end of data)
      if (pageMembers.length < pageSize) {
        console.log(`   ℹ️  Reached end of data (got ${pageMembers.length} < ${pageSize})`);
        break;
      }
    }
    
    // Step 4: Test specific filtering scenarios
    console.log(`\n📋 STEP 4: Testing filtering scenarios...`);
    
    // Test Direct Sponsors
    const directSponsorsQuery = await db.collection('users')
      .where('sponsor_id', '==', adminUserId)
      .get();
    
    console.log(`✅ Direct Sponsors: ${directSponsorsQuery.size} found`);
    
    // Test Joined Members
    const joinedMembersQuery = await db.collection('users')
      .where('upline_refs', 'array-contains', adminUserId)
      .where('biz_join_date', '!=', null)
      .get();
    
    console.log(`✅ Joined Members: ${joinedMembersQuery.size} found`);
    
    // Step 5: Performance analysis
    console.log(`\n📋 STEP 5: Performance analysis...`);
    
    const memoryEstimate = totalNetworkSize * 2; // Rough estimate: 2KB per UserModel
    const networkTransferEstimate = totalNetworkSize * 1; // Rough estimate: 1KB per user over network
    
    console.log(`📊 Performance estimates:`);
    console.log(`   - Memory usage: ~${memoryEstimate}KB (${(memoryEstimate/1024).toFixed(1)}MB)`);
    console.log(`   - Network transfer: ~${networkTransferEstimate}KB (${(networkTransferEstimate/1024).toFixed(1)}MB)`);
    console.log(`   - Recommended strategy: ${strategy}`);
    
    if (memoryEstimate > 5000) { // > 5MB
      console.log(`   ⚠️  WARNING: Large memory usage detected. Pagination recommended.`);
    } else {
      console.log(`   ✅ Memory usage acceptable for loading all data.`);
    }
    
    console.log(`\n🎉 SUMMARY:`);
    console.log(`   - Total network size: ${totalNetworkSize}`);
    console.log(`   - Recommended strategy: ${strategy}`);
    console.log(`   - Page size: ${pageSize}`);
    console.log(`   - Direct sponsors: ${directSponsorsQuery.size}`);
    console.log(`   - Joined members: ${joinedMembersQuery.size}`);
    console.log(`   - Pagination will ensure optimal performance!`);
    
  } catch (error) {
    console.error(`❌ Error in pagination test:`, error);
  }
}

// Get admin user ID from command line arguments
const adminUserId = process.argv[2];

if (!adminUserId) {
  console.log('Usage: node test_intelligent_pagination.js <adminUserId>');
  console.log('Example: node test_intelligent_pagination.js KJ8uFnlhKhWgBa4NVcwT');
  process.exit(1);
}

testIntelligentPagination(adminUserId)
  .then(() => {
    console.log('\nPagination test complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('Pagination test failed:', error);
    process.exit(1);
  });
