#!/usr/bin/env node

/**
 * Validates recruiting message templates against character caps for SMS/push delivery.
 *
 * Rules:
 * - SMS body: ≤140 chars (warn at 90%, fail at 100%)
 * - Push title: ≤65 chars
 * - Push body: ≤140 chars
 *
 * Expansion factors (worst-case placeholders):
 * - {prospectName}: 20 chars
 * - {senderFirst}: 12 chars
 * - {companyName}: 14 chars
 * - {shortLink}: 20 chars
 * - {inviteLink}: 45 chars
 * - {days}/{remaining}: 2 digits
 *
 * For ICU plural/select, tests the longest branch.
 */

const fs = require('fs');
const path = require('path');

// Placeholder expansion rules (worst-case character counts)
const PLACEHOLDER_EXPANSION = {
  prospectName: 20,
  senderFirst: 12,
  companyName: 14,
  shortLink: 20,
  inviteLink: 45,
  days: 2,
  remaining: 2,
  count: 2,
};

// Character caps for different delivery channels
const CAPS = {
  sms: 140,
  pushTitle: 65,
  pushBody: 140,
};

// Warning threshold (90% of cap)
const WARNING_THRESHOLD = 0.9;

/**
 * Extracts the longest branch from an ICU plural/select statement.
 * Example: "{count, plural, =0{Short} one{Medium text} other{Longest text here}}"
 * Returns: "Longest text here"
 */
function extractLongestIcuBranch(text) {
  // Match ICU plural/select patterns
  const icuPattern = /\{[^,]+,\s*(plural|select),\s*([^}]+)\}/g;

  let longestBranch = text;
  let match;

  while ((match = icuPattern.exec(text)) !== null) {
    const branches = match[2];
    // Extract branch values (everything between {...})
    const branchPattern = /\{([^}]+)\}/g;
    let branchMatch;
    let maxBranchLength = 0;
    let longestBranchText = '';

    while ((branchMatch = branchPattern.exec(branches)) !== null) {
      const branchText = branchMatch[1];
      if (branchText.length > maxBranchLength) {
        maxBranchLength = branchText.length;
        longestBranchText = branchText;
      }
    }

    // Replace the entire ICU statement with its longest branch
    longestBranch = longestBranch.replace(match[0], longestBranchText);
  }

  return longestBranch;
}

/**
 * Expands placeholders in a string with worst-case character counts.
 * Example: "Hey {prospectName}" → "Hey XXXXXXXXXXXXXXXXXXXX" (20 X's)
 */
function expandPlaceholders(text) {
  let expanded = text;

  // First, get the longest ICU branch
  expanded = extractLongestIcuBranch(expanded);

  // Then expand all placeholders
  for (const [placeholder, charCount] of Object.entries(PLACEHOLDER_EXPANSION)) {
    const pattern = new RegExp(`\\{${placeholder}\\}`, 'g');
    const replacement = 'X'.repeat(charCount);
    expanded = expanded.replace(pattern, replacement);
  }

  // Handle any remaining placeholders that weren't in our map
  const remainingPlaceholders = expanded.match(/\{[^}]+\}/g);
  if (remainingPlaceholders) {
    remainingPlaceholders.forEach(placeholder => {
      // Replace with conservative estimate (15 chars)
      expanded = expanded.replace(placeholder, 'X'.repeat(15));
    });
  }

  return expanded;
}

/**
 * Checks a single template string against its defined caps.
 */
