/**
 * Get AWS us-west-2 (Oregon/Boardman) IP ranges
 */

const https = require('https');

function fetchAWSRanges() {
  return new Promise((resolve, reject) => {
    https.get('https://ip-ranges.amazonaws.com/ip-ranges.json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  try {
    console.log('Fetching AWS IP ranges...\n');
    const awsData = await fetchAWSRanges();

    // Filter for us-west-2 IPv4 ranges
    const usWest2Ranges = awsData.prefixes
      .filter(p => p.region === 'us-west-2')
      .map(p => p.ip_prefix)
      .sort();

    // Remove duplicates
    const uniqueRanges = [...new Set(usWest2Ranges)];

    console.log('='.repeat(60));
    console.log('AWS us-west-2 (Oregon/Boardman) IPv4 CIDR RANGES');
    console.log(`Total: ${uniqueRanges.length} ranges`);
    console.log('='.repeat(60));
    console.log('');

    // Group by first octet for easier viewing
    const grouped = {};
    uniqueRanges.forEach(range => {
      const firstOctet = range.split('.')[0];
      if (!grouped[firstOctet]) grouped[firstOctet] = [];
      grouped[firstOctet].push(range);
    });

    // Show grouped ranges
    Object.keys(grouped).sort((a,b) => parseInt(a) - parseInt(b)).forEach(octet => {
      console.log(`\n${octet}.x.x.x ranges (${grouped[octet].length}):`);
      grouped[octet].forEach(range => console.log(`  ${range}`));
    });

    // Recommend consolidated ranges for GA4
    console.log('\n');
    console.log('='.repeat(60));
    console.log('RECOMMENDED GA4 FILTER ADDITIONS');
    console.log('='.repeat(60));
    console.log('');
    console.log('You already have: 52.0.0.0/8, 54.0.0.0/8, 35.80.0.0/12');
    console.log('');
    console.log('Add these to cover remaining us-west-2 traffic:');
    console.log('');

    // Find ranges not covered by existing filters
    const existingCoverage = ['52.', '54.', '35.8', '35.9'];
    const uncovered = uniqueRanges.filter(range => {
      return !existingCoverage.some(prefix => range.startsWith(prefix));
    });

    // Consolidate into broader ranges where possible
    const consolidate = {};
    uncovered.forEach(range => {
      const parts = range.split('.');
      const key = parts[0];
      if (!consolidate[key]) consolidate[key] = [];
      consolidate[key].push(range);
    });

    console.log('Option 1 - Broad coverage (simpler, may catch non-AWS):');
    const broadRanges = Object.keys(consolidate).map(octet => `${octet}.0.0.0/8`);
    broadRanges.forEach(r => console.log(`  • ${r}`));

    console.log('');
    console.log('Option 2 - Precise ranges (more entries, AWS-only):');
    uncovered.slice(0, 20).forEach(r => console.log(`  • ${r}`));
    if (uncovered.length > 20) {
      console.log(`  ... and ${uncovered.length - 20} more ranges`);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('QUICK COPY-PASTE LIST (Option 1 - Recommended)');
    console.log('='.repeat(60));
    console.log('');
    console.log('Add these CIDR ranges to your GA4 Internal Traffic Definition:');
    console.log('');

    // Get unique first octets not already covered
    const newOctets = [...new Set(uncovered.map(r => r.split('.')[0]))].sort((a,b) => parseInt(a) - parseInt(b));
    newOctets.forEach(octet => {
      console.log(`${octet}.0.0.0/8`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
