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

  // Test different selectors
  console.log('\n=== TESTING SELECTORS ===');

  const selectors = [
    'div[class*="cursor-pointer"]',
    'div[class*="cursor-pointer"][role="button"]',
    'div[role="button"]',
    'div.cursor-pointer',
    '[aria-label*="Select stylist"]',
  ];

  for (const sel of selectors) {
    const count = await frame.locator(sel).count();
    console.log(`${sel}: ${count} matches`);

    if (count > 0 && count < 20) {
      const items = await frame.locator(sel).all();
      for (let i = 0; i < Math.min(3, items.length); i++) {
        const text = await items[i].textContent().catch(() => '');
        const visible = await items[i].isVisible().catch(() => false);
        console.log(`  [${i}] visible=${visible}, text="${text.trim().substring(0, 40)}"`);
      }
    }
  }

  // Try clicking first result with working selector
  console.log('\n=== CLICKING FIRST RESULT ===');
  const firstResult = frame.locator('[aria-label*="Select stylist"]').first();
  if (await firstResult.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Found aria-label selector, clicking...');
    await firstResult.click();
    await page.waitForTimeout(3000);

    // Screenshot after clicking
    await page.screenshot({ path: '/tmp/cs-after-click.png', fullPage: false });
    console.log('Screenshot saved to /tmp/cs-after-click.png');

    // Look for all buttons in iframe
    const buttons = await frame.locator('button').all();
    console.log(`\nFound ${buttons.length} buttons in iframe:`);
    for (let i = 0; i < buttons.length; i++) {
      const visible = await buttons[i].isVisible().catch(() => false);
      const text = await buttons[i].textContent().catch(() => '');
      if (visible && text.trim()) {
        console.log(`  Button ${i}: "${text.trim().substring(0, 40)}"`);
      }
    }

    // Check for SELECT STYLIST button
    const selectBtn = frame.locator('button:has-text("SELECT STYLIST")').first();
    const selectVisible = await selectBtn.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`\nSELECT STYLIST visible: ${selectVisible}`);

    if (selectVisible) {
      console.log('SELECT STYLIST button visible, clicking...');
      await selectBtn.click();
      await page.waitForTimeout(2000);

      // Check for FINISH button
      const finishBtn = frame.locator('button:has-text("FINISH")').first();
      if (await finishBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('FINISH button visible, clicking...');
        await finishBtn.click();
        await page.waitForTimeout(3000);

        console.log('Current URL:', page.url());
      }
    }
  }

  await browser.close();
}

debug().catch(console.error);
