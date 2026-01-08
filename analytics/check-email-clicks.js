const { BetaAnalyticsDataClient } = require("@google-analytics/data");

const analyticsDataClient = new BetaAnalyticsDataClient({
    keyFilename: "../secrets/ga4-service-account.json"
});

async function getEmailCampaignClicks() {
    const propertyId = "478877868";
    
    const [response] = await analyticsDataClient.runReport({
        property: "properties/" + propertyId,
        dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
        dimensions: [
            { name: "sessionSource" },
            { name: "sessionMedium" },
            { name: "sessionCampaignName" },
            { name: "date" }
        ],
        metrics: [
            { name: "sessions" },
            { name: "totalUsers" }
        ],
        dimensionFilter: {
            filter: {
                fieldName: "sessionMedium",
                stringFilter: { value: "outreach" }
            }
        },
        orderBys: [{ dimension: { dimensionName: "date" }, desc: true }]
    });

    console.log("📊 PreIntake Email Campaign - GA4 Click Data (Last 7 Days)");
    console.log("============================================================\n");
    
    if (!response.rows || response.rows.length === 0) {
        console.log("No clicks tracked from email campaign yet.");
        console.log("(Looking for UTM: utm_medium=outreach)");
    } else {
        let totalSessions = 0;
        let totalUsers = 0;
        
        response.rows.forEach(row => {
            const date = row.dimensionValues[3].value;
            const sessions = parseInt(row.metricValues[0].value);
            const users = parseInt(row.metricValues[1].value);
            totalSessions += sessions;
            totalUsers += users;
            
            const formattedDate = date.slice(0,4) + "-" + date.slice(4,6) + "-" + date.slice(6,8);
            console.log(formattedDate + ": " + sessions + " sessions, " + users + " users");
        });
        
        console.log("\n📈 Totals:");
        console.log("   Sessions:", totalSessions);
        console.log("   Users:", totalUsers);
    }
}

getEmailCampaignClicks().catch(err => {
    console.error("GA4 Error:", err.message);
    process.exit(1);
});
