const admin = require('firebase-admin');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../functions/.env.teambuilder-plus-fe74d') });

const serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, '../secrets/serviceAccountKey.json'), 'utf8'));
const app = initializeApp({
    credential: cert(serviceAccount)
}, 'find-demos-' + Date.now());

const db = getFirestore(app, 'preintake');

async function findDemos() {
    // Check the specific lead
    const doc = await db.collection('preintake_leads').doc('9yXCw3SXVjBeHJTbD4qr').get();
    if (doc.exists) {
        const data = doc.data();
        console.log('Lead 9yXCw3SXVjBeHJTbD4qr:');
        console.log('  firmName:', data.firmName);
        console.log('  analysisData.firmName:', data.analysisData?.firmName);
        console.log('  status:', data.status);
        console.log('');
    }
    
    // Find leads with analysisData.firmName
    const snapshot = await db.collection('preintake_leads')
        .limit(100)
        .get();
    
    console.log('Checking', snapshot.size, 'leads for valid firm names...\n');
    
    let found = 0;
    snapshot.forEach(doc => {
        const data = doc.data();
        const analysisFirmName = data.analysisData?.firmName;
        if (analysisFirmName && 
            analysisFirmName !== 'Your Firm' && 
            analysisFirmName !== 'Your Law Firm') {
            console.log(doc.id, '|', analysisFirmName);
            found++;
        }
    });
    console.log('\nFound', found, 'leads with valid analysisData.firmName');
    process.exit(0);
}
findDemos();
