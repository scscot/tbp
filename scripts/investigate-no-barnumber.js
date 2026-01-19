const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'teambuilder-plus-fe74d' });
}
const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

async function investigateNoBarNumber() {
  const snapshot = await db.collection('preintake_emails').get();

  const withoutBarNumber = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.barNumber === undefined) {
      withoutBarNumber.push({ id: doc.id, ...data });
    }
  });

  console.log('=== Investigation: Contacts Without barNumber ===\n');
  console.log('Total without barNumber:', withoutBarNumber.length);

  // Analyze fields present
  const fieldCounts = {};
  withoutBarNumber.forEach(doc => {
    Object.keys(doc).forEach(key => {
      fieldCounts[key] = (fieldCounts[key] || 0) + 1;
    });
  });

  console.log('\n--- Fields Present (and counts) ---');
  Object.entries(fieldCounts).sort((a, b) => b[1] - a[1]).forEach(([field, count]) => {
    console.log(`  ${field}: ${count}`);
  });

  // Analyze source field
  const sources = {};
  withoutBarNumber.forEach(doc => {
    const src = doc.source || 'undefined';
    sources[src] = (sources[src] || 0) + 1;
  });

  console.log('\n--- Source Field Distribution ---');
  Object.entries(sources).sort((a, b) => b[1] - a[1]).forEach(([src, count]) => {
    console.log(`  ${src}: ${count}`);
  });

  // Analyze email domains
  const domains = {};
  withoutBarNumber.forEach(doc => {
    if (doc.email) {
      const domain = doc.email.split('@')[1] || 'unknown';
      domains[domain] = (domains[domain] || 0) + 1;
    }
  });

  console.log('\n--- Top 15 Email Domains ---');
  Object.entries(domains).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([domain, count]) => {
    console.log(`  ${domain}: ${count}`);
  });

  // Check for state field
  const states = {};
  withoutBarNumber.forEach(doc => {
    const state = doc.state || 'undefined';
    states[state] = (states[state] || 0) + 1;
  });

  console.log('\n--- State Distribution ---');
  Object.entries(states).sort((a, b) => b[1] - a[1]).forEach(([state, count]) => {
    console.log(`  ${state}: ${count}`);
  });

  // Check for practiceArea field
  const practiceAreas = {};
  withoutBarNumber.forEach(doc => {
    const pa = doc.practiceArea || 'undefined';
    practiceAreas[pa] = (practiceAreas[pa] || 0) + 1;
  });

  console.log('\n--- Practice Area Distribution (top 10) ---');
  Object.entries(practiceAreas).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([pa, count]) => {
    console.log(`  ${pa}: ${count}`);
  });

  // Check website field
  const hasWebsite = withoutBarNumber.filter(d => d.website).length;
  const hasNoWebsite = withoutBarNumber.filter(d => !d.website).length;
  console.log('\n--- Website Field ---');
  console.log(`  Has website: ${hasWebsite}`);
  console.log(`  No website: ${hasNoWebsite}`);

  // Show 5 full sample documents
  console.log('\n--- 5 Full Sample Documents ---');
  withoutBarNumber.slice(0, 5).forEach((doc, i) => {
    console.log(`\nSample ${i + 1} (ID: ${doc.id}):`);
    Object.entries(doc).forEach(([key, value]) => {
      if (key !== 'id') {
        let displayValue = value;
        if (value && typeof value === 'object' && value.toDate) {
          displayValue = value.toDate().toISOString();
        } else if (typeof value === 'object') {
          displayValue = JSON.stringify(value);
        }
        console.log(`  ${key}: ${displayValue}`);
      }
    });
  });

  process.exit(0);
}

investigateNoBarNumber().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
