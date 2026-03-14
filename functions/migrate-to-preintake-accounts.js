/**
 * Migration script to move existing subscribers from preintake_leads to preintake_accounts
 *
 * Usage:
 *   node migrate-to-preintake-accounts.js
 *   node migrate-to-preintake-accounts.js --dry-run   # Preview without making changes
 */

const admin = require('firebase-admin');
const serviceAccount = require('../secrets/serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

const DRY_RUN = process.argv.includes('--dry-run');

async function migrateExistingSubscribers() {
    console.log('='.repeat(60));
    console.log('PreIntake Accounts Migration Script');
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
    console.log('='.repeat(60));
    console.log('');

    try {
        // Find all active subscribers in preintake_leads
        const snapshot = await db.collection('preintake_leads')
            .where('subscriptionStatus', '==', 'active')
            .get();

        if (snapshot.empty) {
            console.log('No active subscribers found in preintake_leads.');
            return;
        }

        console.log(`Found ${snapshot.size} active subscriber(s) to migrate.\n`);

        for (const doc of snapshot.docs) {
            const leadData = doc.data();
            const leadId = doc.id;
            const email = leadData.deliveryEmail || leadData.email;

            console.log(`\nProcessing: ${email}`);
            console.log(`  Lead ID: ${leadId}`);
            console.log(`  Firm: ${leadData.firmName || 'N/A'}`);
            console.log(`  Stripe Customer: ${leadData.stripeCustomerId || 'N/A'}`);
            console.log(`  Subscription: ${leadData.stripeSubscriptionId || 'N/A'}`);

            // Check if already migrated
            const existingAccount = await db.collection('preintake_accounts').doc(leadId).get();
            if (existingAccount.exists) {
                console.log(`  ⚠️  Already exists in preintake_accounts - SKIPPING`);
                continue;
            }

            // Build account data
            const accountData = {
                // Copy relevant lead data
                email: leadData.email || email,
                firmName: leadData.firmName || '',
                firstName: leadData.firstName || '',
                lastName: leadData.lastName || '',
                name: leadData.name || '',
                website: leadData.website || '',
                primaryPracticeArea: leadData.primaryPracticeArea || null,
                additionalPracticeAreas: leadData.additionalPracticeAreas || [],
                practiceAreas: leadData.practiceAreas || [],
                confirmedPracticeAreas: leadData.confirmedPracticeAreas || null,
                analysis: leadData.analysis || null,
                deepResearch: leadData.deepResearch || null,
                barNumber: leadData.barNumber || null,
                source: leadData.source || 'migration',

                // Subscription data
                status: 'active',
                stripeCustomerId: leadData.stripeCustomerId || null,
                stripeSubscriptionId: leadData.stripeSubscriptionId || null,
                subscriptionStatus: 'active',
                deliveryEmail: leadData.deliveryEmail || email,
                hasWebsite: leadData.hasWebsite !== false,
                deliveryMethod: leadData.deliveryMethod || (leadData.hasWebsite !== false ? 'embed' : 'hosted'),
                intakeCode: leadData.intakeCode || null,
                hostedIntakeUrl: leadData.hostedIntakeUrl || null,

                // Password (if set)
                passwordHash: leadData.passwordHash || null,

                // Timestamps
                createdAt: leadData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
                activatedAt: leadData.activatedAt || admin.firestore.FieldValue.serverTimestamp(),
                migratedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),

                // Reference to original lead
                originalLeadId: leadId,
            };

            if (DRY_RUN) {
                console.log('  📋 Would create account document with:');
                console.log(`     - email: ${accountData.email}`);
                console.log(`     - firmName: ${accountData.firmName}`);
                console.log(`     - stripeCustomerId: ${accountData.stripeCustomerId}`);
                console.log(`     - passwordHash: ${accountData.passwordHash ? '[SET]' : '[NOT SET]'}`);
            } else {
                // Create account document
                await db.collection('preintake_accounts').doc(leadId).set(accountData);

                // Mark lead as converted
                await db.collection('preintake_leads').doc(leadId).update({
                    status: 'converted',
                    convertedToAccountAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                console.log('  ✅ Successfully migrated to preintake_accounts');
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('Migration complete!');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    }
}

migrateExistingSubscribers()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
