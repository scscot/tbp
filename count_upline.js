const admin = require('firebase-admin');
const serviceAccount = require('./secrets/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function countUsersWithUpline() {
  const includeUid = 'KJ8uFnlhKhWgBa4NVcwT';
  const excludeUid = 'qzvHp5bIjvTEniYuds544aHLNE93';

  console.log(`Querying users where upline_refs contains: ${includeUid}`);
  console.log(`AND upline_refs does NOT contain: ${excludeUid}`);

  const snapshot = await db.collection('users')
    .where('upline_refs', 'array-contains', includeUid)
    .get();

  const filteredUsers = snapshot.docs.filter(doc => {
    const uplineRefs = doc.data().upline_refs || [];
    return !uplineRefs.includes(excludeUid);
  });

  console.log(`\nFound ${filteredUsers.length} user(s) matching criteria`);

  process.exit(0);
}

countUsersWithUpline().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
