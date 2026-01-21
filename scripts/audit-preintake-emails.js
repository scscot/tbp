#!/usr/bin/env node
/**
 * Audit preintake_emails collection for data integrity
 * Checks all fields used by send-preintake-campaign.js
 */

const admin = require("firebase-admin");
const path = require("path");
const serviceAccount = require(path.join(__dirname, "..", "secrets", "serviceAccountKey.json"));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
db.settings({ databaseId: "preintake" });

const validSources = ["mibar", "flbar", "calbar", "ohbar"];

async function audit() {
    console.log("🔍 Auditing preintake_emails collection...\n");

    const snapshot = await db.collection("preintake_emails").get();
    console.log(`Total records: ${snapshot.size}\n`);

    const issues = {
        missingEmail: [],
        invalidEmail: [],
        missingSent: [],
        invalidSent: [],
        missingStatus: [],
        invalidStatus: [],
        missingRandomIndex: [],
        invalidRandomIndex: [],
        missingFirstName: [],
        missingLastName: [],
        missingFirmName: [],
        missingPracticeArea: [],
        missingState: [],
        invalidSource: [],
        undefinedFields: []
    };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validStatuses = ["pending", "sent", "failed", "unsubscribed"];

    snapshot.forEach(doc => {
        const d = doc.data();
        const id = doc.id;

        // Required: email
        if (!d.email) {
            issues.missingEmail.push({ id, data: d });
        } else if (typeof d.email !== 'string' || !emailRegex.test(d.email)) {
            issues.invalidEmail.push({ id, email: d.email });
        }

        // Required: sent (boolean)
        if (d.sent === undefined || d.sent === null) {
            issues.missingSent.push({ id });
        } else if (typeof d.sent !== 'boolean') {
            issues.invalidSent.push({ id, sent: d.sent, type: typeof d.sent });
        }

        // Required: status
        if (!d.status) {
            issues.missingStatus.push({ id });
        } else if (!validStatuses.includes(d.status)) {
            issues.invalidStatus.push({ id, status: d.status });
        }

        // Required: randomIndex (number)
        if (d.randomIndex === undefined || d.randomIndex === null) {
            issues.missingRandomIndex.push({ id });
        } else if (typeof d.randomIndex !== 'number' || isNaN(d.randomIndex)) {
            issues.invalidRandomIndex.push({ id, randomIndex: d.randomIndex });
        }

        // Important: firstName
        if (!d.firstName || d.firstName === 'undefined') {
            issues.missingFirstName.push({ id, firstName: d.firstName, email: d.email });
        }

        // Important: lastName
        if (!d.lastName || d.lastName === 'undefined') {
            issues.missingLastName.push({ id, lastName: d.lastName, email: d.email });
        }

        // Important: firmName
        if (!d.firmName || d.firmName === 'undefined') {
            issues.missingFirmName.push({ id, email: d.email });
        }

        // Important: practiceArea
        if (!d.practiceArea || d.practiceArea === 'Unknown' || d.practiceArea === 'undefined') {
            issues.missingPracticeArea.push({ id, practiceArea: d.practiceArea, email: d.email });
        }

        // Important: state
        if (!d.state || d.state === 'undefined') {
            issues.missingState.push({ id, email: d.email });
        }

        // Source validation
        if (!validSources.includes(d.source)) {
            issues.invalidSource.push({ id, source: d.source });
        }

        // Check for string "undefined" values in any field
        for (const [key, value] of Object.entries(d)) {
            if (value === 'undefined' || value === 'null') {
                issues.undefinedFields.push({ id, field: key, value });
            }
        }
    });

    // Print results
    console.log("=" .repeat(60));
    console.log("CRITICAL ISSUES (will break campaign):");
    console.log("=" .repeat(60));

    console.log(`\n❌ Missing email: ${issues.missingEmail.length}`);
    if (issues.missingEmail.length > 0 && issues.missingEmail.length <= 5) {
        issues.missingEmail.forEach(i => console.log(`   - ${i.id}`));
    }

    console.log(`❌ Invalid email format: ${issues.invalidEmail.length}`);
    if (issues.invalidEmail.length > 0 && issues.invalidEmail.length <= 5) {
        issues.invalidEmail.forEach(i => console.log(`   - ${i.id}: "${i.email}"`));
    }

    console.log(`❌ Missing 'sent' field: ${issues.missingSent.length}`);
    console.log(`❌ Invalid 'sent' type: ${issues.invalidSent.length}`);
    if (issues.invalidSent.length > 0 && issues.invalidSent.length <= 5) {
        issues.invalidSent.forEach(i => console.log(`   - ${i.id}: ${i.sent} (${i.type})`));
    }

    console.log(`❌ Missing 'status' field: ${issues.missingStatus.length}`);
    console.log(`❌ Invalid 'status' value: ${issues.invalidStatus.length}`);
    if (issues.invalidStatus.length > 0 && issues.invalidStatus.length <= 5) {
        issues.invalidStatus.forEach(i => console.log(`   - ${i.id}: "${i.status}"`));
    }

    console.log(`❌ Missing 'randomIndex': ${issues.missingRandomIndex.length}`);
    console.log(`❌ Invalid 'randomIndex' type: ${issues.invalidRandomIndex.length}`);

    console.log(`❌ Invalid source: ${issues.invalidSource.length}`);

    console.log("\n" + "=" .repeat(60));
    console.log("DATA QUALITY ISSUES (may affect personalization):");
    console.log("=" .repeat(60));

    console.log(`\n⚠️  Missing firstName: ${issues.missingFirstName.length}`);
    if (issues.missingFirstName.length > 0 && issues.missingFirstName.length <= 5) {
        issues.missingFirstName.forEach(i => console.log(`   - ${i.email} (firstName: ${i.firstName})`));
    }

    console.log(`⚠️  Missing lastName: ${issues.missingLastName.length}`);
    if (issues.missingLastName.length > 0 && issues.missingLastName.length <= 5) {
        issues.missingLastName.forEach(i => console.log(`   - ${i.email} (lastName: ${i.lastName})`));
    }

    console.log(`⚠️  Missing firmName: ${issues.missingFirmName.length}`);
    console.log(`⚠️  Missing/Unknown practiceArea: ${issues.missingPracticeArea.length}`);
    console.log(`⚠️  Missing state: ${issues.missingState.length}`);

    console.log(`\n⚠️  String 'undefined'/'null' values: ${issues.undefinedFields.length}`);
    if (issues.undefinedFields.length > 0 && issues.undefinedFields.length <= 10) {
        issues.undefinedFields.forEach(i => console.log(`   - ${i.id}: ${i.field}="${i.value}"`));
    }

    // Summary
    const criticalCount = issues.missingEmail.length + issues.invalidEmail.length +
        issues.missingSent.length + issues.invalidSent.length +
        issues.missingStatus.length + issues.invalidStatus.length +
        issues.missingRandomIndex.length + issues.invalidRandomIndex.length +
        issues.invalidSource.length;

    const qualityCount = issues.missingFirstName.length + issues.missingLastName.length +
        issues.missingFirmName.length + issues.missingPracticeArea.length +
        issues.missingState.length + issues.undefinedFields.length;

    console.log("\n" + "=" .repeat(60));
    console.log("SUMMARY:");
    console.log("=" .repeat(60));
    console.log(`Total records: ${snapshot.size}`);
    console.log(`Critical issues: ${criticalCount}`);
    console.log(`Quality issues: ${qualityCount}`);

    if (criticalCount === 0) {
        console.log("\n✅ No critical issues found - campaign can run safely");
    } else {
        console.log("\n❌ Critical issues found - fix before running campaign");
    }

    // Extra analysis for missing firmName
    if (issues.missingFirmName.length > 0) {
        console.log("\n" + "-".repeat(60));
        console.log("MISSING FIRMNAME ANALYSIS:");
        console.log("-".repeat(60));

        // Collect full data for missing firmName records
        const missingFirmNameData = [];
        snapshot.forEach(doc => {
            const d = doc.data();
            if (!d.firmName || d.firmName === 'undefined') {
                missingFirmNameData.push(d);
            }
        });

        // By source
        const sources = {};
        missingFirmNameData.forEach(d => {
            sources[d.source || "undefined"] = (sources[d.source || "undefined"] || 0) + 1;
        });
        console.log("\nBy source:");
        Object.entries(sources).sort((a,b) => b[1]-a[1]).forEach(([s,c]) => console.log("  " + s + ": " + c));

        // Check if they have firstName/lastName (script can construct firmName from these)
        let hasNames = 0;
        missingFirmNameData.forEach(d => {
            if (d.firstName && d.lastName) hasNames++;
        });
        console.log("\nWith firstName + lastName (fallback available):", hasNames, "of", missingFirmNameData.length);

        if (hasNames === missingFirmNameData.length) {
            console.log("✅ All missing firmName records have firstName/lastName - script will use fallback");
        }

        // Samples
        console.log("\nSamples:");
        missingFirmNameData.slice(0, 5).forEach(d => {
            console.log("  -", d.firstName, d.lastName, "|", d.email, "|", d.source);
        });
    }

    return { issues, criticalCount, qualityCount };
}

audit().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
