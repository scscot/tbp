#!/usr/bin/env node

/**
 * Oklahoma Bar Attorney Scraper
 *
 * Scrapes attorney contact information from the Oklahoma Bar Association website.
 * Uses Puppeteer for ASP.NET WebForms interaction (ViewState, __doPostBack pagination).
 *
 * Usage:
 *   node scripts/scrape-okbar-attorneys.js [--practice-area=ID] [--max-attorneys=N] [--dry-run]
 *
 * Environment variables:
 *   FIREBASE_SERVICE_ACCOUNT - Firebase service account JSON
 *   PREINTAKE_SMTP_USER - SMTP username for notifications
 *   PREINTAKE_SMTP_PASS - SMTP password for notifications
 */

const puppeteer = require('puppeteer');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// ============================================================================
// Configuration
// ============================================================================

// The OK Bar uses WordPress with an embedded eWeb system
// The friendly URL loads a WordPress page that contains the search form
const BASE_URL = 'https://www.okbar.org/freelegalanswers/findalawyerinterim/';
const RESULTS_PER_PAGE = 30;
const MAX_ATTORNEYS = parseInt(process.env.MAX_ATTORNEYS) || 500;
const DELAY_BETWEEN_PAGES = 2000;
const DELAY_BETWEEN_PROFILES = 500;
const DRY_RUN = process.argv.includes('--dry-run');

// Practice areas with their GUID values from Oklahoma Bar dropdown
// Ordered by priority (PI, Immigration, Workers Comp first)
const PRACTICE_AREAS = [
  // Tier 1 - High Priority
  { id: '42bf5bee-4391-47d5-a345-c087d95218bb', name: 'Personal Injury' },
  { id: '9228489f-4de3-488c-b010-af15b24393c2', name: 'Immigration' },
  { id: 'e28b10db-031a-49d0-9f66-5c85ad83db06', name: 'Workers Compensation' },
  { id: '3d36c3fe-7452-4c9b-a57c-c8d716bb320e', name: 'Medical Malpractice' },
  { id: '03b5886f-5930-4880-86b4-d8edbd8f6193', name: 'Bankruptcy - Business' },
  { id: '7f535e77-313e-486c-a87e-857f045b20bf', name: 'Bankruptcy - Personal' },
  { id: 'ece86f4a-38e9-4c7a-baad-5105c5ed7ca1', name: 'Criminal Defense' },
  { id: 'fa60e988-d18f-454a-8b79-5d2a66c0d2d2', name: 'Family Law' },
  { id: 'f1ef4137-dff3-447c-ba42-6f087afd8c00', name: 'Divorce' },
  { id: 'beda2a47-a52d-4e83-84ec-80936083240a', name: 'Adoption' },
  // Tier 2 - Medium Priority
  { id: '43dce770-022f-4d19-85c0-2f3b19c80b52', name: 'Elder Law' },
  { id: '5549f3d8-2fe8-4433-ae2d-f8ec5f2a1724', name: 'Estate Planning and Probate' },
  { id: '996ecd05-85d7-4e59-97e0-d728a2416e35', name: 'Guardianship' },
  { id: '0891d24a-6373-4a4e-9559-c306ab08cc9c', name: 'Social Security' },
  { id: '40432bb1-383e-4d6f-bb4d-9fdd52e68c2d', name: 'Labor & Employment Law' },
  { id: '2e9b6750-2181-4fda-a3bf-4dba570dd64d', name: 'Employment Law' },
  { id: 'efc94c04-87b8-4525-867c-7425caa9e964', name: 'Landlord - Tenant Law' },
  { id: '1415c71c-7e76-4562-a9a7-497b61970e80', name: 'Foreclosure' },
  { id: '6a9d9fbc-013a-454b-8f0a-9a42fa585c61', name: 'Debt Defense' },
  { id: '6238f101-d96a-4cda-a19d-14e51bb3cf2b', name: 'Consumer Law' },
  // Tier 3 - Lower Priority
  { id: '0bb49620-d66b-4200-9963-b802376de650', name: 'Real Property (Land)' },
  { id: '7a74209d-8a6f-4611-a702-025c8adb6dc9', name: 'Business & Corporate Law' },
  { id: 'b670a33b-b3c8-46f4-b7bf-86348cc70a21', name: 'Insurance' },
  { id: '78e6464d-6d94-4c18-98a0-9dbe6c07dac1', name: 'Taxation' },
  { id: '2dabe61f-cedd-4eca-9bbd-0f7c4ef7027c', name: 'Civil Rights' },
  { id: '64ee9e73-3f5b-44c8-a8b3-e75e084d0fc8', name: "Veteran's Law" },
  { id: '3548eb74-ebcc-445f-bf95-eac1f3636132', name: 'Litigation' },
  { id: '43cfe3e1-62a3-4e5c-9dcd-d52f8d35e5f9', name: 'General Practice' },
];

