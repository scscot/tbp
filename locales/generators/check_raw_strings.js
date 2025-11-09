const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

function generateHash(filePath, lineNum, content) {
  // Create stable hash from file + line + content for allowlist tracking
  const data = `${filePath}:${lineNum}:${content}`;
  return crypto.createHash('md5').update(data).digest('hex').substring(0, 8);
}

function checkFile(filePath, allowlist = []) {
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
        const hash = generateHash(filePath, lineNum, line.trim());

        // Skip if in allowlist
        if (allowlist.some(entry => entry.hash === hash)) {
          return;
        }

        violations.push({
          line: lineNum,
          content: line.trim(),
          pattern: pattern.toString(),
          hash: hash,
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

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    files: null,
    allowlist: null,
    generateAllowlist: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--files') {
      const filesArg = args[i + 1] || '';
      options.files = filesArg.split('\n').filter(f => f.trim().length > 0);
      i++;
    } else if (args[i] === '--allowlist' && args[i + 1]) {
      options.allowlist = args[i + 1];
      i++;
    } else if (args[i] === '--generate-allowlist') {
      options.generateAllowlist = true;
    }
  }

  return options;
}

function loadAllowlist(allowlistPath) {
  if (!allowlistPath || !fs.existsSync(allowlistPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(allowlistPath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.warn(`⚠️  Warning: Could not load allowlist from ${allowlistPath}: ${e.message}`);
    return [];
  }
}

function saveAllowlist(allowlistPath, violations) {
  const allowlistEntries = [];

  violations.forEach(({ file, violations: fileViolations }) => {
    fileViolations.forEach(({ line, content, hash }) => {
      allowlistEntries.push({
        file: file,
        line: line,
        content: content,
        hash: hash,
      });
    });
  });

  fs.writeFileSync(allowlistPath, JSON.stringify(allowlistEntries, null, 2), 'utf8');
  console.log(`\n✅ Generated allowlist with ${allowlistEntries.length} entries: ${allowlistPath}`);
}

function main() {
  const projectRoot = path.join(__dirname, '..', '..');
  const libDir = path.join(projectRoot, 'lib');
  const options = parseArgs();

  // Load allowlist if specified
  const allowlist = options.allowlist ? loadAllowlist(options.allowlist) : [];

  // Determine files to check
  let filesToCheck = [];

  if (options.files !== null) {
    // Changed-files mode (even if empty)
    if (options.files.length === 0) {
      console.log('ℹ️  No UI files changed, skipping raw string scan\n');
      process.exit(0);
    }

    console.log(`🔍 Checking ${options.files.length} changed files for raw string literals...\n`);

    filesToCheck = options.files
      .filter(f => f.endsWith('.dart') && !shouldSkipFile(f))
      .filter(f => f.includes('lib/screens/') || f.includes('lib/widgets/'))
      .map(f => path.join(projectRoot, f));
  } else {
    // Check all screens and widgets
    console.log('🔍 Checking for raw string literals in UI code...\n');

    const screenDir = path.join(libDir, 'screens');
    const widgetDir = path.join(libDir, 'widgets');

    if (fs.existsSync(screenDir)) {
      filesToCheck = filesToCheck.concat(findDartFiles(screenDir));
    }
    if (fs.existsSync(widgetDir)) {
      filesToCheck = filesToCheck.concat(findDartFiles(widgetDir));
    }
  }

  // Check files
  let allViolations = [];

  filesToCheck.forEach(file => {
    if (fs.existsSync(file)) {
      const violations = checkFile(file, allowlist);
      if (violations.length > 0) {
        allViolations.push({ file, violations });
      }
    }
  });

  // Generate allowlist mode
  if (options.generateAllowlist) {
    const allowlistPath = path.join(__dirname, '..', 'allowlists', 'raw_strings_allowlist.json');
    saveAllowlist(allowlistPath, allViolations);
    process.exit(0);
  }

  // Report results
  if (allViolations.length === 0) {
    console.log(`✅ No raw string literals found in UI code (${filesToCheck.length} files checked)`);
    if (allowlist.length > 0) {
      console.log(`ℹ️  Allowlist: ${allowlist.length} legacy violations ignored`);
    }
    process.exit(0);
  } else {
    console.error(`❌ Found raw string literals in ${allViolations.length} files:\n`);

    allViolations.forEach(({ file, violations }) => {
      const relativePath = path.relative(projectRoot, file);
      console.error(`\n📄 ${relativePath}`);

      violations.forEach(({ line, content, hash }) => {
        console.error(`   Line ${line}: ${content}`);
        console.error(`   Hash: ${hash}`);
      });
    });

    console.error(`\n💡 Replace raw strings with localized strings:`);
    console.error(`   Text('Hello') → LocalizedText((l10n) => l10n.greeting)`);
    console.error(`   title: 'Settings' → title: context.l10n.settingsTitle`);

    process.exit(1);
  }
}

main();
