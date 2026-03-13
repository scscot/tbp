const { chromium } = require('playwright');

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Go directly to Amy Agema's PWS page
  console.log('Navigating directly to Amy Agema PWS page...');
  await page.goto('https://www.colorstreet.com/?pws=AmyAgema', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Accept cookies
  const acceptBtn = page.locator('button:has-text("Accept")').first();
  if (await acceptBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await acceptBtn.click();
    console.log('Accepted cookies');
    await page.waitForTimeout(1000);
  }

  // Take screenshot of the page
  await page.screenshot({ path: '/tmp/colorstreet-pws-direct.png', fullPage: false });
  console.log('Screenshot saved');

  // Analyze the entire page HTML
  console.log('\n=== ANALYZING PAGE HTML FOR STYLIST BUTTON ===');
  const pageHTML = await page.content();

  // Look for Amy Agema in the HTML
  const amyMatches = pageHTML.match(/Amy[\s\S]{0,200}?Agema/gi);
  if (amyMatches) {
    console.log('Found Amy Agema references:', amyMatches.length);
    amyMatches.slice(0, 3).forEach((m, i) => console.log(`  ${i}: ${m.trim().substring(0, 100)}`));
  }

  // Look for "STYLIST:" pattern
  const stylistMatches = pageHTML.match(/STYLIST:[\s\S]{0,100}/gi);
  if (stylistMatches) {
    console.log('\nFound STYLIST: patterns:', stylistMatches.length);
    stylistMatches.forEach((m, i) => console.log(`  ${i}: ${m.trim().substring(0, 80)}`));
  }

  // Look for button with pink/purple background or profile image
  const buttonPatterns = [
    /class="[^"]*pws[^"]*"[^>]*>/gi,
    /class="[^"]*stylist[^"]*name[^"]*"/gi,
    /<button[^>]*>[\s\S]*?STYLIST[\s\S]*?<\/button>/gi,
    /data-stylist[^>]*/gi,
  ];

  for (const pattern of buttonPatterns) {
    const matches = pageHTML.match(pattern);
    if (matches) {
      console.log(`\nPattern ${pattern} found:`, matches.length);
      matches.slice(0, 2).forEach(m => console.log(`  ${m.substring(0, 150)}`));
    }
  }

  // Find all buttons on the page and check their text
  console.log('\n=== ALL BUTTONS ON PAGE ===');
  const allButtons = await page.locator('button').all();
  for (let i = 0; i < allButtons.length; i++) {
    const btn = allButtons[i];
    const visible = await btn.isVisible().catch(() => false);
    const text = await btn.textContent().catch(() => '');
    const className = await btn.getAttribute('class').catch(() => '');

    if (text.includes('Amy') || text.includes('STYLIST') || className?.includes('pws')) {
      console.log(`Button ${i}: visible=${visible}, class="${className?.substring(0, 50)}", text="${text.trim().substring(0, 50)}"`);
    }
  }

  // Find all clickable elements with Amy or Stylist text
  console.log('\n=== CLICKABLE ELEMENTS WITH AMY/STYLIST ===');
  const clickables = await page.locator('a, button, [role="button"], [onclick], .locator-modal__open').all();
  for (const el of clickables) {
    const visible = await el.isVisible().catch(() => false);
    const text = await el.textContent().catch(() => '');
    const href = await el.getAttribute('href').catch(() => '');
    const onclick = await el.getAttribute('onclick').catch(() => '');

    if (visible && (text.includes('Amy') || text.includes('STYLIST') || text.includes('Agema'))) {
      console.log(`Element: text="${text.trim().substring(0, 60)}", href="${href?.substring(0, 50)}", onclick="${onclick?.substring(0, 50)}"`);
    }
  }

  // Look for hidden divs that might contain contact info
  console.log('\n=== SEARCHING FOR CONTACT INFO IN HTML ===');

  // Check for any elements with contact-related classes
  const contactPatterns = [
    /class="[^"]*contact[^"]*"[\s\S]*?<\/\w+>/gi,
    /mailto:([^"]+)/g,
    /tel:([^"]+)/g,
    /@[a-zA-Z0-9._]+\.[a-zA-Z]{2,}/g,  // Email pattern
    /\(\d{3}\)\s*\d{3}-\d{4}/g,  // Phone pattern
    /\d{3}-\d{3}-\d{4}/g,  // Phone pattern
  ];

  for (const pattern of contactPatterns) {
    const matches = pageHTML.match(pattern);
    if (matches) {
      console.log(`Pattern found (${pattern}):`, matches.slice(0, 5));
    }
  }

  // Look for any data attributes that might contain contact info
  const dataMatches = pageHTML.match(/data-[a-z-]+="[^"]*(?:email|phone|contact)[^"]*"/gi);
  if (dataMatches) {
    console.log('\nData attributes with contact info:', dataMatches);
  }

  // Check if there's a network request we need to make
  console.log('\n=== CHECKING FOR PWS HEADER BUTTON ===');
  const pwsHeader = page.locator('.pws-header, [class*="pws-"], .stylist-header, header button').first();
  if (await pwsHeader.isVisible({ timeout: 1000 }).catch(() => false)) {
    console.log('Found PWS header element');
    const html = await pwsHeader.innerHTML();
    console.log('Header HTML:', html.substring(0, 500));
  }

  // Look for the specific pink/purple button in the top left
  const topLeftButtons = page.locator('header button, nav button, .header button').all();
  console.log('\nHeader/Nav buttons:', (await topLeftButtons).length);
  for (const btn of await topLeftButtons) {
    const visible = await btn.isVisible().catch(() => false);
    const text = await btn.textContent().catch(() => '');
    if (visible && text.length > 0 && text.length < 50) {
      console.log(`  "${text.trim()}"`);

      // If this looks like the stylist button, click it
      if (text.includes('Amy') || text.includes('STYLIST')) {
        console.log('  --> Clicking this button...');
        await btn.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: '/tmp/colorstreet-clicked.png', fullPage: false });
        console.log('  --> Screenshot saved');
      }
    }
  }

  await browser.close();
}

debug().catch(console.error);
