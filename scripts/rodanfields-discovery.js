#!/usr/bin/env node
/**
 * Rodan + Fields Consultant Discovery
 * Phase 1: Discover consultant IDs and profile URLs from the search API
 *
 * Usage:
 *   node rodanfields-discovery.js --discover         # Discover consultants
 *   node rodanfields-discovery.js --stats            # Show collection stats
 *   node rodanfields-discovery.js --reset            # Reset discovery state
 */

const admin = require('firebase-admin');
const { firefox } = require('playwright');

// Initialize Firebase
const serviceAccount = require('../secrets/serviceAccountKey.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

// Common US names for search - covers majority of consultants
const SEARCH_NAMES = [
  // Top 50 US surnames
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones',
  'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris',
  'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright',
  'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall',
  'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  // Female first names (90 unique)
  'Jennifer', 'Jessica', 'Ashley', 'Sarah', 'Emily',
  'Elizabeth', 'Amanda', 'Stephanie', 'Melissa', 'Nicole',
  'Samantha', 'Michelle', 'Kimberly', 'Amy', 'Heather',
  'Rachel', 'Emma', 'Rebecca', 'Megan', 'Olivia',
  'Hannah', 'Lauren', 'Angela', 'Madison', 'Amber',
  'Katherine', 'Christina', 'Mary', 'Abigail', 'Danielle',
  'Sophia', 'Isabella', 'Alexis', 'Ava', 'Laura',
  'Victoria', 'Brianna', 'Alyssa', 'Erin', 'Tiffany',
  'Anna', 'Courtney', 'Kayla', 'Alexandra', 'Mia',
  'Grace', 'Natalie', 'Kelly', 'Sara', 'Andrea',
  'Allison', 'Crystal', 'Julia', 'Kaitlyn', 'Vanessa',
  'Chloe', 'Maria', 'Gabriella', 'Brooke', 'Brittany',
  'Faith', 'Hailey', 'Katelyn', 'Lillian', 'Lily',
  'Kelsey', 'Mackenzie', 'Jasmine', 'Leah', 'Savannah',
  'Kylie', 'Paige', 'Gabrielle', 'Chelsea', 'Lindsey',
  'Stacy', 'Monica', 'Evelyn', 'Jenna', 'Alicia',
  'Caroline', 'Catherine', 'Sofia', 'Patricia', 'Kristin',
  'Veronica', 'Erica', 'Jacqueline', 'Valerie'
];

const MAX_PAGES_PER_NAME = 50; // Limit pages per search term
const COLLECTION = 'rodanfields_consultants';
const STATE_DOC = 'scraper_state/rodanfields_discovery';

const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function getDiscoveryState() {
  const doc = await db.doc(STATE_DOC).get();
  if (!doc.exists) {
    return {
      currentNameIndex: 0,
      currentPageNumber: 0,
      totalDiscovered: 0,
      totalSaved: 0,
      completedNames: []
    };
  }
  return doc.data();
}

async function updateDiscoveryState(state) {
  await db.doc(STATE_DOC).set({
    ...state,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function saveConsultant(consultant) {
  const docRef = db.collection(COLLECTION).doc(consultant.cid);
  const existing = await docRef.get();

  if (!existing.exists) {
    await docRef.set({
      ...consultant,
      scraped: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return true; // New consultant
  }
  return false; // Already exists
}

async function discoverConsultants(maxPages = 100) {
  console.log('Starting Rodan + Fields consultant discovery...\n');

  const state = await getDiscoveryState();
  console.log('Current state:', JSON.stringify(state, null, 2));

  const browser = await firefox.launch({
    headless: true,
    firefoxUserPrefs: {
      'dom.webdriver.enabled': false,
      'useAutomationExtension': false
    }
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0',
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  // Capture API responses
  let lastApiResponse = null;
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/search/customers')) {
      try {
        lastApiResponse = await response.json();
      } catch (e) {}
    }
  });

  let pagesProcessed = 0;
  let newConsultants = 0;

  try {
    // Navigate to finder page first to establish session
    await page.goto('https://www.rodanandfields.com/en-us/findaconsultant', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(randomDelay(3000, 5000));

    // Remove overlays (aggressive)
    const removeOverlays = async () => {
      await page.evaluate(() => {
        document.getElementById('attentive_overlay')?.remove();
        document.getElementById('attentive_creative')?.remove();
        document.getElementById('onetrust-consent-sdk')?.remove();
        document.querySelectorAll('.onetrust-pc-dark-filter').forEach(el => el.remove());
        document.querySelectorAll('[id*="attentive"]').forEach(el => el.remove());
        document.querySelectorAll('[class*="attentive"]').forEach(el => el.remove());
      });
    };
    for (let i = 0; i < 3; i++) {
      await removeOverlays();
      await page.waitForTimeout(500);
    }

    // Process names starting from current state
    for (let nameIdx = state.currentNameIndex; nameIdx < SEARCH_NAMES.length && pagesProcessed < maxPages; nameIdx++) {
      const searchName = SEARCH_NAMES[nameIdx];
      console.log(`\n=== Searching for "${searchName}" ===`);

      // Type search term
      const searchInput = page.locator('#consultantSearch');
      await searchInput.fill('');
      await page.waitForTimeout(randomDelay(300, 500));

      for (const char of searchName) {
        await page.keyboard.type(char, { delay: randomDelay(50, 120) });
      }
      await page.waitForTimeout(randomDelay(500, 1000));

      // Click search
      await removeOverlays();
      await page.locator('button.search-consultant__button').click({ force: true });
      await page.waitForTimeout(randomDelay(3000, 5000));

      if (!lastApiResponse || !lastApiResponse.sponsors) {
        console.log('No results or API error');
        continue;
      }

      // Process first page results by clicking through UI to get actual profile URLs
      const firstPageSponsors = lastApiResponse.sponsors || [];
      console.log(`Page 1: ${firstPageSponsors.length} results`);

      // For each result, click to get the actual profile URL
      for (let idx = 0; idx < firstPageSponsors.length; idx++) {
        const sponsor = firstPageSponsors[idx];

        // Click on the result card
        const cards = await page.$$('.consultant-result-card__content_info');
        if (idx >= cards.length) break;

        await removeOverlays();
        await cards[idx].click();
        await page.waitForTimeout(randomDelay(800, 1500));

        // Click Continue to get profile URL
        const continueBtn = page.locator('button:has-text("Continue")').first();
        if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await continueBtn.click();
          await page.waitForTimeout(randomDelay(2000, 3000));

          const profileUrl = page.url();

          // Only save if we got a valid profile URL (not error page)
          if (profileUrl.includes('.myrandf.com') && !profileUrl.includes('error') && !profileUrl.includes('exception')) {
            const consultant = {
              cid: sponsor.cid,
              firstName: sponsor.firstName,
              lastName: sponsor.lastName,
              city: sponsor.city,
              state: sponsor.state,
              country: sponsor.sponsorMarketId || 'USA',
              profileUrl: profileUrl,
              accountId: sponsor.accountId,
              enrollmentDate: sponsor.enrollmentDate ? new Date(sponsor.enrollmentDate) : null,
              source: 'rodanfields_search',
              searchTerm: searchName
            };

            if (await saveConsultant(consultant)) {
              newConsultants++;
              console.log(`  + ${sponsor.firstName} ${sponsor.lastName}: ${profileUrl.match(/https:\/\/([^.]+)\.myrandf/)?.[1]}`);
            }
          }

          // Navigate back to search
          await page.goto('https://www.rodanandfields.com/en-us/findaconsultant', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          await page.waitForTimeout(randomDelay(2000, 3000));

          // Remove overlays
          await removeOverlays();

          // Re-search
          const searchInput2 = page.locator('#consultantSearch');
          await searchInput2.fill('');
          for (const char of searchName) {
            await page.keyboard.type(char, { delay: randomDelay(50, 120) });
          }
          await page.waitForTimeout(randomDelay(500, 1000));
          await removeOverlays();
          await page.locator('button.search-consultant__button').click({ force: true });
          await page.waitForTimeout(randomDelay(3000, 5000));
        }
      }

      pagesProcessed++;
      state.totalDiscovered += firstPageSponsors.length;

      // Try to determine total pages (from UI or estimate)
      const totalPages = Math.min(MAX_PAGES_PER_NAME, 100); // R+F shows max 100 pages

      // Navigate through additional pages using API parameter
      for (let pageNum = 1; pageNum < totalPages && pagesProcessed < maxPages; pageNum++) {
        // Click on page number if visible, otherwise use direct navigation
        const pageBtn = page.locator(`.find-consultant__search_container_pagination >> text="${pageNum + 1}"`).first();

        if (await pageBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await pageBtn.click();
          await page.waitForTimeout(randomDelay(2000, 4000));

          if (lastApiResponse && lastApiResponse.sponsors) {
            const sponsors = lastApiResponse.sponsors;
            console.log(`Page ${pageNum + 1}: ${sponsors.length} results`);

            if (sponsors.length === 0) {
              console.log('No more results, moving to next name');
              break;
            }

            for (const sponsor of sponsors) {
              const consultant = {
                cid: sponsor.cid,
                firstName: sponsor.firstName,
                lastName: sponsor.lastName,
                city: sponsor.city,
                state: sponsor.state,
                country: sponsor.sponsorMarketId || 'USA',
                profileUrl: `https://${sponsor.pwsUrl?.replace('.myrandf.com', '') || sponsor.cid}.myrandf.com/en-us/pws/pwsAboutMe`,
                accountId: sponsor.accountId,
                enrollmentDate: sponsor.enrollmentDate ? new Date(sponsor.enrollmentDate) : null,
                source: 'rodanfields_search',
                searchTerm: searchName
              };

              if (await saveConsultant(consultant)) {
                newConsultants++;
              }
            }

            pagesProcessed++;
            state.totalDiscovered += sponsors.length;
          }
        } else {
          // No more page buttons visible
          break;
        }

        // Save state periodically
        if (pagesProcessed % 10 === 0) {
          state.currentNameIndex = nameIdx;
          state.currentPageNumber = pageNum;
          state.totalSaved += newConsultants;
          await updateDiscoveryState(state);
          console.log(`Progress saved: ${pagesProcessed} pages, ${newConsultants} new consultants`);
        }
      }

      // Mark name as completed
      if (!state.completedNames.includes(searchName)) {
        state.completedNames.push(searchName);
      }
      state.currentNameIndex = nameIdx + 1;
      state.currentPageNumber = 0;
    }

    // Final state update
    state.totalSaved += newConsultants;
    await updateDiscoveryState(state);

    console.log('\n=== Discovery Complete ===');
    console.log(`Pages processed: ${pagesProcessed}`);
    console.log(`New consultants saved: ${newConsultants}`);
    console.log(`Total discovered: ${state.totalDiscovered}`);

  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: '/tmp/rf-discovery-error.png', fullPage: true });

    // Save state on error
    state.totalSaved += newConsultants;
    await updateDiscoveryState(state);
  } finally {
    await browser.close();
  }
}

async function showStats() {
  console.log('Rodan + Fields Discovery Stats\n');

  const state = await getDiscoveryState();
  console.log('Discovery State:', JSON.stringify(state, null, 2));

  // Count consultants
  const collection = db.collection(COLLECTION);
  const totalCount = await collection.count().get();
  const unscrapedCount = await collection.where('scraped', '==', false).count().get();
  const withEmailCount = await collection.where('email', '!=', null).count().get();

  console.log('\nCollection Stats:');
  console.log(`Total consultants: ${totalCount.data().count}`);
  console.log(`Unscraped: ${unscrapedCount.data().count}`);
  console.log(`With email: ${withEmailCount.data().count}`);
}

async function resetState() {
  await db.doc(STATE_DOC).delete();
  console.log('Discovery state reset');
}

async function clearCollection() {
  const snapshot = await db.collection(COLLECTION).get();
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  console.log(`Deleted ${snapshot.size} consultants`);

  // Also reset state
  await resetState();
}

// Main
const args = process.argv.slice(2);
if (args.includes('--discover')) {
  const maxPages = parseInt(args.find(a => a.startsWith('--max-pages='))?.split('=')[1]) || 100;
  discoverConsultants(maxPages).then(() => process.exit(0));
} else if (args.includes('--stats')) {
  showStats().then(() => process.exit(0));
} else if (args.includes('--reset')) {
  resetState().then(() => process.exit(0));
} else if (args.includes('--clear')) {
  clearCollection().then(() => process.exit(0));
} else {
  console.log(`
Rodan + Fields Consultant Discovery

Usage:
  node rodanfields-discovery.js --discover [--max-pages=N]   Discover consultants (default: 100 pages)
  node rodanfields-discovery.js --stats                      Show collection stats
  node rodanfields-discovery.js --reset                      Reset discovery state
  `);
}
