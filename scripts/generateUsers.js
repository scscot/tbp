const admin = require("firebase-admin");
const { v4: uuidv4 } = require("uuid");
const { faker } = require("@faker-js/faker");
const process = require("process");
const crypto = require("crypto");

// ======================= IMPORTANT =======================
// CONFIGURE YOUR EXISTING ADMIN USER'S DETAILS HERE
const ROOT_ADMIN_UID = "KJ8uFnlhKhWgBa4NVcwT";
const ROOT_ADMIN_REFERRAL_CODE = "88888888";
const STATIC_PASSWORD = '11111111'; // Static password for all test users
// =========================================================

// Configuration constants
const BATCH_SIZE = 450; // Safe batch size for Firestore operations
const AUTH_CREATION_DELAY = 100; // Delay in ms between auth user creations
const DEFAULT_QUALIFICATION_THRESHOLDS = {
  directSponsorMin: 4,
  totalTeamMin: 20
};

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isInsert = args.includes("--insert");
const isDeleteOnly = args.includes("--delete-only");
const isDeleteAndInsert = args.includes("--delete-and-insert");

// Initialize Firebase Admin SDK only if needed
if (isInsert || isDeleteOnly || isDeleteAndInsert) {
  const serviceAccount = require("../secrets/serviceAccountKey.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("✅ Firebase Admin Initialized");
}


/**
 * Gets timezone based on country and state/province
 */
function getTimezoneFromLocation(country, state) {
  const timezoneMap = {
    'United States': {
      'California': 'America/Los_Angeles',
      'New York': 'America/New_York',
      'Texas': 'America/Chicago',
      'Florida': 'America/New_York',
      'Illinois': 'America/Chicago',
      'Pennsylvania': 'America/New_York',
      'Ohio': 'America/New_York',
      'Georgia': 'America/New_York',
      'North Carolina': 'America/New_York',
      'Michigan': 'America/New_York',
      'New Jersey': 'America/New_York',
      'Virginia': 'America/New_York',
      'Washington': 'America/Los_Angeles',
      'Arizona': 'America/Phoenix',
      'Massachusetts': 'America/New_York'
    },
    'Canada': {
      'Ontario': 'America/Toronto',
      'Quebec': 'America/Montreal',
      'British Columbia': 'America/Vancouver',
      'Alberta': 'America/Edmonton',
      'Manitoba': 'America/Winnipeg',
      'Saskatchewan': 'America/Regina',
      'Nova Scotia': 'America/Halifax',
      'New Brunswick': 'America/Moncton',
      'Newfoundland and Labrador': 'America/St_Johns',
      'Prince Edward Island': 'America/Halifax',
      'Yukon': 'America/Whitehorse',
      'Northwest Territories': 'America/Yellowknife',
      'Nunavut': 'America/Iqaluit'
    },
    'Germany': 'Europe/Berlin',
    'France': 'Europe/Paris',
    'Japan': 'Asia/Tokyo',
    'Colombia': 'America/Bogota',
    'Mexico': 'America/Mexico_City',
    'Malaysia': 'Asia/Kuala_Lumpur'
  };

  if (timezoneMap[country]) {
    if (typeof timezoneMap[country] === 'object') {
      return timezoneMap[country][state] || 'UTC';
    }
    return timezoneMap[country];
  }
  return 'UTC';
}

/**
 * Validates that the root admin exists and has proper configuration
 */
async function validateRootAdmin(db) {
  console.log("🔍 Validating root admin configuration...");
  
  // Check if root admin user exists
  const adminUserDoc = await db.collection('users').doc(ROOT_ADMIN_UID).get();
  if (!adminUserDoc.exists) {
    throw new Error(`Root admin user with UID ${ROOT_ADMIN_UID} does not exist in Firestore`);
  }
  
  const adminData = adminUserDoc.data();
  if (adminData.referralCode !== ROOT_ADMIN_REFERRAL_CODE) {
    throw new Error(`Root admin referral code mismatch. Expected: ${ROOT_ADMIN_REFERRAL_CODE}, Found: ${adminData.referralCode}`);
  }
  
  // Check if admin_settings exists
  const adminSettingsDoc = await db.collection('admin_settings').doc(ROOT_ADMIN_UID).get();
  if (!adminSettingsDoc.exists) {
    console.warn(`⚠️  Warning: admin_settings document for ${ROOT_ADMIN_UID} does not exist`);
  }
  
  console.log("✅ Root admin validation passed");
  return adminData;
}

/**
 * Gets qualification thresholds from Remote Config or uses defaults
 */
async function getQualificationThresholds() {
  try {
    const remoteConfig = admin.remoteConfig();
    const template = await remoteConfig.getTemplate();
    const parameters = template.parameters;
    
    const directSponsorMin = parseInt(parameters.projectWideDirectSponsorMin?.defaultValue?.value || DEFAULT_QUALIFICATION_THRESHOLDS.directSponsorMin, 10);
    const totalTeamMin = parseInt(parameters.projectWideDataTeamMin?.defaultValue?.value || DEFAULT_QUALIFICATION_THRESHOLDS.totalTeamMin, 10);
    
    console.log(`📊 Using qualification thresholds: Direct Sponsors >= ${directSponsorMin}, Total Team >= ${totalTeamMin}`);
    return { directSponsorMin, totalTeamMin };
  } catch (error) {
    console.warn(`⚠️  Could not fetch Remote Config, using defaults: ${error.message}`);
    return DEFAULT_QUALIFICATION_THRESHOLDS;
  }
}

/**
 * Recursively and correctly deletes all documents in a collection using pagination.
 * @param {admin.firestore.Firestore} db - The Firestore instance.
 * @param {string} collectionPath - The path to the collection.
 * @param {string|null} excludeId - An optional document ID to exclude from deletion.
 */
async function deleteCollection(db, collectionPath, excludeId = null) {
  console.log(`🔥 Deleting collection: '${collectionPath}'...`);
  const collectionRef = db.collection(collectionPath);
  const batchSize = 200;
  let deletedCount = 0;

  while (true) {
    const snapshot = await collectionRef.limit(batchSize).get();

    // When there are no documents left, we are done
    if (snapshot.size === 0) {
      break;
    }

    const batch = db.batch();
    let docsInBatch = 0;

    for (const doc of snapshot.docs) {
      if (excludeId && doc.id === excludeId) {
        continue;
      }

      // Recursively delete sub-collections first
      const subcollections = await doc.ref.listCollections();
      for (const subcollection of subcollections) {
        await deleteCollection(db, subcollection.path);
      }

      batch.delete(doc.ref);
      docsInBatch++;
    }

    // Only commit if there are documents to delete in this batch
    if (docsInBatch > 0) {
      await batch.commit();
      deletedCount += docsInBatch;
      console.log(`   ...deleted batch of ${docsInBatch} documents from '${collectionPath}'.`);
    }

    // If the snapshot size is less than the batch size, it means we've reached the end
    if (snapshot.size < batchSize) {
      break;
    }
  }

  console.log(`✅ Finished deleting from '${collectionPath}'. Total: ${deletedCount}`);
}


/**
 * Deletes all data from Firestore and Firebase Auth, excluding the root admin.
 */
async function deleteAllData() {
  const db = admin.firestore();
  const auth = admin.auth();
  console.log("🔥 Starting deletion process...");

  // 1. Delete Firestore Collections Recursively
  await deleteCollection(db, 'users', ROOT_ADMIN_UID);
  await deleteCollection(db, 'chats'); // No exclusion needed
  await deleteCollection(db, 'admin_settings', ROOT_ADMIN_UID);

  // 2. Delete Auth Users
  console.log("🔥 Deleting Authentication users (excluding root admin)...");
  let authDeleteCount = 0;
  let nextPageToken;
  do {
    const listUsersResult = await auth.listUsers(1000, nextPageToken);
    const usersToDelete = listUsersResult.users.filter(
      (user) => user.uid !== ROOT_ADMIN_UID
    );

    if (usersToDelete.length > 0) {
      const deletePromises = usersToDelete.map(user => auth.deleteUser(user.uid));
      await Promise.all(deletePromises);
      authDeleteCount += usersToDelete.length;
      console.log(`   ...deleted page of ${usersToDelete.length} Auth users.`);
    }

    nextPageToken = listUsersResult.pageToken;
  } while (nextPageToken);
  console.log(`✅ Deleted ${authDeleteCount} total Authentication users.`);
  console.log("✅ Deletion process complete.");
}


const statesByCountry = {
  'United States': [
    'California',
    'New York',
    'Texas',
    'Florida',
    'Illinois',
    'Pennsylvania',
    'Ohio',
    'Georgia',
    'North Carolina',
    'Michigan',
    'New Jersey',
    'Virginia',
    'Washington',
    'Arizona',
    'Massachusetts'
  ],
  'Canada': [
    'Ontario',
    'Quebec',
    'British Columbia',
    'Alberta',
    'Manitoba',
    'Saskatchewan',
    'Nova Scotia',
    'New Brunswick',
    'Newfoundland and Labrador',
    'Prince Edward Island',
    'Yukon',
    'Northwest Territories',
    'Nunavut'
  ],
  'Germany': [
    'Bavaria',
    'Berlin',
    'Hesse',
    'North Rhine-Westphalia',
    'Hamburg'
  ],
  'France': [
    'Île-de-France',
    'Provence-Alpes-Côte d\'Azur',
    'Auvergne-Rhône-Alpes',
    'Occitanie',
    'Hauts-de-France'
  ],
  'Japan': [
    'Tokyo',
    'Osaka',
    'Kyoto',
    'Hokkaido',
    'Aichi'
  ],
  'Colombia': [
    'Bogotá D.C.',
    'Antioquia',
    'Valle del Cauca',
    'Cundinamarca',
    'Atlántico'
  ],
  'Mexico': [
    'Mexico City',
    'Jalisco',
    'Nuevo León',
    'Quintana Roo',
    'Baja California'
  ],
  'Malaysia': [
    'Kuala Lumpur',
    'Selangor',
    'Penang',
    'Johor',
    'Sabah'
  ],
};

function getRandomLocation() {
  const country = faker.helpers.arrayElement(Object.keys(statesByCountry));
  const state = faker.helpers.arrayElement(statesByCountry[country]);
  const city = faker.location.city();
  return { country, state, city };
}

/**
 * Generates a referral code similar to the main app format
 */
function generateReferralCode(firstName) {
  const cleanFirstName = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const randomNumber = Math.floor(1000 + Math.random() * 9000);
  return `${cleanFirstName}${randomNumber}`;
}

// Global counter for sequential email generation
let userEmailCounter = 1;

function createUser(sponsor, uplineAdminId) {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const location = getRandomLocation();
  const creationDate = new Date();
  const timezone = getTimezoneFromLocation(location.country, location.state);

  const uplineRefs = [];
  if (sponsor) {
    if (Array.isArray(sponsor.upline_refs)) {
      uplineRefs.push(...sponsor.upline_refs);
    }
    uplineRefs.push(sponsor.uid);
  }

  // Generate sequential email address
  const email = `test${userEmailCounter}@xtest.com`;
  userEmailCounter++;

  return {
    uid: uuidv4(),
    firstName,
    lastName,
    email: email,
    ...location,
    timezone,
    photoUrl: faker.image.avatar(),
    referralCode: generateReferralCode(firstName),
    referredBy: sponsor ? sponsor.referralCode : null,
    sponsor_id: sponsor ? sponsor.uid : null,
    upline_admin: uplineAdminId,
    level: uplineRefs.length + 1,
    upline_refs: uplineRefs,
    createdAt: creationDate,
    role: 'user',
    isProfileComplete: true,
    // Subscription and count fields to simulate a fully registered user
    subscriptionStatus: 'trial',
    trialStartDate: creationDate,
    directSponsorCount: 0,
    totalTeamCount: 0,
    currentPartner: false,
    // Store password for reference (in real app, this wouldn't be stored)
    generatedPassword: STATIC_PASSWORD
  };
}

function buildHierarchy(rootAdmin, targetUserCount) {
  // Reset email counter for consistent numbering
  userEmailCounter = 1;
  
  let allGeneratedUsers = [];
  let availableSponsors = [rootAdmin];
  
  // Generate users until we reach the target count
  while (allGeneratedUsers.length < targetUserCount && availableSponsors.length > 0) {
    const sponsor = availableSponsors[Math.floor(Math.random() * availableSponsors.length)];
    
    // Create 1-8 users for this sponsor (random variation)
    const numToCreate = Math.min(
      Math.floor(Math.random() * 8) + 1, 
      targetUserCount - allGeneratedUsers.length
    );
    
    for (let i = 0; i < numToCreate; i++) {
      const newUser = createUser(sponsor, rootAdmin.uid);
      allGeneratedUsers.push(newUser);
      
      // Add new user as potential sponsor (80% chance to keep hierarchy growing)
      if (Math.random() < 0.8) {
        availableSponsors.push(newUser);
      }
    }
    
    // Occasionally remove sponsors to prevent infinite growth (20% chance)
    if (availableSponsors.length > 50 && Math.random() < 0.2) {
      availableSponsors.splice(Math.floor(Math.random() * availableSponsors.length), 1);
    }
  }
  
  return allGeneratedUsers;
}

/**
 * Calculates counts and updates user qualification status in Firestore.
 * @param {admin.firestore.Firestore} db - The Firestore instance.
 * @param {Array<Object>} users - The array of all generated user data objects.
 * @param {Object} qualificationThresholds - The qualification thresholds to use.
 */
async function processQualifications(db, users, qualificationThresholds) {
  console.log('📊 Calculating team counts and processing qualifications...');
  const counts = new Map();

  // Initialize counts for the root admin
  counts.set(ROOT_ADMIN_UID, { directSponsorCount: 0, totalTeamCount: 0 });

  // Calculate counts in memory first
  for (const user of users) {
    // Direct sponsor count
    if (user.sponsor_id) {
      if (!counts.has(user.sponsor_id)) {
        counts.set(user.sponsor_id, { directSponsorCount: 0, totalTeamCount: 0 });
      }
      counts.get(user.sponsor_id).directSponsorCount++;
    }
    // Total team count for everyone in the upline
    for (const uplineId of user.upline_refs) {
      if (!counts.has(uplineId)) {
        counts.set(uplineId, { directSponsorCount: 0, totalTeamCount: 0 });
      }
      counts.get(uplineId).totalTeamCount++;
    }
  }

  console.log(`   ...counts calculated for ${counts.size} users.`);
  console.log('   ...preparing batch update for Firestore.');

  // Prepare batch update
  let batch = db.batch();
  let batchCount = 0;
  let qualifiedCount = 0;

  for (const [userId, userCounts] of counts.entries()) {
    const userRef = db.collection('users').doc(userId);
    const updateData = {
      directSponsorCount: userCounts.directSponsorCount,
      totalTeamCount: userCounts.totalTeamCount,
    };

    // Check for qualification using dynamic thresholds
    if (userCounts.directSponsorCount >= qualificationThresholds.directSponsorMin && 
        userCounts.totalTeamCount >= qualificationThresholds.totalTeamMin) {
      updateData.qualifiedDate = new Date();
      qualifiedCount++;
    }

    batch.update(userRef, updateData);
    batchCount++;

    // Commit batch when it reaches safe size
    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`   ...committed batch of ${batchCount} count updates.`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  // Commit remaining updates
  if (batchCount > 0) {
    await batch.commit();
    console.log(`   ...committed final batch of ${batchCount} count updates.`);
  }

  console.log(`✅ Updated counts for ${counts.size} users.`);
  console.log(`🎉 Found and updated ${qualifiedCount} newly qualified users.`);
}


function displayDryRun(users) {
  console.log(`🌲 Dry Run: Will generate ${users.length} new users.`);
  console.log("Sample of first 5 users:");
  console.log("----------------------------------------");
  users.slice(0, 5).forEach(user => {
    console.log(`UID: ${user.uid}`);
    console.log(` Name: ${user.firstName} ${user.lastName}`);
    console.log(` Email: ${user.email}`);
    console.log(` Level: ${user.level}`);
    console.log(` Timezone: ${user.timezone}`);
    console.log(` Sponsor UID: ${user.sponsor_id || 'N/A'}`);
    console.log(` Referred By (Code): ${user.referredBy}`);
    console.log(` Referral Code: ${user.referralCode}`);
    console.log(` Password: ${STATIC_PASSWORD}`);
    console.log(` Upline Refs: [${user.upline_refs.join(", ")}]`);
    console.log("----------------------------------------");
  });
  
  if (users.length > 5) {
    console.log(`... and ${users.length - 5} more users`);
  }
}

async function insertFirestoreUsers(users) {
  const db = admin.firestore();
  let batch = db.batch();
  let usersInBatch = 0;
  let totalProcessed = 0;

  console.log(`✍️  Preparing to insert ${users.length} users into Firestore...`);

  for (const user of users) {
    // Remove password from Firestore data (security)
    const { generatedPassword, ...firestoreUser } = user;
    
    const ref = db.collection("users").doc(user.uid);
    batch.set(ref, firestoreUser, { merge: true });
    usersInBatch++;
    
    if (usersInBatch >= BATCH_SIZE) {
      await batch.commit();
      totalProcessed += usersInBatch;
      console.log(`   ...committed batch of ${usersInBatch} users. Total: ${totalProcessed}/${users.length}`);
      batch = db.batch();
      usersInBatch = 0;
    }
  }

  if (usersInBatch > 0) {
    await batch.commit();
    totalProcessed += usersInBatch;
    console.log(`   ...committed final batch of ${usersInBatch} users. Total: ${totalProcessed}/${users.length}`);
  }
  console.log(`✅ Inserted/Updated ${users.length} total users into Firestore.`);
}

/**
 * Creates Firebase Authentication accounts for the generated users with rate limiting.
 * @param {Array<Object>} users - The array of user data objects.
 */
async function createAuthUsers(users) {
  const auth = admin.auth();
  console.log(`🔑 Preparing to create ${users.length} Authentication users...`);
  let successCount = 0;
  let errorCount = 0;
  const userCredentials = [];

  // Check for existing emails to avoid duplicates
  const existingEmails = new Set();
  try {
    let nextPageToken;
    do {
      const listUsersResult = await auth.listUsers(1000, nextPageToken);
      listUsersResult.users.forEach(user => {
        if (user.email) existingEmails.add(user.email.toLowerCase());
      });
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);
  } catch (error) {
    console.warn(`⚠️  Could not fetch existing users: ${error.message}`);
  }

  // Create auth users with rate limiting
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    
    // Skip if email already exists
    if (existingEmails.has(user.email.toLowerCase())) {
      console.log(`   ...skipping ${user.email} (already exists)`);
      errorCount++;
      continue;
    }
    
    try {
      await auth.createUser({
        uid: user.uid,
        email: user.email,
        password: STATIC_PASSWORD,
        displayName: `${user.firstName} ${user.lastName}`,
        photoURL: user.photoUrl,
      });
      
      userCredentials.push({
        email: user.email,
        password: STATIC_PASSWORD,
        name: `${user.firstName} ${user.lastName}`
      });
      
      successCount++;
      
      // Progress indicator
      if (successCount % 50 === 0) {
        console.log(`   ...created ${successCount}/${users.length} auth users`);
      }
      
      // Rate limiting delay
      if (AUTH_CREATION_DELAY > 0) {
        await new Promise(resolve => setTimeout(resolve, AUTH_CREATION_DELAY));
      }
      
    } catch (error) {
      console.error(`   ...failed to create auth user for ${user.email} (UID: ${user.uid}):`, error.message);
      errorCount++;
    }
  }

  console.log(`✅ Created ${successCount} Authentication users.`);
  if (errorCount > 0) {
    console.error(`❌ Failed to create ${errorCount} Authentication users.`);
  }
  
  // Save credentials to file for reference
  if (userCredentials.length > 0) {
    const fs = require('fs');
    const credentialsFile = `generated_user_credentials_${Date.now()}.json`;
    fs.writeFileSync(credentialsFile, JSON.stringify(userCredentials, null, 2));
    console.log(`📄 User credentials saved to: ${credentialsFile}`);
  }
}


(async () => {
  // Validate configuration
  if ((isInsert || isDeleteOnly || isDeleteAndInsert) && 
      (ROOT_ADMIN_UID === "PASTE_YOUR_ADMIN_UID_HERE" || 
       ROOT_ADMIN_REFERRAL_CODE === "PASTE_ADMIN_REFERRAL_CODE_HERE")) {
    console.error("❌ ERROR: Please edit the script to provide your actual ROOT_ADMIN_UID and ROOT_ADMIN_REFERRAL_CODE.");
    console.error("Update lines 10-11 with your admin's actual UID and referral code.");
    return;
  }

  try {
    // Only create db connection if Firebase is initialized
    const db = (isInsert || isDeleteOnly || isDeleteAndInsert) ? admin.firestore() : null;

    // Validate root admin if doing operations
    let rootAdminData = null;
    if (isInsert || isDeleteAndInsert) {
      rootAdminData = await validateRootAdmin(db);
    }

    // Get qualification thresholds (only if Firebase is initialized)
    let qualificationThresholds = DEFAULT_QUALIFICATION_THRESHOLDS;
    if (isInsert || isDeleteAndInsert) {
      qualificationThresholds = await getQualificationThresholds();
    }

    // --- DELETION ---
    if (isDeleteOnly || isDeleteAndInsert) {
      await deleteAllData();
    }

    // --- CREATION ---
    const shouldCreate = isInsert || isDeleteAndInsert;
    if (shouldCreate || isDryRun) {
      console.log('🌱 Generating user data...');
      const rootAdmin = {
        uid: ROOT_ADMIN_UID,
        referralCode: ROOT_ADMIN_REFERRAL_CODE,
        upline_refs: [] // The root admin has no upline
      };

      // Generate target number of users (adjust this number as needed)
      const targetUserCount = 55; // Creates 55 users (within 50-60 range)
      const usersToCreate = buildHierarchy(rootAdmin, targetUserCount);

      if (isDryRun) {
        displayDryRun(usersToCreate);
        console.log(`\n📊 Qualification thresholds that would be used:`);
        console.log(`   Direct Sponsors: >= ${qualificationThresholds.directSponsorMin}`);
        console.log(`   Total Team: >= ${qualificationThresholds.totalTeamMin}`);
      }

      if (shouldCreate) {
        console.log('🚀 Starting user creation process...');
        await insertFirestoreUsers(usersToCreate);
        await createAuthUsers(usersToCreate);
        await processQualifications(db, usersToCreate, qualificationThresholds);
        console.log('🎉 Database creation process complete!');
      }
    }

    // --- HELP MESSAGE ---
    if (!isDryRun && !isInsert && !isDeleteOnly && !isDeleteAndInsert) {
      console.log("No action taken. Use one of the following flags:");
      console.log("  --dry-run: Display users that would be generated.");
      console.log("  --insert: Add generated users to Firestore and Auth.");
      console.log("  --delete-only: Delete all data except the root admin.");
      console.log("  --delete-and-insert: Delete all users and then insert the new set.");
      console.log("");
      console.log("Before running with --insert, --delete-only, or --delete-and-insert:");
      console.log("1. Update ROOT_ADMIN_UID and ROOT_ADMIN_REFERRAL_CODE in this script");
      console.log("2. Ensure your Firebase service account key is in ../secrets/serviceAccountKey.json");
    }

  } catch (error) {
    console.error("❌ CRITICAL ERROR:", error.message);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
})();
