#!/usr/bin/env node
/**
 * Analyze PreIntake.ai email campaign click rates
 * Correlates emails sent with demo views in Firestore
 */

const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '..', 'secrets', 'serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

async function analyze() {
    console.log('📊 PreIntake.ai Click Rate Analysis');
    console.log('====================================\n');

    // Get date range for previous 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startDate = new Date(sevenDaysAgo.getFullYear(), sevenDaysAgo.getMonth(), sevenDaysAgo.getDate());
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); // Include today

    const dateRangeStr = `${startDate.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`;
    console.log(`📅 Date range: ${dateRangeStr}\n`);

    // Get all sent emails
    const allEmailsSnap = await db.collection('preintake_emails')
        .where('sent', '==', true)
        .get();

    console.log('📧 Total emails sent (all time):', allEmailsSnap.size);

    // Calculate date boundaries
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Count emails sent with demos vs without
    let withDemo = 0;
    let withoutDemo = 0;
    let last7DaysSent = 0;
    let last7DaysWithDemo = 0;
    let yesterdaySent = 0;
    let yesterdayWithDemo = 0;

    const leadIdsFromEmails = new Set();

    allEmailsSnap.forEach(doc => {
        const data = doc.data();
        if (data.demoGenerated) {
            withDemo++;
            if (data.preintakeLeadId) {
                leadIdsFromEmails.add(data.preintakeLeadId);
            }
        } else {
            withoutDemo++;
        }

        // Check date ranges
        if (data.sentTimestamp) {
            const sentDate = data.sentTimestamp.toDate();
            // Last 7 days
            if (sentDate >= startDate && sentDate < endDate) {
                last7DaysSent++;
                if (data.demoGenerated) {
                    last7DaysWithDemo++;
                }
            }
            // Yesterday
            if (sentDate >= yesterdayStart && sentDate < todayStart) {
                yesterdaySent++;
                if (data.demoGenerated) {
                    yesterdayWithDemo++;
                }
            }
        }
    });

    console.log('   With pre-generated demo:', withDemo);
    console.log('   Without demo (fallback):', withoutDemo);
    console.log('');
    console.log('📅 Yesterday:');
    console.log('   Emails sent:', yesterdaySent);
    console.log('   With demos:', yesterdayWithDemo);
    console.log('');
    console.log('📅 Last 7 days:');
    console.log('   Emails sent:', last7DaysSent);
    console.log('   With demos:', last7DaysWithDemo);
    console.log('');

    // Get all campaign-sourced leads
    const leadsSnap = await db.collection('preintake_leads')
        .where('source', '==', 'campaign')
        .get();

    console.log('📁 Campaign-sourced leads (demos):', leadsSnap.size);

    // Analyze each lead for tracking data
    let viewedCount = 0;
    let intakeStarted = 0;
    let intakeCompleted = 0;
    const leadDetails = [];

    leadsSnap.forEach(doc => {
        const data = doc.data();
        // Check for view tracking (new fields: firstViewedAt, lastViewedAt, viewCount)
        const hasView = data.firstViewedAt || data.lastViewedAt || data.viewCount > 0 ||
                        data.viewed || data.demoViewed || data.viewedAt || data.demoViewedAt;
        const hasIntakeStart = data.intakeStarted || data.chatStarted || data.conversationStarted;
        const hasIntakeComplete = data.intakeCompleted || data.leadDelivered || data.deliveryConfig;

        if (hasView) viewedCount++;
        if (hasIntakeStart) intakeStarted++;
        if (hasIntakeComplete) intakeCompleted++;

        // Store lead details
        leadDetails.push({
            id: doc.id,
            firmName: data.name || data.analysis?.firmName || 'Unknown',
            status: data.status,
            createdAt: data.createdAt?.toDate(),
            firstViewedAt: data.firstViewedAt?.toDate(),
            viewCount: data.viewCount || 0,
            hasDeliveryConfig: !!data.deliveryConfig,
            fields: Object.keys(data)
        });
    });

    console.log('');
    console.log('📊 Engagement Tracking:');
    console.log('   Leads with view tracking:', viewedCount);
    console.log('   Leads with intake started:', intakeStarted);
    console.log('   Leads with intake completed:', intakeCompleted);
    console.log('');

    // Show sample fields from first lead
    if (leadDetails.length > 0) {
        console.log('📋 Sample lead fields:', leadDetails[0].fields.slice(0, 15).join(', '));
    }

    // Check for any leads with status changes (indicates activity)
    const activeLeads = leadDetails.filter(l =>
        l.status !== 'demo_ready' || l.hasDeliveryConfig
    );

    console.log('');
    console.log('🎯 Active leads (status changed or has delivery config):', activeLeads.length);

    if (activeLeads.length > 0) {
        console.log('   Details:');
        activeLeads.forEach(l => {
            console.log(`   - ${l.firmName}: status=${l.status}, hasDeliveryConfig=${l.hasDeliveryConfig}`);
        });
    }

    // Calculate click rate based on view tracking
    console.log('\n📈 Click Rate Calculation (based on demo views):');

    // Count leads with views (the true "clicks")
    const viewedLeads = leadDetails.filter(l => l.viewCount > 0);

    if (withDemo > 0) {
        console.log('');
        console.log('   All Time:');
        console.log(`     Emails with demos: ${withDemo}`);
        console.log(`     Demos viewed: ${viewedLeads.length}`);
        console.log(`     Click Rate: ${(viewedLeads.length / withDemo * 100).toFixed(2)}%`);
    }

    if (last7DaysWithDemo > 0) {
        // Filter viewed leads to last 7 days
        const last7DaysViewed = viewedLeads.filter(l =>
            l.firstViewedAt && l.firstViewedAt >= startDate
        ).length;
        console.log('');
        console.log('   Last 7 Days:');
        console.log(`     Emails with demos: ${last7DaysWithDemo}`);
        console.log(`     Demos viewed: ${last7DaysViewed}`);
        console.log(`     Click Rate: ${(last7DaysViewed / last7DaysWithDemo * 100).toFixed(2)}%`);
    }

    if (yesterdayWithDemo > 0) {
        // Filter viewed leads to yesterday
        const yesterdayViewed = viewedLeads.filter(l =>
            l.firstViewedAt && l.firstViewedAt >= yesterdayStart && l.firstViewedAt < todayStart
        ).length;
        console.log('');
        console.log('   Yesterday:');
        console.log(`     Emails with demos: ${yesterdayWithDemo}`);
        console.log(`     Demos viewed: ${yesterdayViewed}`);
        console.log(`     Click Rate: ${(yesterdayViewed / yesterdayWithDemo * 100).toFixed(2)}%`);
    }

    if (withDemo === 0) {
        console.log('   No emails with pre-generated demos yet.');
        console.log('   Run the campaign with demo generation enabled to start tracking.');
    }

    // Check template versions used
    console.log('\n📋 Template Versions Used:');
    const versions = {};
    allEmailsSnap.forEach(doc => {
        const v = doc.data().templateVersion || 'unknown';
        versions[v] = (versions[v] || 0) + 1;
    });
    Object.entries(versions).sort((a,b) => b[1] - a[1]).forEach(([v, c]) => {
        console.log(`   ${v}: ${c}`);
    });

    // Show campaign lead details with view tracking
    console.log('\n📅 Campaign Lead Details:');
    leadDetails.forEach(l => {
        const created = l.createdAt ? l.createdAt.toISOString().split('T')[0] : 'unknown';
        const viewed = l.firstViewedAt ? l.firstViewedAt.toISOString().split('T')[0] : 'not viewed';
        const viewInfo = l.viewCount > 0 ? `viewed ${viewed} (${l.viewCount}x)` : 'not viewed';
        console.log(`   ${l.firmName}: created ${created}, ${viewInfo}, status=${l.status}`);
    });

    process.exit(0);
}

analyze().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
