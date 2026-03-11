#!/usr/bin/env node
/**
 * Rodan + Fields Contact Scraper
 * Phase 2: Visit consultant profile pages and extract emails
 *
 * Usage:
 *   node rodanfields-scraper.js --scrape             # Scrape unscraped consultants
 *   node rodanfields-scraper.js --scrape --max=50    # Limit to 50 profiles
 *   node rodanfields-scraper.js --stats              # Show collection stats
 *   node rodanfields-scraper.js --test --cid=123     # Test single consultant
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

const COLLECTION = 'rodanfields_consultants';
const CONTACTS_COLLECTION = 'rodanfields_contacts'; // Final contacts for email campaign

const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function scrapeProfile(page, consultant) {
  try {
    await page.goto(consultant.profileUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(randomDelay(2000, 4000));

    // Remove overlays
    await page.evaluate(() => {
      document.getElementById('attentive_overlay')?.remove();
      document.getElementById('attentive_creative')?.remove();
      document.getElementById('onetrust-consent-sdk')?.remove();
      document.querySelectorAll('.onetrust-pc-dark-filter').forEach(el => el.remove());
    });

    // Extract data from page
    const profileData = await page.evaluate(() => {
      const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const phonePattern = /(\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})/g;

      const html = document.documentElement.innerHTML;
      const bodyText = document.body.innerText;

      // Find emails
      const allEmails = [...new Set((html.match(emailPattern) || []))].filter(e =>
        !e.includes('rodanandfields') &&
        !e.includes('schema.org') &&
        !e.includes('onetrust') &&
        !e.includes('attn.tv') &&
        !e.includes('example') &&
        !e.includes('myrandf.com')
      );

      // Find mailto links
      const mailtoLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'))
        .map(a => a.href.replace('mailto:', '').split('?')[0]);

      // Find phones
      const phones = bodyText.match(phonePattern) || [];

      // Extract name from profile
      let profileName = null;
      const namePatterns = [
        /Brand Consultant:\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/,
        /MY PROFILE\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/
      ];
      for (const pattern of namePatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          profileName = match[1];
          break;
        }
      }

      // Check if profile has contact form or direct contact
      const hasContactForm = bodyText.includes('CONTACT ME') && bodyText.includes('Type your message');
      const hasEmail = allEmails.length > 0 || mailtoLinks.length > 0;

      return {
        emails: [...new Set([...allEmails, ...mailtoLinks])],
        phones: [...new Set(phones)].slice(0, 3),
        profileName,
        hasContactForm,
        hasEmail,
        pageUrl: window.location.href
      };
    });

    return {
      success: true,
      ...profileData
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function updateConsultant(cid, updateData) {
  await db.collection(COLLECTION).doc(cid).update({
    ...updateData,
    scraped: true,
    scrapedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function saveContact(consultant, profileData) {
  // Only save if we found an email
  if (!profileData.emails || profileData.emails.length === 0) {
    return false;
  }

  const email = profileData.emails[0]; // Use first email
  const docRef = db.collection(CONTACTS_COLLECTION).doc(consultant.cid);

  await docRef.set({
    cid: consultant.cid,
    firstName: consultant.firstName,
    lastName: consultant.lastName,
    fullName: `${consultant.firstName} ${consultant.lastName}`,
    email: email,
    phone: profileData.phones?.[0] || null,
    city: consultant.city,
    state: consultant.state,
    country: consultant.country || 'USA',
    company: 'Rodan + Fields',
    profileUrl: consultant.profileUrl,
    source: 'rodanfields_scraper',

    // Email campaign fields
    sent: false,
    status: 'pending',
    randomIndex: Math.random(),

    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return true;
}

async function scrapeConsultants(maxProfiles = 50) {
  console.log('Starting Rodan + Fields profile scraping...\n');

  // Get unscraped consultants
  const snapshot = await db.collection(COLLECTION)
    .where('scraped', '==', false)
    .limit(maxProfiles)
    .get();

  if (snapshot.empty) {
    console.log('No unscraped consultants found');
    return;
  }

  console.log(`Found ${snapshot.size} unscraped consultants\n`);

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

  let scraped = 0;
  let withEmail = 0;
  let errors = 0;

  try {
    for (const doc of snapshot.docs) {
      const consultant = doc.data();
      const cid = doc.id;

      console.log(`[${scraped + 1}/${snapshot.size}] ${consultant.firstName} ${consultant.lastName} (${consultant.city}, ${consultant.state})`);

      const result = await scrapeProfile(page, consultant);

      if (result.success) {
        // Update consultant record
        await updateConsultant(cid, {
          email: result.emails?.[0] || null,
          phone: result.phones?.[0] || null,
          hasEmail: result.hasEmail,
          hasContactForm: result.hasContactForm
        });

        // Save to contacts collection if has email
        if (result.emails && result.emails.length > 0) {
          const saved = await saveContact(consultant, result);
          if (saved) {
            withEmail++;
            console.log(`  ✓ Email found: ${result.emails[0]}`);
          }
        } else {
          console.log(`  ✗ No email (contact form only)`);
        }

        scraped++;
      } else {
        console.log(`  ✗ Error: ${result.error}`);
        await updateConsultant(cid, { scrapeError: result.error });
        errors++;
      }

      // Random delay between profiles
      await page.waitForTimeout(randomDelay(1500, 3000));
    }

  } catch (error) {
    console.error('Fatal error:', error.message);
  } finally {
    await browser.close();
  }

  console.log('\n=== Scraping Complete ===');
  console.log(`Profiles scraped: ${scraped}`);
  console.log(`With email: ${withEmail}`);
  console.log(`Errors: ${errors}`);
  console.log(`Email rate: ${((withEmail / scraped) * 100).toFixed(1)}%`);
}

async function showStats() {
  console.log('Rodan + Fields Scraper Stats\n');

  const consultants = db.collection(COLLECTION);
  const contacts = db.collection(CONTACTS_COLLECTION);

  const totalConsultants = await consultants.count().get();
  const scrapedCount = await consultants.where('scraped', '==', true).count().get();
  const unscrapedCount = await consultants.where('scraped', '==', false).count().get();
  const withEmailCount = await consultants.where('hasEmail', '==', true).count().get();

  const totalContacts = await contacts.count().get();
  const unsentContacts = await contacts.where('sent', '==', false).count().get();

  console.log('Consultants Collection:');
  console.log(`  Total: ${totalConsultants.data().count}`);
  console.log(`  Scraped: ${scrapedCount.data().count}`);
  console.log(`  Unscraped: ${unscrapedCount.data().count}`);
  console.log(`  With email: ${withEmailCount.data().count}`);

  console.log('\nContacts Collection (for email campaign):');
  console.log(`  Total: ${totalContacts.data().count}`);
  console.log(`  Unsent: ${unsentContacts.data().count}`);
}

async function testSingle(cid) {
  console.log(`Testing consultant ${cid}...\n`);

  const doc = await db.collection(COLLECTION).doc(cid).get();
  if (!doc.exists) {
    console.log('Consultant not found');
    return;
  }

  const consultant = doc.data();
  console.log('Consultant:', JSON.stringify(consultant, null, 2));

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

  try {
    const result = await scrapeProfile(page, consultant);
    console.log('\nScrape result:', JSON.stringify(result, null, 2));

    await page.screenshot({ path: '/tmp/rf-test-profile.png', fullPage: true });
    console.log('Screenshot saved to /tmp/rf-test-profile.png');
  } finally {
    await browser.close();
  }
}

// Main
const args = process.argv.slice(2);
if (args.includes('--scrape')) {
  const max = parseInt(args.find(a => a.startsWith('--max='))?.split('=')[1]) || 50;
  scrapeConsultants(max).then(() => process.exit(0));
} else if (args.includes('--stats')) {
  showStats().then(() => process.exit(0));
} else if (args.includes('--test')) {
  const cid = args.find(a => a.startsWith('--cid='))?.split('=')[1];
  if (cid) {
    testSingle(cid).then(() => process.exit(0));
  } else {
    console.log('Please provide --cid=<consultant_id>');
  }
} else {
  console.log(`
Rodan + Fields Contact Scraper

Usage:
  node rodanfields-scraper.js --scrape [--max=N]    Scrape profiles (default: 50)
  node rodanfields-scraper.js --stats               Show collection stats
  node rodanfields-scraper.js --test --cid=ID       Test single consultant
  `);
}
