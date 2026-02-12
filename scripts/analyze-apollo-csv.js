#!/usr/bin/env node
/**
 * Analyze Apollo.io contacts CSV export
 * Returns stats on total contacts, valid/invalid emails, breakdown by company
 */

const fs = require('fs');
const readline = require('readline');

let totalContacts = 0;
let validEmails = 0;
let invalidEmails = 0;
const companyBreakdown = {};
let headers = [];
let emailIndex = -1;
let companyIndex = -1;

// Simple email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Parse CSV line (handles quoted fields)
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

const rl = readline.createInterface({
  input: fs.createReadStream('/Users/sscott/tbp/purchased-emails/apollo-contacts-export.csv'),
  crlfDelay: Infinity
});

let isFirstLine = true;

rl.on('line', (line) => {
  const fields = parseCSVLine(line);

  if (isFirstLine) {
    headers = fields;
    // Find email and company column indices
    emailIndex = headers.findIndex(h => h.toLowerCase() === 'email');
    companyIndex = headers.findIndex(h => h.toLowerCase() === 'company' || h.toLowerCase() === 'company name');
    isFirstLine = false;
    return;
  }

  totalContacts++;

  const email = emailIndex >= 0 ? (fields[emailIndex] || '') : '';
  const company = companyIndex >= 0 ? (fields[companyIndex] || 'Unknown') : 'Unknown';

  // Validate email
  const isValid = email && emailRegex.test(email.trim());
  if (isValid) {
    validEmails++;
  } else {
    invalidEmails++;
  }

  // Company breakdown
  if (!companyBreakdown[company]) {
    companyBreakdown[company] = { total: 0, valid: 0, invalid: 0 };
  }
  companyBreakdown[company].total++;
  if (isValid) {
    companyBreakdown[company].valid++;
  } else {
    companyBreakdown[company].invalid++;
  }
});

rl.on('close', () => {
  console.log('=== APOLLO CONTACTS ANALYSIS REPORT ===\n');
  console.log('SUMMARY:');
  console.log('Total Contacts:', totalContacts);
  console.log('Valid Emails:', validEmails);
  console.log('Invalid Emails:', invalidEmails);
  console.log('Valid Email Rate:', (validEmails / totalContacts * 100).toFixed(1) + '%');
  console.log('\n');

  // Sort companies by count
  const sortedCompanies = Object.entries(companyBreakdown)
    .sort((a, b) => b[1].total - a[1].total);

  console.log('BREAKDOWN BY COMPANY (sorted by total):');
  console.log('-'.repeat(80));
  console.log('Company'.padEnd(40) + 'Total'.padStart(8) + 'Valid'.padStart(8) + 'Invalid'.padStart(8));
  console.log('-'.repeat(80));

  for (const [company, stats] of sortedCompanies) {
    console.log(
      company.substring(0, 39).padEnd(40) +
      stats.total.toString().padStart(8) +
      stats.valid.toString().padStart(8) +
      stats.invalid.toString().padStart(8)
    );
  }
  console.log('-'.repeat(80));
  console.log('TOTALS'.padEnd(40) + totalContacts.toString().padStart(8) + validEmails.toString().padStart(8) + invalidEmails.toString().padStart(8));
});
