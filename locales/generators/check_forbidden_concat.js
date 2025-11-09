const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function checkForbiddenConcat() {
  const libDir = path.join(__dirname, '..', '..', 'lib');

  try {
    const result = execSync(
      `grep -r "+ AppLocalizations\\|+ l10n\\|+ appLocalizations" "${libDir}" --include="*.dart" || true`,
      { encoding: 'utf8' }
    );

    if (result.trim().length === 0) {
      console.log('✅ No forbidden string concatenation found');
      process.exit(0);
    }

    console.error('❌ ERROR: Forbidden string concatenation detected:');
    console.error('');
    console.error(result);
    console.error('');
    console.error('ℹ️  Never concatenate localized strings. Use ICU placeholders instead.');
    console.error('   Example:');
    console.error('   ❌ "Welcome " + appLocalizations.name');
    console.error('   ✅ appLocalizations.welcome(name)');
    process.exit(1);
  } catch (err) {
    console.error('❌ ERROR: Failed to check for forbidden concatenation:', err.message);
    process.exit(1);
  }
}

checkForbiddenConcat();
