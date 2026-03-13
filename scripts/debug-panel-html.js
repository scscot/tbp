const { chromium } = require('playwright');

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Navigating...');
  await page.goto('https://www.colorstreet.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Accept cookies
  const acceptBtn = page.locator('button:has-text("Accept")').first();
  if (await acceptBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await acceptBtn.click();
    await page.waitForTimeout(1000);
  }

  // Click Find a Stylist
  await page.locator('text=Find a Stylist').first().click();
  await page.waitForTimeout(3000);

  // Access iframe
  const iframeLocator = page.locator('iframe#fyc-iframe, iframe[src*="widgets.colorstreet.com"]');
  const frame = await iframeLocator.contentFrame();

  // Search
  await frame.locator('input[type="text"]').first().fill('Amy');
  await page.waitForTimeout(500);
  await frame.locator('button:has-text("SEARCH")').first().click();
  await page.waitForTimeout(4000);

  // Click first result
  const firstResult = frame.locator('[aria-label*="Select stylist"]').first();
  await firstResult.click();
  await page.waitForTimeout(2000);

  // Get the panel HTML
  const panelHTML = await frame.locator('body').innerHTML();

  // Find the right panel section (after clicking a result)
  console.log('\n=== SEARCHING FOR USERNAME PATTERN ===');

  // Look for Contact section
  const contactIdx = panelHTML.indexOf('Contact');
  if (contactIdx > -1) {
    console.log('Contact section found at index:', contactIdx);
    console.log('Context around Contact:');
    console.log(panelHTML.substring(contactIdx, contactIdx + 500));
  }

  // Look for AmyAgema pattern
  const amyIdx = panelHTML.indexOf('AmyAgema');
  if (amyIdx > -1) {
    console.log('\nAmyAgema found at index:', amyIdx);
    console.log('Context around AmyAgema:');
    console.log(panelHTML.substring(amyIdx - 100, amyIdx + 100));
  }

  // Look for spans with user-looking content
  const spanMatches = panelHTML.match(/<span[^>]*>([A-Z][a-z]+[A-Z][a-z]+)<\/span>/g);
  if (spanMatches) {
    console.log('\nCamelCase spans (likely usernames):');
    spanMatches.forEach(m => console.log(' ', m));
  }

  await browser.close();
}

debug().catch(console.error);
