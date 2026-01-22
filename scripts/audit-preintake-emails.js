#!/usr/bin/env node
/**
 * Audit preintake_emails collection for data integrity
 * Checks all fields used by send-preintake-campaign.js
 * Sends email alert if critical issues are found
 */

const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const path = require("path");
const serviceAccount = require(path.join(__dirname, "..", "secrets", "serviceAccountKey.json"));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
db.settings({ databaseId: "preintake" });

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
        missingSource: [],
        undefinedFields: []
    };

    // Track source distribution (source-independent)
    const sourceDistribution = {};

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

        // Source tracking (source-independent)
        const source = d.source || 'missing';
        sourceDistribution[source] = (sourceDistribution[source] || 0) + 1;
        if (!d.source) {
            issues.missingSource.push({ id, email: d.email });
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

    console.log(`❌ Missing source: ${issues.missingSource.length}`);

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

    // Source distribution
    console.log("\n" + "=" .repeat(60));
    console.log("SOURCE DISTRIBUTION:");
    console.log("=" .repeat(60));
    Object.entries(sourceDistribution)
        .sort((a, b) => b[1] - a[1])
        .forEach(([source, count]) => {
            const pct = ((count / snapshot.size) * 100).toFixed(1);
            console.log(`   ${source}: ${count} (${pct}%)`);
        });

    // Summary
    const criticalCount = issues.missingEmail.length + issues.invalidEmail.length +
        issues.missingSent.length + issues.invalidSent.length +
        issues.missingStatus.length + issues.invalidStatus.length +
        issues.missingRandomIndex.length + issues.invalidRandomIndex.length +
        issues.missingSource.length;

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

    return { issues, criticalCount, qualityCount, totalRecords: snapshot.size, sourceDistribution };
}

async function sendAuditEmail(auditResult) {
    const { criticalCount, qualityCount, totalRecords, issues, sourceDistribution } = auditResult;

    // Only send if SMTP credentials are available
    if (!process.env.PREINTAKE_SMTP_USER || !process.env.PREINTAKE_SMTP_PASS) {
        console.log("\n⚠️  SMTP credentials not configured - skipping email");
        return;
    }

    const transporter = nodemailer.createTransport({
        host: "smtp.dreamhost.com",
        port: 587,
        secure: false,
        auth: {
            user: process.env.PREINTAKE_SMTP_USER,
            pass: process.env.PREINTAKE_SMTP_PASS
        }
    });

    // Build critical issue details
    const criticalDetails = [];
    if (issues.missingEmail.length > 0) criticalDetails.push(`Missing email: ${issues.missingEmail.length}`);
    if (issues.invalidEmail.length > 0) criticalDetails.push(`Invalid email format: ${issues.invalidEmail.length}`);
    if (issues.missingSent.length > 0) criticalDetails.push(`Missing 'sent' field: ${issues.missingSent.length}`);
    if (issues.invalidSent.length > 0) criticalDetails.push(`Invalid 'sent' type: ${issues.invalidSent.length}`);
    if (issues.missingStatus.length > 0) criticalDetails.push(`Missing 'status' field: ${issues.missingStatus.length}`);
    if (issues.invalidStatus.length > 0) criticalDetails.push(`Invalid 'status' value: ${issues.invalidStatus.length}`);
    if (issues.missingRandomIndex.length > 0) criticalDetails.push(`Missing 'randomIndex': ${issues.missingRandomIndex.length}`);
    if (issues.invalidRandomIndex.length > 0) criticalDetails.push(`Invalid 'randomIndex' type: ${issues.invalidRandomIndex.length}`);
    if (issues.missingSource.length > 0) criticalDetails.push(`Missing source: ${issues.missingSource.length}`);

    // Build quality issue details
    const qualityDetails = [];
    if (issues.missingFirstName.length > 0) qualityDetails.push(`Missing firstName: ${issues.missingFirstName.length}`);
    if (issues.missingLastName.length > 0) qualityDetails.push(`Missing lastName: ${issues.missingLastName.length}`);
    if (issues.missingFirmName.length > 0) qualityDetails.push(`Missing firmName: ${issues.missingFirmName.length}`);
    if (issues.missingPracticeArea.length > 0) qualityDetails.push(`Missing practiceArea: ${issues.missingPracticeArea.length}`);
    if (issues.missingState.length > 0) qualityDetails.push(`Missing state: ${issues.missingState.length}`);
    if (issues.undefinedFields.length > 0) qualityDetails.push(`String 'undefined'/'null' values: ${issues.undefinedFields.length}`);

    // Source distribution
    const sourceLines = Object.entries(sourceDistribution)
        .sort((a, b) => b[1] - a[1])
        .map(([source, count]) => `  ${source}: ${count} (${((count / totalRecords) * 100).toFixed(1)}%)`)
        .join('\n');

    // Determine subject and status based on issues
    const statusIcon = criticalCount > 0 ? '⚠️' : '✅';
    const statusText = criticalCount > 0 ? `${criticalCount} Critical Issues` : 'All Clear';
    const subject = `${statusIcon} PreIntake Audit: ${statusText} (${totalRecords.toLocaleString()} records)`;

    const criticalSection = criticalCount > 0
        ? `CRITICAL ISSUES (${criticalCount}):\n${criticalDetails.map(d => `  ❌ ${d}`).join('\n')}\n\n`
        : `CRITICAL ISSUES: None ✅\n\n`;

    const qualitySection = qualityCount > 0
        ? `QUALITY ISSUES (${qualityCount}):\n${qualityDetails.map(d => `  ⚠️ ${d}`).join('\n')}\n\n`
        : `QUALITY ISSUES: None ✅\n\n`;

    const actionLine = criticalCount > 0
        ? 'Action Required: Fix critical issues before running the email campaign.'
        : 'Status: Database is healthy - email campaign can run safely.';

    const emailBody = `
PreIntake Email Collection Audit Report
${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

SUMMARY
-------
Total Records: ${totalRecords.toLocaleString()}
Critical Issues: ${criticalCount}
Quality Issues: ${qualityCount}

${criticalSection}${qualitySection}SOURCE DISTRIBUTION:
${sourceLines}

${actionLine}

---
This is an automated daily report from the PreIntake audit workflow.
    `.trim();

    try {
        await transporter.sendMail({
            from: process.env.PREINTAKE_SMTP_USER,
            to: "scscot@gmail.com",
            subject,
            text: emailBody
        });
        console.log("\n📧 Audit report email sent to scscot@gmail.com");
    } catch (err) {
        console.error("\n❌ Failed to send audit email:", err.message);
    }
}

audit().then(async (result) => {
    // Always send audit email (daily report)
    await sendAuditEmail(result);

    // Exit with error code if critical issues found
    if (result.criticalCount > 0) {
        process.exit(1);
    }
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
