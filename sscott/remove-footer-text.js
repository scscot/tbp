import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, 'public');

function findAndRemoveFooterText(dir) {
  const files = fs.readdirSync(dir);
  let updatedCount = 0;

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && !filePath.includes('node_modules')) {
      updatedCount += findAndRemoveFooterText(filePath);
    } else if (file.endsWith('.html')) {
      let content = fs.readFileSync(filePath, 'utf8');

      const footerLineRegex = /\s*<p style="margin-top: 1rem; font-size: 0\.8125rem;">\s*Built with <a href="https:\/\/teambuildpro\.com" target="_blank" rel="noopener">Team Build Pro<\/a> - AI-Powered Network Marketing Platform\s*<\/p>\s*/g;

      if (footerLineRegex.test(content)) {
        content = content.replace(footerLineRegex, '');
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✓ Updated: ${path.relative(PUBLIC_DIR, filePath)}`);
        updatedCount++;
      }
    }
  });

  return updatedCount;
}

console.log('Removing footer text from all pages...\n');
console.log('='.repeat(80));

const updatedCount = findAndRemoveFooterText(PUBLIC_DIR);

console.log('='.repeat(80));
console.log(`\n✅ Updated ${updatedCount} files\n`);
