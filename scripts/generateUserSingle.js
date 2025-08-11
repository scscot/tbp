const admin = require("firebase-admin");
const { v4: uuidv4 } = require("uuid");
const { faker } = require("@faker-js/faker");
const process = require("process");
const crypto = require("crypto");

// ======================= IMPORTANT =======================
// CONFIGURE YOUR EXISTING ADMIN USER'S DETAILS HERE
const ROOT_ADMIN_UID = "KJ8uFnlhKhWgBa4NVcwT";
const ROOT_ADMIN_REFERRAL_CODE = "88888888";
const STATIC_PASSWORD = '11111111'; // Static password for test user
// =========================================================

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isInsert = args.includes("--insert") || args.includes("--target-count=1");

// Initialize Firebase Admin SDK only if needed
if (isInsert) {
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

const statesByCountry = {
  'United States': [
    'California', 'New York', 'Texas', 'Florida', 'Illinois', 'Pennsylvania', 'Ohio', 'Georgia', 'North Carolina', 'Michigan'
  ],
  'Canada': [
    'Ontario', 'Quebec', 'British Columbia', 'Alberta', 'Manitoba'
  ],
  'Germany': ['Bavaria', 'Berlin', 'Hesse'],
  'France': ['Île-de-France', 'Provence-Alpes-Côte d\'Azur'],
  'Japan': ['Tokyo', 'Osaka', 'Kyoto'],
  'Colombia': ['Bogotá D.C.', 'Antioquia'],
  'Mexico': ['Mexico City', 'Jalisco'],
  'Malaysia': ['Kuala Lumpur', 'Selangor']
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

/**
 * Creates a single user
 */
function createSingleUser(sponsor, uplineAdminId) {
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

  const email = `singleuser${Date.now()}@xtest.com`;

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
    subscriptionStatus: 'trial',
    trialStartDate: creationDate,
    directSponsorCount: 0,
    totalTeamCount: 0,
    currentPartner: false,
    generatedPassword: STATIC_PASSWORD
  };
}

/**
 * Validates that the root admin exists and has proper configuration
 */
async function validateRootAdmin(db) {
  console.log("🔍 Validating root admin configuration...");
  
  const adminUserDoc = await db.collection('users').doc(ROOT_ADMIN_UID).get();
  if (!adminUserDoc.exists) {
    throw new Error(`Root admin user with UID ${ROOT_ADMIN_UID} does not exist in Firestore`);
  }
  
  const adminData = adminUserDoc.data();
  if (adminData.referralCode !== ROOT_ADMIN_REFERRAL_CODE) {
    throw new Error(`Root admin referral code mismatch. Expected: ${ROOT_ADMIN_REFERRAL_CODE}, Found: ${adminData.referralCode}`);
  }
  
  console.log("✅ Root admin validation passed");
  return adminData;
}

/**
 * Inserts a single user into Firestore and Auth
 */
async function insertSingleUser(user) {
  const db = admin.firestore();
  const auth = admin.auth();
  
  console.log(`✍️  Creating single user: ${user.firstName} ${user.lastName}`);
  
  try {
    // Create Auth user
    await auth.createUser({
      uid: user.uid,
      email: user.email,
      password: STATIC_PASSWORD,
      displayName: `${user.firstName} ${user.lastName}`,
      photoURL: user.photoUrl,
    });
    console.log(`✅ Auth user created: ${user.email}`);
    
    // Create Firestore user
    const { generatedPassword, ...firestoreUser } = user;
    await db.collection("users").doc(user.uid).set(firestoreUser);
    console.log(`✅ Firestore user created: ${user.uid}`);
    
    // Save credentials
    const fs = require('fs');
    const credentials = [{
      email: user.email,
      password: STATIC_PASSWORD,
      name: `${user.firstName} ${user.lastName}`,
      uid: user.uid
    }];
    const credentialsFile = `single_user_credentials_${Date.now()}.json`;
    fs.writeFileSync(credentialsFile, JSON.stringify(credentials, null, 2));
    console.log(`📄 User credentials saved to: ${credentialsFile}`);
    
  } catch (error) {
    console.error("❌ Error creating user:", error.message);
    throw error;
  }
}

function displayDryRun(user) {
  console.log(`🌲 Dry Run: Will create 1 new user`);
  console.log("----------------------------------------");
  console.log(`UID: ${user.uid}`);
  console.log(`Name: ${user.firstName} ${user.lastName}`);
  console.log(`Email: ${user.email}`);
  console.log(`Level: ${user.level}`);
  console.log(`Timezone: ${user.timezone}`);
  console.log(`Country: ${user.country}`);
  console.log(`State: ${user.state}`);
  console.log(`City: ${user.city}`);
  console.log(`Sponsor UID: ${user.sponsor_id || 'N/A'}`);
  console.log(`Referred By (Code): ${user.referredBy}`);
  console.log(`Referral Code: ${user.referralCode}`);
  console.log(`Password: ${STATIC_PASSWORD}`);
  console.log(`Upline Refs: [${user.upline_refs.join(", ")}]`);
  console.log("----------------------------------------");
}

(async () => {
  // Validate configuration
  if (isInsert && 
      (ROOT_ADMIN_UID === "PASTE_YOUR_ADMIN_UID_HERE" || 
       ROOT_ADMIN_REFERRAL_CODE === "PASTE_ADMIN_REFERRAL_CODE_HERE")) {
    console.error("❌ ERROR: Please edit the script to provide your actual ROOT_ADMIN_UID and ROOT_ADMIN_REFERRAL_CODE.");
    console.error("Update lines 10-11 with your admin's actual UID and referral code.");
    return;
  }

  try {
    let rootAdminData = null;
    let db = null;
    
  if (isInsert) {
      const serviceAccount = require("../secrets/serviceAccountKey.json");
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log("✅ Firebase Admin Initialized");
      } else {
        console.log("✅ Firebase Admin Already Initialized");
      }
      
      db = admin.firestore();
      rootAdminData = await validateRootAdmin(db);
    }

    console.log('🌱 Creating single user...');
    const rootAdmin = {
      uid: ROOT_ADMIN_UID,
      referralCode: ROOT_ADMIN_REFERRAL_CODE,
      upline_refs: []
    };

    const user = createSingleUser(rootAdmin, ROOT_ADMIN_UID);

    if (isDryRun) {
      displayDryRun(user);
    } else {
      await insertSingleUser(user);
      console.log('🎉 Single user creation complete!');
    }

  } catch (error) {
    console.error("❌ CRITICAL ERROR:", error.message);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
})();
