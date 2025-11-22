const admin = require('firebase-admin');
const serviceAccount = require('../secrets/serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Email addresses from the failed 6pm batch (3version template error)
const failedEmails = [
  'alfrits.n@gmail.com',
  'anasmbahdien@gmail.com',
  'anngoupil@gmail.com',
  'arielgolan05@gmail.com',
  'arno@publilux.lu',
  'bryan.mastalerz@yahoo.com',
  'chrissykusk@gmail.com',
  'cliffordlingam@gmail.com',
  'corriesteyn93@gmail.com',
  'danieledelgado93@gmail.com',
  'dchenderson57@gmail.com',
  'dgpnath@gmail.com',
  'djcho05@gmail.com',
  'djwaqar786@gmail.com',
  'drcalilator@gmail.com',
  'drwasiuabdulfatai@gmail.com',
  'egnlyhez@gmail.com',
  'ekejiofor285@gmail.com',
  'emadomar2@gmail.com',
  'eugeniofinardi@gmail.com',
  'fazrul.ismail@gmail.com',
  'francislucas015@gmail.com',
  'franknoronha57@gmail.com',
  'franskrenz@gmail.com',
  'fredmundia@yahoo.com',
  'gregmrtn@gmail.com',
  'helenskyg@gmail.com',
  'jamaarshalon@gmail.com',
  'jennifersamuel533@gmail.com',
  'jeremyattah@gmail.com',
  'jlu596128@gmail.com',
  'johnspami@gmail.com',
  'kash1@gmail.com',
  'kennymaxev@gmail.com',
  'kkhlawyer@gmail.com',
  'lazarusmajeni@gmail.com',
  'mahlaniqubeka@gmail.com',
  'marcelokane@gmail.com',
  'marionpennie@gmail.com',
  'maxonohen@gmail.com',
  'mccoyliv123@gmail.com',
  'merrickodiyama@gmail.com',
  'mm562154@gmail.com',
  'mohdsaleemkhan14@gmail.com',
  'muchiriallan@yahoo.com',
  'muhamudshaafi@gmail.com',
  'nzonozeli@gmail.com',
  'oarivin@gmail.com',
  'orlandoferreira@gmail.com',
  'osmanarefin99@gmail.com',
  'paulmathew2010@gmail.com',
  'petercoleman8@gmail.com',
  'prashantharavind@gmail.com',
  'rcsosa53@gmail.com',
  'renzthedreamer@gmail.com',
  'robertokane637@gmail.com',
  'rosalynestate@gmail.com',
  'ruwell2@gmail.com',
  'salomsagas@gmail.com',
  'sammyom@icloud.com',
  'samuelegboloh@yahoo.com',
  'sebastientay@gmail.com',
  'sgeledembe@gmail.com',
  'stevendavis1977@yahoo.com',
  'suprosamanta@gmail.com',
  'sylvainesquem@gmail.com',
  'tahermrench@gmail.com',
  'theronmaree@gmail.com',
  'tracyquek@gmail.com',
  'trevormorris1976@gmail.com',
  'valenciajason85@gmail.com',
  'vanlynch.daniel@gmail.com',
  'varuniianand@gmail.com',
  'vicky.muk@gmail.com',
  'vincentalecanla2@gmail.com',
  'vincentonyama@gmail.com',
  'vmorindaro@gmail.com',
  'welsonyen5rvs@yahoo.com',
  'willysiocha@gmail.com',
  'zankomario@gmail.com'
];

async function resetFailedContacts() {
  console.log(`🔄 Starting reset for ${failedEmails.length} contacts from failed 6pm batch`);

  const contactsRef = db.collection('emailCampaigns').doc('master').collection('contacts');

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const email of failedEmails) {
    try {
      // Query for the contact by email
      const querySnapshot = await contactsRef.where('email', '==', email).limit(1).get();

      if (querySnapshot.empty) {
        console.log(`⚠️  Contact not found: ${email}`);
        notFound++;
        continue;
      }

      const doc = querySnapshot.docs[0];
      const currentData = doc.data();

      // Update the document to reset to unsent state
      await doc.ref.update({
        sent: false,
        sentTimestamp: admin.firestore.FieldValue.delete(),
        status: 'pending',
        errorMessage: '',
        mailgunId: ''
      });

      console.log(`✅ Reset: ${email} (was: ${currentData.status})`);
      updated++;

    } catch (error) {
      console.error(`❌ Error updating ${email}: ${error.message}`);
      errors++;
    }
  }

  console.log('\n📊 Reset Summary:');
  console.log(`   Successfully reset: ${updated}`);
  console.log(`   Not found: ${notFound}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total processed: ${failedEmails.length}`);

  process.exit(0);
}

resetFailedContacts().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
