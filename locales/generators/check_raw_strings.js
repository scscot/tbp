const fs = require('fs');
const path = require('path');

// Files/directories to skip
const SKIP_PATTERNS = [
  'lib/l10n/',           // Generated localization files
  'lib/i18n/',           // i18n infrastructure (constants, error codes)
  'lib/widgets/localized_text.dart',  // Localization widget itself
  'lib/config/',         // Configuration files
  'lib/models/',         // Data models
  'lib/services/',       // Service layer
  'lib/providers/',      // State providers
  '.dart_tool/',
  'build/',
  'test/',               // Test files can have raw strings
];

// Patterns that indicate raw string literals in UI code
const RAW_STRING_PATTERNS = [
  /Text\s*\(\s*['"`]/,                    // Text('...')
  /title\s*:\s*['"`]/,                    // title: '...'
  /label\s*:\s*['"`]/,                    // label: '...'
  /hintText\s*:\s*['"`]/,                 // hintText: '...'
  /labelText\s*:\s*['"`]/,                // labelText: '...'
  /helperText\s*:\s*['"`]/,               // helperText: '...'
  /errorText\s*:\s*['"`]/,                // errorText: '...'
  /SnackBar\s*\([^)]*content\s*:\s*Text\s*\(\s*['"`]/, // SnackBar with raw string
];

// Allowed exceptions (regex patterns)
const ALLOWED_EXCEPTIONS = [
  /Text\s*\(\s*['"`]\$/, // Allows Text('$variable')
  /debugPrint\s*\(\s*['"`]/, // Debug strings are OK
  /print\s*\(\s*['"`]/, // Print strings are OK
  /const\s+Text\s*\(\s*['"`]/, // const Text('...') in tests/debug widgets
];

function shouldSkipFile(filePath) {
  return SKIP_PATTERNS.some(pattern => filePath.includes(pattern));
}

function isAllowedException(line) {
  return ALLOWED_EXCEPTIONS.some(pattern => pattern.test(line));
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Skip if this is an allowed exception
    if (isAllowedException(line)) {
      return;
    }

    // Check for raw string patterns
    RAW_STRING_PATTERNS.forEach(pattern => {
      if (pattern.test(line)) {
        violations.push({
          line: lineNum,
          content: line.trim(),
          pattern: pattern.toString(),
        });
      }
    });
  });

  return violations;
}

function findDartFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!shouldSkipFile(filePath)) {
        findDartFiles(filePath, fileList);
      }
    } else if (file.endsWith('.dart') && !shouldSkipFile(filePath)) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function main() {
  const projectRoot = path.join(__dirname, '..', '..');
  const libDir = path.join(projectRoot, 'lib');

  // Focus on UI files: screens and widgets
  const screenDir = path.join(libDir, 'screens');
  const widgetDir = path.join(libDir, 'widgets');

  let allViolations = [];
  let filesChecked = 0;

  console.log('🔍 Checking for raw string literals in UI code...\n');

  // Check screens directory
  if (fs.existsSync(screenDir)) {
    const screenFiles = findDartFiles(screenDir);
    filesChecked += screenFiles.length;

    screenFiles.forEach(file => {
      const violations = checkFile(file);
      if (violations.length > 0) {
        allViolations.push({ file, violations });
      }
    });
  }

  // Check widgets directory
  if (fs.existsSync(widgetDir)) {
    const widgetFiles = findDartFiles(widgetDir);
    filesChecked += widgetFiles.length;

    widgetFiles.forEach(file => {
      const violations = checkFile(file);
      if (violations.length > 0) {
        allViolations.push({ file, violations });
      }
    });
  }

  // Report results
  if (allViolations.length === 0) {
    console.log(`✅ No raw string literals found in UI code (${filesChecked} files checked)`);
    process.exit(0);
  } else {
    console.error(`❌ Found raw string literals in ${allViolations.length} files:\n`);

    allViolations.forEach(({ file, violations }) => {
      const relativePath = path.relative(projectRoot, file);
      console.error(`\n📄 ${relativePath}`);

      violations.forEach(({ line, content }) => {
        console.error(`   Line ${line}: ${content}`);
      });
    });

    console.error(`\n💡 Replace raw strings with localized strings:`);
    console.error(`   Text('Hello') → LocalizedText((l10n) => l10n.greeting)`);
    console.error(`   title: 'Settings' → title: context.l10n.settingsTitle`);

    process.exit(1);
  }
}

main();
