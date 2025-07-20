// test_migration.js
// Script to test the migration function via Firebase Functions API

const https = require('https');

// Your Firebase project configuration
const PROJECT_ID = 'teambuilder-plus-fe74d';
const REGION = 'us-central1';
const FUNCTION_NAME = 'migrateProfileCompletion';

// You'll need to get an ID token from Firebase Auth
// For testing, you can get this from the browser console after logging in:
// firebase.auth().currentUser.getIdToken().then(token => console.log(token))
const ID_TOKEN = 'YOUR_ID_TOKEN_HERE'; // Replace with actual token

const callMigrationFunction = async () => {
  console.log('🚀 Calling migration function...');
  
  const postData = JSON.stringify({
    data: {} // Empty data object since function doesn't need parameters
  });
  
  const options = {
    hostname: `${REGION}-${PROJECT_ID}.cloudfunctions.net`,
    path: `/${FUNCTION_NAME}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ID_TOKEN}`,
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('✅ Migration function response:', JSON.stringify(response, null, 2));
          resolve(response);
        } catch (error) {
          console.error('❌ Error parsing response:', error);
          console.log('Raw response:', data);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request error:', error);
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
};

// Instructions for getting the ID token
console.log('📋 To run this migration:');
console.log('1. Open your Flutter app or Firebase console');
console.log('2. Log in as an authenticated user');
console.log('3. In browser console, run: firebase.auth().currentUser.getIdToken().then(token => console.log(token))');
console.log('4. Copy the token and replace YOUR_ID_TOKEN_HERE in this file');
console.log('5. Run: node test_migration.js');
console.log('');

if (ID_TOKEN === 'YOUR_ID_TOKEN_HERE') {
  console.log('⚠️  Please set your ID_TOKEN first before running the migration!');
  process.exit(1);
} else {
  callMigrationFunction()
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}
