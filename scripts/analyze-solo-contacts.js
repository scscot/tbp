const admin = require('firebase-admin');
const serviceAccount = require('../secrets/serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

async function analyze() {
    console.log('Analyzing preintake_emails collection...');
    
    const snapshot = await db.collection('preintake_emails').get();
    
    let total = 0;
    let domainCheckedTrue = 0;
    let notCheckedYet = 0;
    
    let resultFound = 0;
    let resultNotFound = 0;
    let resultPersonalEmail = 0;
    let resultOther = 0;
    
    let bySource = {};
    
    snapshot.forEach(doc => {
        const data = doc.data();
        total++;
        
        const source = data.source || 'unknown';
        if (bySource[source] === undefined) {
            bySource[source] = { total: 0, checked: 0, notFound: 0, personalEmail: 0, found: 0 };
        }
        bySource[source].total++;
        
        if (data.domainChecked === true) {
            domainCheckedTrue++;
            bySource[source].checked++;
            
            if (data.domainCheckResult === 'found') {
                resultFound++;
                bySource[source].found++;
            } else if (data.domainCheckResult === 'not_found') {
                resultNotFound++;
                bySource[source].notFound++;
            } else if (data.domainCheckResult === 'personal_email') {
                resultPersonalEmail++;
                bySource[source].personalEmail++;
            } else {
                resultOther++;
            }
        } else {
            notCheckedYet++;
        }
    });
    
    console.log('');
    console.log('============================================================');
    console.log('OVERALL SUMMARY');
    console.log('============================================================');
    console.log('Total contacts:', total.toLocaleString());
    console.log('');
    console.log('Domain Check Status:');
    console.log('  Checked (domainChecked=true):', domainCheckedTrue.toLocaleString());
    console.log('  Not checked yet:', notCheckedYet.toLocaleString());
    console.log('');
    
    console.log('============================================================');
    console.log('CHECKED CONTACTS BREAKDOWN');
    console.log('============================================================');
    const foundPct = (resultFound/domainCheckedTrue*100).toFixed(1);
    const notFoundPct = (resultNotFound/domainCheckedTrue*100).toFixed(1);
    const personalPct = (resultPersonalEmail/domainCheckedTrue*100).toFixed(1);
    console.log('  Website found:', resultFound.toLocaleString(), '(' + foundPct + '%)');
    console.log('  Not found:', resultNotFound.toLocaleString(), '(' + notFoundPct + '%)');
    console.log('  Personal email:', resultPersonalEmail.toLocaleString(), '(' + personalPct + '%)');
    if (resultOther > 0) console.log('  Other:', resultOther);
    console.log('');
    
    const soloEligible = resultNotFound + resultPersonalEmail;
    const soloPercent = (soloEligible / domainCheckedTrue * 100).toFixed(1);
    console.log('============================================================');
    console.log('SOLO PRODUCT CANDIDATES (no website)');
    console.log('============================================================');
    console.log('  From checked contacts:', soloEligible.toLocaleString(), '(' + soloPercent + '%)');
    
    const projectedSolo = Math.round(notCheckedYet * (soloEligible / domainCheckedTrue));
    console.log('  Projected from unchecked:', projectedSolo.toLocaleString(), '(extrapolated @ ' + soloPercent + '%)');
    console.log('  -------------------------------------------');
    console.log('  ESTIMATED TOTAL SOLO CANDIDATES:', (soloEligible + projectedSolo).toLocaleString());
    console.log('');
    
    console.log('============================================================');
    console.log('BY SOURCE');
    console.log('============================================================');
    for (const [source, stats] of Object.entries(bySource).sort((a,b) => b[1].total - a[1].total)) {
        console.log('');
        console.log(source.toUpperCase() + ':');
        console.log('  Total:', stats.total.toLocaleString());
        console.log('  Checked:', stats.checked.toLocaleString());
        if (stats.checked > 0) {
            const srcSoloEligible = stats.notFound + stats.personalEmail;
            const srcSoloPercent = (srcSoloEligible / stats.checked * 100).toFixed(1);
            console.log('  Website found:', stats.found, '(' + (stats.found/stats.checked*100).toFixed(1) + '%)');
            console.log('  Solo eligible:', srcSoloEligible, '(' + srcSoloPercent + '%)');
        }
    }
}

analyze().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