// ============================================================================
// Firebase Initialization
// ============================================================================

function initFirebase() {
  if (admin.apps.length > 0) return admin.apps[0];

  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    credential = admin.credential.cert(serviceAccount);
  } else {
    credential = admin.credential.applicationDefault();
  }

  return admin.initializeApp({
    credential,
    databaseURL: 'https://teambuilder-plus-fe74d.firebaseio.com'
  });
}

// ============================================================================
// Email Notifications
// ============================================================================

async function sendNotificationEmail(subject, body) {
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would send email: ${subject}`);
    return;
  }

  const smtpUser = process.env.PREINTAKE_SMTP_USER;
  const smtpPass = process.env.PREINTAKE_SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.log('SMTP credentials not configured, skipping email notification');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.dreamhost.com',
    port: 587,
    secure: false,
    auth: { user: smtpUser, pass: smtpPass }
  });

  try {
    await transporter.sendMail({
      from: smtpUser,
      to: 'scscot@gmail.com',
      subject,
      html: body
    });
    console.log('Notification email sent');
  } catch (error) {
    console.error('Failed to send notification email:', error.message);
  }
}

// ============================================================================
// Progress Tracking
// ============================================================================

async function getProgress(db) {
  const doc = await db.collection('preintake_scrape_progress').doc('okbar').get();
  if (!doc.exists) {
    return {
      completedPracticeAreaIds: [],
      lastRunDate: null,
      totalInserted: 0,
      totalSkipped: 0
    };
  }
  return doc.data();
}

async function saveProgress(db, progress) {
  if (DRY_RUN) {
    console.log('[DRY RUN] Would save progress:', JSON.stringify(progress, null, 2));
    return;
  }
  await db.collection('preintake_scrape_progress').doc('okbar').set(progress, { merge: true });
}

// ============================================================================
// Existing Email Check (Deduplication)
// ============================================================================

async function getExistingEmails(db) {
  console.log('Loading existing emails for deduplication...');
  const snapshot = await db.collection('preintake_emails').select('email').get();
  const emails = new Set();
  snapshot.forEach(doc => {
    const email = doc.data().email;
    if (email) emails.add(email.toLowerCase());
  });
  console.log(`Loaded ${emails.size} existing emails`);
  return emails;
}

// ============================================================================
// Data Extraction Helpers
// ============================================================================

function extractAttorneyData(card) {
  // Attorney cards have structure:
  // <div class="span4 pad10">
  //   <div class="span8">
  //     <strong>Firm/Attorney Name</strong> <br/>
  //     <div>Address Line 1</div>
  //     <div>City, ST  ZIP</div>
  //     <div><a href="tel:(xxx)xxx-xxxx">(xxx)xxx-xxxx</a></div>
  //     <div><a href=mailto:email@example.com>email@example.com</a></div>
  //     <div class="website"><a href=http://example.com>...</a></div>
  //   </div>
  // </div>

  const data = {
    firmName: null,
    email: null,
    phone: null,
    website: null,
    address: null,
    city: null,
    state: 'OK'
  };

  // Extract firm/attorney name from <strong> tag
  const strongEl = card.querySelector('strong');
  if (strongEl) {
    data.firmName = strongEl.textContent.trim();
  }

  // Extract email from mailto link
  const emailLink = card.querySelector('a[href^="mailto:"]');
  if (emailLink) {
    const href = emailLink.getAttribute('href');
    const email = href.replace('mailto:', '').trim();
    if (email && email !== 'Unlisted' && !email.includes('Unlisted')) {
      data.email = email.toLowerCase();
    }
  }

  // Extract phone from tel link
  const phoneLink = card.querySelector('a[href^="tel:"]');
  if (phoneLink) {
    data.phone = phoneLink.textContent.trim();
  }

  // Extract website
  const websiteDiv = card.querySelector('.website a');
  if (websiteDiv) {
    data.website = websiteDiv.getAttribute('href');
  }

  // Extract address from divs (skip the ones with links)
  const span8 = card.querySelector('.span8');
  if (span8) {
    const divs = span8.querySelectorAll('div');
    const addressParts = [];
    for (const div of divs) {
      // Skip divs that contain links (phone, email, website)
      if (div.querySelector('a') || div.classList.contains('website')) continue;
      const text = div.textContent.trim();
      if (text && !text.includes('Unlisted')) {
        addressParts.push(text);
      }
    }
    if (addressParts.length > 0) {
      data.address = addressParts.join(', ');
      // Try to extract city from last address part (format: "City, ST  ZIP")
      const lastPart = addressParts[addressParts.length - 1];
      const cityMatch = lastPart.match(/^([^,]+),\s*([A-Z]{2})/);
      if (cityMatch) {
        data.city = cityMatch[1].trim();
        data.state = cityMatch[2];
      }
    }
  }

  return data;
}

// ============================================================================
// Main Scraper Logic
// ============================================================================

async function scrapePracticeArea(page, db, practiceArea, existingEmails, stats) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Scraping: ${practiceArea.name} (${practiceArea.id})`);
  console.log('='.repeat(60));

  // Navigate to search page
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 60000 });

  // Wait for page to fully load
  await new Promise(r => setTimeout(r, 3000));

  // The OK Bar uses a WordPress page that may contain an iframe with the eWeb form
  // Check if the dropdown exists on main page first
  let dropdownFound = await page.$('#C_2_2_ValueDropDownList0');

  if (!dropdownFound) {
    // Check for iframes that might contain the search form
    const frames = page.frames();
    console.log(`Main page doesn't have dropdown, checking ${frames.length} frames...`);

    for (const frame of frames) {
      try {
        const frameUrl = frame.url();
        if (frameUrl.includes('eweb') || frameUrl.includes('startpage')) {
          console.log(`Found eWeb frame: ${frameUrl}`);
          dropdownFound = await frame.$('#C_2_2_ValueDropDownList0');
          if (dropdownFound) {
            console.log('Dropdown found in iframe, switching context');
            // We need to work within this frame
            page = frame;
            break;
          }
        }
      } catch (e) {
        // Frame might be detached, skip it
      }
    }
  }

  // Wait for the practice area dropdown
  try {
    await page.waitForSelector('#C_2_2_ValueDropDownList0', { timeout: 30000 });
  } catch (err) {
    // Log the page URL and HTML snippet for debugging
    const currentUrl = page.url();
    const bodyHtml = await page.evaluate(() => document.body.innerHTML.substring(0, 2000));
    console.error(`Failed to find dropdown. Current URL: ${currentUrl}`);
    console.error(`Page HTML snippet: ${bodyHtml.substring(0, 500)}...`);

    // Also check for iframes
    const iframes = await page.$$('iframe');
    console.error(`Found ${iframes.length} iframes on page`);
    for (let i = 0; i < iframes.length; i++) {
      const src = await page.evaluate(el => el.src || el.getAttribute('src'), iframes[i]);
      console.error(`  iframe[${i}]: ${src}`);
    }
    throw err;
  }

  // Select practice area from dropdown
  await page.select('#C_2_2_ValueDropDownList0', practiceArea.id);
  await new Promise(r => setTimeout(r, 500));

  // Click search button
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
    page.click('#C_2_2_ButtonFindGo')
  ]);

  // Check for results
  const resultsContainer = await page.$('#search-results');
  if (!resultsContainer) {
    console.log('No results container found, skipping practice area');
    stats.all_profiles_scraped = true;
    return;
  }

  // Get total results count if available
  let totalPages = 1;
  const paginationLinks = await page.$$('.pagination a');
  if (paginationLinks.length > 0) {
    // Find highest page number
    for (const link of paginationLinks) {
      const text = await page.evaluate(el => el.textContent.trim(), link);
      const pageNum = parseInt(text);
      if (!isNaN(pageNum) && pageNum > totalPages) {
        totalPages = pageNum;
      }
    }
  }
  console.log(`Found approximately ${totalPages} page(s) of results`);

  let currentPage = 1;
  let totalScraped = 0;

  while (currentPage <= totalPages && stats.totalInserted < MAX_ATTORNEYS) {
    console.log(`\nProcessing page ${currentPage}/${totalPages}...`);

    // Extract attorney cards on current page
    const attorneys = await page.evaluate(() => {
      const cards = document.querySelectorAll('#search-results .span4.pad10');
      const results = [];

      cards.forEach(card => {
        const data = {
          firmName: null,
          email: null,
          phone: null,
          website: null,
          address: null,
          city: null,
          state: 'OK'
        };

        // Extract firm/attorney name from <strong> tag
        const strongEl = card.querySelector('strong');
        if (strongEl) {
          data.firmName = strongEl.textContent.trim();
        }

        // Extract email from mailto link
        const emailLink = card.querySelector('a[href^="mailto:"]');
        if (emailLink) {
          const href = emailLink.getAttribute('href');
          const email = href.replace('mailto:', '').trim();
          if (email && email !== 'Unlisted' && !email.includes('Unlisted')) {
            data.email = email.toLowerCase();
          }
        }

        // Extract phone from tel link
        const phoneLink = card.querySelector('a[href^="tel:"]');
        if (phoneLink) {
          data.phone = phoneLink.textContent.trim();
        }

        // Extract website
        const websiteDiv = card.querySelector('.website a');
        if (websiteDiv) {
          data.website = websiteDiv.getAttribute('href');
        }

        // Extract address from divs
        const span8 = card.querySelector('.span8');
        if (span8) {
          const divs = span8.querySelectorAll('div');
          const addressParts = [];
          for (const div of divs) {
            if (div.querySelector('a') || div.classList.contains('website')) continue;
            const text = div.textContent.trim();
            if (text && !text.includes('Unlisted')) {
              addressParts.push(text);
            }
          }
          if (addressParts.length > 0) {
            data.address = addressParts.join(', ');
            const lastPart = addressParts[addressParts.length - 1];
            const cityMatch = lastPart.match(/^([^,]+),\s*([A-Z]{2})/);
            if (cityMatch) {
              data.city = cityMatch[1].trim();
              data.state = cityMatch[2];
            }
          }
        }

        results.push(data);
      });

      return results;
    });

    console.log(`Found ${attorneys.length} attorneys on page ${currentPage}`);

    // Process each attorney
    for (const attorney of attorneys) {
      if (stats.totalInserted >= MAX_ATTORNEYS) {
        console.log(`Reached MAX_ATTORNEYS limit (${MAX_ATTORNEYS})`);
        break;
      }

      // Skip if no email
      if (!attorney.email) {
        stats.totalSkipped++;
        continue;
      }

      // Skip if email already exists
      if (existingEmails.has(attorney.email.toLowerCase())) {
        stats.totalSkipped++;
        continue;
      }

      // Add to database
      if (!DRY_RUN) {
        const docData = {
          email: attorney.email,
          firmName: attorney.firmName,
          phone: attorney.phone || null,
          website: attorney.website || null,
          address: attorney.address || null,
          city: attorney.city || null,
          state: attorney.state || 'OK',
          practiceArea: practiceArea.name,
          source: 'okbar',
          status: 'pending',
          sent: false,
          randomIndex: Math.random(),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('preintake_emails').add(docData);
        existingEmails.add(attorney.email.toLowerCase());
      }

      stats.totalInserted++;
      totalScraped++;

      if (stats.totalInserted % 50 === 0) {
        console.log(`Progress: ${stats.totalInserted} inserted, ${stats.totalSkipped} skipped`);
      }
    }

    // Check if there are more pages
    if (currentPage >= totalPages || stats.totalInserted >= MAX_ATTORNEYS) {
      break;
    }

    // Navigate to next page using __doPostBack
    currentPage++;
    console.log(`Navigating to page ${currentPage}...`);

    try {
      // Find the pagination control ID from the page
      const paginationId = await page.evaluate(() => {
        const paginationLinks = document.querySelectorAll('.pagination a');
        for (const link of paginationLinks) {
          const onclick = link.getAttribute('onclick') || '';
          const match = onclick.match(/__doPostBack\('([^']+)'/);
          if (match) return match[1];
        }
        return null;
      });

      if (paginationId) {
        // Oklahoma Bar uses 0-indexed page arguments: page 2 = '1', page 3 = '2', etc.
        const pageArgument = (currentPage - 1).toString();
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
          page.evaluate((id, pageArg) => {
            __doPostBack(id, pageArg);
          }, paginationId, pageArgument)
        ]);
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_PAGES));
      } else {
        console.log('Could not find pagination control, stopping');
        break;
      }
    } catch (error) {
      console.error(`Error navigating to page ${currentPage}:`, error.message);
      break;
    }
  }

  console.log(`\nCompleted ${practiceArea.name}: ${totalScraped} attorneys scraped`);

  // Check if we've scraped all pages
  if (currentPage >= totalPages || totalScraped === 0) {
    stats.all_profiles_scraped = true;
  }
}

