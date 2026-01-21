const admin = require("firebase-admin");
const path = require("path");
const serviceAccount = require(path.join(__dirname, "..", "secrets", "serviceAccountKey.json"));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
db.settings({ databaseId: "preintake" });

const validSources = ["mibar", "flbar", "calbar", "ohbar"];

async function analyzeSource() {
    const snapshot = await db.collection("preintake_emails").get();

    console.log("Total records:", snapshot.size);

    const legacy = [];
    snapshot.forEach(doc => {
        const source = doc.data().source;
        if (validSources.indexOf(source) === -1) {
            legacy.push(doc.data());
        }
    });

    console.log("Non-scraper records:", legacy.length);

    // By state
    const states = {};
    legacy.forEach(d => {
        const s = d.state || "undefined";
        states[s] = (states[s] || 0) + 1;
    });
    console.log("\nBy state (top 10):");
    Object.entries(states).sort((a,b) => b[1]-a[1]).slice(0,10).forEach(([s,c]) => console.log("  " + s + ": " + c));

    // By practiceArea
    const areas = {};
    legacy.forEach(d => {
        const a = d.practiceArea || "undefined";
        areas[a] = (areas[a] || 0) + 1;
    });
    console.log("\nBy practiceArea:");
    Object.entries(areas).sort((a,b) => b[1]-a[1]).forEach(([a,c]) => console.log("  " + a + ": " + c));

    // Sent status
    let sent = legacy.filter(d => d.sent).length;
    console.log("\nSent:", sent, "| Unsent:", legacy.length - sent);

    // Samples
    console.log("\nSample records:");
    legacy.slice(0, 8).forEach(d => {
        console.log("  -", d.firstName, d.lastName, "|", d.state, "|", d.practiceArea, "|", d.email);
    });
}

analyzeSource().then(() => process.exit(0));
