#!/usr/bin/env node
/**
 * Analyze Purchased Leads Performance
 *
 * Compares performance across lead sources (Apollo, Apache, Exact Data)
 * for A/B testing and ROI analysis.
 *
 * Usage:
 *   node analyze-purchased-leads.js
 *   node analyze-purchased-leads.js --source=apollo
 *   node analyze-purchased-leads.js --batch=apollo_1234567890
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

// Parse arguments
const args = process.argv.slice(2);
const sourceFilter = args.find(a => a.startsWith('--source='))?.split('=')[1];
const batchFilter = args.find(a => a.startsWith('--batch='))?.split('=')[1];

async function getSourceStats() {
  const statsSnapshot = await db.collection('purchased_leads_stats').get();
  const stats = {};

  statsSnapshot.forEach(doc => {
    stats[doc.id] = doc.data();
  });

  return stats;
}

async function getBatchStats() {
  let query = db.collection('purchased_leads_batches')
    .where('status', '!=', 'example')
    .orderBy('status')
    .orderBy('purchaseDate', 'desc');

  if (batchFilter) {
    const batchDoc = await db.collection('purchased_leads_batches').doc(batchFilter).get();
    return batchDoc.exists ? [{ id: batchDoc.id, ...batchDoc.data() }] : [];
  }

  const snapshot = await query.limit(20).get();
  const batches = [];

  snapshot.forEach(doc => {
    batches.push({ id: doc.id, ...doc.data() });
  });

  return batches;
}

async function getLeadStats(sourceFilter = null) {
  let query = db.collection('purchased_leads');

  if (sourceFilter) {
    query = query.where('source', '==', sourceFilter);
  }

  const snapshot = await query.get();

  const stats = {
    total: 0,
    bySource: {},
    byStatus: {},
    byTemplate: {},
    sent: 0,
    delivered: 0,
    clicked: 0,
    failed: 0
  };

  snapshot.forEach(doc => {
    const lead = doc.data();
    stats.total++;

    // By source
    const source = lead.source || 'unknown';
    if (!stats.bySource[source]) {
      stats.bySource[source] = {
        total: 0,
        sent: 0,
        delivered: 0,
        clicked: 0,
        failed: 0,
        pending: 0,
        costPerLead: lead.costPerLead || 0,
        totalCost: 0
      };
    }
    stats.bySource[source].total++;
    stats.bySource[source].totalCost += lead.costPerLead || 0;
    if (lead.sent) stats.bySource[source].sent++;
    if (lead.delivered) stats.bySource[source].delivered++;
    if (lead.clicked) stats.bySource[source].clicked++;
    if (lead.status === 'failed') stats.bySource[source].failed++;
    if (lead.status === 'pending') stats.bySource[source].pending++;

    // By status
    const status = lead.status || 'pending';
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

    // By template version
    if (lead.templateVersion) {
      if (!stats.byTemplate[lead.templateVersion]) {
        stats.byTemplate[lead.templateVersion] = { sent: 0, clicked: 0 };
      }
      stats.byTemplate[lead.templateVersion].sent++;
      if (lead.clicked) stats.byTemplate[lead.templateVersion].clicked++;
    }

    // Totals
    if (lead.sent) stats.sent++;
    if (lead.delivered) stats.delivered++;
    if (lead.clicked) stats.clicked++;
    if (lead.status === 'failed') stats.failed++;
  });

  return stats;
}

function printDivider(char = '=', length = 70) {
  console.log(char.repeat(length));
}

function printHeader(title) {
  console.log('\n' + title);
  printDivider('-', title.length + 10);
}

function formatPercent(num, denom) {
  if (!denom || denom === 0) return '0.0%';
  return ((num / denom) * 100).toFixed(1) + '%';
}

function formatCurrency(amount) {
  return '$' + amount.toFixed(2);
}

async function main() {
  console.log('\n');
  printDivider();
  console.log('PURCHASED LEADS PERFORMANCE ANALYSIS');
  printDivider();
  console.log(`Generated: ${new Date().toISOString()}`);
  if (sourceFilter) console.log(`Filter: source=${sourceFilter}`);
  if (batchFilter) console.log(`Filter: batch=${batchFilter}`);

  // Get data
  const sourceStats = await getSourceStats();
  const batches = await getBatchStats();
  const leadStats = await getLeadStats(sourceFilter);

  // =========================================================================
  // OVERALL SUMMARY
  // =========================================================================
  printHeader('📊 OVERALL SUMMARY');

  console.log(`Total Leads:      ${leadStats.total.toLocaleString()}`);
  console.log(`Total Sent:       ${leadStats.sent.toLocaleString()}`);
  console.log(`Total Delivered:  ${leadStats.delivered.toLocaleString()}`);
  console.log(`Total Clicked:    ${leadStats.clicked.toLocaleString()}`);
  console.log(`Total Failed:     ${leadStats.failed.toLocaleString()}`);
  console.log('');
  console.log(`Delivery Rate:    ${formatPercent(leadStats.delivered, leadStats.sent)}`);
  console.log(`Click Rate:       ${formatPercent(leadStats.clicked, leadStats.sent)}`);
  console.log(`Failure Rate:     ${formatPercent(leadStats.failed, leadStats.sent)}`);

  // =========================================================================
  // SOURCE COMPARISON (A/B Test Results)
  // =========================================================================
  printHeader('🏆 SOURCE COMPARISON (A/B Test Results)');

  console.log('Source'.padEnd(15) +
    'Total'.padStart(8) +
    'Sent'.padStart(8) +
    'Click'.padStart(8) +
    'Rate'.padStart(8) +
    'Cost'.padStart(10) +
    '$/Click'.padStart(10));
  printDivider('-');

  const sourceRankings = [];

  for (const [source, data] of Object.entries(leadStats.bySource)) {
    const clickRate = data.sent > 0 ? (data.clicked / data.sent) : 0;
    const costPerClick = data.clicked > 0 ? (data.totalCost / data.clicked) : 0;

    console.log(
      source.padEnd(15) +
      data.total.toString().padStart(8) +
      data.sent.toString().padStart(8) +
      data.clicked.toString().padStart(8) +
      formatPercent(data.clicked, data.sent).padStart(8) +
      formatCurrency(data.totalCost).padStart(10) +
      (data.clicked > 0 ? formatCurrency(costPerClick) : 'N/A').padStart(10)
    );

    sourceRankings.push({
      source,
      clickRate,
      costPerClick,
      clicks: data.clicked,
      cost: data.totalCost
    });
  }

  // Determine winner
  if (sourceRankings.length > 1) {
    const winner = sourceRankings
      .filter(s => s.clicks > 0)
      .sort((a, b) => {
        // Sort by click rate first, then by cost per click (lower is better)
        if (Math.abs(a.clickRate - b.clickRate) > 0.001) {
          return b.clickRate - a.clickRate;
        }
        return a.costPerClick - b.costPerClick;
      })[0];

    if (winner) {
      console.log('');
      console.log(`🏆 BEST PERFORMER: ${winner.source.toUpperCase()}`);
      console.log(`   Click Rate: ${(winner.clickRate * 100).toFixed(2)}%`);
      console.log(`   Cost/Click: ${formatCurrency(winner.costPerClick)}`);
    }
  }

  // =========================================================================
  // TEMPLATE VERSION COMPARISON
  // =========================================================================
  if (Object.keys(leadStats.byTemplate).length > 0) {
    printHeader('📧 TEMPLATE VERSION COMPARISON');

    console.log('Template'.padEnd(15) +
      'Sent'.padStart(10) +
      'Clicked'.padStart(10) +
      'Click Rate'.padStart(12));
    printDivider('-', 47);

    for (const [template, data] of Object.entries(leadStats.byTemplate)) {
      console.log(
        template.toUpperCase().padEnd(15) +
        data.sent.toString().padStart(10) +
        data.clicked.toString().padStart(10) +
        formatPercent(data.clicked, data.sent).padStart(12)
      );
    }

    // Determine winning template
    const templates = Object.entries(leadStats.byTemplate)
      .map(([name, data]) => ({
        name,
        clickRate: data.sent > 0 ? data.clicked / data.sent : 0,
        ...data
      }))
      .sort((a, b) => b.clickRate - a.clickRate);

    if (templates.length >= 2 && templates[0].sent >= 10) {
      console.log('');
      console.log(`🏆 WINNING TEMPLATE: ${templates[0].name.toUpperCase()}`);
      console.log(`   Click Rate: ${(templates[0].clickRate * 100).toFixed(2)}%`);
      console.log(`   vs ${templates[1].name}: ${(templates[1].clickRate * 100).toFixed(2)}%`);
    }
  }

  // =========================================================================
  // STATUS BREAKDOWN
  // =========================================================================
  printHeader('📋 STATUS BREAKDOWN');

  for (const [status, count] of Object.entries(leadStats.byStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`${status.padEnd(20)} ${count.toLocaleString().padStart(8)} (${formatPercent(count, leadStats.total)})`);
  }

  // =========================================================================
  // RECENT BATCHES
  // =========================================================================
  if (batches.length > 0) {
    printHeader('📦 RECENT BATCHES');

    console.log('Batch ID'.padEnd(30) +
      'Source'.padStart(10) +
      'Leads'.padStart(8) +
      'Sent'.padStart(8) +
      'Click'.padStart(8) +
      'Status'.padStart(12));
    printDivider('-');

    for (const batch of batches) {
      console.log(
        batch.batchId.substring(0, 29).padEnd(30) +
        (batch.source || '-').padStart(10) +
        (batch.totalLeads || 0).toString().padStart(8) +
        (batch.sent || 0).toString().padStart(8) +
        (batch.clicked || 0).toString().padStart(8) +
        (batch.status || 'unknown').padStart(12)
      );
    }
  }

  // =========================================================================
  // ROI ANALYSIS
  // =========================================================================
  printHeader('💰 ROI ANALYSIS');

  let bestROI = null;
  let worstROI = null;

  for (const [source, data] of Object.entries(leadStats.bySource)) {
    if (data.clicked > 0 && data.totalCost > 0) {
      const cpc = data.totalCost / data.clicked;

      console.log(`\n${source.toUpperCase()}:`);
      console.log(`  Total Investment:  ${formatCurrency(data.totalCost)}`);
      console.log(`  Total Clicks:      ${data.clicked}`);
      console.log(`  Cost per Click:    ${formatCurrency(cpc)}`);

      // Assuming $6.99/mo subscription, 1% trial-to-paid conversion
      const estimatedRevenue = data.clicked * 0.01 * 6.99 * 12; // Annual value
      const roi = ((estimatedRevenue - data.totalCost) / data.totalCost) * 100;
      console.log(`  Est. Annual Rev:   ${formatCurrency(estimatedRevenue)} (1% conv, $6.99/mo)`);
      console.log(`  Est. ROI:          ${roi.toFixed(1)}%`);

      if (!bestROI || cpc < bestROI.cpc) {
        bestROI = { source, cpc };
      }
      if (!worstROI || cpc > worstROI.cpc) {
        worstROI = { source, cpc };
      }
    }
  }

  if (bestROI && worstROI && bestROI.source !== worstROI.source) {
    console.log('\n📈 RECOMMENDATION:');
    console.log(`   Scale: ${bestROI.source.toUpperCase()} (${formatCurrency(bestROI.cpc)}/click)`);
    console.log(`   Pause: ${worstROI.source.toUpperCase()} (${formatCurrency(worstROI.cpc)}/click)`);
  }

  // =========================================================================
  // SUMMARY JSON
  // =========================================================================
  printHeader('📄 JSON SUMMARY');

  const summary = {
    generated: new Date().toISOString(),
    total: leadStats.total,
    sent: leadStats.sent,
    clicked: leadStats.clicked,
    overallClickRate: leadStats.sent > 0 ? (leadStats.clicked / leadStats.sent) : 0,
    bySource: Object.fromEntries(
      Object.entries(leadStats.bySource).map(([source, data]) => [
        source,
        {
          total: data.total,
          sent: data.sent,
          clicked: data.clicked,
          clickRate: data.sent > 0 ? data.clicked / data.sent : 0,
          totalCost: data.totalCost,
          costPerClick: data.clicked > 0 ? data.totalCost / data.clicked : null
        }
      ])
    ),
    byTemplate: Object.fromEntries(
      Object.entries(leadStats.byTemplate).map(([template, data]) => [
        template,
        {
          sent: data.sent,
          clicked: data.clicked,
          clickRate: data.sent > 0 ? data.clicked / data.sent : 0
        }
      ])
    ),
    bestSource: bestROI?.source || null,
    worstSource: worstROI?.source || null
  };

  console.log(JSON.stringify(summary, null, 2));

  console.log('\n');
  printDivider();
  console.log('Analysis complete.');
  printDivider();

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