function checkTemplate(key, value, metadata) {
  const issues = [];

  if (!metadata || !metadata.cap) {
    // No caps defined for this template - skip
    return issues;
  }

  const caps = metadata.cap;
  const baseLength = value.length;
  const expandedText = expandPlaceholders(value);
  const expandedLength = expandedText.length;

  // Find which branch was longest (for helpful error messages)
  const longestBranch = extractLongestIcuBranch(value);
  const branchInfo = longestBranch !== value ? ` (longest branch: "${longestBranch.substring(0, 50)}...")` : '';

  // Check SMS cap
  if (caps.sms !== undefined) {
    const cap = caps.sms;
    const warnAt = Math.floor(cap * WARNING_THRESHOLD);

    if (expandedLength > cap) {
      const headroom = expandedLength - cap;
      issues.push({
        severity: 'error',
        key,
        channel: 'SMS',
        cap,
        baseLength,
        expandedLength,
        headroom: -headroom,
        branchInfo,
        message: `❌ FAIL: ${key} exceeds SMS cap (${expandedLength} > ${cap})${branchInfo}\n` +
                `   Base length: ${baseLength} chars\n` +
                `   Expanded length: ${expandedLength} chars (with worst-case placeholders)\n` +
                `   Headroom needed: ${-headroom} chars`,
      });
    } else if (expandedLength >= warnAt) {
      const headroom = cap - expandedLength;
      issues.push({
        severity: 'warning',
        key,
        channel: 'SMS',
        cap,
        baseLength,
        expandedLength,
        headroom,
        branchInfo,
        message: `⚠️  WARN: ${key} at ${Math.round((expandedLength / cap) * 100)}% of SMS cap (${expandedLength}/${cap})${branchInfo}\n` +
                `   Base length: ${baseLength} chars\n` +
                `   Expanded length: ${expandedLength} chars\n` +
                `   Headroom: ${headroom} chars`,
      });
    }
  }

  // Check push title cap
  if (caps.pushTitle !== undefined) {
    const cap = caps.pushTitle;

    if (expandedLength > cap) {
      const headroom = expandedLength - cap;
      issues.push({
        severity: 'error',
        key,
        channel: 'Push Title',
        cap,
        baseLength,
        expandedLength,
        headroom: -headroom,
        branchInfo,
        message: `❌ FAIL: ${key} exceeds push title cap (${expandedLength} > ${cap})${branchInfo}\n` +
                `   Base length: ${baseLength} chars\n` +
                `   Expanded length: ${expandedLength} chars\n` +
                `   Headroom needed: ${-headroom} chars`,
      });
    }
  }

  // Check push body cap
  if (caps.pushBody !== undefined) {
    const cap = caps.pushBody;
    const warnAt = Math.floor(cap * WARNING_THRESHOLD);

    if (expandedLength > cap) {
      const headroom = expandedLength - cap;
      issues.push({
        severity: 'error',
        key,
        channel: 'Push Body',
        cap,
        baseLength,
        expandedLength,
        headroom: -headroom,
        branchInfo,
        message: `❌ FAIL: ${key} exceeds push body cap (${expandedLength} > ${cap})${branchInfo}\n` +
                `   Base length: ${baseLength} chars\n` +
                `   Expanded length: ${expandedLength} chars\n` +
                `   Headroom needed: ${-headroom} chars`,
      });
    } else if (expandedLength >= warnAt) {
      const headroom = cap - expandedLength;
      issues.push({
        severity: 'warning',
        key,
        channel: 'Push Body',
        cap,
        baseLength,
        expandedLength,
        headroom,
        branchInfo,
        message: `⚠️  WARN: ${key} at ${Math.round((expandedLength / cap) * 100)}% of push body cap (${expandedLength}/${cap})${branchInfo}\n` +
                `   Base length: ${baseLength} chars\n` +
                `   Expanded length: ${expandedLength} chars\n` +
                `   Headroom: ${headroom} chars`,
      });
    }
  }

  return issues;
}

/**
 * Main validation function.
 */
function checkMessageLengths() {
  const l10nDir = path.join(__dirname, '../../lib/l10n');
  const locales = ['en', 'es', 'pt', 'tl'];

  let totalIssues = 0;
  let totalErrors = 0;
  let totalWarnings = 0;

  console.log('🔍 Checking recruiting message lengths...\n');

  for (const locale of locales) {
    const arbPath = path.join(l10nDir, `app_${locale}.arb`);

    if (!fs.existsSync(arbPath)) {
      console.log(`⚠️  Skipping ${locale}: file not found`);
      continue;
    }

    const arb = JSON.parse(fs.readFileSync(arbPath, 'utf8'));
    const issues = [];

    // Check all recruiting templates (keys starting with "recruitT")
    for (const [key, value] of Object.entries(arb)) {
      if (!key.startsWith('recruitT') || key.startsWith('@')) {
        continue;
      }

      const metadataKey = `@${key}`;
      const metadata = arb[metadataKey];

      if (typeof value === 'string') {
        const templateIssues = checkTemplate(key, value, metadata);
        issues.push(...templateIssues);
      }
    }

    if (issues.length > 0) {
      console.log(`\n📋 ${locale.toUpperCase()} (${issues.length} issue${issues.length > 1 ? 's' : ''})`);
      console.log('─'.repeat(80));

      issues.forEach(issue => {
        console.log(`\n${issue.message}`);

        if (issue.severity === 'error') {
          totalErrors++;
        } else {
          totalWarnings++;
        }
      });

      totalIssues += issues.length;
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(80));
  if (totalIssues === 0) {
    console.log('✅ All recruiting templates within length caps');
    return 0;
  } else {
    console.log(`\n📊 Summary: ${totalIssues} issue${totalIssues > 1 ? 's' : ''} found`);
    if (totalErrors > 0) {
      console.log(`   ❌ Errors: ${totalErrors}`);
    }
    if (totalWarnings > 0) {
      console.log(`   ⚠️  Warnings: ${totalWarnings}`);
    }

    if (totalErrors > 0) {
      console.log('\n❌ Message length check FAILED');
      return 1;
    } else {
      console.log('\n✅ Message length check PASSED (warnings only)');
      return 0;
    }
  }
}

// Run the check
const exitCode = checkMessageLengths();
process.exit(exitCode);