async function main() {
  console.log('Oklahoma Bar Attorney Scraper');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Max attorneys: ${MAX_ATTORNEYS}`);

  // Parse command line arguments
  let targetPracticeAreaId = null;
  for (const arg of process.argv) {
    if (arg.startsWith('--practice-area=')) {
      targetPracticeAreaId = arg.split('=')[1];
    }
  }

  // Initialize Firebase
  initFirebase();
  const db = admin.firestore();
  db.settings({ databaseId: 'preintake' });

  // Load progress and existing emails
  const progress = await getProgress(db);
  console.log(`Previous progress: ${progress.totalInserted} inserted, ${progress.completedPracticeAreaIds?.length || 0} practice areas completed`);

  const existingEmails = await getExistingEmails(db);

  // Initialize stats
  const stats = {
    totalInserted: 0,
    totalSkipped: 0,
    practiceAreasCompleted: [],
    errors: []
  };

  // Determine which practice areas to scrape
  let practiceAreasToScrape = PRACTICE_AREAS;
  if (targetPracticeAreaId) {
    practiceAreasToScrape = PRACTICE_AREAS.filter(pa => pa.id === targetPracticeAreaId);
    if (practiceAreasToScrape.length === 0) {
      console.error(`Practice area not found: ${targetPracticeAreaId}`);
      process.exit(1);
    }
  } else {
    // Skip already completed practice areas
    const completed = new Set(progress.completedPracticeAreaIds || []);
    practiceAreasToScrape = PRACTICE_AREAS.filter(pa => !completed.has(pa.id));
  }

  console.log(`Practice areas to scrape: ${practiceAreasToScrape.length}`);

  if (practiceAreasToScrape.length === 0) {
    console.log('All practice areas already completed!');
    return;
  }

  // Launch browser
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 800 });

  try {
    for (const practiceArea of practiceAreasToScrape) {
      if (stats.totalInserted >= MAX_ATTORNEYS) {
        console.log(`\nReached MAX_ATTORNEYS limit (${MAX_ATTORNEYS}), stopping`);
        break;
      }

      const paStats = { totalInserted: 0, totalSkipped: 0, all_profiles_scraped: false };

      try {
        await scrapePracticeArea(page, db, practiceArea, existingEmails, paStats);

        stats.totalInserted += paStats.totalInserted;
        stats.totalSkipped += paStats.totalSkipped;

        if (paStats.all_profiles_scraped) {
          stats.practiceAreasCompleted.push(practiceArea.id);

          // Update progress
          if (!DRY_RUN) {
            const updatedCompleted = [...(progress.completedPracticeAreaIds || []), practiceArea.id];
            await saveProgress(db, {
              completedPracticeAreaIds: updatedCompleted,
              lastRunDate: new Date().toISOString(),
              totalInserted: (progress.totalInserted || 0) + stats.totalInserted,
              totalSkipped: (progress.totalSkipped || 0) + stats.totalSkipped
            });
          }
        }

      } catch (error) {
        console.error(`Error scraping ${practiceArea.name}:`, error.message);
        stats.errors.push({ practiceArea: practiceArea.name, error: error.message });
      }

      // Brief pause between practice areas
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_PAGES));
    }

  } finally {
    await browser.close();
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('SCRAPE COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total inserted: ${stats.totalInserted}`);
  console.log(`Total skipped: ${stats.totalSkipped}`);
  console.log(`Practice areas completed: ${stats.practiceAreasCompleted.length}`);
  if (stats.errors.length > 0) {
    console.log(`Errors: ${stats.errors.length}`);
    stats.errors.forEach(e => console.log(`  - ${e.practiceArea}: ${e.error}`));
  }

  // Send notification email
  const emailBody = `
    <h2>Oklahoma Bar Scraper Complete</h2>
    <p><strong>Mode:</strong> ${DRY_RUN ? 'DRY RUN' : 'LIVE'}</p>
    <p><strong>Total Inserted:</strong> ${stats.totalInserted}</p>
    <p><strong>Total Skipped:</strong> ${stats.totalSkipped}</p>
    <p><strong>Practice Areas Completed:</strong> ${stats.practiceAreasCompleted.length}</p>
    ${stats.errors.length > 0 ? `<p><strong>Errors:</strong></p><ul>${stats.errors.map(e => `<li>${e.practiceArea}: ${e.error}</li>`).join('')}</ul>` : ''}
  `;
  await sendNotificationEmail('Oklahoma Bar Scraper Complete', emailBody);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
