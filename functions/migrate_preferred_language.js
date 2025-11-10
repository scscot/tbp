const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const COUNTRY_TO_LANGUAGE = {
  // Spanish-speaking countries
  'Spain': 'es',
  'Mexico': 'es',
  'Colombia': 'es',
  'Argentina': 'es',
  'Chile': 'es',
  'Peru': 'es',
  'Venezuela': 'es',
  'Ecuador': 'es',
  'Guatemala': 'es',
  'Cuba': 'es',
  'Bolivia': 'es',
  'Dominican Republic': 'es',
  'Honduras': 'es',
  'Paraguay': 'es',
  'El Salvador': 'es',
  'Nicaragua': 'es',
  'Costa Rica': 'es',
  'Panama': 'es',
  'Uruguay': 'es',
  'Puerto Rico': 'es',
  // Portuguese-speaking countries
  'Brazil': 'pt',
  'Portugal': 'pt',
  // German-speaking countries
  'Germany': 'de',
  'Austria': 'de',
  'Switzerland': 'de',
};

function inferLanguageFromCountry(country) {
  if (!country) return 'en';

  // Try exact match first
  if (COUNTRY_TO_LANGUAGE[country]) {
    return COUNTRY_TO_LANGUAGE[country];
  }

  // Try case-insensitive match
  const countryLower = country.toLowerCase();
  for (const [key, lang] of Object.entries(COUNTRY_TO_LANGUAGE)) {
    if (key.toLowerCase() === countryLower) {
      return lang;
    }
  }

  return 'en';
}

async function migratePreferredLanguage() {
  console.log('🚀 Starting preferredLanguage migration...');
  console.log('Note: Firestore cannot query for "field does not exist", so we process all users\n');

  const BATCH_SIZE = 500;
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let lastDoc = null;
  const languageStats = { en: 0, es: 0, pt: 0, de: 0 };
  const countryCounts = {};

  try {
    // Get total user count
    const totalSnapshot = await db.collection('users').count().get();
    const totalUsers = totalSnapshot.data().count;
    console.log(`📊 Total users in database: ${totalUsers}\n`);

    while (true) {
      let query = db.collection('users').limit(BATCH_SIZE);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();

      if (snapshot.empty) {
        console.log('✅ No more users to process');
        break;
      }

      console.log(`📦 Processing batch of ${snapshot.size} users...`);

      const batch = db.batch();
      let batchCount = 0;

      for (const doc of snapshot.docs) {
        const userData = doc.data();

        // Skip users who already have preferredLanguage set
        if (userData.preferredLanguage) {
          totalSkipped++;
          continue;
        }

        const country = userData.country || 'No country';
        const inferredLanguage = inferLanguageFromCountry(userData.country);

        // Track statistics
        countryCounts[country] = (countryCounts[country] || 0) + 1;
        languageStats[inferredLanguage]++;

        batch.update(doc.ref, {
          preferredLanguage: inferredLanguage
        });

        batchCount++;
        totalUpdated++;

        if (batchCount % 100 === 0) {
          console.log(`  ... ${batchCount} users queued for update`);
        }
      }

      // Only commit if we have updates
      if (batchCount > 0) {
        await batch.commit();
        console.log(`✅ Batch committed: ${batchCount} users updated`);
      } else {
        console.log(`⏭️  Batch skipped: all users already have preferredLanguage`);
      }

      totalProcessed += snapshot.size;
      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      console.log(`📊 Progress: ${totalProcessed}/${totalUsers} processed, ${totalUpdated} updated, ${totalSkipped} skipped\n`);

      if (snapshot.size < BATCH_SIZE) {
        break;
      }
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log(`📊 Final stats:`);
    console.log(`  Total processed: ${totalProcessed}`);
    console.log(`  Users updated: ${totalUpdated}`);
    console.log(`  Users skipped (already had language): ${totalSkipped}`);

    if (totalUpdated > 0) {
      console.log('\n📊 Language distribution (newly set):');
      console.log(`  English (en): ${languageStats.en}`);
      console.log(`  Spanish (es): ${languageStats.es}`);
      console.log(`  Portuguese (pt): ${languageStats.pt}`);
      console.log(`  German (de): ${languageStats.de}`);

      console.log('\n🌍 Top countries:');
      const sortedCountries = Object.entries(countryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      sortedCountries.forEach(([country, count]) => {
        const lang = inferLanguageFromCountry(country);
        console.log(`  ${country}: ${count} users (${lang})`);
      });
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  migratePreferredLanguage()
    .then(() => {
      console.log('✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { migratePreferredLanguage, inferLanguageFromCountry };
